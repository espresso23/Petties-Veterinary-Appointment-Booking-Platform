"""Booking AI tools cho Pet Owner business chat."""

from __future__ import annotations

import re
import json
from functools import wraps
from datetime import date as date_cls, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from loguru import logger

from app.core.agents.booking_context import (
    parse_conditional_intent,
    resolve_booking_datetime_inputs as _shared_resolve_booking_datetime_inputs,
)
from app.core.agents.text_utils import normalize_vietnamese_text
from app.core.tool_runtime_context import (
    require_tool_runtime_context,
    get_booking_context_cache,
)
from app.core.tools.contracts import (
    build_tool_success_response,
    build_tool_error_response,
    classify_error_code,
    get_error_title,
)
from app.core.tools.mcp_server import mcp_server
from app.services.backend_client import BackendClientError, get_backend_client


def _normalize_booking_type(
    booking_type: Optional[str],
    home_address: Optional[str] = None,
    home_lat: Optional[float] = None,
    home_long: Optional[float] = None,
) -> str:
    normalized = (booking_type or "").strip().upper()
    if normalized in {"IN_CLINIC", "HOME_VISIT", "SOS"}:
        return normalized

    if home_address or home_lat is not None or home_long is not None:
        return "HOME_VISIT"

    return "IN_CLINIC"


def _normalize_pet_species_enum(pet_species: Optional[str]) -> Optional[str]:
    text = str(pet_species or "").strip()
    if not text:
        return None

    normalized = normalize_vietnamese_text(text)
    if normalized in {"dog", "cho", "cho ta", "cho canh"}:
        return "DOG"
    if normalized in {"cat", "meo", "meo ta", "meo canh"}:
        return "CAT"
    if normalized in {"bird", "chim"}:
        return "BIRD"
    if normalized in {"rabbit", "tho"}:
        return "RABBIT"
    if normalized in {"hamster", "chuot hamster"}:
        return "HAMSTER"
    if normalized in {"fish", "ca"}:
        return "FISH"
    if normalized in {"other", "khac"}:
        return "OTHER"

    upper_text = text.upper()
    allowed = {"DOG", "CAT", "BIRD", "RABBIT", "HAMSTER", "FISH", "OTHER"}
    return upper_text if upper_text in allowed else text


def _has_meaningful_service_signal(
    service_ids: List[str],
    service_hint: Optional[str],
    latest_message: Optional[str],
    transcript: Optional[str],
) -> bool:
    if service_ids:
        return True

    if str(service_hint or "").strip():
        return True

    combined_text = normalize_vietnamese_text(
        " ".join(
            part.strip()
            for part in [str(latest_message or ""), str(transcript or "")]
            if str(part or "").strip()
        )
    )
    if not combined_text:
        return False

    service_keywords = {
        "kham",
        "kham tong quat",
        "tiem",
        "tiem phong",
        "vac xin",
        "vaccine",
        "xet nghiem",
        "sieu am",
        "triet san",
        "phau thuat",
        "spa",
        "grooming",
        "cat tia",
        "tam",
        "dich vu",
    }
    return any(keyword in combined_text for keyword in service_keywords)


def _infer_clinic_suggestion_mode(
    latest_message: Optional[str],
    transcript: Optional[str],
) -> str:
    combined_text = normalize_vietnamese_text(
        " ".join(
            part.strip()
            for part in [str(latest_message or ""), str(transcript or "")]
            if str(part or "").strip()
        )
    )
    if not combined_text:
        return "booking"

    discovery_keywords = {
        "tim hieu",
        "tham khao",
        "so sanh",
        "gia",
        "chi phi",
        "bao gia",
        "danh gia",
        "review",
        "thong tin phong kham",
    }
    booking_keywords = {
        "dat lich",
        "booking",
        "tao yeu cau",
        "xac nhan",
        "chon khung gio",
        "slot",
        "tao lich",
    }

    has_discovery_signal = any(
        keyword in combined_text for keyword in discovery_keywords
    )
    has_booking_signal = any(keyword in combined_text for keyword in booking_keywords)

    if has_discovery_signal and not has_booking_signal:
        return "discovery"

    return "booking"


def _is_create_booking_denied_by_user(
    latest_message: Optional[str], transcript: Optional[str]
) -> bool:
    combined_text = normalize_vietnamese_text(
        " ".join(
            part.strip()
            for part in [str(latest_message or ""), str(transcript or "")]
            if str(part or "").strip()
        )
    )
    if not combined_text:
        return False

    explicit_deny_patterns = [
        "khong dat lich",
        "khong dat nua",
        "khong tao booking",
        "khong tao yeu cau booking",
        "khong xac nhan booking",
        "khong xac nhan dat lich",
        "dung tao booking",
        "dung dat lich",
        "thoi khong dat",
        "huy dat lich",
        "huy booking",
    ]
    if any(pattern in combined_text for pattern in explicit_deny_patterns):
        return True

    negation_tokens = {"khong", "dung", "thoi", "huy", "cancel"}
    booking_tokens = {
        "booking",
        "dat lich",
        "tao yeu cau",
        "tao lich",
        "xac nhan",
    }
    has_negation = any(token in combined_text for token in negation_tokens)
    has_booking_action = any(token in combined_text for token in booking_tokens)
    return has_negation and has_booking_action


from app.core.tools.auth_deps import (
    AuthenticationRequiredError,
    _require_auth_token,
)


def _booking_retry_error(
    message: str, *, error_code: str = "INTERNAL_ERROR"
) -> Dict[str, Any]:
    return build_tool_error_response(
        error_code=error_code,
        message=message,
        recoverable=True,
        suggestion="Vui lòng kiểm tra lại dữ liệu đặt lịch hoặc thử lại sau ít phút.",
    )


def _attach_booking_error_metadata(
    payload: Dict[str, Any],
    *,
    error_code: str,
    suggestion: Optional[str] = None,
    recoverable: Optional[bool] = None,
) -> Dict[str, Any]:
    enriched = dict(payload)
    if not str(error_code or "").strip():
        return enriched
    enriched["error_code"] = error_code
    enriched.setdefault("title", get_error_title(error_code))
    if suggestion is not None:
        enriched.setdefault("suggestion", suggestion)
    if recoverable is not None:
        enriched.setdefault("recoverable", recoverable)
    return enriched


def _normalize_booking_tool_payload(payload: Any) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return {
            "success": True,
            "data": payload,
            "metadata": {},
        }

    normalized = dict(payload)
    message = str(normalized.get("message") or "").strip()
    has_error_signal = bool(str(normalized.get("error_code") or "").strip()) or bool(
        normalized.get("requires_auth")
    )

    if normalized.get("success") is None and has_error_signal:
        needs_clarification = bool(normalized.get("needs_clarification"))
        error_code = str(normalized.get("error_code") or "").strip().upper()
        non_fatal_codes = {
            "SERVICE_NOT_FOUND",
            "NO_SLOTS_AVAILABLE",
            "INVALID_DATE",
            "CLINIC_NOT_FOUND",
        }
        normalized["success"] = needs_clarification or error_code in non_fatal_codes

    # CRITICAL: If there are actual data fields (pets, clinics, services, etc.)
    # → Never mark as error, regardless of message content
    has_data_fields = any(
        [
            normalized.get("pets"),
            normalized.get("total_pets", 0) > 0,
            normalized.get("clinics"),
            normalized.get("total_found", 0) > 0,
            normalized.get("services"),
            normalized.get("slots"),
            normalized.get("total_slots", 0) > 0,
        ]
    )
    if (
        has_data_fields
        and not has_error_signal
        and normalized.get("success") is not False
    ):
        normalized["success"] = True

    if normalized.get("success") is True:
        return normalized

    needs_clarification = bool(normalized.get("needs_clarification"))
    is_auth_error = bool(normalized.get("requires_auth"))

    if normalized.get("success") is False or is_auth_error:
        normalized["success"] = False
        if not normalized.get("error_code"):
            if is_auth_error:
                normalized["error_code"] = "UNAUTHORIZED"
            elif needs_clarification:
                normalized["error_code"] = "INVALID_INPUT"
            else:
                normalized["error_code"] = classify_error_code(message)
        normalized["recoverable"] = bool(normalized.get("recoverable", True))
        if "suggestion" not in normalized:
            if is_auth_error:
                normalized["suggestion"] = "Vui lòng đăng nhập lại để tiếp tục."
            elif needs_clarification:
                normalized["suggestion"] = "Vui lòng cung cấp thêm thông tin còn thiếu."
            else:
                normalized["suggestion"] = (
                    "Vui lòng kiểm tra lại dữ liệu hoặc thử lại sau ít phút."
                )
        if not message:
            normalized["message"] = "Không thể xử lý yêu cầu đặt lịch lúc này."
        return normalized

    # No explicit success field: infer from payload intent.
    if message:
        lowered = normalize_vietnamese_text(message)
        likely_error = any(
            token in lowered
            for token in [
                "khong the",
                "khong tim thay",
                "khong hop le",
                "loi",
            ]
        )
        if likely_error and not needs_clarification:
            normalized["success"] = False
            normalized["error_code"] = normalized.get(
                "error_code"
            ) or classify_error_code(message)
            normalized["recoverable"] = bool(normalized.get("recoverable", True))
            normalized.setdefault(
                "suggestion",
                "Vui lòng kiểm tra lại dữ liệu hoặc thử lại sau ít phút.",
            )
            return normalized

    normalized["success"] = True
    return normalized


def _standardize_booking_tool_response(func):
    @wraps(func)
    async def _wrapper(*args, **kwargs):
        payload = await func(*args, **kwargs)
        return _normalize_booking_tool_payload(payload)

    return _wrapper


def _build_booking_confirmation_snapshot(
    *,
    pet_id: Optional[str],
    clinic_id: Optional[str],
    clinic_name: Optional[str],
    booking_date: Optional[str],
    start_time: Optional[str],
    service_ids: Optional[List[str]],
    booking_type: Optional[str],
    notes: Optional[str],
    home_address: Optional[str],
    distance_km: Optional[float],
    items: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    snapshot = {
        "pet_id": str(pet_id or "").strip() or None,
        "clinic_id": str(clinic_id or "").strip() or None,
        "clinic_name": str(clinic_name or "").strip() or None,
        "booking_date": str(booking_date or "").strip() or None,
        "start_time": str(start_time or "").strip() or None,
        "service_ids": [
            str(service_id).strip()
            for service_id in (service_ids or [])
            if str(service_id).strip()
        ],
        "booking_type": str(booking_type or "").strip() or None,
        "notes": str(notes or "").strip() or None,
        "home_address": str(home_address or "").strip() or None,
        "distance_km": float(distance_km) if distance_km is not None else None,
        "items": [
            {
                "pet_id": str(item.get("pet_id") or "").strip() or None,
                "service_ids": [
                    str(service_id).strip()
                    for service_id in (item.get("service_ids") or [])
                    if str(service_id).strip()
                ],
            }
            for item in (items or [])
            if isinstance(item, dict)
        ],
    }
    return snapshot


def _evaluate_booking_confirmation_guard(
    *,
    confirmation_snapshot: Dict[str, Any],
    confirmed: bool,
    auto_create_if_available: bool,
    latest_message: Optional[str],
    transcript: Optional[str],
) -> Optional[Dict[str, Any]]:
    conditional = None
    if auto_create_if_available:
        conditional = parse_conditional_intent(latest_message or "", transcript)
        if not conditional or conditional.get("action") != "create_booking":
            return build_tool_error_response(
                error_code="INVALID_CONFIRMATION",
                message="Yêu cầu tự tạo booking chỉ hợp lệ khi người dùng xác nhận theo điều kiện rõ ràng.",
                recoverable=True,
                suggestion="Vui lòng xác nhận rõ ràng lại trước khi tạo booking.",
            )

    if not confirmed and not auto_create_if_available:
        return None

    return None


# Refactored: authentication helpers moved to app.core.tools.auth_deps


def _resolve_user_id(requested_user_id: Optional[str]) -> str:
    context = require_tool_runtime_context()
    runtime_user_id = str(context.user_id).strip()
    input_user_id = str(requested_user_id or "").strip()

    if input_user_id and input_user_id != runtime_user_id:
        logger.warning(
            "Tu choi user_id tu tool input vi khong khop session: "
            f"input={input_user_id}, runtime={runtime_user_id}"
        )
        raise RuntimeError("User ID khong khop voi session hien tai")

    return runtime_user_id


def _calculate_age_years(date_of_birth: Optional[str]) -> Optional[int]:
    if not date_of_birth:
        return None
    try:
        birth_date = datetime.fromisoformat(date_of_birth).date()
    except ValueError:
        try:
            birth_date = date_cls.fromisoformat(date_of_birth)
        except ValueError:
            return None
    today = date_cls.today()
    return (
        today.year
        - birth_date.year
        - ((today.month, today.day) < (birth_date.month, birth_date.day))
    )


def _format_operating_hours(raw_hours: Any) -> str:
    if not isinstance(raw_hours, dict) or not raw_hours:
        return "Chua cap nhat"

    formatted_parts = []
    for day, value in raw_hours.items():
        if not isinstance(value, dict):
            continue
        open_time = value.get("openTime") or value.get("open_time")
        close_time = value.get("closeTime") or value.get("close_time")
        if open_time and close_time:
            formatted_parts.append(f"{day}: {open_time}-{close_time}")
    return "; ".join(formatted_parts[:3]) if formatted_parts else "Chua cap nhat"


def _safe_date_label(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)).date().isoformat()
    except ValueError:
        try:
            return date_cls.fromisoformat(str(value)).isoformat()
        except ValueError:
            return str(value)


def _resolve_booking_datetime_inputs(
    *,
    date: Optional[str] = None,
    date_expression: Optional[str] = None,
    exact_time: Optional[str] = None,
    time_preference: Optional[str] = None,
    latest_message: Optional[str] = None,
    transcript: Optional[str] = None,
) -> Dict[str, Optional[str]]:
    return _shared_resolve_booking_datetime_inputs(
        date=date,
        date_expression=date_expression,
        exact_time=exact_time,
        time_preference=time_preference,
        latest_message=latest_message,
        transcript=transcript,
    )


def _parse_slot_start_time(raw_slot: Any) -> Optional[time]:
    candidate = None
    if isinstance(raw_slot, str):
        candidate = raw_slot.strip()
    elif isinstance(raw_slot, dict):
        for key in ("start_time", "startTime", "time", "slot", "availableTime"):
            value = raw_slot.get(key)
            if value is not None and str(value).strip():
                candidate = str(value).strip()
                break
    elif raw_slot is not None:
        candidate = str(raw_slot).strip()

    if not candidate:
        return None
    if "T" in candidate:
        try:
            return datetime.fromisoformat(candidate.replace("Z", "+00:00")).time()
        except ValueError:
            pass
    try:
        return time.fromisoformat(candidate[:5] if len(candidate) >= 5 else candidate)
    except ValueError:
        logger.warning(f"Unable to parse slot start time: {candidate}")
        return None


def _slot_matches_time_preference(
    slot_time: time, *, exact_time: Optional[str], time_preference: Optional[str]
) -> bool:
    if exact_time:
        parsed_exact = _parse_slot_start_time(exact_time)
        return bool(
            parsed_exact
            and parsed_exact.strftime("%H:%M") == slot_time.strftime("%H:%M")
        )

    normalized = normalize_vietnamese_text(time_preference or "")
    if not normalized:
        return True
    hour = slot_time.hour
    if "sang" in normalized:
        return 5 <= hour < 12
    if "chieu" in normalized:
        return 12 <= hour < 18
    if "toi" in normalized:
        return 18 <= hour < 23
    return True


