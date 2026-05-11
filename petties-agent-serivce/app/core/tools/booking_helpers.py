"""Shared booking helper functions."""

from __future__ import annotations

import re
from functools import wraps
from datetime import date as date_cls, datetime, time
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
    build_tool_error_response,
    classify_error_code,
    get_error_title,
)
from app.services.backend_client import BackendClientError, get_backend_client

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
        "dose_label": record.get("doseLabel"),
        "date": record.get("date"),
        "is_active": record.get("isActive"),
        "status": record.get("status"),
        "next_dose_date": record.get("nextDoseDate"),
        "next_dose_template_id": record.get("nextDoseTemplateId"),
    }
