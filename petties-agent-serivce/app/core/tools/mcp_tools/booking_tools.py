"""Booking AI tools cho Pet Owner business chat."""

from __future__ import annotations

from datetime import date as date_cls, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from loguru import logger

from app.core.tool_runtime_context import require_tool_runtime_context
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


def _require_auth_token() -> str:
    context = require_tool_runtime_context()
    if not context.auth_token:
        raise RuntimeError("Thiếu JWT token cho booking tools")
    return context.auth_token


def _resolve_user_id(requested_user_id: Optional[str]) -> str:
    context = require_tool_runtime_context()
    if requested_user_id and requested_user_id != context.user_id:
        raise RuntimeError("User ID không khớp với session hiện tại")
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
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


def _format_operating_hours(raw_hours: Any) -> str:
    if not isinstance(raw_hours, dict) or not raw_hours:
        return "Chưa cập nhật"

    formatted_parts = []
    for day, value in raw_hours.items():
        if isinstance(value, dict):
            open_time = value.get("openTime") or value.get("open_time")
            close_time = value.get("closeTime") or value.get("close_time")
            if open_time and close_time:
                formatted_parts.append(f"{day}: {open_time}-{close_time}")
    return "; ".join(formatted_parts[:3]) if formatted_parts else "Chưa cập nhật"


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
    """Lấy danh sách thú cưng của người dùng hiện tại."""
    resolved_user_id = _resolve_user_id(user_id)
    token = _require_auth_token()
    client = get_backend_client()

    try:
        pets = await client.get_my_pets(token)
    except BackendClientError as exc:
        logger.error(f"get_user_pets failed: {exc}")
        return {
            "user_id": resolved_user_id,
            "pets": [],
            "total_pets": 0,
            "message": f"Không thể lấy danh sách thú cưng lúc này: {exc}",
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
            "message": "Bạn chưa thêm thú cưng nào. Vui lòng thêm pet trước khi đặt lịch.",
        }

    return {
        "user_id": resolved_user_id,
        "pets": formatted_pets,
        "total_pets": len(formatted_pets),
    }


@mcp_server.tool
async def get_clinic_services(
    clinic_id: str,
    pet_species: Optional[str] = None,
    is_home_visit: Optional[bool] = None,
) -> Dict[str, Any]:
    """Lấy danh sách dịch vụ của phòng khám."""
    client = get_backend_client()
    try:
        services = await client.get_clinic_services(
            clinic_id,
            pet_species=pet_species,
            is_home_visit=is_home_visit,
        )
    except BackendClientError as exc:
        logger.error(f"get_clinic_services failed: {exc}")
        return {
            "clinic_id": clinic_id,
            "services": [],
            "total_services": 0,
            "message": f"Không thể tải dịch vụ phòng khám: {exc}",
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
        if service.get("isActive", True)
    ]

    return {
        "clinic_id": clinic_id,
        "filters": {
            "pet_species": pet_species,
            "is_home_visit": is_home_visit,
        },
        "services": formatted_services,
        "total_services": len(formatted_services),
    }