_MATCH_STOPWORDS = {
    "toi",
    "muon",
    "dat",
    "lich",
    "cho",
    "be",
    "tai",
    "phong",
    "kham",
    "o",
    "gan",
    "ngay",
    "sang",
    "chieu",
    "toi",
    "nay",
    "giup",
    "minh",
    "nhe",
    "voi",
    "can",
    "duoc",
    "luon",
}
_UUID_PATTERN = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
)
_SYNTHETIC_ID_PATTERN = re.compile(r"^[a-z]+-\d+$")

_SERVICE_HINT_SYNONYMS: Dict[str, List[str]] = {
    "tam": ["grooming", "bath", "bathing", "spa"],
    "grooming": ["tam", "cat tia", "spa"],
    "cat": ["cat tia", "grooming", "trim"],
    "tia": ["cat tia", "trim", "grooming"],
    "tiem": ["vaccination", "vaccine", "vac xin"],
    "vac": ["vaccine", "vaccination", "tiem"],
    "vaccine": ["vac xin", "tiem", "tiem phong"],
    "kham": ["consult", "checkup", "general"],
    "xet": ["test", "lab", "xet nghiem"],
}

_PET_TYPE_LABELS: Dict[str, str] = {
    "DOG": "Chó",
    "CAT": "Mèo",
}


def _expand_service_hint_tokens(tokens: List[str]) -> List[str]:
    expanded: List[str] = []
    seen = set()

    for token in tokens:
        normalized = normalize_vietnamese_text(token)
        if not normalized:
            continue
        if normalized not in seen:
            seen.add(normalized)
            expanded.append(normalized)

        for alias in _SERVICE_HINT_SYNONYMS.get(normalized, []):
            alias_normalized = normalize_vietnamese_text(alias)
            if alias_normalized and alias_normalized not in seen:
                seen.add(alias_normalized)
                expanded.append(alias_normalized)

    return expanded


def _tokenize_match_text(*texts: Optional[str]) -> List[str]:
    normalized = normalize_vietnamese_text(" ".join(text for text in texts if text))
    tokens = re.findall(r"[a-z0-9]+", normalized)
    return [
        token for token in tokens if len(token) > 1 and token not in _MATCH_STOPWORDS
    ]


def _pet_type_display_label(pet_type: Optional[str]) -> str:
    normalized = normalize_vietnamese_text(str(pet_type or ""))
    if not normalized:
        return ""
    if "dog" in normalized or "cho" in normalized:
        return _PET_TYPE_LABELS["DOG"]
    if "cat" in normalized or "meo" in normalized:
        return _PET_TYPE_LABELS["CAT"]
    return ""


def _service_name_has_pet_context(service_name: str, pet_type: Optional[str]) -> bool:
    normalized_name = normalize_vietnamese_text(service_name)
    normalized_pet_type = normalize_vietnamese_text(str(pet_type or ""))
    if not normalized_name or not normalized_pet_type:
        return False
    if "dog" in normalized_pet_type or "cho" in normalized_pet_type:
        return "cho" in normalized_name or "dog" in normalized_name
    if "cat" in normalized_pet_type or "meo" in normalized_pet_type:
        return "meo" in normalized_name or "cat" in normalized_name
    return False


def _format_service_display_name(
    service_name: Optional[str], pet_type: Optional[str]
) -> str:
    name = str(service_name or "").strip()
    if not name:
        return ""
    if _service_name_has_pet_context(name, pet_type):
        return name
    pet_label = _pet_type_display_label(pet_type)
    if not pet_label:
        return name
    return f"{name} ({pet_label})"


def _service_matches_preferred_pet_species(
    service: Dict[str, Any], preferred_pet_species: Optional[str]
) -> bool:
    expected = normalize_vietnamese_text(preferred_pet_species or "")
    if not expected:
        return True
    raw_pet_type = str(service.get("pet_type") or "")
    normalized_pet_type = normalize_vietnamese_text(raw_pet_type)
    if not normalized_pet_type:
        return True
    if "dog" in expected:
        return "dog" in normalized_pet_type or "cho" in normalized_pet_type
    if "cat" in expected:
        return "cat" in normalized_pet_type or "meo" in normalized_pet_type
    return expected in normalized_pet_type


def _extract_canonical_service_ids(services: List[Dict[str, Any]]) -> List[str]:
    return [
        str(service.get("id") or "").strip()
        for service in services
        if str(service.get("id") or "").strip()
    ]


def _extract_canonical_service_names(services: List[Dict[str, Any]]) -> List[str]:
    names: List[str] = []
    for service in services:
        candidate = str(
            service.get("display_name")
            or service.get("canonical_name")
            or service.get("name")
            or ""
        ).strip()
        if candidate:
            names.append(candidate)
    return names


def _filter_clinics_by_hint(
    clinics: List[Dict[str, Any]],
    clinic_hint: Optional[str],
) -> List[Dict[str, Any]]:
    def _compact_text(value: str) -> str:
        return re.sub(r"\s+", "", normalize_vietnamese_text(value))

    normalized_hint = normalize_vietnamese_text(clinic_hint or "")
    if not normalized_hint:
        return clinics
    compact_hint = _compact_text(normalized_hint)

    hint_tokens = [
        token
        for token in re.findall(r"[a-z0-9]+", normalized_hint)
        if len(token) > 1 and token not in _MATCH_STOPWORDS
    ]
    if not hint_tokens:
        return clinics

    matched: List[Dict[str, Any]] = []
    for clinic in clinics:
        haystack = normalize_vietnamese_text(
            " ".join(
                str(clinic.get(key) or "")
                for key in ("name", "address", "reason_matched", "match_mode")
            )
        )
        compact_haystack = _compact_text(haystack)
        if all(token in haystack for token in hint_tokens) or (
            compact_hint and compact_hint in compact_haystack
        ):
            matched.append(clinic)

    if not matched and len(hint_tokens) == 1:
        token = hint_tokens[0]
        for clinic in clinics:
            haystack = normalize_vietnamese_text(
                " ".join(
                    str(clinic.get(key) or "")
                    for key in ("name", "address", "reason_matched", "match_mode")
                )
            )
            compact_haystack = _compact_text(haystack)
            if (
                token in haystack
                or haystack in token
                or token in compact_haystack
                or compact_haystack in token
                or compact_hint in compact_haystack
            ):
                matched.append(clinic)

    if not matched and len(hint_tokens) >= 2:
        for clinic in clinics:
            haystack = normalize_vietnamese_text(
                " ".join(
                    str(clinic.get(key) or "")
                    for key in ("name", "address", "reason_matched", "match_mode")
                )
            )
            compact_haystack = _compact_text(haystack)
            match_count = sum(1 for token in hint_tokens if token in haystack)
            if match_count >= len(hint_tokens) - 1 or (
                compact_hint and compact_hint in compact_haystack
            ):
                matched.append(clinic)

    return matched


def _looks_like_uuid(value: Optional[str]) -> bool:
    return bool(value and _UUID_PATTERN.fullmatch(str(value).strip()))


def _looks_like_internal_identifier(value: Optional[str]) -> bool:
    normalized = str(value or "").strip().lower()
    if not normalized:
        return False
    return _looks_like_uuid(normalized) or bool(
        _SYNTHETIC_ID_PATTERN.fullmatch(normalized)
    )


def _extract_primary_image_url(raw_clinic: Dict[str, Any]) -> Optional[str]:
    direct_fields = (
        raw_clinic.get("primaryImageUrl"),
        raw_clinic.get("primary_image_url"),
        raw_clinic.get("imageUrl"),
        raw_clinic.get("image_url"),
        raw_clinic.get("logo"),
        raw_clinic.get("logoUrl"),
        raw_clinic.get("logo_url"),
    )
    for candidate in direct_fields:
        text = str(candidate or "").strip()
        if text:
            return text

    image_details = (
        raw_clinic.get("imageDetails") or raw_clinic.get("image_details") or []
    )
    if isinstance(image_details, list):
        primary_detail = None
        for detail in image_details:
            if not isinstance(detail, dict):
                continue
            if detail.get("isPrimary") or detail.get("is_primary"):
                primary_detail = detail
                break
        if primary_detail is None and image_details:
            first_detail = image_details[0]
            primary_detail = first_detail if isinstance(first_detail, dict) else None
        if isinstance(primary_detail, dict):
            url = str(
                primary_detail.get("imageUrl") or primary_detail.get("image_url") or ""
            ).strip()
            if url:
                return url

    images = raw_clinic.get("images") or []
    if isinstance(images, list):
        for image in images:
            text = str(image or "").strip()
            if text:
                return text
    return None


