"""Booking AI tools cho Pet Owner business chat."""

from __future__ import annotations

from datetime import date as date_cls, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from loguru import logger

from app.core.tool_runtime_context import require_tool_runtime_context
from app.core.tools.mcp_server import mcp_server
from app.services.backend_client import BackendClientError, get_backend_client


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
async def get_clinic_services(clinic_id: str, pet_species: Optional[str] = None) -> Dict[str, Any]:
    """Lấy danh sách dịch vụ của phòng khám."""
    client = get_backend_client()
    try:
        services = await client.get_clinic_services(clinic_id, pet_species=pet_species)
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
            "category": service.get("serviceCategory"),
            "pet_type": service.get("petType"),
            "is_home_visit": service.get("isHomeVisit"),
        }
        for service in services
        if service.get("isActive", True)
    ]

    return {
        "clinic_id": clinic_id,
        "services": formatted_services,
        "total_services": len(formatted_services),
    }


@mcp_server.tool
async def search_clinics_nearby(
    latitude: float,
    longitude: float,
    radius_km: float = 5.0,
    service_names: Optional[List[str]] = None,
    top_k: int = 5,
) -> Dict[str, Any]:
    """Tìm phòng khám gần vị trí người dùng."""
    client = get_backend_client()

    try:
        response = await client.find_nearby_clinics(latitude, longitude, radius_km, size=max(top_k * 3, 10))
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
    requested_services = {service_name.strip().lower() for service_name in (service_names or []) if service_name.strip()}

    clinics: List[Dict[str, Any]] = []
    for clinic in raw_clinics:
        clinic_id = clinic.get("clinicId")
        clinic_services = []
        if clinic_id:
            services_response = await get_clinic_services(str(clinic_id))
            clinic_services = [service.get("name") for service in services_response.get("services", []) if service.get("name")]

        if requested_services:
            normalized_clinic_services = {service_name.lower() for service_name in clinic_services}
            if not requested_services.intersection(normalized_clinic_services):
                continue

        clinics.append(
            {
                "id": clinic_id,
                "name": clinic.get("name"),
                "address": clinic.get("address"),
                "distance_km": clinic.get("distance"),
                "rating": clinic.get("ratingAvg"),
                "total_reviews": clinic.get("ratingCount"),
                "services": clinic_services,
                "has_sos": clinic.get("sosFee") is not None,
                "operating_hours": _format_operating_hours(clinic.get("operatingHours")),
            }
        )

    clinics = sorted(clinics, key=lambda item: item.get("distance_km") or 999999)[:top_k]

    message = None
    if len(clinics) < 3:
        message = "Ít hơn 3 phòng khám phù hợp trong bán kính hiện tại. Có thể mở rộng bán kính tìm kiếm."

    return {
        "query_location": {"lat": latitude, "lng": longitude},
        "radius_km": radius_km,
        "clinics": clinics,
        "total_found": len(clinics),
        "message": message,
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
    notes: Optional[str] = None,
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

    token = _require_auth_token()
    client = get_backend_client()

    payload = {
        "petId": pet_id,
        "clinicId": clinic_id,
        "bookingDate": booking_date,
        "bookingTime": start_time,
        "type": "IN_CLINIC",
        "serviceIds": service_ids,
        "notes": notes,
    }

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
            "services": services,
            "estimated_total": booking.get("totalPrice"),
            "user_id": resolved_user_id,
        },
        "message": f"Đã tạo booking thành công cho {booking.get('petName')} tại {booking.get('clinicName')}.",
    }