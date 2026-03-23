"""Booking AI tools cho Pet Owner business chat."""

from __future__ import annotations

import re
from datetime import date as date_cls, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from loguru import logger

from app.core.agents.booking_context import (
    resolve_booking_datetime_inputs as _shared_resolve_booking_datetime_inputs,
)
from app.core.agents.text_utils import normalize_vietnamese_text
from app.core.tool_runtime_context import (
    get_tool_runtime_context,
    require_tool_runtime_context,
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


def _require_auth_token() -> Optional[str]:
    context = require_tool_runtime_context()
    if not context.auth_token:
        logger.warning(
            "JWT token not available for booking tools - using optional auth mode"
        )
        return None
    return context.auth_token


def _get_optional_auth_token() -> Optional[str]:
    context = get_tool_runtime_context()
    return context.auth_token if context else None


def _resolve_user_id(requested_user_id: Optional[str]) -> str:
    context = require_tool_runtime_context()
    if requested_user_id and requested_user_id != context.user_id:
        raise RuntimeError("User ID khong khop voi session hien tai")
    return requested_user_id or context.user_id


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


def _tokenize_match_text(*texts: Optional[str]) -> List[str]:
    normalized = normalize_vietnamese_text(" ".join(text for text in texts if text))
    tokens = re.findall(r"[a-z0-9]+", normalized)
    return [
        token for token in tokens if len(token) > 1 and token not in _MATCH_STOPWORDS
    ]


def _filter_clinics_by_hint(
    clinics: List[Dict[str, Any]],
    clinic_hint: Optional[str],
) -> List[Dict[str, Any]]:
    normalized_hint = normalize_vietnamese_text(clinic_hint or "")
    if not normalized_hint:
        return clinics

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
        if all(token in haystack for token in hint_tokens):
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
        matched_services.append(
            {
                "id": service.get("serviceId") or service.get("id"),
                "name": service.get("name"),
                "category": category,
                "base_price": service.get("basePrice") or service.get("base_price"),
                "description": service.get("description"),
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
        "petSpecies": pet_species or resolved_pet.get("species"),
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
        return {
            "clinic_id": resolved_clinic.get("id"),
            "clinic_hint": normalized_ref,
            "clinic": resolved_clinic,
            "clinics": clinics,
            "needs_clarification": False,
            "auto_selected": True,
        }

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
    service: Dict[str, Any], *, hint_tokens: List[str], context_tokens: List[str]
) -> int:
    haystack = _build_service_match_text(service)
    if not haystack:
        return 0
    score = 0
    joined_hint = " ".join(hint_tokens).strip()
    if joined_hint and joined_hint in haystack:
        score += 100
    for token in hint_tokens:
        if token in haystack:
            score += 20
    for token in context_tokens:
        if token in haystack:
            score += 5
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

    payload = {
        "latitude": latitude,
        "longitude": longitude,
        "address": address,
        "petId": pet_id,
        "clinicHint": clinic_hint,
        "serviceHint": service_hint,
        "petSpecies": pet_species,
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
async def get_user_pets(user_id: Optional[str] = None) -> Dict[str, Any]:
    """Lay danh sach thu cung cua user hien tai de phuc vu booking flow."""
    resolved_user_id = _resolve_user_id(user_id)
    token = _require_auth_token()
    client = get_backend_client()

    if not token:
        return {
            "user_id": resolved_user_id,
            "pets": [],
            "total_pets": 0,
            "message": "Chua dang nhap - khong the lay danh sach thu cung. Vui long dang nhap truoc.",
            "requires_auth": True,
        }

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

    if not formatted_pets:
        return {
            "user_id": resolved_user_id,
            "pets": [],
            "total_pets": 0,
            "message": "Ban chua co thu cung nao trong ho so.",
        }

    return {
        "user_id": resolved_user_id,
        "pets": formatted_pets,
        "total_pets": len(formatted_pets),
        "ui_card": {
            "type": "pet_list",
            "pets": formatted_pets,
        },
    }


@mcp_server.tool
async def get_clinic_services(
    clinic_id: str,
    pet_species: Optional[str] = None,
    is_home_visit: Optional[bool] = None,
    service_hint: Optional[str] = None,
    booking_type: Optional[str] = None,
    transcript: Optional[str] = None,
    latest_message: Optional[str] = None,
) -> Dict[str, Any]:
    """Lay danh sach dich vu cua phong kham va resolve theo ngu canh neu co."""
    optional_token = _get_optional_auth_token()
    clinic_resolution = await _resolve_clinic_reference(
        clinic_ref=clinic_id,
        token=optional_token,
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
            "services": [],
            "matched_services": [],
            "resolved_service_ids": [],
            "suggested_service_options": [],
            "needs_clarification": True,
            "total_services": 0,
            "message": clinic_resolution.get("message")
            or "Minh can xac nhan phong kham truoc khi tai danh sach dich vu.",
        }

    client = get_backend_client()
    try:
        services = await client.get_clinic_services(
            resolved_clinic_id or clinic_id,
            pet_species=pet_species,
            is_home_visit=is_home_visit,
        )
    except BackendClientError as exc:
        logger.error(f"get_clinic_services failed: {exc}")
        return {
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
        }

    formatted_services = [
        {
            "id": service.get("serviceId"),
            "name": service.get("name"),
            "description": service.get("description"),
            "base_price": service.get("basePrice"),
            "duration_minutes": service.get("durationTime"),
            "slots_required": service.get("slotsRequired"),
            "category": service.get("serviceCategory"),
            "service_category": service.get("serviceCategory"),
            "pet_type": service.get("petType"),
            "is_home_visit": service.get("isHomeVisit"),
            "reminder_interval": service.get("reminderInterval"),
            "reminder_unit": service.get("reminderUnit"),
            "vaccine_template_id": service.get("vaccineTemplateId"),
            "is_vaccination": service.get("serviceCategory") == "VACCINATION",
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

    hint_tokens = _tokenize_match_text(service_hint)
    context_tokens = _tokenize_match_text(latest_message, transcript, booking_type)
    ranked_services = []
    if hint_tokens or context_tokens:
        for service in formatted_services:
            score = _score_service_match(
                service, hint_tokens=hint_tokens, context_tokens=context_tokens
            )
            if score > 0:
                ranked_services.append((score, service))
        ranked_services.sort(key=lambda item: item[0], reverse=True)

    matched_services = [service for _, service in ranked_services[:3]]
    resolved_service_ids = [
        str(service.get("id")) for service in matched_services if service.get("id")
    ]
    suggested_service_options = [
        {
            "id": service.get("id"),
            "name": service.get("name"),
            "base_price": service.get("base_price"),
            "category": service.get("category"),
        }
        for service in formatted_services[:5]
    ]
    needs_clarification = bool(service_hint and not matched_services)

    return {
        "clinic_id": resolved_clinic_id or clinic_id,
        "resolved_clinic_id": resolved_clinic_id or clinic_id,
        "resolved_clinic": clinic_resolution.get("clinic"),
        "filters": {
            "pet_species": pet_species,
            "is_home_visit": is_home_visit,
            "booking_type": booking_type,
        },
        "services": formatted_services,
        "matched_services": matched_services,
        "resolved_service_ids": resolved_service_ids,
        "suggested_service_options": suggested_service_options,
        "needs_clarification": needs_clarification,
        "match_hint": service_hint,
        "total_services": len(formatted_services),
        "message": None
        if formatted_services
        else "Phong kham hien chua co du lieu dich vu kha dung.",
        "ui_card": {
            "type": "service_chips",
            "clinic_id": resolved_clinic_id or clinic_id,
            "services": matched_services[:6]
            if matched_services
            else formatted_services[:6],
            "message": "Mình đã lấy được danh sách dịch vụ phù hợp. Bạn chọn dịch vụ cần đặt lịch nhé.",
        },
    }


@mcp_server.tool
async def check_vaccination_status(
    pet_id: str,
    vaccine_template_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Kiem tra lich su va lich tiem sap toi cua thu cung."""
    client = get_backend_client()
    try:
        token = _require_auth_token()
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
        "ui_card": {
            "type": "vaccination_card",
            "pet_id": pet_id,
            "history": filtered_history,
            "upcoming": filtered_upcoming,
            "message": None,
        },
    }


@mcp_server.tool
async def search_clinics_nearby(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: float = 5.0,
    top_k: int = 5,
    address: Optional[str] = None,
    clinic_hint: Optional[str] = None,
    clinic_name_hint: Optional[str] = None,
    service_hint: Optional[str] = None,
    pet_id: Optional[str] = None,
    pet_species: Optional[str] = None,
    booking_type: Optional[str] = None,
    transcript: Optional[str] = None,
    latest_message: Optional[str] = None,
) -> Dict[str, Any]:
    """Tim phong kham gan vi tri nguoi dung, co the uu tien theo ngu canh booking."""
    client = get_backend_client()
    optional_token = _get_optional_auth_token()
    effective_clinic_hint = str(clinic_hint or clinic_name_hint or "").strip() or None

    context_snapshot = await _resolve_backend_booking_context(
        token=optional_token,
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
    pet_species = pet_species or resolved_pet.get("species")
    booking_type = booking_type or resolved_booking_type
    effective_clinic_hint = effective_clinic_hint or resolved_clinic_hint
    service_hint = service_hint or resolved_service_hint

    if effective_clinic_hint and optional_token:
        effective_radius = None

        payload = {
            "latitude": latitude,
            "longitude": longitude,
            "radiusKm": effective_radius,
            "limit": top_k,
            "address": address,
            "clinicHint": effective_clinic_hint,
            "serviceHint": service_hint,
            "petId": pet_id,
            "petSpecies": pet_species,
            "bookingType": booking_type,
            "transcript": transcript,
            "latestMessage": latest_message,
        }
        try:
            response = await client.get_booking_clinic_options(optional_token, payload)
        except BackendClientError as exc:
            logger.warning(f"search_clinics_nearby clinic-options failed: {exc}")
            return {
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
                "needs_clarification": True,
                "message": "Mình chưa thể tìm phòng khám lúc này. Bạn thử lại sau nhé.",
            }
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
                    return {
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
                        "match_mode": "explicit_name",
                        "auto_select_clinic": False,
                        "needs_clarification": True,
                        "message": "Mình chưa tìm thấy phòng khám khớp với tên bạn vừa nêu. Có thể tên phòng khám hơi khác, bạn kiểm tra lại giúp mình nhé.",
                    }
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
                    "ui_card": {
                        "type": "clinic_suggestion",
                        "clinics": clinics[:5],
                        "total_found": int(response.get("totalFound") or len(clinics)),
                        "location": {
                            "lat": latitude,
                            "lng": longitude,
                            "address": address,
                        },
                    },
                }

    if latitude is None or longitude is None:
        return {
            "query_location": {"lat": latitude, "lng": longitude, "address": address},
            "radius_km": radius_km,
            "clinic_hint": effective_clinic_hint,
            "service_hint": service_hint,
            "clinics": [],
            "matched_clinic": None,
            "total_found": 0,
            "needs_clarification": True,
            "message": "Mình cần vị trí hiện tại hoặc địa chỉ cụ thể để tìm phòng khám gần bạn.",
        }

    try:
        response = await client.find_nearby_clinics(
            latitude, longitude, radius_km, size=max(top_k * 3, 10)
        )
    except BackendClientError as exc:
        logger.error(f"search_clinics_nearby failed: {exc}")
        return {
            "query_location": {"lat": latitude, "lng": longitude, "address": address},
            "radius_km": radius_km,
            "clinic_hint": effective_clinic_hint,
            "service_hint": service_hint,
            "clinics": [],
            "matched_clinic": None,
            "total_found": 0,
            "message": f"Khong the tim phong kham gan day: {exc}",
        }

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
        "match_mode": "explicit_name" if effective_clinic_hint else "nearby",
        "resolved_clinic": None,
        "auto_select_clinic": False,
        "needs_clarification": False,
        "ui_card": {
            "type": "clinic_suggestion",
            "clinics": clinics[:5],
            "total_found": len(clinics),
            "location": {"lat": latitude, "lng": longitude, "address": address},
        },
    }


@mcp_server.tool
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
    """Kiem tra khung gio con trong cua phong kham."""
    client = get_backend_client()
    optional_token = _get_optional_auth_token()
    clinic_resolution = await _resolve_clinic_reference(
        clinic_ref=clinic_id,
        token=optional_token,
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
    resolved_date = resolved_datetime.get("date")
    resolved_exact_time = resolved_datetime.get("exact_time")
    resolved_time_preference = resolved_datetime.get("time_preference")
    normalized_service_ids = [
        str(service_id).strip()
        for service_id in (service_ids or [])
        if str(service_id).strip()
    ]
    has_service_signal = bool(
        normalized_service_ids
        or str(service_hint or "").strip()
        or str(latest_message or "").strip()
        or str(transcript or "").strip()
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
        return {
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
            "needs_clarification": True,
            "next_best_action": "provide_date",
            "message": "Minh chua xac dinh duoc ngay kham cu the. Ban co the noi theo dang nhu `thu bay nay`, `ngay mai` hoac `2026-03-21`.",
        }

    if not has_service_signal:
        return {
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
            "message": "Minh chua xac dinh duoc dich vu can kiem tra slot. Ban muon kham benh, tiem phong hay dich vu nao cho be?",
        }

    if optional_token:
        payload = {
            "clinicId": resolved_clinic_id or clinic_id,
            "bookingDate": resolved_date,
            "serviceIds": normalized_service_ids,
            "exactTime": resolved_exact_time,
            "timePreference": resolved_time_preference,
            "petId": pet_id,
            "petSpecies": pet_species,
            "bookingType": booking_type,
            "serviceHint": service_hint,
            "transcript": transcript,
            "latestMessage": latest_message,
            "dateExpression": date_expression,
        }
        try:
            slot_response = await client.get_booking_slot_options(
                optional_token, payload
            )
        except BackendClientError as exc:
            logger.error(f"check_available_slots failed: {exc}")
            return {
                "clinic_id": clinic_id,
                "resolved_clinic_id": resolved_clinic_id or clinic_id,
                "date": resolved_date,
                "services": normalized_service_ids,
                "available_slots": [],
                "total_slots": 0,
                "message": f"Khong the kiem tra slot luc nay: {exc}",
                "needs_clarification": False,
                "next_best_action": "retry",
            }
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
                    slot_response.get("resolvedServiceIds") or normalized_service_ids
                )
                resolved_service_names = slot_response.get("resolvedServiceNames") or []
                no_slots = not available_slots
                return {
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
                    "message": slot_response.get("message"),
                    "resolved_time_preference": resolved_time_preference,
                    "needs_clarification": no_slots,
                    "next_best_action": "choose_another_time"
                    if no_slots
                    else "select_slot",
                    "ui_card": {
                        "type": "slot_grid",
                        "clinic_id": resolved_clinic_id or clinic_id,
                        "booking_date": resolved_date,
                        "service_ids": resolved_service_ids_from_backend,
                        "service_names": resolved_service_names,
                        "recommended_slots": recommended_slots[:6],
                        "alternative_slots": alternative_slots[:6],
                        "total_slots": int(
                            slot_response.get("totalAvailable") or len(available_slots)
                        ),
                        "message": slot_response.get("message")
                        or "Mình đã tìm được các khung giờ phù hợp. Bạn chọn một khung giờ để tiếp tục nhé.",
                    },
                }

    if not normalized_service_ids:
        return {
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
            "message": "Minh can xac dinh ro dich vu truoc khi kiem tra slot bang API cong khai.",
        }

    try:
        slots_response = await client.get_available_slots(
            resolved_clinic_id or clinic_id, resolved_date, normalized_service_ids
        )
        clinic_services = await client.get_clinic_services(
            resolved_clinic_id or clinic_id
        )
    except BackendClientError as exc:
        logger.error(f"check_available_slots failed: {exc}")
        return {
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
        }

    service_duration_values = [
        int(service.get("durationTime") or 0)
        for service in clinic_services
        if isinstance(service, dict)
        and str(service.get("serviceId")) in normalized_service_ids
    ]
    service_names = [
        service.get("name")
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

    return {
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
        "needs_clarification": not bool(formatted_slots),
        "next_best_action": "choose_another_time"
        if not formatted_slots
        else "select_slot",
        "ui_card": {
            "type": "slot_grid",
            "clinic_id": resolved_clinic_id or clinic_id,
            "booking_date": resolved_date,
            "service_ids": normalized_service_ids,
            "service_names": service_names,
            "recommended_slots": formatted_slots[:6],
            "alternative_slots": [],
            "total_slots": len(formatted_slots),
            "message": "Mình đã tìm được các khung giờ phù hợp. Bạn chọn một khung giờ để tiếp tục nhé."
            if formatted_slots
            else None,
        },
    }


@mcp_server.tool
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
    """
    resolved_user_id = _resolve_user_id(user_id)
    token = _require_auth_token()

    if not token:
        return {
            "success": False,
            "ready_to_create": False,
            "requires_auth": True,
            "message": "Chua dang nhap - khong the tao booking. Vui long dang nhap truoc.",
        }

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
        return {
            "success": False,
            "ready_to_create": False,
            "missing_fields": [],
            "clinic_options": clinic_resolution.get("clinics") or [],
            "needs_clarification": True,
            "next_best_action": "choose_clinic",
            "message": clinic_resolution.get("message")
            or "Minh can xac nhan phong kham truoc khi tao yeu cau booking.",
        }

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
                }
            if not item.get("service_ids"):
                return {
                    "success": False,
                    "ready_to_create": False,
                    "missing_fields": [f"service_ids cho thu cung #{i + 1}"],
                    "needs_clarification": True,
                    "next_best_action": "collect_missing_fields",
                    "message": f"Thu cung #{i + 1} can co it nhat mot dich vu.",
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
    if not resolved_booking_date:
        missing_fields.append("ngay kham")
    if not normalized_service_ids:
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

    if missing_fields:
        return {
            "success": False,
            "ready_to_create": False,
            "missing_fields": missing_fields,
            "needs_clarification": True,
            "next_best_action": "collect_missing_fields",
            "message": f"Chua the tao yeu cau booking vi con thieu: {', '.join(missing_fields)}.",
        }

    if not confirmed:
        return {
            "success": False,
            "ready_to_create": False,
            "missing_fields": [],
            "needs_clarification": True,
            "next_best_action": "confirm_booking",
            "message": "Minh da co du du lieu co ban nhung chua co xac nhan cuoi tu ban. Hay xac nhan ro rang truoc khi minh tao yeu cau booking.",
            "booking_preview": {
                "pet_id": pet_id,
                "clinic_id": resolved_clinic_id or clinic_id,
                "clinic_name": (clinic_resolution.get("clinic") or {}).get("name"),
                "booking_date": resolved_booking_date,
                "start_time": resolved_start_time,
                "service_ids": normalized_service_ids,
                "booking_type": normalized_booking_type,
                "notes": notes,
                "home_address": home_address,
            },
            "ui_card": {
                "type": "booking_summary",
                "pet_id": pet_id,
                "clinic_id": resolved_clinic_id or clinic_id,
                "clinic_name": (clinic_resolution.get("clinic") or {}).get("name"),
                "booking_date": resolved_booking_date,
                "start_time": resolved_start_time,
                "service_ids": normalized_service_ids,
                "booking_type": normalized_booking_type,
                "notes": notes,
                "home_address": home_address,
                "message": "Mình đã tổng hợp đủ thông tin cơ bản. Bạn xác nhận để mình tạo yêu cầu đặt lịch nhé.",
            },
        }

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
        return {
            "success": False,
            "ready_to_create": False,
            "needs_clarification": False,
            "next_best_action": "retry",
            "message": f"Khong the tao yeu cau booking luc nay: {exc}",
        }

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
        return {
            "success": booking.get("success", True),
            "ready_to_create": True,
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
            "ui_card": {
                "type": "booking_created",
                "bookings": bookings_list,
                "summary": summary,
                "message": booking.get("message")
                or f"Da tao {len(bookings_list)} yeu cau booking. Clinic manager se xac nhan sau.",
            },
        }

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

    return {
        "success": True,
        "ready_to_create": True,
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
        "ui_card": {
            "type": "booking_created",
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
            },
            "message": f"Da tao yeu cau booking cho {booking.get('petName') or 'thu cung cua ban'} tai {booking.get('clinicName') or 'phong kham da chon'}. Clinic manager se xac nhan sau.",
        },
    }