def _map_backend_clinic_option(
    raw_clinic: Dict[str, Any],
    *,
    default_match_mode: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if not isinstance(raw_clinic, dict):
        return None

    canonical_clinic_id = raw_clinic.get("clinicId") or raw_clinic.get("id")
    name = raw_clinic.get("clinicName") or raw_clinic.get("name")
    if not canonical_clinic_id and not name:
        return None

    matched_services = []
    for service in (
        raw_clinic.get("matchedServices") or raw_clinic.get("matched_services") or []
    ):
        if not isinstance(service, dict):
            continue
        category = service.get("category")
        pet_type = service.get("petType") or service.get("pet_type")
        canonical_name = service.get("name")
        display_name = _format_service_display_name(canonical_name, pet_type)
        matched_services.append(
            {
                "id": service.get("serviceId") or service.get("id"),
                "name": display_name or canonical_name,
                "canonical_name": canonical_name,
                "display_name": display_name or canonical_name,
                "category": category,
                "base_price": service.get("basePrice") or service.get("base_price"),
                "description": service.get("description"),
                "pet_type": pet_type,
                "is_vaccination": str(category or "").strip().upper() == "VACCINATION",
            }
        )

    return {
        "id": canonical_clinic_id,
        "clinic_id": canonical_clinic_id,
        "name": name,
        "address": raw_clinic.get("address"),
        "distance_km": raw_clinic.get("distanceKm") or raw_clinic.get("distance"),
        "rating": raw_clinic.get("ratingAvg") or raw_clinic.get("rating"),
        "total_reviews": raw_clinic.get("ratingCount")
        or raw_clinic.get("totalReviews"),
        "has_sos": raw_clinic.get("hasSos")
        if raw_clinic.get("hasSos") is not None
        else raw_clinic.get("sosFee") is not None,
        "operating_hours": _format_operating_hours(
            raw_clinic.get("operatingHours") or raw_clinic.get("operating_hours")
        ),
        "match_mode": raw_clinic.get("matchMode")
        or raw_clinic.get("match_mode")
        or default_match_mode,
        "services": matched_services,
        "estimated_price_from": raw_clinic.get("estimatedPriceFrom")
        or raw_clinic.get("estimated_price_from"),
        "supports_home_visit": raw_clinic.get("supportsHomeVisit")
        if raw_clinic.get("supportsHomeVisit") is not None
        else raw_clinic.get("supports_home_visit"),
        "reason_matched": raw_clinic.get("reasonMatched")
        or raw_clinic.get("reason_matched"),
        "logo_url": str(
            raw_clinic.get("logo")
            or raw_clinic.get("logoUrl")
            or raw_clinic.get("logo_url")
            or ""
        ).strip()
        or None,
        "image_url": _extract_primary_image_url(raw_clinic),
    }


def _select_resolved_clinic(
    clinics: List[Dict[str, Any]],
    clinic_hint: Optional[str],
) -> Optional[Dict[str, Any]]:
    if not clinics:
        return None

    normalized_hint = normalize_vietnamese_text(clinic_hint or "")
    if normalized_hint:
        exact_name_matches = [
            clinic
            for clinic in clinics
            if normalize_vietnamese_text(str(clinic.get("name") or ""))
            == normalized_hint
        ]
        if len(exact_name_matches) == 1:
            return exact_name_matches[0]

        filtered_matches = _filter_clinics_by_hint(clinics, clinic_hint)
        if len(filtered_matches) == 1:
            return filtered_matches[0]

    # If multiple clinics match or no hint provided, pick the best rated one
    if len(clinics) > 1:
        # Sort by rating (desc), then by total_reviews (desc)
        sorted_clinics = sorted(
            clinics,
            key=lambda c: (float(c.get("rating") or 0.0), int(c.get("total_reviews") or 0)),
            reverse=True,
        )
        return sorted_clinics[0]

    return clinics[0] if len(clinics) == 1 else None


async def _resolve_clinic_reference(
    *,
    clinic_ref: Optional[str],
    token: Optional[str],
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    address: Optional[str] = None,
    pet_id: Optional[str] = None,
    pet_species: Optional[str] = None,
    booking_type: Optional[str] = None,
    service_hint: Optional[str] = None,
    transcript: Optional[str] = None,
    latest_message: Optional[str] = None,
) -> Dict[str, Any]:
    normalized_ref = str(clinic_ref or "").strip()
    if not normalized_ref:
        return {
            "clinic_id": None,
            "clinic_hint": None,
            "clinic": None,
            "clinics": [],
            "needs_clarification": True,
            "message": "Minh chua xac dinh duoc phong kham can dat lich.",
        }

    if _looks_like_internal_identifier(normalized_ref) or not token:
        return {
            "clinic_id": normalized_ref,
            "clinic_hint": None,
            "clinic": None,
            "clinics": [],
            "needs_clarification": False,
            "auto_selected": False,
        }

    cache = get_booking_context_cache()
    cached = cache.get_clinic_resolution(normalized_ref)
    if cached:
        logger.info(f"Using cached clinic resolution for hint: {normalized_ref}")
        return {
            "clinic_id": cached.resolved_clinic_id,
            "clinic_hint": normalized_ref,
            "clinic": cached.resolved_clinic,
            "clinics": cached.clinic_options,
            "needs_clarification": cached.resolved_clinic is None,
            "auto_selected": cached.resolved_clinic is not None,
        }

    client = get_backend_client()
    context_snapshot = await _resolve_backend_booking_context(
        token=token,
        latitude=latitude,
        longitude=longitude,
        address=address,
        pet_id=pet_id,
        clinic_hint=normalized_ref,
        service_hint=service_hint,
        pet_species=pet_species,
        booking_type=booking_type,
        transcript=transcript,
        latest_message=latest_message,
    )
    resolved_location = context_snapshot.get("resolvedLocation") or {}
    resolved_pet = context_snapshot.get("resolvedPet") or {}
    normalized_pet_species = _normalize_pet_species_enum(
        pet_species or resolved_pet.get("species")
    )

    payload = {
        "latitude": latitude
        if latitude is not None
        else resolved_location.get("latitude"),
        "longitude": longitude
        if longitude is not None
        else resolved_location.get("longitude"),
        "address": address or resolved_location.get("address"),
        "clinicHint": normalized_ref,
        "serviceHint": service_hint or context_snapshot.get("resolvedServiceHint"),
        "petId": pet_id or resolved_pet.get("petId"),
        "petSpecies": normalized_pet_species,
        "bookingType": booking_type or context_snapshot.get("resolvedBookingType"),
        "transcript": transcript,
        "latestMessage": latest_message,
        "topK": 5,
    }

    try:
        response = await client.get_booking_clinic_options(
            token,
            {
                key: value
                for key, value in payload.items()
                if value is not None and str(value).strip() != ""
            },
        )
    except BackendClientError as exc:
        logger.warning(
            f"resolve clinic reference failed for clinic_ref={normalized_ref}: {exc}"
        )
        return {
            "clinic_id": None,
            "clinic_hint": normalized_ref,
            "clinic": None,
            "clinics": [],
            "needs_clarification": True,
            "auto_selected": False,
            "message": "Minh chua the xac nhan phong kham nay luc nay. Ban thu lai hoac chon phong kham cu the giup minh.",
        }

    raw_clinics = response.get("clinics") or response.get("content") or []
    clinics = [
        clinic
        for clinic in (
            _map_backend_clinic_option(
                raw_clinic,
                default_match_mode="explicit_name",
            )
            for raw_clinic in raw_clinics
        )
        if clinic
    ]
    clinics = _filter_clinics_by_hint(clinics, normalized_ref)
    resolved_clinic = _select_resolved_clinic(clinics, normalized_ref)
    if resolved_clinic:
        cache.cache_clinic_resolution(
            clinic_hint=normalized_ref,
            resolved_clinic_id=str(resolved_clinic.get("id") or ""),
            resolved_clinic=resolved_clinic,
            clinic_options=clinics,
        )
        return {
            "clinic_id": resolved_clinic.get("id"),
            "clinic_hint": normalized_ref,
            "clinic": resolved_clinic,
            "clinics": clinics,
            "needs_clarification": False,
            "auto_selected": True,
        }

    cache.cache_clinic_resolution(
        clinic_hint=normalized_ref,
        resolved_clinic_id="",
        resolved_clinic=None,
        clinic_options=clinics,
    )
    return {
        "clinic_id": None,
        "clinic_hint": normalized_ref,
        "clinic": None,
        "clinics": clinics,
        "needs_clarification": True,
        "auto_selected": False,
        "message": (
            "Minh tim thay nhieu phong kham phu hop voi ten ban vua neu. "
            "Ban chon 1 phong kham giup minh de tiep tuc."
            if clinics
            else "Minh chua tim thay phong kham khop voi ten ban vua neu."
        ),
    }


def _build_service_match_text(service: Dict[str, Any]) -> str:
    return normalize_vietnamese_text(
        " ".join(
            str(service.get(key) or "")
            for key in (
                "name",
                "description",
                "service_category",
                "category",
                "pet_type",
            )
        )
    )


def _score_service_match(
    service: Dict[str, Any],
    *,
    hint_tokens: List[str],
    context_tokens: List[str],
    preferred_pet_species: Optional[str] = None,
) -> int:
    haystack = _build_service_match_text(service)
    if not haystack:
        return 0

    expanded_hint_tokens = _expand_service_hint_tokens(hint_tokens)
    service_name = normalize_vietnamese_text(str(service.get("name") or ""))
    score = 0
    joined_hint = " ".join(hint_tokens).strip()
    if joined_hint and joined_hint in haystack:
        score += 100
    for token in hint_tokens:
        if token in haystack:
            score += 20
        if token and service_name.startswith(token):
            score += 12

    for token in expanded_hint_tokens:
        if token in haystack:
            score += 10

    for token in context_tokens:
        if token in haystack:
            score += 5

    expected_pet_species = normalize_vietnamese_text(preferred_pet_species or "")
    service_pet_type = normalize_vietnamese_text(str(service.get("pet_type") or ""))
    if expected_pet_species and service_pet_type:
        if expected_pet_species in service_pet_type:
            score += 18
        else:
            score -= 8

    return score


async def _resolve_backend_booking_context(
    *,
    token: Optional[str],
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    address: Optional[str] = None,
    pet_id: Optional[str] = None,
    clinic_hint: Optional[str] = None,
    service_hint: Optional[str] = None,
    pet_species: Optional[str] = None,
    booking_type: Optional[str] = None,
    date_hint: Optional[str] = None,
    time_hint: Optional[str] = None,
    transcript: Optional[str] = None,
    latest_message: Optional[str] = None,
) -> Dict[str, Any]:
    if not token:
        return {}

    has_explicit_clinic_hint = bool(str(clinic_hint or "").strip())
    normalized_pet_species = _normalize_pet_species_enum(pet_species)
    payload = {
        "latitude": None if has_explicit_clinic_hint else latitude,
        "longitude": None if has_explicit_clinic_hint else longitude,
        "address": None if has_explicit_clinic_hint else address,
        "petId": pet_id,
        "clinicHint": clinic_hint,
        "serviceHint": service_hint,
        "petSpecies": normalized_pet_species,
        "bookingTypeHint": booking_type,
        "dateHint": date_hint,
        "timeHint": time_hint,
        "transcript": transcript,
        "latestMessage": latest_message,
    }

    if not any(
        value is not None and str(value).strip() != "" for value in payload.values()
    ):
        return {}

    try:
        return await get_backend_client().resolve_booking_context(
            token,
            {
                key: value
                for key, value in payload.items()
                if value is not None and str(value).strip() != ""
            },
        )
    except BackendClientError as exc:
        logger.warning(
            f"resolve_booking_context failed, continue with local context only: {exc}"
        )
        return {}


def _format_vaccination_record(record: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": record.get("id"),
        "pet_id": record.get("petId"),
        "booking_id": record.get("bookingId"),
        "clinic_id": record.get("clinicId"),
        "clinic_name": record.get("clinicName"),
        "staff_id": record.get("staffId"),
        "staff_name": record.get("staffName"),
        "vaccine_name": record.get("vaccineName"),
        "vaccine_template_id": record.get("vaccineTemplateId"),
        "dose_number": record.get("doseNumber"),
        "total_doses": record.get("totalDoses"),
        "series_id": record.get("seriesId"),
        "vaccination_date": _safe_date_label(record.get("vaccinationDate")),
        "next_due_date": _safe_date_label(record.get("nextDueDate")),
        "status": record.get("status"),
        "notes": record.get("notes"),
    }


@mcp_server.tool
@_standardize_booking_tool_response
async def get_user_pets(
    user_id: Optional[str] = None,
    pet_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """Lấy danh sách thú cưng của user hiện tại.

    Sử dụng khi:
    - User nói "thú cưng của tôi", "bé nhà tôi" mà chưa rõ tên cụ thể
    - Cần xem thông tin pet để đặt lịch khám
    - Cần lấy pet_id để truyền vào các tool booking khác

    Params:
        user_id: Override user ID (thường không cần truyền, lấy từ session)
        pet_hint: Tên thú cưng để fuzzy match, trả về pet khớp nhất với tên

    Examples:
        get_user_pets()  # Lay tat ca thu cung cua user
        get_user_pets(pet_hint="mèo")  # Tim thu cung co ten chua "mèo"

    Returns:
        pets: Danh sách thú cưng với pet_id, name, species, breed, age
        total_pets: Tổng số thú cưng
        resolved_pet_id: Nếu fuzzy match tìm được 1 kết quả, trả về pet_id đó
        requires_auth: Có cần đăng nhập không
    """
    from app.core.agents.booking_context import fuzzy_match_pet_name

    try:
        resolved_user_id = _resolve_user_id(user_id)
    except RuntimeError as exc:
        return _attach_booking_error_metadata(
            {
                "user_id": user_id,
                "pets": [],
                "total_pets": 0,
                "message": str(exc),
                "requires_auth": True,
            },
            error_code="UNAUTHORIZED",
            suggestion="Vui long dang nhap lai bang tai khoan hop le roi thu lai.",
            recoverable=True,
        )

    try:
        token = _require_auth_token()
    except AuthenticationRequiredError as e:
        return {
            "user_id": resolved_user_id,
            "pets": [],
            "total_pets": 0,
            "message": str(e),
            "requires_auth": True,
        }

    client = get_backend_client()

    try:
        pets = await client.get_user_pets(token, resolved_user_id)
    except BackendClientError as exc:
        logger.error(f"get_user_pets failed: {exc}")
        return {
            "user_id": resolved_user_id,
            "pets": [],
            "total_pets": 0,
            "message": f"Khong the tai danh sach thu cung luc nay: {exc}",
        }

    logger.info(
        f"get_user_pets loaded {len(pets) if isinstance(pets, list) else 0} pets for user {resolved_user_id}"
    )

    formatted_pets = [
        {
            "id": pet.get("id"),
            "name": pet.get("name"),
            "species": pet.get("species"),
            "breed": pet.get("breed"),
            "age_years": _calculate_age_years(pet.get("dateOfBirth")),
            "weight_kg": pet.get("weight"),
            "avatar_url": pet.get("imageUrl"),
        }
        for pet in pets
    ]

    resolved_pet_id = None
    matched_pet = None
    if pet_hint and formatted_pets:
        matched_pet = fuzzy_match_pet_name(pet_hint, formatted_pets)
        if matched_pet:
            resolved_pet_id = matched_pet.get("id")
            logger.info(
                f"fuzzy_match_pet_name: hint='{pet_hint}' matched to '{matched_pet.get('name')}' (id={resolved_pet_id})"
            )

    if not formatted_pets:
        return {
            "user_id": resolved_user_id,
            "pets": [],
            "total_pets": 0,
            "message": "Ban chua co thu cung nao trong ho so.",
        }

    response = {
        "user_id": resolved_user_id,
        "pets": formatted_pets,
        "total_pets": len(formatted_pets),
    }

    if resolved_pet_id:
        response["resolved_pet_id"] = resolved_pet_id
        response["resolved_pet"] = matched_pet
        response["pet_hint_used"] = pet_hint
        response["message"] = (
            f"Da tim thay thu cung '{matched_pet.get('name')}' phu hop voi '{pet_hint}'. "
            f"Su dung pet_id={resolved_pet_id} de dat lich."
        )

    return response


@mcp_server.tool
@_standardize_booking_tool_response
async def get_clinic_services(
    clinic_id: str,
    pet_species: Optional[str] = None,
    is_home_visit: Optional[bool] = None,
    service_hint: Optional[str] = None,
    booking_type: Optional[str] = None,
    transcript: Optional[str] = None,
    latest_message: Optional[str] = None,
) -> Dict[str, Any]:
    """Lấy danh sách dịch vụ của phòng khám, có thể lọc theo loại thú cưng và hình thức khám.

    Sử dụng khi:
    - Đã biết phòng khám, cần xem có dịch vụ gì
    - User muốn đặt dịch vụ cụ thể
    - Muốn xem giá dịch vụ trước khi đặt lịch
    - Cần xem dịch vụ tiêm chủng (có thể có nhiều dose/mũi)

    Params:
    - clinic_id: ID phòng khám (bắt buộc)
    - pet_species: Lọc dịch vụ theo loại thú cưng (VD: "dog", "cat")
    - is_home_visit: Chỉ lấy dịch vụ khám tại nhà
    - service_hint: Lọc theo tên/nhóm dịch vụ (VD: "tiêm", "khám tổng quát")
    - booking_type: Hình thức khám ("IN_CLINIC", "HOME_VISIT")

    Examples:
        get_clinic_services(clinic_id="xxx")
        get_clinic_services(clinic_id="xxx", pet_species="dog")
        get_clinic_services(clinic_id="xxx", service_hint="tiêm")
        get_clinic_services(clinic_id="xxx", is_home_visit=True)

    Returns:
        services: Danh sách dịch vụ của phòng khám
        matched_services: Dịch vụ khớp với hint
        is_vaccination: Danh sách dịch vụ tiêm chủng (có thể có nhiều dose)
        suggested_service_options: Gợi ý dịch vụ phù hợp
        needs_clarification: Cần hỏi user để làm rõ thêm
    """
    try:
        token = _require_auth_token()
    except AuthenticationRequiredError as e:
        return _attach_booking_error_metadata(
            {
                "clinic_id": clinic_id,
                "resolved_clinic_id": None,
                "resolved_clinic": None,
                "clinic_options": [],
                "services": [],
                "matched_services": [],
                "resolved_service_ids": [],
                "suggested_service_options": [],
                "needs_clarification": True,
                "total_services": 0,
                "message": str(e),
                "requires_auth": True,
            },
            error_code="UNAUTHORIZED",
            suggestion="Vui long dang nhap lai de tiep tuc.",
            recoverable=True,
        )

    clinic_resolution = await _resolve_clinic_reference(
        clinic_ref=clinic_id,
        token=token,
        pet_species=pet_species,
        booking_type=booking_type,
        service_hint=service_hint,
        transcript=transcript,
        latest_message=latest_message,
    )
    resolved_clinic_id = str(clinic_resolution.get("clinic_id") or "").strip()
    normalized_pet_species = _normalize_pet_species_enum(pet_species)
    if clinic_resolution.get("needs_clarification") and not resolved_clinic_id:
        return _attach_booking_error_metadata(
            {
                "clinic_id": clinic_id,
                "resolved_clinic_id": None,
                "resolved_clinic": clinic_resolution.get("clinic"),
                "clinic_options": clinic_resolution.get("clinics") or [],
                "services": [],
                "matched_services": [],
                "resolved_service_ids": [],
                "suggested_service_options": [],
                "needs_clarification": True,
                "total_services": 0,
                "message": clinic_resolution.get("message")
                or "Minh can xac nhan phong kham truoc khi tai danh sach dich vu.",
            },
            error_code="CLINIC_NOT_FOUND",
            suggestion="Vui lòng chọn đúng phòng khám trước khi tiếp tục.",
            recoverable=True,
        )

    client = get_backend_client()
    try:
        services = await client.get_clinic_services_by_clinic(
            resolved_clinic_id or clinic_id,
            pet_species=normalized_pet_species,
            is_home_visit=is_home_visit,
        )
    except BackendClientError as exc:
        logger.error(f"get_clinic_services failed: {exc}")
        return _attach_booking_error_metadata(
            {
                "clinic_id": resolved_clinic_id or clinic_id,
                "resolved_clinic_id": resolved_clinic_id or clinic_id,
                "resolved_clinic": clinic_resolution.get("clinic"),
                "services": [],
                "matched_services": [],
                "resolved_service_ids": [],
                "suggested_service_options": [],
                "needs_clarification": False,
                "total_services": 0,
                "message": f"Khong the tai dich vu phong kham luc nay: {exc}",
            },
            error_code="INTERNAL_ERROR",
            suggestion="Vui lòng thử tải lại dịch vụ sau ít phút.",
            recoverable=True,
        )

    formatted_services = [
        {
            "id": service.get("serviceId")
            or service.get("id")
            or service.get("service_id"),
            "name": service.get("name")
            or service.get("serviceName")
            or service.get("service_name"),
            "description": service.get("description"),
            "base_price": service.get("basePrice")
            if service.get("basePrice") is not None
            else service.get("base_price"),
            "duration_minutes": service.get("durationTime")
            if service.get("durationTime") is not None
            else service.get("duration_minutes"),
            "slots_required": service.get("slotsRequired")
            if service.get("slotsRequired") is not None
            else service.get("slots_required"),
            "category": service.get("serviceCategory")
            or service.get("service_category")
            or service.get("category"),
            "service_category": service.get("serviceCategory")
            or service.get("service_category")
            or service.get("category"),
            "pet_type": service.get("petType") or service.get("pet_type"),
            "is_home_visit": service.get("isHomeVisit")
            if service.get("isHomeVisit") is not None
            else service.get("is_home_visit"),
            "reminder_interval": service.get("reminderInterval")
            if service.get("reminderInterval") is not None
            else service.get("reminder_interval"),
            "reminder_unit": service.get("reminderUnit")
            or service.get("reminder_unit"),
            "vaccine_template_id": service.get("vaccineTemplateId")
            or service.get("vaccine_template_id"),
            "is_vaccination": (
                service.get("serviceCategory")
                or service.get("service_category")
                or service.get("category")
            )
            == "VACCINATION",
            "weight_prices": [
                {
                    "min_weight": weight_price.get("minWeight"),
                    "max_weight": weight_price.get("maxWeight"),
                    "price": weight_price.get("price"),
                }
                for weight_price in (service.get("weightPrices") or [])
                if isinstance(weight_price, dict)
                and weight_price.get("price") is not None
                and weight_price.get("minWeight") is not None
                and weight_price.get("maxWeight") is not None
            ],
            "dose_prices": [
                {
                    "dose_number": dose_price.get("doseNumber"),
                    "dose_label": dose_price.get("doseLabel"),
                    "price": dose_price.get("price"),
                    "is_active": dose_price.get("isActive"),
                }
                for dose_price in (service.get("dosePrices") or [])
                if isinstance(dose_price, dict) and dose_price.get("isActive", True)
            ],
        }
        for service in services
        if isinstance(service, dict) and service.get("isActive", True)
    ]

    for service in formatted_services:
        canonical_name = str(service.get("name") or "").strip()
        display_name = _format_service_display_name(
            canonical_name,
            service.get("pet_type"),
        )
        service["canonical_name"] = canonical_name
        service["display_name"] = display_name or canonical_name

    if normalized_pet_species:
        species_matched_services = [
            service
            for service in formatted_services
            if _service_matches_preferred_pet_species(service, normalized_pet_species)
        ]
        if species_matched_services:
            formatted_services = species_matched_services

    hint_tokens = _tokenize_match_text(service_hint)
    context_tokens = _tokenize_match_text(latest_message, transcript, booking_type)
    ranked_services = []
    if hint_tokens or context_tokens:
        for service in formatted_services:
            score = _score_service_match(
                service,
                hint_tokens=hint_tokens,
                context_tokens=context_tokens,
                preferred_pet_species=normalized_pet_species,
            )
            if score > 0:
                ranked_services.append((score, service))
        ranked_services.sort(key=lambda item: item[0], reverse=True)

    matched_services = [service for _, service in ranked_services[:3]]
    if matched_services:
        for service in matched_services:
            canonical_name = _format_service_display_name(
                service.get("name"), service.get("pet_type")
            )
            if canonical_name:
                service["display_name"] = canonical_name
    resolved_service_ids = [
        str(service.get("id")) for service in matched_services if service.get("id")
    ]
    resolved_service_names = [
        service.get("display_name") or str(service.get("name") or "").strip()
        for service in matched_services
        if str(service.get("display_name") or service.get("name") or "").strip()
    ]
    suggested_service_options = [
        {
            "id": service.get("id"),
            "name": _format_service_display_name(
                service.get("name"), service.get("pet_type")
            )
            or service.get("name"),
            "base_price": service.get("base_price"),
            "category": service.get("category"),
            "pet_type": service.get("pet_type"),
        }
        for service in formatted_services[:5]
    ]
    needs_clarification = bool(service_hint and not matched_services)

    return _attach_booking_error_metadata(
        {
            "clinic_id": resolved_clinic_id or clinic_id,
            "resolved_clinic_id": resolved_clinic_id or clinic_id,
            "resolved_clinic": clinic_resolution.get("clinic"),
            "filters": {
                "pet_species": normalized_pet_species or pet_species,
                "is_home_visit": is_home_visit,
                "booking_type": booking_type,
            },
            "services": formatted_services,
            "matched_services": matched_services,
            "resolved_service_ids": resolved_service_ids,
            "resolved_service_names": resolved_service_names,
            "suggested_service_options": suggested_service_options,
            "needs_clarification": needs_clarification,
            "match_hint": service_hint,
            "total_services": len(formatted_services),
            "message": None
            if formatted_services
            else "Phong kham hien chua co du lieu dich vu kha dung.",
        },
        error_code="SERVICE_NOT_FOUND"
        if needs_clarification or not formatted_services
        else "",
        suggestion="Vui lòng chọn dịch vụ khác hoặc kiểm tra lại từ khóa dịch vụ."
        if (needs_clarification or not formatted_services)
        else None,
        recoverable=True if (needs_clarification or not formatted_services) else None,
    )


@mcp_server.tool
@_standardize_booking_tool_response
async def check_vaccination_status(
    pet_id: Optional[str] = None,
    pet_hint: Optional[str] = None,
    vaccine_template_id: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Kiểm tra lịch sử tiêm chủng và lịch tiêm nhắc của thú cưng.

    Sử dụng khi:
    - User hỏi về lịch sử tiêm phòng của thú cưng
    - User nêu tên thú cưng (VD: "Mimi") mà không có ID (truyền qua pet_hint)
    - User muốn biết mũi tiếp theo là gì và khi nào cần tiêm

    Args:
        pet_id: ID của thú cưng (UUID). Ưu tiên dùng ID nếu có.
        pet_hint: Tên thú cưng để tra cứu nếu không có pet_id.
        vaccine_template_id: ID mẫu tiêm (tùy chọn)

    Returns:
        history: Danh sách các mũi đã tiêm (đã hoàn thành)
        upcoming: Danh sách các mũi cần tiêm (chưa thực hiện)
        total_history: Số mũi đã tiêm
        total_upcoming: Số mũi sắp tới
        requires_auth: Có cần đăng nhập không
    """
    client = get_backend_client()
    try:
        resolved_user_id = _resolve_user_id(user_id)
    except RuntimeError as exc:
        return _attach_booking_error_metadata(
            {
                "pet_id": pet_id,
                "pet_hint": pet_hint,
                "history": [],
                "upcoming": [],
                "total_history": 0,
                "total_upcoming": 0,
                "message": str(exc),
                "requires_auth": True,
            },
            error_code="UNAUTHORIZED",
            suggestion="Vui long dang nhap lai bang tai khoan hop le roi thu lai.",
            recoverable=True,
        )

    try:
        token = _require_auth_token()
    except AuthenticationRequiredError as e:
        return {
            "pet_id": pet_id,
            "pet_hint": pet_hint,
            "history": [],
            "upcoming": [],
            "total_history": 0,
            "total_upcoming": 0,
            "message": str(e),
            "requires_auth": True,
        }

    # Resolve pet_id from pet_hint if needed
    if not pet_id and pet_hint:
        from app.core.agents.booking_context import fuzzy_match_pet_name

        try:
            pets_data = await client.get_user_pets(token, resolved_user_id)
            matched_pet = fuzzy_match_pet_name(pet_hint, pets_data)
            if matched_pet:
                pet_id = matched_pet.get("id")
        except Exception:
            pass

    if not pet_id:
        return {
            "success": False,
            "error_code": "PET_NOT_FOUND",
            "message": f"Không tìm thấy thú cưng có tên '{pet_hint}' để tra cứu tiêm phòng.",
            "suggestion": "Bạn có thể dùng tool 'get_user_pets' để xem danh sách thú cưng của mình.",
            "recoverable": True,
        }

    try:
        history = await client.get_vaccinations_by_pet(token, pet_id)
        upcoming = await client.get_upcoming_vaccinations(token, pet_id)
    except BackendClientError as exc:
        logger.error(f"check_vaccination_status failed: {exc}")
        return {
            "pet_id": pet_id,
            "vaccine_template_id": vaccine_template_id,
            "history": [],
            "upcoming": [],
            "total_history": 0,
            "total_upcoming": 0,
            "message": f"Khong the tai du lieu tiem phong luc nay: {exc}",
        }

    normalized_template_id = (vaccine_template_id or "").strip() or None

    def _matches_template(record: Dict[str, Any]) -> bool:
        if not normalized_template_id:
            return True
        return (
            str(record.get("vaccineTemplateId") or "").strip() == normalized_template_id
        )

    filtered_history = [
        _format_vaccination_record(record)
        for record in history
        if isinstance(record, dict) and _matches_template(record)
    ]
    filtered_upcoming = [
        _format_vaccination_record(record)
        for record in upcoming
        if isinstance(record, dict) and _matches_template(record)
    ]

    return {
        "pet_id": pet_id,
        "vaccine_template_id": normalized_template_id,
        "history": filtered_history,
        "upcoming": filtered_upcoming,
        "total_history": len(filtered_history),
        "total_upcoming": len(filtered_upcoming),
        "message": None,
    }


@mcp_server.tool
@_standardize_booking_tool_response
async def search_clinics_nearby(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: float = 10.0,
    top_k: int = 5,
    address: Optional[str] = None,
    clinic_hint: Optional[str] = None,
    service_hint: Optional[str] = None,
    pet_id: Optional[str] = None,
    pet_species: Optional[str] = None,
    booking_type: Optional[str] = None,
    transcript: Optional[str] = None,
    latest_message: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Tìm kiếm hoặc resolve phòng khám thú y cho business chat.

    Sử dụng khi:
    - User hỏi "tìm phòng khám", "phòng khám ở đâu"
    - User nêu tên phòng khám cụ thể và cần resolve đúng clinic (truyền tên bằng clinic_hint)
    - User muốn tìm phòng khám gần vị trí hiện tại (truyền lat/lng)
    - Đây là tool clinic discovery chuẩn trong runtime business chat

    Params quan trọng:
    - clinic_hint: Resolve phòng khám theo TÊN. Có thể dùng cùng GPS hoặc địa chỉ text để tăng độ chính xác.
    - latitude + longitude: Tìm phòng khám GẦN vị trí. Chỉ cần khi user hỏi theo khoảng cách.
    - address: Tìm theo địa chỉ text (thay thế cho lat/lng)
    - radius_km: Bán kính tìm (mặc định 10km)
    - top_k: Số lượng kết quả trả về (mặc định 5)
    - service_hint: Lọc phòng khám theo dịch vụ cung cấp
    - pet_species: Lọc phòng khám theo loại thú cưng được phục vụ

    Examples:
        search_clinics_nearby(clinic_hint="PetCare")  # Resolve theo ten clinic
        search_clinics_nearby(latitude=10.76, longitude=106.69)  # Tim gan vi tri
        search_clinics_nearby(lat, lng, radius_km=10)  # Tim gan + ban kinh lon hon
        search_clinics_nearby(address="Quận 1, TP.HCM")  # Tim theo dia chi text

    Returns:
        clinics: Danh sách phòng khám tìm được
        matched_clinic: Phòng khám khớp với tên (nếu có)
        total_found: Tổng số phòng khám tìm được
        needs_clarification: Cần hỏi user để làm rõ thêm
    """
    logger.info(
        f"search_clinics_nearby called: lat={latitude}, lng={longitude}, "
        f"clinic_hint={clinic_hint}, address={address}, timezone=Asia/Ho_Chi_Minh"
    )

    clinic_suggestion_mode = _infer_clinic_suggestion_mode(
        latest_message=latest_message,
        transcript=transcript,
    )

    try:
        token = _require_auth_token()
    except AuthenticationRequiredError as e:
        return _attach_booking_error_metadata(
            {
                "query_location": {
                    "lat": latitude,
                    "lng": longitude,
                    "address": address,
                },
                "radius_km": radius_km,
                "clinic_hint": clinic_hint,
                "service_hint": service_hint,
                "clinics": [],
                "matched_clinic": None,
                "total_found": 0,
                "clinic_suggestion_mode": clinic_suggestion_mode,
                "needs_clarification": True,
                "requires_auth": True,
                "message": str(e),
            },
            error_code="UNAUTHORIZED",
            suggestion="Vui long dang nhap lai de tim phong kham.",
            recoverable=True,
        )

    client = get_backend_client()
    effective_clinic_hint = str(clinic_hint or "").strip() or None

    context_snapshot = await _resolve_backend_booking_context(
        token=token,
        latitude=latitude,
        longitude=longitude,
        address=address,
        pet_id=pet_id,
        clinic_hint=effective_clinic_hint,
        service_hint=service_hint,
        pet_species=pet_species,
        booking_type=booking_type,
        transcript=transcript,
        latest_message=latest_message,
    )
    resolved_location = context_snapshot.get("resolvedLocation") or {}
    resolved_pet = context_snapshot.get("resolvedPet") or {}
    resolved_booking_type = context_snapshot.get("resolvedBookingType")
    resolved_clinic_hint = context_snapshot.get("resolvedClinicHint")
    resolved_service_hint = context_snapshot.get("resolvedServiceHint")

    latitude = latitude if latitude is not None else resolved_location.get("latitude")
    longitude = (
        longitude if longitude is not None else resolved_location.get("longitude")
    )
    address = address or resolved_location.get("address")
    pet_id = pet_id or resolved_pet.get("petId")
    pet_species = _normalize_pet_species_enum(
        pet_species or resolved_pet.get("species")
    )
    booking_type = booking_type or resolved_booking_type
    effective_clinic_hint = effective_clinic_hint or resolved_clinic_hint
    service_hint = service_hint or resolved_service_hint

    if effective_clinic_hint:
        # Exact clinic-name resolution must not be constrained by nearby radius/GPS filters,
        # but we still send coordinates if available to allow backend to calculate distance.
        payload = {
            "latitude": latitude,
            "longitude": longitude,
            "limit": top_k,
            "clinicHint": effective_clinic_hint,
            "serviceHint": service_hint,
            "petId": pet_id,
            "petSpecies": pet_species,
            "bookingType": booking_type,
            "transcript": transcript,
            "latestMessage": latest_message,
        }
        try:
            response = await client.get_booking_clinic_options(token, payload)
        except BackendClientError as exc:
            logger.warning(f"search_clinics_nearby clinic-options failed: {exc}")
            return _attach_booking_error_metadata(
                {
                    "query_location": {
                        "lat": latitude,
                        "lng": longitude,
                        "address": address,
                    },
                    "radius_km": radius_km,
                    "clinic_hint": effective_clinic_hint,
                    "service_hint": service_hint,
                    "clinics": [],
                    "matched_clinic": None,
                    "total_found": 0,
                    "clinic_suggestion_mode": clinic_suggestion_mode,
                    "needs_clarification": True,
                    "message": "Mình chưa thể tìm phòng khám lúc này. Bạn thử lại sau nhé.",
                },
                error_code="INTERNAL_ERROR",
                suggestion="Vui lòng thử lại sau ít phút.",
                recoverable=True,
            )
        else:
            if isinstance(response, dict):
                raw_clinics = response.get("clinics") or response.get("content") or []
                clinics = [
                    clinic
                    for clinic in (
                        _map_backend_clinic_option(
                            raw_clinic,
                            default_match_mode="explicit_name"
                            if effective_clinic_hint
                            else "nearby",
                        )
                        for raw_clinic in raw_clinics
                    )
                    if clinic
                ]
                clinics.sort(key=lambda c: c.get("distance_km") or 999999)
                clinics = _filter_clinics_by_hint(clinics, effective_clinic_hint)
                resolved_clinic = _select_resolved_clinic(
                    clinics, effective_clinic_hint
                )
                auto_select_clinic = bool(
                    effective_clinic_hint and resolved_clinic and len(clinics) == 1
                )
                if effective_clinic_hint and not clinics:
                    return _attach_booking_error_metadata(
                        {
                            "query_location": {
                                "lat": latitude,
                                "lng": longitude,
                                "address": address,
                            },
                            "radius_km": radius_km,
                            "clinic_hint": effective_clinic_hint,
                            "service_hint": service_hint,
                            "clinics": [],
                            "matched_clinic": None,
                            "resolved_clinic": None,
                            "total_found": 0,
                            "clinic_suggestion_mode": clinic_suggestion_mode,
                            "match_mode": "explicit_name",
                            "auto_select_clinic": False,
                            "needs_clarification": True,
                            "message": "Mình chưa tìm thấy phòng khám khớp với tên bạn vừa nêu. Có thể tên phòng khám hơi khác, bạn kiểm tra lại giúp mình nhé.",
                        },
                        error_code="CLINIC_NOT_FOUND",
                        suggestion="Vui lòng kiểm tra lại tên phòng khám hoặc chọn từ danh sách gợi ý.",
                        recoverable=True,
                    )
                return {
                    "query_location": {
                        "lat": latitude,
                        "lng": longitude,
                        "address": address,
                    },
                    "radius_km": radius_km,
                    "clinic_hint": effective_clinic_hint,
                    "service_hint": service_hint,
                    "clinics": clinics[:top_k],
                    "matched_clinic": resolved_clinic
                    or (clinics[0] if clinics else None),
                    "resolved_clinic": resolved_clinic,
                    "total_found": int(response.get("totalFound") or len(clinics)),
                    "clinic_suggestion_mode": clinic_suggestion_mode,
                    "match_mode": clinics[0].get("match_mode") if clinics else None,
                    "auto_select_clinic": auto_select_clinic,
                    "needs_clarification": bool(
                        effective_clinic_hint
                        and len(clinics) > 1
                        and not auto_select_clinic
                    ),
                    "message": (
                        "Mình đã xác định được phòng khám bạn vừa nêu và sẽ tiếp tục booking."
                        if auto_select_clinic
                        else None
                    ),
                }

    if latitude is None or longitude is None:
        return _attach_booking_error_metadata(
            {
                "query_location": {
                    "lat": latitude,
                    "lng": longitude,
                    "address": address,
                },
                "radius_km": radius_km,
                "clinic_hint": effective_clinic_hint,
                "service_hint": service_hint,
                "clinics": [],
                "matched_clinic": None,
                "total_found": 0,
                "clinic_suggestion_mode": clinic_suggestion_mode,
                "needs_clarification": True,
                "message": "Mình cần vị trí hiện tại hoặc địa chỉ cụ thể để tìm phòng khám gần bạn.",
            },
            error_code="INVALID_INPUT",
            suggestion="Vui lòng chia sẻ vị trí hoặc nhập địa chỉ cụ thể.",
            recoverable=True,
        )

    try:
        response = await client.find_nearby_clinics(
            latitude, longitude, radius_km, size=max(top_k * 3, 10)
        )
    except BackendClientError as exc:
        logger.error(f"search_clinics_nearby failed: {exc}")
        return _attach_booking_error_metadata(
            {
                "query_location": {
                    "lat": latitude,
                    "lng": longitude,
                    "address": address,
                },
                "radius_km": radius_km,
                "clinic_hint": effective_clinic_hint,
                "service_hint": service_hint,
                "clinics": [],
                "matched_clinic": None,
                "total_found": 0,
                "clinic_suggestion_mode": clinic_suggestion_mode,
                "message": f"Khong the tim phong kham gan day: {exc}",
            },
            error_code="INTERNAL_ERROR",
            suggestion="Vui lòng thử lại sau ít phút.",
            recoverable=True,
        )

    raw_clinics = response.get(
        "content", response if isinstance(response, list) else []
    )
    clinics: List[Dict[str, Any]] = [
        clinic
        for clinic in (
            _map_backend_clinic_option(raw_clinic, default_match_mode="nearby")
            for raw_clinic in raw_clinics
        )
        if clinic
    ]

    clinics.sort(key=lambda c: c.get("distance_km") or 999999)
    clinics = _filter_clinics_by_hint(clinics, effective_clinic_hint)

    if effective_clinic_hint and not clinics:
        return {
            "query_location": {"lat": latitude, "lng": longitude, "address": address},
            "radius_km": radius_km,
            "clinic_hint": effective_clinic_hint,
            "service_hint": service_hint,
            "clinics": [],
            "matched_clinic": None,
            "total_found": 0,
            "clinic_suggestion_mode": clinic_suggestion_mode,
            "match_mode": "explicit_name",
            "needs_clarification": True,
            "message": "Minh chua tim thay phong kham khop voi ten ban vua neu trong khu vuc nay.",
        }

    clinics = clinics[:top_k]

    return {
        "query_location": {"lat": latitude, "lng": longitude, "address": address},
        "radius_km": radius_km,
        "clinic_hint": effective_clinic_hint,
        "service_hint": service_hint,
        "clinics": clinics,
        "matched_clinic": clinics[0] if clinics else None,
        "total_found": len(clinics),
        "clinic_suggestion_mode": clinic_suggestion_mode,
        "match_mode": "explicit_name" if effective_clinic_hint else "nearby",
        "resolved_clinic": None,
        "auto_select_clinic": False,
        "needs_clarification": False,
    }


@mcp_server.tool
@_standardize_booking_tool_response
async def get_my_booking_info(
    booking_id: Optional[str] = None,
    booking_code: Optional[str] = None,
) -> Dict[str, Any]:
    """Lấy thông tin chi tiết một booking cụ thể.

    Sử dụng khi:
    - User hỏi "lịch khám của tôi ngày mai thế nào?"
    - User muốn kiểm tra trạng thái booking
    - User hỏi về chi tiết lịch đặt

    Params:
        booking_id: ID của booking (UUID)
        booking_code: Mã booking (VD: "BK-123456")

    Examples:
        get_my_booking_info(booking_id="uuid-here")
        get_my_booking_info(booking_code="BK-123456")

    Returns:
        booking: Thông tin chi tiết booking
        status: Trạng thái (PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED)
        pet_name: Tên thú cưng
        clinic_name: Tên phòng khám
        date: Ngày khám
        time: Giờ khám
        services: Danh sách dịch vụ
    """
    logger.info(f"🔧 [TOOL] ===== get_my_booking_info =====")
    logger.info(f"  ├─ Input: booking_id={booking_id}, booking_code={booking_code}")

    try:
        token = _require_auth_token()
        logger.info(f"  ├─ Auth token: {token[:10]}...")
    except AuthenticationRequiredError as e:
        logger.warning(f"  └─ ❌ Auth required: {e}")
        return {
            "booking_id": booking_id,
            "booking_code": booking_code,
            "booking": None,
            "message": str(e),
            "requires_auth": True,
        }

    if not booking_id and not booking_code:
        logger.warning(f"  └─ ❌ Missing booking_id and booking_code")
        return _attach_booking_error_metadata(
            {
                "booking_id": booking_id,
                "booking_code": booking_code,
                "booking": None,
                "message": "Vui lòng cung cấp booking_id hoặc booking_code để tra cứu.",
                "needs_clarification": True,
            },
            error_code="INVALID_INPUT",
            suggestion="Vui lòng cung cấp mã booking hoặc ID booking.",
            recoverable=True,
        )

    client = get_backend_client()
    lookup_id = booking_id or booking_code
    logger.info(f"  ├─ Backend call: GET /bookings/{lookup_id}")

    try:
        booking = await client.get_booking(token, lookup_id)
        logger.info(
            f"  ├─ Backend response: {json.dumps(booking, ensure_ascii=False)[:500]}"
        )
    except BackendClientError as exc:
        logger.error(f"  └─ ❌ Backend error: {exc}")
        return _attach_booking_error_metadata(
            {
                "booking_id": booking_id,
                "booking_code": booking_code,
                "booking": None,
                "message": f"Không thể tra cứu booking lúc này: {exc}",
            },
            error_code="BOOKING_NOT_FOUND",
            suggestion="Vui lòng kiểm tra lại mã booking hoặc thử lại sau.",
            recoverable=True,
        )

    if not booking:
        logger.warning(f"  └─ ❌ Booking not found: {lookup_id}")
        return _attach_booking_error_metadata(
            {
                "booking_id": booking_id,
                "booking_code": booking_code,
                "booking": None,
                "message": "Không tìm thấy booking với thông tin cung cấp.",
            },
            error_code="BOOKING_NOT_FOUND",
            suggestion="Vui lòng kiểm tra lại mã booking.",
            recoverable=True,
        )

    booking_detail = {
        "id": booking.get("id") or booking.get("bookingId"),
        "booking_code": booking.get("bookingCode"),
        "status": booking.get("status"),
        "pet_name": booking.get("petName"),
        "pet_id": booking.get("petId"),
        "clinic_name": booking.get("clinicName"),
        "clinic_id": booking.get("clinicId"),
        "date": booking.get("bookingDate"),
        "time": booking.get("bookingTime"),
        "booking_type": booking.get("type") or booking.get("bookingType"),
        "services": booking.get("services", []),
        "total_price": booking.get("totalPrice"),
        "notes": booking.get("notes"),
        "created_at": booking.get("createdAt"),
        "manager_will_confirm": booking.get("managerWillConfirm"),
    }

    result = {
        "booking_id": booking_id,
        "booking_code": booking_code,
        "booking": booking_detail,
        "message": None,
    }
    logger.info(f"  └─ ✅ Returning: {json.dumps(result, ensure_ascii=False)[:500]}")
    return result


@mcp_server.tool
@_standardize_booking_tool_response
async def list_my_bookings(
    status: Optional[str] = "upcoming",
    limit: int = 10,
) -> Dict[str, Any]:
    """Lấy danh sách booking của user hiện tại.

    Sử dụng khi:
    - User hỏi "các lịch khám sắp tới của tôi"
    - User muốn xem lịch sử đặt lịch
    - User hỏi "tôi có lịch khám nào không?"

    Params:
        status: Lọc theo trạng thái
            - "upcoming": Sắp tới (PENDING, CONFIRMED)
            - "past": Quá khứ (COMPLETED, CANCELLED)
            - "all": Tất cả
        limit: Số lượng kết quả (mặc định: 10)

    Examples:
        list_my_bookings()  # Lấy lịch sắp tới
        list_my_bookings(status="past")  # Lấy lịch sử
        list_my_bookings(status="all", limit=20)  # Lấy tất cả

    Returns:
        bookings: Danh sách booking
        total: Tổng số booking
        upcoming_count: Số lịch sắp tới
    """
    logger.info(f"🔧 [TOOL] ===== list_my_bookings =====")
    logger.info(f"  ├─ Input: status={status}, limit={limit}")

    try:
        token = _require_auth_token()
        logger.info(f"  ├─ Auth token: {token[:10]}...")
    except AuthenticationRequiredError as e:
        logger.warning(f"  └─ ❌ Auth required: {e}")
        return {
            "bookings": [],
            "total": 0,
            "upcoming_count": 0,
            "message": str(e),
            "requires_auth": True,
        }

    client = get_backend_client()
    logger.info(
        f"  ├─ Backend call: GET /bookings/my-bookings?status={status}&size={limit}"
    )

    try:
        response = await client.get_my_bookings(
            token=token,
            status=status,
            size=limit,
        )
        logger.info(
            f"  ├─ Backend response: {json.dumps(response, ensure_ascii=False)[:500]}"
        )
    except BackendClientError as exc:
        logger.error(f"  └─ ❌ Backend error: {exc}")
        return _attach_booking_error_metadata(
            {
                "bookings": [],
                "total": 0,
                "upcoming_count": 0,
                "message": f"Không thể tải danh sách booking lúc này: {exc}",
            },
            error_code="INTERNAL_ERROR",
            suggestion="Vui lòng thử lại sau ít phút.",
            recoverable=True,
        )

    raw_bookings = response.get("content") or []
    total = response.get("totalElements") or len(raw_bookings)
    logger.info(f"  ├─ Raw bookings count: {len(raw_bookings)}, total: {total}")

    formatted_bookings = []
    upcoming_count = 0
    for b in raw_bookings:
        if not isinstance(b, dict):
            continue
        status_val = b.get("status", "")
        if status_val in {"PENDING", "CONFIRMED"}:
            upcoming_count += 1
        formatted_bookings.append(
            {
                "id": b.get("id") or b.get("bookingId"),
                "booking_code": b.get("bookingCode"),
                "status": status_val,
                "pet_name": b.get("petName"),
                "clinic_name": b.get("clinicName"),
                "date": b.get("bookingDate"),
                "time": b.get("bookingTime"),
                "booking_type": b.get("type") or b.get("bookingType"),
                "services": b.get("services", []),
                "total_price": b.get("totalPrice"),
            }
        )

    logger.info(
        f"  ├─ Formatted bookings: {len(formatted_bookings)}, upcoming: {upcoming_count}"
    )
    result = {
        "bookings": formatted_bookings,
        "total": total,
        "upcoming_count": upcoming_count,
        "status_filter": status,
        "message": None if formatted_bookings else "Bạn chưa có lịch khám nào.",
    }
    logger.info(f"  └─ ✅ Returning: {json.dumps(result, ensure_ascii=False)[:500]}")
    return result


@mcp_server.tool
@mcp_server.tool
@_standardize_booking_tool_response
async def get_clinic_detail(
    clinic_id: str,
) -> Dict[str, Any]:
    """Lấy thông tin chi tiết phòng khám theo ID.

    Sử dụng khi user muốn xem chi tiết:
    - "Xem chi tiết phòng khám này"
    - "Phòng khám này có dịch vụ gì"
    - "Thông tin phòng khám {id}"

    Params:
        clinic_id: ID của phòng khám (UUID)

    Returns:
        clinic: Thông tin chi tiết phòng khám
        services: Danh sách dịch vụ
    """
    logger.info(f"🔧 [TOOL] ===== get_clinic_detail =====")
    logger.info(f"  ├─ Input: clinic_id={clinic_id}")

    client = get_backend_client()
    logger.info(f"  ├─ Backend call: GET /clinics/{clinic_id}")

    try:
        clinic = await client.get_clinic_by_id(clinic_id)
        logger.info(
            f"  ├─ Backend response: {json.dumps(clinic, ensure_ascii=False)[:500]}"
        )
    except BackendClientError as exc:
        logger.error(f"  └─ ❌ Backend error: {exc}")
        return _attach_booking_error_metadata(
            {
                "clinic_id": clinic_id,
                "clinic": None,
                "message": f"Không thể lấy thông tin phòng khám lúc này: {exc}",
            },
            error_code="CLINIC_NOT_FOUND",
            suggestion="Vui lòng kiểm tra lại ID phòng khám.",
            recoverable=True,
        )

    if not clinic:
        logger.warning(f"  └─ ❌ Clinic not found: {clinic_id}")
        return _attach_booking_error_metadata(
            {
                "clinic_id": clinic_id,
                "clinic": None,
                "message": "Không tìm thấy phòng khám với ID cung cấp.",
            },
            error_code="CLINIC_NOT_FOUND",
            suggestion="Vui lòng kiểm tra lại ID phòng khám.",
            recoverable=True,
        )

    clinic_detail = {
        "id": clinic.get("id"),
        "name": clinic.get("name"),
        "address": clinic.get("address"),
        "phone": clinic.get("phone"),
        "email": clinic.get("email"),
        "province": clinic.get("province"),
        "district": clinic.get("district"),
        "ward": clinic.get("ward"),
        "latitude": clinic.get("latitude"),
        "longitude": clinic.get("longitude"),
        "status": clinic.get("status"),
        "rating": clinic.get("rating"),
        "total_reviews": clinic.get("totalReviews"),
        "description": clinic.get("description"),
        "logo_url": clinic.get("logoUrl"),
        "primary_image_url": clinic.get("primaryImageUrl"),
        "opening_hours": clinic.get("openingHours"),
        "services_count": clinic.get("servicesCount"),
    }

    result = {
        "clinic_id": clinic_id,
        "clinic": clinic_detail,
        "message": None,
    }
    logger.info(f"  └─ ✅ Returning: {json.dumps(result, ensure_ascii=False)[:500]}")
    return result


@mcp_server.tool
@_standardize_booking_tool_response
async def get_clinic_reviews(
    clinic_id: str,
) -> Dict[str, Any]:
    """Lấy danh sách đánh giá chi tiết của phòng khám.

    Sử dụng khi:
    - Người dùng hỏi về chất lượng phòng khám.
    - Cần biết khách hàng khác nói gì về dịch vụ, bác sĩ, hoặc cơ sở vật chất.
    - Muốn đưa ra gợi ý cá nhân hóa dựa trên trải nghiệm thực tế của người khác.

    Params:
        clinic_id: ID phòng khám (bắt buộc).

    Returns:
        reviews: Danh sách các đánh giá (rating, comment, user_name, date).
        total_reviews: Tổng số lượng đánh giá.
        average_rating: Điểm đánh giá trung bình.
    """
    logger.info(f"🔧 [TOOL] get_clinic_reviews: clinic_id={clinic_id}")
    client = get_backend_client()
    try:
        reviews = await client.get_clinic_reviews(clinic_id)
    except BackendClientError as exc:
        logger.error(f"  └─ ❌ Backend error: {exc}")
        return {
            "clinic_id": clinic_id,
            "reviews": [],
            "total_reviews": 0,
            "message": f"Không thể lấy đánh giá lúc này: {exc}",
        }

    formatted_reviews = [
        {
            "rating": r.get("rating"),
            "comment": r.get("comment"),
            "user_name": r.get("userName") or r.get("user_name") or "Khách hàng",
            "date": r.get("createdAt") or r.get("created_at"),
        }
        for r in reviews if isinstance(r, dict)
    ]

    # Limit to top 10 most recent/relevant reviews to save context window
    formatted_reviews = formatted_reviews[:10]

    avg_rating = 0.0
    if formatted_reviews:
        avg_rating = sum(r.get("rating") or 0 for r in formatted_reviews) / len(formatted_reviews)

    result = {
        "clinic_id": clinic_id,
        "reviews": formatted_reviews,
        "total_reviews": len(formatted_reviews),
        "average_rating": round(avg_rating, 1),
    }

    logger.info(f"  └─ ✅ Returning {len(formatted_reviews)} reviews")
    return result


@mcp_server.tool
@_standardize_booking_tool_response
async def check_available_slots(
    clinic_id: str,
    date: Optional[str] = None,
    service_ids: Optional[List[str]] = None,
    exact_time: Optional[str] = None,
    time_preference: Optional[str] = None,
    pet_id: Optional[str] = None,
    pet_species: Optional[str] = None,
    booking_type: Optional[str] = None,
    service_hint: Optional[str] = None,
    transcript: Optional[str] = None,
    latest_message: Optional[str] = None,
    date_expression: Optional[str] = None,
) -> Dict[str, Any]:
    """Kiểm tra khung giờ trống của phòng khám để đặt lịch.

    Sử dụng khi:
    - Đã biết phòng khám, cần xem ngày nào có lịch trống
    - Cần xem giờ nào còn trống trong ngày cụ thể

    Params quan trọng:
    - clinic_id: ID phòng khám (bắt buộc)
    - date: Ngày chuẩn ISO (VD: "2026-03-25")
    - date_expression: Ngày dạng text (VD: "thứ bảy này", "ngày 15", "cuối tuần")
    - exact_time: Giờ chính xác (VD: "14:30")
    - time_preference: Ưu tiên buổi (VD: "sáng", "chiều")
    - service_ids: Lọc theo dịch vụ cụ thể
    - pet_id: ID thú cưng (để resolve context). LƯU Ý QUAN TRỌNG: pet_id PHẢI LÀ MỘT UUID HỢP LỆ. Nếu chỉ biết tên thú cưng (VD: "hadine"), BẮT BUỘC phải gọi tool `get_user_pets` trước để lấy chính xác UUID của thú cưng đó. TUYỆT ĐỐI KHÔNG truyền tên thú cưng (VD: "hadine_pet_id") vào trường pet_id này.
    - pet_species: Loại thú cưng ("dog", "cat")
    - booking_type: Loại khám ("IN_CLINIC", "HOME_VISIT")

    Examples:
        check_available_slots(clinic_id="xxx", date="2026-03-25")
        check_available_slots(clinic_id="xxx", date_expression="thứ bảy này")
        check_available_slots(clinic_id="xxx", time_preference="sáng")
        check_available_slots(clinic_id="xxx", service_ids=["svc1", "svc2"])

    Returns:
        slots: Danh sách khung giờ trống
        recommended_slots: Các khung giờ được gợi ý
        message: Thông báo trạng thái
        needs_clarification: Cần hỏi user để làm rõ thêm
    """
    logger.info(
        f"check_available_slots called: clinic_id={clinic_id}, date={date}, "
        f"date_expression={date_expression}, exact_time={exact_time}, "
        f"time_preference={time_preference}, resolved_date will use Asia/Ho_Chi_Minh timezone"
    )

    try:
        token = _require_auth_token()
    except AuthenticationRequiredError as e:
        return _attach_booking_error_metadata(
            {
                "clinic_id": clinic_id,
                "resolved_clinic_id": None,
                "resolved_clinic": None,
                "date": date,
                "services": service_ids or [],
                "resolved_service_ids": [],
                "resolved_service_names": [],
                "recommended_slots": [],
                "alternative_slots": [],
                "available_slots": [],
                "total_slots": 0,
                "exact_match": False,
                "preferred_unavailable": False,
                "needs_clarification": True,
                "next_best_action": "login",
                "requires_auth": True,
                "message": str(e),
            },
            error_code="UNAUTHORIZED",
            suggestion="Vui long dang nhap lai de kiem tra lich trong.",
            recoverable=True,
        )

    client = get_backend_client()
    clinic_resolution = await _resolve_clinic_reference(
        clinic_ref=clinic_id,
        token=token,
        pet_id=pet_id,
        pet_species=pet_species,
        booking_type=booking_type,
        service_hint=service_hint,
        transcript=transcript,
        latest_message=latest_message,
    )
    resolved_clinic_id = str(clinic_resolution.get("clinic_id") or "").strip()
    if clinic_resolution.get("needs_clarification") and not resolved_clinic_id:
        return {
            "clinic_id": clinic_id,
            "resolved_clinic_id": None,
            "resolved_clinic": clinic_resolution.get("clinic"),
            "clinic_options": clinic_resolution.get("clinics") or [],
            "date": None,
            "services": [],
            "resolved_service_ids": [],
            "resolved_service_names": [],
            "recommended_slots": [],
            "alternative_slots": [],
            "available_slots": [],
            "total_slots": 0,
            "exact_match": False,
            "preferred_unavailable": False,
            "needs_clarification": True,
            "next_best_action": "choose_clinic",
            "message": clinic_resolution.get("message")
            or "Minh can xac nhan phong kham truoc khi kiem tra slot.",
        }

    resolved_datetime = _resolve_booking_datetime_inputs(
        date=date,
        date_expression=date_expression,
        exact_time=exact_time,
        time_preference=time_preference,
        latest_message=latest_message,
        transcript=transcript,
    )
    normalized_pet_species = _normalize_pet_species_enum(pet_species)
    resolved_date = resolved_datetime.get("date")
    resolved_exact_time = resolved_datetime.get("exact_time")
    resolved_time_preference = resolved_datetime.get("time_preference")
    normalized_service_ids = [
        str(service_id).strip()
        for service_id in (service_ids or [])
        if str(service_id).strip()
    ]
    has_service_signal = _has_meaningful_service_signal(
        normalized_service_ids,
        service_hint,
        latest_message,
        transcript,
    )

    def _format_slots(slots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        formatted: List[Dict[str, Any]] = []
        for slot in slots:
            if not isinstance(slot, dict):
                continue
            formatted.append(
                {
                    "start_time": slot.get("startTime") or slot.get("start_time"),
                    "end_time": slot.get("endTime") or slot.get("end_time"),
                    "duration_minutes": slot.get("durationMinutes")
                    or slot.get("duration_minutes"),
                    "staff_available": slot.get("staffAvailable"),
                    "exact_requested": bool(
                        slot.get("exactRequested", slot.get("exact_requested", False))
                    ),
                }
            )
        return formatted

    if not resolved_date:
        return _attach_booking_error_metadata(
            {
                "clinic_id": clinic_id,
                "resolved_clinic_id": resolved_clinic_id or clinic_id,
                "resolved_clinic": clinic_resolution.get("clinic"),
                "date": None,
                "services": normalized_service_ids,
                "resolved_service_ids": normalized_service_ids,
                "resolved_service_names": [],
                "recommended_slots": [],
                "alternative_slots": [],
                "available_slots": [],
                "total_slots": 0,
                "exact_match": False,
                "preferred_unavailable": False,
                "needs_clarification": True,
                "next_best_action": "provide_date",
                "message": "Minh chua xac dinh duoc ngay kham cu the. Ban co the noi theo dang nhu `thu bay nay`, `ngay mai` hoac `2026-03-21`.",
            },
            error_code="INVALID_DATE",
            suggestion="Vui lòng nói rõ ngày khám mong muốn.",
            recoverable=True,
        )

    if not has_service_signal:
        return _attach_booking_error_metadata(
            {
                "clinic_id": clinic_id,
                "resolved_clinic_id": resolved_clinic_id or clinic_id,
                "resolved_clinic": clinic_resolution.get("clinic"),
                "date": resolved_date,
                "services": [],
                "resolved_service_ids": [],
                "resolved_service_names": [],
                "recommended_slots": [],
                "alternative_slots": [],
                "available_slots": [],
                "total_slots": 0,
                "exact_match": False,
                "preferred_unavailable": False,
                "needs_clarification": True,
                "next_best_action": "choose_service",
                "message": "Minh chua xac dinh duoc dich vu can kiem tra slot. Ban muon kham benh, tiem phong hay dich vu nao cho be?",
            },
            error_code="SERVICE_NOT_FOUND",
            suggestion="Vui lòng nói rõ dịch vụ cần đặt lịch.",
            recoverable=True,
        )

    # DB-first service resolution: service_hint is intent only, but slot query should
    # use canonical service IDs/names from clinic services whenever possible.
    resolved_service_ids_for_slot = list(normalized_service_ids)
    resolved_service_names_for_slot: List[str] = []
    service_resolution_payload: Dict[str, Any] = {}
    if not resolved_service_ids_for_slot and str(service_hint or "").strip():
        service_resolution = await get_clinic_services(
            clinic_id=resolved_clinic_id or clinic_id,
            pet_species=normalized_pet_species,
            booking_type=booking_type,
            service_hint=service_hint,
            transcript=transcript,
            latest_message=latest_message,
        )
        if isinstance(service_resolution, dict):
            service_resolution_payload = (
                service_resolution.get("data")
                if isinstance(service_resolution.get("data"), dict)
                else service_resolution
            )
        matched_services = service_resolution_payload.get("matched_services") or []
        if isinstance(matched_services, list) and matched_services:
            resolved_service_ids_for_slot = _extract_canonical_service_ids(
                matched_services
            )
            resolved_service_names_for_slot = _extract_canonical_service_names(
                matched_services
            )
            normalized_service_ids = list(resolved_service_ids_for_slot)

    if not resolved_service_ids_for_slot and str(service_hint or "").strip():
        return _attach_booking_error_metadata(
            {
                "clinic_id": clinic_id,
                "resolved_clinic_id": resolved_clinic_id or clinic_id,
                "resolved_clinic": clinic_resolution.get("clinic"),
                "date": resolved_date,
                "services": [],
                "resolved_service_ids": [],
                "resolved_service_names": [],
                "matched_services": service_resolution_payload.get("matched_services")
                or [],
                "suggested_service_options": service_resolution_payload.get(
                    "suggested_service_options"
                )
                or [],
                "recommended_slots": [],
                "alternative_slots": [],
                "available_slots": [],
                "total_slots": 0,
                "needs_clarification": True,
                "next_best_action": "choose_service",
                "message": "Mình chưa xác định được dịch vụ chuẩn từ phòng khám. Bạn chọn dịch vụ trong danh sách để mình kiểm tra slot chính xác nhé.",
            },
            error_code="SERVICE_NOT_FOUND",
            suggestion="Vui lòng chọn dịch vụ trước khi kiểm tra slot.",
            recoverable=True,
        )

    if token:
        payload = {
            "clinicId": resolved_clinic_id or clinic_id,
            "bookingDate": resolved_date,
            "serviceIds": resolved_service_ids_for_slot,
            "exactTime": resolved_exact_time,
            "timePreference": resolved_time_preference,
            "petId": pet_id,
            "petSpecies": normalized_pet_species,
            "bookingType": booking_type,
            "serviceHint": service_hint,
            "transcript": transcript,
            "latestMessage": latest_message,
            "dateExpression": date_expression,
        }
        try:
            slot_response = await client.get_booking_slot_options(token, payload)
        except BackendClientError as exc:
            logger.error(f"check_available_slots failed: {exc}")
            return _attach_booking_error_metadata(
                {
                    "clinic_id": clinic_id,
                    "resolved_clinic_id": resolved_clinic_id or clinic_id,
                    "date": resolved_date,
                    "services": resolved_service_names_for_slot
                    or resolved_service_ids_for_slot,
                    "resolved_service_ids": resolved_service_ids_for_slot,
                    "resolved_service_names": resolved_service_names_for_slot,
                    "available_slots": [],
                    "total_slots": 0,
                    "exact_match": False,
                    "preferred_unavailable": False,
                    "message": f"Không thể kiểm tra slot lúc này: {exc}",
                    "needs_clarification": False,
                    "next_best_action": "retry",
                },
                error_code="INTERNAL_ERROR",
                suggestion="Vui lòng thử kiểm tra slot lại sau ít phút.",
                recoverable=True,
            )
        else:
            if isinstance(slot_response, dict):
                recommended_slots = _format_slots(
                    slot_response.get("recommendedSlots") or []
                )
                alternative_slots = _format_slots(
                    slot_response.get("alternatives") or []
                )
                available_slots = [*recommended_slots, *alternative_slots]
                resolved_service_ids_from_backend = (
                    slot_response.get("resolvedServiceIds")
                    or resolved_service_ids_for_slot
                )
                resolved_service_names = (
                    slot_response.get("resolvedServiceNames")
                    or resolved_service_names_for_slot
                )
                no_slots = not available_slots
                has_alternatives = bool(alternative_slots)
                preferred_unavailable = bool(not recommended_slots and has_alternatives)
                return _attach_booking_error_metadata(
                    {
                        "clinic_id": clinic_id,
                        "resolved_clinic_id": resolved_clinic_id or clinic_id,
                        "resolved_clinic": clinic_resolution.get("clinic"),
                        "date": resolved_date,
                        "services": resolved_service_names
                        or resolved_service_ids_from_backend,
                        "resolved_service_ids": resolved_service_ids_from_backend,
                        "resolved_service_names": resolved_service_names,
                        "recommended_slots": recommended_slots,
                        "alternative_slots": alternative_slots,
                        "available_slots": available_slots,
                        "total_slots": int(
                            slot_response.get("totalAvailable") or len(available_slots)
                        ),
                        "exact_match": bool(slot_response.get("exactMatch")),
                        "preferred_unavailable": preferred_unavailable,
                        "message": slot_response.get("message"),
                        "resolved_time_preference": resolved_time_preference,
                        "needs_clarification": no_slots,
                        "next_best_action": "choose_alternative"
                        if preferred_unavailable
                        else "choose_another_time"
                        if no_slots
                        else "select_slot",
                    },
                    error_code="NO_SLOTS_AVAILABLE" if no_slots else "",
                    suggestion="Vui lòng chọn khung giờ hoặc ngày khác phù hợp hơn."
                    if no_slots
                    else None,
                    recoverable=True if no_slots else None,
                )

    if not normalized_service_ids:
        return _attach_booking_error_metadata(
            {
                "clinic_id": clinic_id,
                "resolved_clinic_id": resolved_clinic_id or clinic_id,
                "resolved_clinic": clinic_resolution.get("clinic"),
                "date": resolved_date,
                "services": [],
                "resolved_service_ids": [],
                "resolved_service_names": [],
                "recommended_slots": [],
                "alternative_slots": [],
                "available_slots": [],
                "total_slots": 0,
                "needs_clarification": True,
                "next_best_action": "choose_service",
                "message": "Mình đã hiểu nhu cầu dịch vụ nhưng chưa xác định được dịch vụ chuẩn của phòng khám. Bạn chọn dịch vụ trong danh sách để kiểm tra slot chính xác nhé.",
            },
            error_code="SERVICE_NOT_FOUND",
            suggestion="Vui lòng chọn dịch vụ trước khi kiểm tra slot.",
            recoverable=True,
        )

    try:
        slots_response = await client.get_available_slots(
            resolved_clinic_id or clinic_id, resolved_date, normalized_service_ids
        )
        clinic_services = await client.get_clinic_services_by_clinic(
            resolved_clinic_id or clinic_id
        )
    except BackendClientError as exc:
        logger.error(f"check_available_slots failed: {exc}")
        return _attach_booking_error_metadata(
            {
                "clinic_id": clinic_id,
                "resolved_clinic_id": resolved_clinic_id or clinic_id,
                "resolved_clinic": clinic_resolution.get("clinic"),
                "date": resolved_date,
                "services": normalized_service_ids,
                "resolved_service_ids": normalized_service_ids,
                "resolved_service_names": [],
                "recommended_slots": [],
                "alternative_slots": [],
                "available_slots": [],
                "total_slots": 0,
                "needs_clarification": False,
                "next_best_action": "retry",
                "message": f"Khong the kiem tra slot luc nay: {exc}",
            },
            error_code="INTERNAL_ERROR",
            suggestion="Vui lòng thử kiểm tra slot lại sau ít phút.",
            recoverable=True,
        )

    service_duration_values = [
        int(service.get("durationTime") or 0)
        for service in clinic_services
        if isinstance(service, dict)
        and str(service.get("serviceId")) in normalized_service_ids
    ]
    service_names = [
        _format_service_display_name(service.get("name"), service.get("petType"))
        or service.get("name")
        for service in clinic_services
        if isinstance(service, dict)
        and str(service.get("serviceId")) in normalized_service_ids
        and service.get("name")
    ]
    duration_minutes = max(sum(service_duration_values), 30)

    raw_slots = (
        slots_response.get("availableSlots", [])
        if isinstance(slots_response, dict)
        else []
    )
    if raw_slots is None:
        raw_slots = []
    if isinstance(raw_slots, (str, dict)):
        raw_slots = [raw_slots]

    formatted_slots = []
    for slot in raw_slots:
        parsed_start = _parse_slot_start_time(slot)
        if parsed_start is None:
            logger.warning(
                f"Skipping invalid slot payload for clinic {clinic_id}: {slot}"
            )
            continue
        if not _slot_matches_time_preference(
            parsed_start,
            exact_time=resolved_exact_time,
            time_preference=resolved_time_preference,
        ):
            continue
        end_time = (
            datetime.combine(date_cls.today(), parsed_start)
            + timedelta(minutes=duration_minutes)
        ).time()
        formatted_slots.append(
            {
                "start_time": parsed_start.strftime("%H:%M"),
                "end_time": end_time.strftime("%H:%M"),
                "duration_minutes": duration_minutes,
                "staff_available": None,
            }
        )

    return _attach_booking_error_metadata(
        {
            "clinic_id": clinic_id,
            "resolved_clinic_id": resolved_clinic_id or clinic_id,
            "resolved_clinic": clinic_resolution.get("clinic"),
            "date": resolved_date,
            "services": service_names or normalized_service_ids,
            "resolved_service_ids": normalized_service_ids,
            "resolved_service_names": service_names,
            "recommended_slots": formatted_slots,
            "alternative_slots": [],
            "available_slots": formatted_slots,
            "total_slots": len(formatted_slots),
            "message": None
            if formatted_slots
            else "Khong con slot phu hop trong ngay nay. Ban co the thu buoi khac hoac ngay khac gan nhat.",
            "resolved_time_preference": resolved_time_preference,
            "exact_match": bool(resolved_exact_time and formatted_slots),
            "preferred_unavailable": False,
            "needs_clarification": not bool(formatted_slots),
            "next_best_action": "choose_another_time"
            if not formatted_slots
            else "select_slot",
        },
        error_code="NO_SLOTS_AVAILABLE" if not formatted_slots else "",
        suggestion="Vui lòng chọn ngày hoặc khung giờ khác."
        if not formatted_slots
        else None,
        recoverable=True if not formatted_slots else None,
    )


@mcp_server.tool
@_standardize_booking_tool_response
async def get_available_staff_for_reassign(
    booking_id: str,
    service_id: str,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Lấy danh sách nhân viên khả dụng để phân công lại cho một dịch vụ cụ thể trong lịch hẹn.

    Sử dụng khi:
    - User (Clinic Manager/Owner) muốn thay đổi nhân viên thực hiện một dịch vụ trong lịch hẹn.
    - Cần xem danh sách nhân viên rảnh vào thời gian của dịch vụ đó.

    Params:
        booking_id: ID của lịch hẹn
        service_id: ID của dịch vụ (thuộc clinic_service_id)

    Returns:
        staff_list: Danh sách nhân viên khả dụng
        ui_card: Tên UI card hiển thị
    """
    logger.info(f"🔧 [TOOL] ===== get_available_staff_for_reassign =====")
    logger.info(f"  ├─ Input: booking_id={booking_id}, service_id={service_id}")

    try:
        token = _require_auth_token()
    except AuthenticationRequiredError as e:
        return {
            "staff_list": [],
            "message": str(e),
            "requires_auth": True,
        }

    client = get_backend_client()
    try:
        response = await client.get_available_staff_for_reassign(
            token, booking_id, service_id
        )
    except BackendClientError as exc:
        logger.error(f"get_available_staff_for_reassign failed: {exc}")
        return _attach_booking_error_metadata(
            {
                "staff_list": [],
                "message": f"Không thể lấy danh sách nhân viên lúc này: {exc}",
            },
            error_code="INTERNAL_ERROR",
            suggestion="Vui lòng thử lại sau.",
            recoverable=True,
        )

    return {
        "staff_list": response,
        "ui_card": "staff_list_card",
        "message": "Đã lấy danh sách nhân viên khả dụng.",
    }


@mcp_server.tool
@_standardize_booking_tool_response
async def reassign_staff_for_service(
    booking_id: str,
    service_id: str,
    booking_service_item_id: str,
    new_staff_id: str,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Phân công lại nhân viên cho một dịch vụ cụ thể trong lịch hẹn.

    Sử dụng khi:
    - User (Clinic Manager/Owner) đã chọn một nhân viên mới để thay thế cho nhân viên cũ của dịch vụ đó.

    Params:
        booking_id: ID của lịch hẹn
        service_id: ID của dịch vụ (clinic_service_id)
        booking_service_item_id: ID cụ thể của dịch vụ trong lịch hẹn (BookingServiceItemResponse.bookingServiceId)
        new_staff_id: ID của nhân viên mới sẽ thực hiện dịch vụ

    Returns:
        booking: Thông tin lịch hẹn sau khi đã cập nhật
        ui_card: Tên UI card hiển thị
    """
    logger.info(f"🔧 [TOOL] ===== reassign_staff_for_service =====")
    logger.info(
        f"  ├─ Input: booking_id={booking_id}, service_id={service_id}, booking_service_item_id={booking_service_item_id}, new_staff_id={new_staff_id}"
    )

    try:
        token = _require_auth_token()
    except AuthenticationRequiredError as e:
        return {
            "success": False,
            "message": str(e),
            "requires_auth": True,
        }

    client = get_backend_client()
    payload = {
        "bookingServiceItemId": booking_service_item_id,
        "newStaffId": new_staff_id,
    }

    try:
        response = await client.reassign_staff_for_service(
            token, booking_id, service_id, payload
        )
    except BackendClientError as exc:
        logger.error(f"reassign_staff_for_service failed: {exc}")
        return _attach_booking_error_metadata(
            {
                "success": False,
                "message": f"Không thể phân công lại nhân viên lúc này: {exc}",
            },
            error_code="INTERNAL_ERROR",
            suggestion="Vui lòng thử lại sau.",
            recoverable=True,
        )

    return {
        "success": True,
        "booking": response,
        "ui_card": "booking_detail_card",
        "message": "Đã phân công lại nhân viên thành công.",
    }


@mcp_server.tool
@_standardize_booking_tool_response
async def confirm_booking_manager(
    booking_id: str,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Xác nhận lịch hẹn (chỉ dành cho Quản lý/Chủ phòng khám).

    Sử dụng khi:
    - Quản lý/Chủ phòng khám muốn xác nhận một lịch hẹn đang ở trạng thái PENDING.

    Params:
        booking_id: ID của lịch hẹn cần xác nhận

    Returns:
        booking: Thông tin lịch hẹn sau khi xác nhận
        ui_card: Tên UI card hiển thị
        success: Trạng thái thành công
    """
    logger.info(f"🔧 [TOOL] ===== confirm_booking_manager =====")
    logger.info(f"  ├─ Input: booking_id={booking_id}")

    try:
        token = _require_auth_token()
    except AuthenticationRequiredError as e:
        return {
            "success": False,
            "message": str(e),
            "requires_auth": True,
        }

    client = get_backend_client()
    try:
        response = await client.confirm_booking(token, booking_id)
    except BackendClientError as exc:
        logger.error(f"confirm_booking_manager failed: {exc}")
        return _attach_booking_error_metadata(
            {
                "success": False,
                "message": f"Không thể xác nhận lịch hẹn lúc này: {exc}",
            },
            error_code="INTERNAL_ERROR",
            suggestion="Vui lòng thử lại sau.",
            recoverable=True,
        )

    return {
        "success": True,
        "booking": response,
        "ui_card": "booking_detail_card",
        "message": "Đã xác nhận lịch hẹn thành công.",
    }


@mcp_server.tool
@_standardize_booking_tool_response
async def cancel_booking_manager(
    booking_id: Optional[str] = None,
    booking_code_hint: Optional[str] = None,
    reason: str = "Huỷ bởi quản lý/AI",
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Hủy lịch hẹn (chỉ dành cho Quản lý/Chủ phòng khám).

    Sử dụng khi:
    - Quản lý/Chủ phòng khám muốn hủy một lịch hẹn.
    - Có thể cung cấp booking_id hoặc booking_code_hint (mã booking).

    Params:
        booking_id: ID của lịch hẹn cần hủy (UUID). Ưu tiên dùng ID.
        booking_code_hint: Mã lịch hẹn để tra cứu nếu không có booking_id.
        reason: Lý do hủy lịch hẹn (bắt buộc)

    Returns:
        booking: Thông tin lịch hẹn sau khi hủy
        ui_card: Tên UI card hiển thị
        success: Trạng thái thành công
    """
    logger.info(f"🔧 [TOOL] ===== cancel_booking_manager =====")
    logger.info(
        f"  ├─ Input: booking_id={booking_id}, booking_code={booking_code_hint}, reason={reason}"
    )

    client = get_backend_client()
    try:
        token = _require_auth_token()
    except AuthenticationRequiredError as e:
        return build_tool_error_response(
            error_code="UNAUTHORIZED",
            message=str(e),
            recoverable=True,
            suggestion="Vui lòng đăng nhập lại.",
        )

    # Resolve booking_id from booking_code_hint if needed
    if not booking_id and booking_code_hint:
        try:
            # We reuse get_my_booking_info tool logic if possible,
            # or just call backend directly
            # For simplicity, we call get_my_booking_info directly
            booking_info = await get_my_booking_info(booking_code=booking_code_hint)
            if booking_info.get("success") and booking_info.get("booking"):
                booking_id = booking_info["booking"].get("id")
        except Exception as e:
            logger.warning(f"Failed to resolve booking code {booking_code_hint}: {e}")

    if not booking_id:
        return build_tool_error_response(
            error_code="BOOKING_NOT_FOUND",
            message=f"Không tìm thấy lịch hẹn có mã '{booking_code_hint}'.",
            recoverable=True,
            suggestion="Vui lòng kiểm tra lại mã hoặc xem danh sách đặt lịch của bạn.",
        )

    if not str(reason or "").strip():
        return _attach_booking_error_metadata(
            {
                "success": False,
                "message": "Vui lòng cung cấp lý do hủy lịch hẹn.",
                "needs_clarification": True,
            },
            error_code="INVALID_INPUT",
            suggestion="Lý do hủy là bắt buộc.",
            recoverable=True,
        )

    client = get_backend_client()
    try:
        response = await client.cancel_booking(token, booking_id, reason)
    except BackendClientError as exc:
        logger.error(f"cancel_booking_manager failed: {exc}")
        return _attach_booking_error_metadata(
            {
                "success": False,
                "message": f"Không thể hủy lịch hẹn lúc này: {exc}",
            },
            error_code="INTERNAL_ERROR",
            suggestion="Vui lòng thử lại sau.",
            recoverable=True,
        )

    return {
        "success": True,
        "booking": response,
        "ui_card": "booking_detail_card",
        "message": "Đã hủy lịch hẹn thành công.",
    }


@mcp_server.tool
@_standardize_booking_tool_response
async def create_booking_for_user(
    pet_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
    booking_date: Optional[str] = None,
    start_time: Optional[str] = None,
    service_ids: Optional[List[str]] = None,
    booking_type: Optional[str] = None,
    notes: Optional[str] = None,
    home_address: Optional[str] = None,
    home_lat: Optional[float] = None,
    home_long: Optional[float] = None,
    distance_km: Optional[float] = None,
    user_id: Optional[str] = None,
    confirmed: bool = False,
    auto_create_if_available: bool = False,
    date_expression: Optional[str] = None,
    time_preference: Optional[str] = None,
    transcript: Optional[str] = None,
    latest_message: Optional[str] = None,
    items: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Tao yeu cau booking cho user sau khi da xac nhan ro rang.

    Supports single-pet (pet_id + service_ids) and multi-pet (items) modes.
    When items is provided with non-empty list, multi-pet mode is used.

    Multi-pet mode example:
        items = [
            {"pet_id": "uuid1", "pet_hint": "bé mèo 1", "service_ids": ["svc1", "svc2"]},
            {"pet_id": "uuid2", "pet_hint": "bé mèo 2", "service_ids": ["svc1"]}
        ]

    auto_create_if_available: When True, treats the request as user having conditionally
    confirmed ("nếu còn slot thì tạo"). Backend will auto-create if slot is available.
    """
    try:
        resolved_user_id = _resolve_user_id(user_id)
    except RuntimeError as exc:
        response = build_tool_error_response(
            error_code="UNAUTHORIZED",
            message=str(exc),
            recoverable=True,
            suggestion="Vui long dang nhap lai bang tai khoan hop le roi thu lai.",
            metadata={"requires_auth": True},
        )
        response["ready_to_create"] = False
        response["requires_auth"] = True
        return response
    try:
        token = _require_auth_token()
    except AuthenticationRequiredError as e:
        response = build_tool_error_response(
            error_code="UNAUTHORIZED",
            message=str(e),
            recoverable=True,
            suggestion="Vui lòng đăng nhập lại để tiếp tục đặt lịch.",
            metadata={"requires_auth": True},
        )
        response["ready_to_create"] = False
        response["requires_auth"] = True
        return response

    client = get_backend_client()
    clinic_resolution = await _resolve_clinic_reference(
        clinic_ref=clinic_id,
        token=token,
        pet_id=pet_id,
        booking_type=booking_type,
        transcript=transcript,
        latest_message=latest_message,
    )
    resolved_clinic_id = str(clinic_resolution.get("clinic_id") or "").strip()
    if clinic_resolution.get("needs_clarification") and not resolved_clinic_id:
        return _attach_booking_error_metadata(
            {
                "success": False,
                "ready_to_create": False,
                "missing_fields": [],
                "clinic_options": clinic_resolution.get("clinics") or [],
                "needs_clarification": True,
                "next_best_action": "choose_clinic",
                "message": clinic_resolution.get("message")
                or "Minh can xac nhan phong kham truoc khi tao yeu cau booking.",
            },
            error_code="CLINIC_NOT_FOUND",
            suggestion="Vui lòng chọn đúng phòng khám trước khi tạo booking.",
            recoverable=True,
        )

    normalized_service_ids = [
        str(service_id).strip()
        for service_id in (service_ids or [])
        if str(service_id).strip()
    ]
    resolved_datetime = _resolve_booking_datetime_inputs(
        date=booking_date,
        date_expression=date_expression,
        exact_time=start_time,
        time_preference=time_preference,
        latest_message=latest_message,
        transcript=transcript,
    )
    resolved_booking_date = resolved_datetime.get("date")
    resolved_start_time = resolved_datetime.get("exact_time") or (
        str(start_time or "").strip() or None
    )
    normalized_booking_type = _normalize_booking_type(
        booking_type=booking_type,
        home_address=home_address,
        home_lat=home_lat,
        home_long=home_long,
    )

    # Check for multi-pet mode
    is_multi_pet = items is not None and len(items) > 0

    # Validate multi-pet items
    if is_multi_pet:
        for i, item in enumerate(items):
            if not item.get("pet_id") and not item.get("pet_hint"):
                return {
                    "success": False,
                    "ready_to_create": False,
                    "missing_fields": [f"pet_id hoac pet_hint cho thu cung #{i + 1}"],
                    "needs_clarification": True,
                    "next_best_action": "collect_missing_fields",
                    "message": f"Thu cung #{i + 1} can co pet_id hoac pet_hint.",
                    "error_code": "PET_NOT_FOUND",
                    "title": get_error_title("PET_NOT_FOUND"),
                    "recoverable": True,
                    "suggestion": "Vui lòng chọn đúng thú cưng cho từng mục booking.",
                }
            if not item.get("service_ids"):
                return {
                    "success": False,
                    "ready_to_create": False,
                    "missing_fields": [f"service_ids cho thu cung #{i + 1}"],
                    "needs_clarification": True,
                    "next_best_action": "collect_missing_fields",
                    "message": f"Thu cung #{i + 1} can co it nhat mot dich vu.",
                    "error_code": "SERVICE_NOT_FOUND",
                    "title": get_error_title("SERVICE_NOT_FOUND"),
                    "recoverable": True,
                    "suggestion": "Vui lòng chọn ít nhất một dịch vụ cho từng thú cưng.",
                }

    # For multi-pet, we don't need single pet validation
    missing_fields: List[str] = []
    if not is_multi_pet and not pet_id:
        missing_fields.append("pet_id")

    if not resolved_booking_date:
        missing_fields.append("ngay kham")
    if not is_multi_pet and not normalized_service_ids:
        missing_fields.append("dich vu")
    if not resolved_start_time:
        missing_fields.append("gio kham")

    if normalized_booking_type == "HOME_VISIT":
        if not home_address:
            missing_fields.append("dia chi kham tai nha")
        if home_lat is None:
            missing_fields.append("toa do vi do")
        if home_long is None:
            missing_fields.append("toa do kinh do")
        if distance_km is None:
            missing_fields.append("khoang cach di chuyen")

    draft_preview = _build_booking_confirmation_snapshot(
        pet_id=pet_id,
        clinic_id=resolved_clinic_id or clinic_id,
        clinic_name=(clinic_resolution.get("clinic") or {}).get("name"),
        booking_date=resolved_booking_date,
        start_time=resolved_start_time,
        service_ids=normalized_service_ids,
        booking_type=normalized_booking_type,
        notes=notes,
        home_address=home_address,
        distance_km=distance_km,
        items=items,
    )

    if missing_fields:
        return _attach_booking_error_metadata(
            {
                "success": False,
                "ready_to_create": False,
                "missing_fields": missing_fields,
                "needs_clarification": True,
                "next_best_action": "fill_booking_form",
                "message": (
                    "Minh da tao ban nhap booking tu thong tin ban da cung cap. "
                    f"Con thieu: {', '.join(missing_fields)}. "
                    "Ban co the mo form dat lich de dien nhanh phan con lai, roi xac nhan trong mot lan."
                ),
                "booking_preview": draft_preview,
            },
            error_code="INVALID_INPUT",
            suggestion="Vui lòng bổ sung đầy đủ thông tin còn thiếu trước khi tạo booking.",
            recoverable=True,
        )

    confirmation_snapshot = _build_booking_confirmation_snapshot(
        pet_id=pet_id,
        clinic_id=resolved_clinic_id or clinic_id,
        clinic_name=(clinic_resolution.get("clinic") or {}).get("name"),
        booking_date=resolved_booking_date,
        start_time=resolved_start_time,
        service_ids=normalized_service_ids,
        booking_type=normalized_booking_type,
        notes=notes,
        home_address=home_address,
        distance_km=distance_km,
        items=items,
    )
    if _is_create_booking_denied_by_user(latest_message, transcript):
        return _attach_booking_error_metadata(
            {
                "success": False,
                "ready_to_create": False,
                "missing_fields": [],
                "needs_clarification": True,
                "next_best_action": "cancel_or_change",
                "message": "Mình đã nhận là bạn chưa muốn tạo booking lúc này, nên sẽ không tạo lịch. Nếu cần, bạn có thể yêu cầu chỉnh sửa thông tin hoặc bắt đầu lại khi sẵn sàng.",
                "booking_preview": confirmation_snapshot,
            },
            error_code="INVALID_CONFIRMATION",
            suggestion="Khi bạn muốn tiếp tục, vui lòng xác nhận lại rõ ràng để mình tạo booking.",
            recoverable=True,
        )

    effective_confirmed = confirmed or auto_create_if_available
    if not effective_confirmed:
        return _attach_booking_error_metadata(
            {
                "success": False,
                "ready_to_create": False,
                "missing_fields": [],
                "needs_clarification": True,
                "next_best_action": "confirm_booking",
                "message": "Minh da co du du lieu co ban nhung chua co xac nhan cuoi tu ban. Hay xac nhan ro rang truoc khi minh tao yeu cau booking.",
                "booking_preview": confirmation_snapshot,
            },
            error_code="CONFIRMATION_REQUIRED",
            suggestion="Vui lòng xác nhận lại bản tóm tắt booking trước khi tạo lịch.",
            recoverable=True,
        )

    guard_error = _evaluate_booking_confirmation_guard(
        confirmation_snapshot=confirmation_snapshot,
        confirmed=confirmed,
        auto_create_if_available=auto_create_if_available,
        latest_message=latest_message,
        transcript=transcript,
    )
    if guard_error:
        response = dict(guard_error)
        response["ready_to_create"] = False
        response["needs_clarification"] = response.get("recoverable", True)
        response.setdefault("next_best_action", "confirm_booking")
        response.setdefault("booking_preview", confirmation_snapshot)
        if state_meta := response.get("metadata"):
            response["metadata"] = state_meta
        return response

    if is_multi_pet:
        # Multi-pet mode: format items for backend
        create_payload = {
            "clinicId": resolved_clinic_id or clinic_id,
            "bookingDate": resolved_booking_date,
            "startTime": resolved_start_time,
            "bookingType": normalized_booking_type,
            "notes": notes,
            "homeAddress": home_address,
            "homeLat": home_lat,
            "homeLong": home_long,
            "distanceKm": distance_km,
            "confirmed": True,
            "timePreference": resolved_datetime.get("time_preference"),
            "dateExpression": date_expression,
            "transcript": transcript,
            "latestMessage": latest_message,
            "items": [
                {
                    "petId": item.get("pet_id"),
                    "petHint": item.get("pet_hint"),
                    "serviceIds": item.get("service_ids", []),
                }
                for item in items
            ],
        }
    else:
        # Single-pet mode (legacy)
        create_payload = {
            "petId": pet_id,
            "clinicId": resolved_clinic_id or clinic_id,
            "bookingDate": resolved_booking_date,
            "startTime": resolved_start_time,
            "serviceIds": normalized_service_ids,
            "bookingType": normalized_booking_type,
            "notes": notes,
            "homeAddress": home_address,
            "homeLat": home_lat,
            "homeLong": home_long,
            "distanceKm": distance_km,
            "confirmed": True,
            "timePreference": resolved_datetime.get("time_preference"),
            "dateExpression": date_expression,
            "transcript": transcript,
            "latestMessage": latest_message,
        }

    try:
        booking = await client.create_ai_booking(token, create_payload)
    except BackendClientError as exc:
        logger.error(f"create_booking_for_user failed: {exc}")
        response = _booking_retry_error(
            "Không thể tạo yêu cầu đặt lịch lúc này.",
            error_code="BOOKING_CREATE_FAILED",
        )
        response["ready_to_create"] = False
        response["needs_clarification"] = False
        response["next_best_action"] = "retry"
        response["metadata"] = {"root_error": str(exc)}
        return response

    # Handle multi-pet response
    if is_multi_pet and booking.get("bookings"):
        bookings_list = []
        for b in booking.get("bookings", []):
            bookings_list.append(
                {
                    "id": b.get("bookingId"),
                    "booking_code": b.get("bookingCode"),
                    "status": b.get("status"),
                    "pet_name": b.get("petName"),
                    "clinic_name": b.get("clinicName"),
                    "date": b.get("bookingDate") or resolved_booking_date,
                    "time": str(b.get("bookingTime", "") or resolved_start_time)[:5]
                    if resolved_start_time
                    else None,
                    "type": b.get("type") or normalized_booking_type,
                    "services": b.get("services", []),
                    "manager_will_confirm": b.get("managerWillConfirm", True),
                }
            )

        summary = booking.get("multiPetSummary", {})
        result_payload = {
            "success": booking.get("success", True),
            "ready_to_create": True,
            "is_final": True,
            "needs_clarification": False,
            "next_best_action": "await_manager_confirmation",
            "bookings": bookings_list,
            "multi_pet_summary": {
                "total_bookings": summary.get("totalBookings", len(bookings_list)),
                "success_count": summary.get("successCount", len(bookings_list)),
                "failure_count": summary.get("failureCount", 0),
                "pet_names": summary.get("petNames", ""),
                "clinic_name": summary.get("clinicName"),
                "date": summary.get("bookingDate") or resolved_booking_date,
                "time": summary.get("bookingTime") or resolved_start_time,
            },
            "message": booking.get("message")
            or f"Da tao {len(bookings_list)} yeu cau booking. Clinic manager se xac nhan sau.",
        }
        return result_payload

    # Handle single-pet response (legacy)
    services = []
    raw_pets = booking.get("pets", []) or []
    if isinstance(raw_pets, dict):
        raw_pets = [raw_pets]
    for pet_summary in raw_pets:
        if not isinstance(pet_summary, dict):
            continue
        for service in pet_summary.get("services", []) or []:
            if isinstance(service, dict) and service.get("serviceName"):
                services.append(service.get("serviceName"))

    if not services:
        services = normalized_service_ids

    result_payload = {
        "success": True,
        "ready_to_create": True,
        "is_final": True,
        "needs_clarification": False,
        "next_best_action": "await_manager_confirmation",
        "booking": {
            "id": booking.get("bookingId")
            or booking.get("booking", {}).get("bookingId")
            if isinstance(booking.get("booking"), dict)
            else None,
            "booking_code": booking.get("bookingCode")
            or (
                booking.get("booking", {}).get("bookingCode")
                if isinstance(booking.get("booking"), dict)
                else None
            ),
            "status": booking.get("status")
            or (
                booking.get("booking", {}).get("status")
                if isinstance(booking.get("booking"), dict)
                else None
            ),
            "pet_name": booking.get("petName")
            or (
                booking.get("booking", {}).get("petName")
                if isinstance(booking.get("booking"), dict)
                else None
            ),
            "clinic_name": booking.get("clinicName")
            or (
                booking.get("booking", {}).get("clinicName")
                if isinstance(booking.get("booking"), dict)
                else None
            ),
            "date": booking.get("bookingDate") or resolved_booking_date,
            "time": str(booking.get("bookingTime", "") or resolved_start_time)[:5]
            if resolved_start_time
            else None,
            "type": booking.get("type") or normalized_booking_type,
            "services": services,
            "estimated_total": booking.get("totalPrice"),
            "home_address": booking.get("homeAddress") or home_address,
            "distance_km": booking.get("distanceKm") or distance_km,
            "user_id": resolved_user_id,
            "manager_will_confirm": booking.get("managerWillConfirm", True),
        },
        "message": (
            f"Da tao yeu cau booking cho {booking.get('petName') or 'thu cung cua ban'} tai "
            f"{booking.get('clinicName') or 'phong kham da chon'}. Clinic manager se xac nhan sau."
        ),
    }
    return result_payload


@mcp_server.tool
@_standardize_booking_tool_response
async def view_clinic_bookings(
    clinic_id: str,
    status: Optional[str] = None,
    booking_type: Optional[str] = None,
    date_hint: Optional[str] = None,
    page: int = 0,
    size: int = 20,
) -> Dict[str, Any]:
    """Xem danh sách lịch hẹn của phòng khám (dành cho Quản lý/Chủ phòng khám).

    Sử dụng khi:
    - Manager hoặc Clinic Owner muốn xem danh sách lịch khám của phòng khám mình quản lý.
    - Cần lọc lịch hẹn theo trạng thái hoặc loại lịch.

    Params:
        clinic_id: ID của phòng khám (bắt buộc)
        status: Trạng thái booking (PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED)
        booking_type: Loại lịch (IN_CLINIC, HOME_VISIT)
        date_hint: (Tương lai) lọc theo ngày
        page: Trang hiện tại (mặc định 0)
        size: Số lượng kết quả mỗi trang (mặc định 20)

    Returns:
        bookings: Danh sách booking
        total_elements: Tổng số booking
        total_pages: Tổng số trang
        current_page: Trang hiện tại
        ui_card: Tên thẻ giao diện đề xuất hiển thị
    """
    logger.info(f"🔧 [TOOL] ===== view_clinic_bookings =====")
    logger.info(
        f"  ├─ Input: clinic_id={clinic_id}, status={status}, booking_type={booking_type}, page={page}, size={size}"
    )

    try:
        token = _require_auth_token()
    except AuthenticationRequiredError as e:
        logger.warning(f"  └─ ❌ Auth required: {e}")
        return {
            "bookings": [],
            "message": str(e),
            "requires_auth": True,
        }

    client = get_backend_client()
    try:
        response = await client.get_clinic_bookings(
            token=token,
            clinic_id=clinic_id,
            status=status,
            booking_type=booking_type,
            page=page,
            size=size,
        )
    except BackendClientError as exc:
        logger.error(f"  └─ ❌ Backend error: {exc}")
        return _attach_booking_error_metadata(
            {
                "bookings": [],
                "total_elements": 0,
                "total_pages": 0,
                "current_page": page,
                "message": f"Không thể lấy danh sách lịch hẹn lúc này: {exc}",
            },
            error_code="INTERNAL_ERROR",
            suggestion="Vui lòng thử lại sau ít phút.",
            recoverable=True,
        )

    raw_bookings = response.get("content") or []

    formatted_bookings = []
    for b in raw_bookings:
        if not isinstance(b, dict):
            continue
        formatted_bookings.append(
            {
                "id": b.get("id") or b.get("bookingId"),
                "booking_code": b.get("bookingCode"),
                "pet_name": b.get("petName"),
                "owner_name": b.get("ownerName"),
                "date": b.get("bookingDate"),
                "time": b.get("bookingTime"),
                "status": b.get("status"),
                "type": b.get("type") or b.get("bookingType"),
                "total_price": b.get("totalPrice"),
                "assigned_staff_name": b.get("assignedStaffName") or b.get("staffName"),
                "services": b.get("services", []),
            }
        )

    result = {
        "bookings": formatted_bookings,
        "total_elements": response.get("totalElements") or len(formatted_bookings),
        "total_pages": response.get("totalPages") or 1,
        "current_page": page,
        "ui_card": "booking_list_card",
        "message": None if formatted_bookings else "Chưa có lịch hẹn nào.",
    }
    logger.info(f"  └─ ✅ Returning {len(formatted_bookings)} bookings")
    return result
