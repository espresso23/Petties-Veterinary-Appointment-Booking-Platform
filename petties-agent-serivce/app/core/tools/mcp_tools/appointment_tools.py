"""AI tools for appointment management and creation."""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from app.core.tools.mcp_server import mcp_server
from app.core.tools.auth_deps import _require_auth_token, AuthenticationRequiredError
from app.services.backend_client import get_backend_client
from app.core.tools.booking_helpers import (
    _standardize_booking_tool_response,
    _attach_booking_error_metadata,
    _resolve_user_id,
    _is_create_booking_denied_by_user,
    _booking_retry_error,
    _resolve_booking_datetime_inputs,
    _normalize_booking_type,
    _resolve_clinic_reference
)

@mcp_server.tool
@_standardize_booking_tool_response
async def get_my_booking_info(booking_id: Optional[str] = None, booking_code: Optional[str] = None) -> Dict[str, Any]:
    """Lấy thông tin chi tiết một lịch hẹn cụ thể của người dùng."""
    try:
        token = _require_auth_token()
        client = get_backend_client()
        if booking_id:
            booking = await client.get_booking_detail(token, booking_id)
        elif booking_code:
            # Fallback to listing and finding by code if backend doesn't support direct code lookup
            bookings = await client.get_my_bookings(token)
            booking = next((b for b in bookings if b.get("bookingCode") == booking_code), None)
        else:
            return _attach_booking_error_metadata({}, error_code="INVALID_INPUT", message="Cần booking_id hoặc booking_code.")
        
        return {"booking": booking, "success": bool(booking)}
    except Exception as e:
        return _attach_booking_error_metadata({"message": str(e)}, error_code="INTERNAL_ERROR")

@mcp_server.tool
@_standardize_booking_tool_response
async def list_my_bookings(status: Optional[str] = None) -> Dict[str, Any]:
    """Lấy danh sách lịch hẹn của người dùng hiện tại."""
    try:
        token = _require_auth_token()
        client = get_backend_client()
        bookings = await client.get_my_bookings(token, status=status)
        return {"bookings": bookings, "total": len(bookings), "success": True}
    except Exception as e:
        return _attach_booking_error_metadata({"message": str(e)}, error_code="INTERNAL_ERROR")

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

    auto_create_if_available: When True, treats the request as user having conditionally
    confirmed ("nếu còn slot thì tạo"). Backend will auto-create if slot is available.
    """
    try:
        _resolve_user_id(user_id)
    except RuntimeError as exc:
        return _attach_booking_error_metadata({"ready_to_create": False, "requires_auth": True}, error_code="UNAUTHORIZED", message=str(exc))
    
    try:
        token = _require_auth_token()
    except AuthenticationRequiredError as e:
        return _attach_booking_error_metadata({"ready_to_create": False, "requires_auth": True}, error_code="UNAUTHORIZED", message=str(e))

    client = get_backend_client()
    clinic_resolution = await _resolve_clinic_reference(
        clinic_ref=clinic_id, token=token, pet_id=pet_id,
        booking_type=booking_type, transcript=transcript, latest_message=latest_message,
    )
    resolved_clinic_id = str(clinic_resolution.get("clinic_id") or "").strip()
    if clinic_resolution.get("needs_clarification") and not resolved_clinic_id:
        return _attach_booking_error_metadata(
            {
                "success": False, "ready_to_create": False, "clinic_options": clinic_resolution.get("clinics") or [],
                "needs_clarification": True, "next_best_action": "choose_clinic",
                "message": clinic_resolution.get("message") or "Minh can xac nhan phong kham truoc khi tao booking.",
            },
            error_code="CLINIC_NOT_FOUND", recoverable=True,
        )

    normalized_service_ids = [str(sid).strip() for sid in (service_ids or []) if str(sid).strip()]
    resolved_datetime = _resolve_booking_datetime_inputs(
        date=booking_date, date_expression=date_expression,
        exact_time=start_time, time_preference=time_preference,
        latest_message=latest_message, transcript=transcript,
    )
    resolved_booking_date = resolved_datetime.get("date")
    resolved_start_time = resolved_datetime.get("exact_time") or (str(start_time or "").strip() or None)
    normalized_booking_type = _normalize_booking_type(booking_type, home_address, home_lat, home_long)

    is_multi_pet = items is not None and len(items) > 0
    missing_fields: List[str] = []
    if not is_multi_pet and not pet_id: missing_fields.append("pet_id")
    if not resolved_booking_date: missing_fields.append("ngay kham")
    if not is_multi_pet and not normalized_service_ids: missing_fields.append("dich vu")
    if not resolved_start_time: missing_fields.append("gio kham")

    if missing_fields:
        return _attach_booking_error_metadata(
            {"success": False, "ready_to_create": False, "missing_fields": missing_fields, "needs_clarification": True},
            error_code="INVALID_INPUT", recoverable=True
        )

    if _is_create_booking_denied_by_user(latest_message, transcript):
        return {"success": False, "message": "Đã dừng tạo lịch hẹn theo yêu cầu.", "action": "cancel"}

    if not (confirmed or auto_create_if_available):
        return _attach_booking_error_metadata({"success": False, "ready_to_create": False, "needs_clarification": True}, error_code="CONFIRMATION_REQUIRED")

    # Final Payload Assembly
    create_payload = {
        "clinicId": resolved_clinic_id or clinic_id,
        "bookingDate": resolved_booking_date,
        "startTime": resolved_start_time,
        "bookingType": normalized_booking_type,
        "notes": notes,
        "confirmed": True,
        "items": [{"petId": i.get("pet_id"), "serviceIds": i.get("service_ids", [])} for i in (items or [])] if is_multi_pet else None,
        "petId": pet_id if not is_multi_pet else None,
        "serviceIds": normalized_service_ids if not is_multi_pet else None,
    }

    try:
        booking = await client.create_ai_booking(token, create_payload)
        return {"success": True, "booking": booking, "message": "Đặt lịch thành công!"}
    except Exception as exc:
        return _booking_retry_error(str(exc))