@mcp_server.tool
async def check_vaccination_status(
    pet_id: str,
    vaccine_template_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Kiểm tra lịch sử tiêm và mũi sắp tới của pet để AI tư vấn booking tiêm chủng nhẹ nhàng như flow thường."""
    token = _require_auth_token()
    client = get_backend_client()

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
            "history_count": 0,
            "upcoming_count": 0,
            "message": f"Không thể tải lịch sử tiêm chủng lúc này: {exc}",
        }

    normalized_template_id = (vaccine_template_id or "").strip() or None

    def _matches_template(record: Dict[str, Any]) -> bool:
        if not normalized_template_id:
            return True
        return str(record.get("vaccineTemplateId") or "").strip() == normalized_template_id

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

    latest_history = None
    if filtered_history:
        latest_history = max(
            filtered_history,
            key=lambda item: (
                item.get("vaccination_date") or "",
                item.get("dose_number") or 0,
            ),
        )

    recommended_next = None
    if filtered_upcoming:
        recommended_next = min(
            filtered_upcoming,
            key=lambda item: (
                item.get("next_due_date") or "9999-12-31",
                item.get("dose_number") or 999,
            ),
        )

    if recommended_next and latest_history:
        message = (
            f"Pet đã có lịch sử tiêm {latest_history.get('vaccine_name') or 'vắc-xin này'}"
            f" ở mũi {latest_history.get('dose_number') or 'gần nhất'}."
            f" Có thể tư vấn người dùng đặt mũi tiếp theo với hạn nhắc"
            f" {recommended_next.get('next_due_date') or 'chưa xác định'}."
        )
    elif recommended_next:
        message = (
            f"Đã có gợi ý mũi tiêm sắp tới cho pet này:"
            f" {recommended_next.get('vaccine_name') or 'vắc-xin'}"
            f" (mũi {recommended_next.get('dose_number') or 'tiếp theo'})"
            f", hạn nhắc {recommended_next.get('next_due_date') or 'chưa xác định'}."
        )
    elif latest_history:
        message = (
            f"Pet đã có lịch sử tiêm gần nhất là {latest_history.get('vaccine_name') or 'vắc-xin'}"
            f" vào ngày {latest_history.get('vaccination_date') or 'chưa rõ'}."
        )
    else:
        message = "Chưa có lịch sử hoặc gợi ý tiêm chủng phù hợp; vẫn có thể tiếp tục flow booking bình thường."

    return {
        "pet_id": pet_id,
        "vaccine_template_id": normalized_template_id,
        "history": filtered_history,
        "upcoming": filtered_upcoming,
        "history_count": len(filtered_history),
        "upcoming_count": len(filtered_upcoming),
        "latest_history": latest_history,
        "recommended_next": recommended_next,
        "message": message,
    }


@mcp_server.tool
async def search_clinics_nearby(
    latitude: float,
    longitude: float,
    radius_km: float = 5.0,
    top_k: int = 5,
) -> Dict[str, Any]:
    """Tìm phòng khám gần vị trí người dùng, trả về thông tin kèm danh sách dịch vụ.

    Tool chỉ lấy dữ liệu thô (vị trí, dịch vụ, giá, rating).
    LLM sẽ tự phân tích kết quả để gợi ý phòng khám phù hợp với yêu cầu người dùng.
    """
    client = get_backend_client()

    try:
        response = await client.find_nearby_clinics(
            latitude, longitude, radius_km, size=max(top_k * 3, 10),
        )
    except BackendClientError as exc:
        logger.error(f"search_clinics_nearby failed: {exc}")
        return {
            "query_location": {"lat": latitude, "lng": longitude},
            "radius_km": radius_km,
            "clinics": [],
            "total_found": 0,
            "message": f"Không thể tìm phòng khám gần đây: {exc}",
        }

    raw_clinics = response.get("content", response if isinstance(response, list) else [])

    clinics: List[Dict[str, Any]] = []
    for clinic in raw_clinics:
        clinic_id = clinic.get("clinicId")
        service_list: List[Dict[str, Any]] = []
        service_error: Optional[str] = None

        if clinic_id:
            svc_resp = await get_clinic_services(str(clinic_id))
            service_list = [
                {
                    "name": svc.get("name"),
                    "category": svc.get("category"),
                    "base_price": svc.get("base_price"),
                    "description": svc.get("description"),
                    "is_vaccination": svc.get("is_vaccination", False),
                }
                for svc in svc_resp.get("services", [])
                if isinstance(svc, dict)
            ]
            if svc_resp.get("message"):
                service_error = str(svc_resp["message"])

        clinics.append({
            "id": clinic_id,
            "name": clinic.get("name"),
            "address": clinic.get("address"),
            "distance_km": clinic.get("distance"),
            "rating": clinic.get("ratingAvg"),
            "total_reviews": clinic.get("ratingCount"),
            "services": service_list,
            "service_error": service_error,
            "has_sos": clinic.get("sosFee") is not None,
            "operating_hours": _format_operating_hours(clinic.get("operatingHours")),
        })

    clinics.sort(key=lambda c: c.get("distance_km") or 999999)
    clinics = clinics[:top_k]

    return {
        "query_location": {"lat": latitude, "lng": longitude},
        "radius_km": radius_km,
        "clinics": clinics,
        "total_found": len(clinics),
    }


@mcp_server.tool
async def check_available_slots(
    clinic_id: str,
    date: str,
    service_ids: List[str],
) -> Dict[str, Any]:
    """Kiểm tra khung giờ còn trống tại phòng khám."""
    client = get_backend_client()

    try:
        slots_response = await client.get_available_slots(clinic_id, date, service_ids)
        clinic_services = await client.get_clinic_services(clinic_id)
    except BackendClientError as exc:
        logger.error(f"check_available_slots failed: {exc}")
        return {
            "clinic_id": clinic_id,
            "date": date,
            "services": service_ids,
            "available_slots": [],
            "total_slots": 0,
            "message": f"Không thể kiểm tra slot trống: {exc}",
        }

    duration_minutes = 30
    service_names: List[str] = []
    for service in clinic_services:
        service_id = str(service.get("serviceId"))
        if service_id in service_ids:
            duration_minutes += max(int(service.get("durationTime") or 0), 0)
            if service.get("name"):
                service_names.append(service.get("name"))

    if service_names:
        duration_minutes = max(
            sum(int(service.get("durationTime") or 0) for service in clinic_services if str(service.get("serviceId")) in service_ids),
            30,
        )

    formatted_slots = []
    for slot in slots_response.get("availableSlots", []) or []:
        parsed_start = time.fromisoformat(str(slot))
        end_time = (datetime.combine(date_cls.today(), parsed_start) + timedelta(minutes=duration_minutes)).time()
        formatted_slots.append(
            {
                "start_time": parsed_start.strftime("%H:%M"),
                "end_time": end_time.strftime("%H:%M"),
                "duration_minutes": duration_minutes,
                "staff_available": None,
            }
        )

    message = None
    if not formatted_slots:
        message = "Không có slot trống trong ngày này. Vui lòng thử ngày khác gần nhất."

    return {
        "clinic_id": clinic_id,
        "date": date,
        "services": service_names or service_ids,
        "available_slots": formatted_slots,
        "total_slots": len(formatted_slots),
        "message": message,
    }


@mcp_server.tool
async def create_booking_for_user(
    pet_id: str,
    clinic_id: str,
    booking_date: str,
    start_time: str,
    service_ids: List[str],
    booking_type: Optional[str] = None,
    notes: Optional[str] = None,
    home_address: Optional[str] = None,
    home_lat: Optional[float] = None,
    home_long: Optional[float] = None,
    distance_km: Optional[float] = None,
    user_id: Optional[str] = None,
    confirmed: bool = False,
) -> Dict[str, Any]:
    """Tạo booking mới cho user sau khi đã xác nhận."""
    resolved_user_id = _resolve_user_id(user_id)
    if not confirmed:
        return {
            "success": False,
            "message": "Chưa có xác nhận đặt lịch từ người dùng. Hãy tóm tắt thông tin booking và yêu cầu xác nhận rõ ràng trước khi tạo booking.",
        }

    normalized_booking_type = _normalize_booking_type(
        booking_type=booking_type,
        home_address=home_address,
        home_lat=home_lat,
        home_long=home_long,
    )

    if normalized_booking_type == "HOME_VISIT":
        missing_fields: List[str] = []
        if not home_address:
            missing_fields.append("địa chỉ khám tại nhà")
        if home_lat is None:
            missing_fields.append("tọa độ vĩ độ")
        if home_long is None:
            missing_fields.append("tọa độ kinh độ")
        if distance_km is None:
            missing_fields.append("khoảng cách di chuyển")

        if missing_fields:
            return {
                "success": False,
                "message": (
                    "Booking khám tại nhà còn thiếu thông tin bắt buộc: "
                    f"{', '.join(missing_fields)}."
                ),
            }

    token = _require_auth_token()
    client = get_backend_client()

    payload = {
        "petId": pet_id,
        "clinicId": clinic_id,
        "bookingDate": booking_date,
        "bookingTime": start_time,
        "type": normalized_booking_type,
        "serviceIds": service_ids,
        "notes": notes,
    }

    if normalized_booking_type == "HOME_VISIT":
        payload.update(
            {
                "homeAddress": home_address,
                "homeLat": home_lat,
                "homeLong": home_long,
                "distanceKm": distance_km,
            }
        )

    try:
        booking = await client.create_booking(token, payload)
    except BackendClientError as exc:
        logger.error(f"create_booking_for_user failed: {exc}")
        return {
            "success": False,
            "message": f"Không thể tạo booking: {exc}",
        }

    services = []
    for pet_summary in booking.get("pets", []) or []:
        for service in pet_summary.get("services", []) or []:
            if service.get("serviceName"):
                services.append(service.get("serviceName"))

    if not services and booking.get("petName"):
        services = service_ids

    return {
        "success": True,
        "booking": {
            "id": booking.get("bookingId"),
            "booking_code": booking.get("bookingCode"),
            "status": booking.get("status"),
            "pet_name": booking.get("petName"),
            "clinic_name": booking.get("clinicName"),
            "date": booking.get("bookingDate"),
            "time": str(booking.get("bookingTime", ""))[:5],
            "type": booking.get("type") or normalized_booking_type,
            "services": services,
            "estimated_total": booking.get("totalPrice"),
            "home_address": booking.get("homeAddress") or home_address,
            "distance_km": booking.get("distanceKm") or distance_km,
            "user_id": resolved_user_id,
        },
        "message": f"Đã tạo booking thành công cho {booking.get('petName')} tại {booking.get('clinicName')}",
    }