"""AI tools for clinic discovery and information."""

from __future__ import annotations
import asyncio
from typing import Any, Dict, Optional
from loguru import logger

from app.core.agents.text_utils import normalize_vietnamese_text

from app.core.tools.mcp_server import mcp_server
from app.core.tools.auth_deps import _require_auth_token, AuthenticationRequiredError
from app.services.backend_client import get_backend_client
from app.core.tools.booking_helpers import (
    _standardize_booking_tool_response,
    _attach_booking_error_metadata,
    _infer_clinic_suggestion_mode,
    _resolve_backend_booking_context,
    _normalize_pet_species_enum,
    _map_backend_clinic_option,
    _filter_clinics_by_hint,
    _select_resolved_clinic,
    _resolve_clinic_reference,
    _format_service_display_name,
    _tokenize_match_text
)

@mcp_server.tool
@_standardize_booking_tool_response
async def quick_booking_search(
    clinic_hint: Optional[str] = None,
    service_hint: Optional[str] = None,
    pet_id: Optional[str] = None,
    booking_date: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    address: Optional[str] = None,
    transcript: Optional[str] = None,
    latest_message: Optional[str] = None,
) -> Dict[str, Any]:
    """Siêu công cụ giúp lấy nhanh TOÀN BỘ thông tin cần thiết để đặt lịch trong 1 lần gọi.

    Sử dụng ngay khi bắt đầu luồng đặt lịch để:
    1. Lấy danh sách thú cưng của user (để user chọn).
    2. Tìm và xác định phòng khám (Clinic) dựa trên tên hoặc vị trí.
    3. Lấy danh sách dịch vụ phù hợp của phòng khám đó.
    4. Nếu có ngày (booking_date), lấy luôn các khung giờ trống (slots).

    Đây là tool tối ưu nhất để giảm số lần AI phải hỏi lại người dùng.
    """
    logger.info(f"🚀 [SUPER-TOOL] quick_booking_search: clinic={clinic_hint}, pet={pet_id}")

    try:
        token = _require_auth_token()
    except AuthenticationRequiredError:
        return _attach_booking_error_metadata({}, error_code="UNAUTHORIZED", message="Cần đăng nhập để sử dụng tính năng này.")

    client = get_backend_client()
    
    # 1. Fetch Pets and Clinic Resolution in parallel
    pet_task = client.get_user_pets(token)
    clinic_task = _resolve_clinic_reference(
        clinic_ref=clinic_hint, token=token, latitude=latitude, longitude=longitude,
        address=address, pet_id=pet_id, service_hint=service_hint,
        transcript=transcript, latest_message=latest_message
    )
    
    pets_data, clinic_res = await asyncio.gather(pet_task, clinic_task)
    
    # Format Pets
    formatted_pets = [{
        "id": p.get("id"), "name": p.get("name"), "species": p.get("species"),
        "breed": p.get("breed"), "age": p.get("dateOfBirth")
    } for p in (pets_data or [])]

    result = {
        "user_pets": formatted_pets,
        "total_pets": len(formatted_pets),
        "clinic": clinic_res.get("clinic"),
        "clinic_options": clinic_res.get("clinics") or [],
        "resolved_clinic_id": clinic_res.get("clinic_id"),
        "needs_clinic_clarification": clinic_res.get("needs_clarification", False),
    }

    # 2. If clinic resolved, fetch services and slots
    resolved_id = clinic_res.get("clinic_id")
    if resolved_id:
        # Fetch services
        services = await client.get_clinic_services_by_clinic(resolved_id)
        formatted_services = [{
            "id": s.get("id") or s.get("serviceId"),
            "name": _format_service_display_name(s.get("name") or s.get("serviceName"), s.get("petType")),
            "price": s.get("basePrice")
        } for s in services if s.get("isActive", True)]
        
        result["services"] = formatted_services[:10]
        
        # If date provided, fetch slots
        if booking_date:
            try:
                slots = await client.get_available_slots(resolved_id, booking_date, [])
                result["available_slots"] = [{
                    "time": str(s.get("startTime", ""))[:5],
                    "available": s.get("available", True)
                } for s in slots if s.get("available", True)][:15]
                result["booking_date"] = booking_date
            except Exception:
                result["available_slots"] = []

    result["message"] = "Đã tổng hợp dữ liệu đặt lịch thành công."
    return result


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
    """
    logger.info(f"search_clinics_nearby called: clinic_hint={clinic_hint}")

    clinic_suggestion_mode = _infer_clinic_suggestion_mode(
        latest_message=latest_message,
        transcript=transcript,
    )

    try:
        token = _require_auth_token()
    except AuthenticationRequiredError as e:
        return _attach_booking_error_metadata(
            {
                "query_location": {"lat": latitude, "lng": longitude, "address": address},
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
            suggestion="Vui lòng đăng nhập lại để tìm phòng khám.",
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
    
    latitude = latitude if latitude is not None else resolved_location.get("latitude")
    longitude = longitude if longitude is not None else resolved_location.get("longitude")
    address = address or resolved_location.get("address")
    pet_id = pet_id or resolved_pet.get("petId")
    pet_species = _normalize_pet_species_enum(pet_species or resolved_pet.get("species"))
    booking_type = booking_type or context_snapshot.get("resolvedBookingType")
    effective_clinic_hint = effective_clinic_hint or context_snapshot.get("resolvedClinicHint")
    service_hint = service_hint or context_snapshot.get("resolvedServiceHint")

    if effective_clinic_hint:
        payload = {
            "latitude": latitude, "longitude": longitude, "limit": top_k,
            "clinicHint": effective_clinic_hint, "serviceHint": service_hint,
            "petId": pet_id, "petSpecies": pet_species, "bookingType": booking_type,
            "transcript": transcript, "latestMessage": latest_message,
        }
        try:
            response = await client.get_booking_clinic_options(token, payload)
            raw_clinics = response.get("clinics") or response.get("content") or []
            clinics = [
                clinic for clinic in (
                    _map_backend_clinic_option(raw_clinic, default_match_mode="explicit_name" if effective_clinic_hint else "nearby")
                    for raw_clinic in raw_clinics
                ) if clinic
            ]
            clinics.sort(key=lambda c: c.get("distance_km") or 999999)
            clinics = _filter_clinics_by_hint(clinics, effective_clinic_hint)
            resolved_clinic = _select_resolved_clinic(clinics, effective_clinic_hint)
            auto_select_clinic = bool(effective_clinic_hint and resolved_clinic and len(clinics) == 1)
            
            if effective_clinic_hint and not clinics:
                return _attach_booking_error_metadata(
                    {
                        "query_location": {"lat": latitude, "lng": longitude, "address": address},
                        "clinics": [], "matched_clinic": None, "total_found": 0, "needs_clarification": True,
                        "message": "Mình chưa tìm thấy phòng khám khớp với tên bạn vừa nêu.",
                    },
                    error_code="CLINIC_NOT_FOUND",
                    suggestion="Vui lòng kiểm tra lại tên phòng khám hoặc chọn từ danh sách gợi ý.",
                    recoverable=True,
                )
            return {
                "query_location": {"lat": latitude, "lng": longitude, "address": address},
                "radius_km": radius_km, "clinic_hint": effective_clinic_hint, "service_hint": service_hint,
                "clinics": clinics[:top_k], "matched_clinic": resolved_clinic or (clinics[0] if clinics else None),
                "resolved_clinic": resolved_clinic, "total_found": int(response.get("totalFound") or len(clinics)),
                "clinic_suggestion_mode": clinic_suggestion_mode, "auto_select_clinic": auto_select_clinic,
                "needs_clarification": bool(effective_clinic_hint and len(clinics) > 1 and not auto_select_clinic),
            }
        except Exception as e:
            logger.error(f"Error in search_clinics_nearby (clinic_hint): {e}")

    # Nearby logic (similar to original but calling find_nearby_clinics)
    if latitude is None or longitude is None:
        return _attach_booking_error_metadata(
            {"clinics": [], "total_found": 0, "needs_clarification": True, "message": "Mình cần vị trí hoặc địa chỉ cụ thể để tìm phòng khám."},
            error_code="INVALID_INPUT",
            suggestion="Vui lòng chia sẻ vị trí hoặc nhập địa chỉ cụ thể.",
            recoverable=True,
        )

    try:
        response = await client.find_nearby_clinics(latitude, longitude, radius_km, size=max(top_k * 3, 10))
        raw_clinics = response.get("content", response if isinstance(response, list) else [])
        clinics = [clinic for clinic in (_map_backend_clinic_option(rc, default_match_mode="nearby") for rc in raw_clinics) if clinic]
        clinics.sort(key=lambda c: c.get("distance_km") or 999999)
        clinics = _filter_clinics_by_hint(clinics, effective_clinic_hint)[:top_k]
        return {
            "query_location": {"lat": latitude, "lng": longitude, "address": address},
            "radius_km": radius_km, "clinic_hint": effective_clinic_hint, "clinics": clinics,
            "total_found": len(clinics), "clinic_suggestion_mode": clinic_suggestion_mode,
        }
    except Exception as e:
        logger.error(f"Error in search_clinics_nearby (nearby): {e}")
        return _attach_booking_error_metadata(
            {"clinics": [], "total_found": 0, "message": f"Không thể tìm phòng khám lúc này: {e}"},
            error_code="INTERNAL_ERROR", suggestion="Vui lòng thử lại sau.", recoverable=True
        )

@mcp_server.tool
@_standardize_booking_tool_response
async def get_clinic_detail(clinic_id: str) -> Dict[str, Any]:
    """Lấy thông tin chi tiết phòng khám theo ID."""
    client = get_backend_client()
    try:
        clinic = await client.get_clinic_by_id(clinic_id)
        if not clinic:
            return _attach_booking_error_metadata({"clinic": None}, error_code="CLINIC_NOT_FOUND")
        
        clinic_detail = {
            "id": clinic.get("id"), "name": clinic.get("name"), "address": clinic.get("address"),
            "phone": clinic.get("phone"), "email": clinic.get("email"),
            "latitude": clinic.get("latitude"), "longitude": clinic.get("longitude"),
            "rating": clinic.get("rating"), "total_reviews": clinic.get("totalReviews"),
            "description": clinic.get("description"), "logo_url": clinic.get("logoUrl"),
            "opening_hours": clinic.get("openingHours"),
        }
        return {"clinic_id": clinic_id, "clinic": clinic_detail}
    except Exception as e:
        return _attach_booking_error_metadata({"message": str(e)}, error_code="CLINIC_NOT_FOUND")

@mcp_server.tool
@_standardize_booking_tool_response
async def get_clinic_reviews(clinic_id: str) -> Dict[str, Any]:
    """Lấy danh sách đánh giá chi tiết của phòng khám."""
    client = get_backend_client()
    try:
        reviews = await client.get_clinic_reviews(clinic_id)
        formatted = [{"rating": r.get("rating"), "comment": r.get("comment"), "user_name": r.get("userName") or "Khách hàng"} for r in reviews[:10]]
        avg = sum(r.get("rating") or 0 for r in formatted) / len(formatted) if formatted else 0
        return {"clinic_id": clinic_id, "reviews": formatted, "total_reviews": len(formatted), "average_rating": round(avg, 1)}
    except Exception as e:
        return {"clinic_id": clinic_id, "reviews": [], "message": str(e)}

@mcp_server.tool
@_standardize_booking_tool_response
async def get_clinic_services(
    clinic_id: str, pet_species: Optional[str] = None, is_home_visit: Optional[bool] = None,
    service_hint: Optional[str] = None, booking_type: Optional[str] = None,
    transcript: Optional[str] = None, latest_message: Optional[str] = None
) -> Dict[str, Any]:
    """Lấy danh sách dịch vụ của phòng khám."""
    try:
        token = _require_auth_token()
        clinic_res = await _resolve_clinic_reference(clinic_ref=clinic_id, token=token, pet_species=pet_species, booking_type=booking_type, service_hint=service_hint, transcript=transcript, latest_message=latest_message)
        resolved_id = str(clinic_res.get("clinic_id") or "").strip() or clinic_id
        
        client = get_backend_client()
        services = await client.get_clinic_services_by_clinic(resolved_id, pet_species=_normalize_pet_species_enum(pet_species), is_home_visit=is_home_visit)
        
        formatted = []
        for s in services:
            if not s.get("isActive", True): continue
            name = s.get("name") or s.get("serviceName")
            formatted.append({
                "id": s.get("id") or s.get("serviceId"), "name": name, "display_name": _format_service_display_name(name, s.get("petType")),
                "base_price": s.get("basePrice"), "category": s.get("serviceCategory") or s.get("category"),
                "is_vaccination": (s.get("serviceCategory") or s.get("category")) == "VACCINATION"
            })
            
        # Basic matching
        hint_tokens = _tokenize_match_text(service_hint)
        matched = [s for s in formatted if any(t in normalize_vietnamese_text(s["name"]) for t in hint_tokens)] if hint_tokens else []
        
        return {
            "clinic_id": resolved_id, "services": formatted, "matched_services": matched[:3],
            "total_services": len(formatted), "needs_clarification": bool(service_hint and not matched)
        }
    except Exception as e:
        return _attach_booking_error_metadata({"message": str(e)}, error_code="INTERNAL_ERROR")
