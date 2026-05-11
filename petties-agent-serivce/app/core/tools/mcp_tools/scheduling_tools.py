"""AI tools for appointment scheduling and slot availability."""

from __future__ import annotations
from typing import Any, Dict, List, Optional

from app.core.tools.mcp_server import mcp_server
from app.core.tools.auth_deps import _require_auth_token, AuthenticationRequiredError
from app.services.backend_client import get_backend_client
from app.core.tools.booking_helpers import (
    _standardize_booking_tool_response,
    _attach_booking_error_metadata,
    _resolve_booking_datetime_inputs,
    _parse_slot_start_time,
    _slot_matches_time_preference
)

@mcp_server.tool
@_standardize_booking_tool_response
async def check_available_slots(
    clinic_id: str,
    booking_date: Optional[str] = None,
    date_expression: Optional[str] = None,
    exact_time: Optional[str] = None,
    time_preference: Optional[str] = None,
    service_ids: Optional[List[str]] = None,
    transcript: Optional[str] = None,
    latest_message: Optional[str] = None,
) -> Dict[str, Any]:
    """Kiểm tra các khung giờ trống (slots) của phòng khám."""
    try:
        token = _require_auth_token()
    except AuthenticationRequiredError:
        return _attach_booking_error_metadata({"slots": []}, error_code="UNAUTHORIZED")

    resolved_dt = _resolve_booking_datetime_inputs(
        date=booking_date, date_expression=date_expression,
        exact_time=exact_time, time_preference=time_preference,
        latest_message=latest_message, transcript=transcript
    )
    target_date = resolved_dt.get("booking_date")
    if not target_date:
        return _attach_booking_error_metadata({"slots": []}, error_code="INVALID_DATE", message="Mình chưa rõ bạn muốn khám ngày nào.")

    client = get_backend_client()
    try:
        slots = await client.get_clinic_available_slots(token, clinic_id, target_date, service_ids)
        
        formatted_slots = []
        for s in slots:
            slot_time = _parse_slot_start_time(s)
            if not slot_time: continue
            if _slot_matches_time_preference(slot_time, exact_time=exact_time, time_preference=time_preference):
                formatted_slots.append({"start_time": slot_time.strftime("%H:%M"), "available": s.get("available", True)})
        
        return {
            "clinic_id": clinic_id, "booking_date": target_date,
            "slots": formatted_slots[:20], "total_slots": len(formatted_slots)
        }
    except Exception as e:
        return _attach_booking_error_metadata({"message": str(e)}, error_code="INTERNAL_ERROR")
