"""
PETTIES AGENT SERVICE - Staff & Scheduling Tools
Tools for clinic managers and owners to manage staff schedules and slot availability.
"""

from typing import Any, Dict, Optional, List
import logging
from datetime import datetime, timezone, timedelta, date as date_cls

from app.core.tools.contracts import (
    build_tool_success_response,
    build_tool_error_response,
    classify_error_code,
)
from app.core.tools.mcp_server import mcp_server
from app.core.tool_runtime_context import require_tool_runtime_context
from app.core.tools.auth_deps import _require_auth_token
from app.services.backend_client import BackendClientError, get_backend_client
from app.core.tools.tool_policy import get_tool_policy

logger = logging.getLogger(__name__)


def _is_tool_available(tool_name: str) -> bool:
    """Check if tool is registered in policy."""
    return get_tool_policy(tool_name) is not None


# Refactored: authentication helpers moved to app.core.tools.auth_deps


@mcp_server.tool
async def get_staff_schedule(
    date: Optional[str] = None,
    days: int = 1,
    clinic_name_hint: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get the staff schedule for the clinic.
    Can provide clinic_name_hint to automatically find the correct clinic ID.

    Args:
        date: Start date (YYYY-MM-DD). Default is today.
        days: Number of days to view. Default 1 (just the given day), max 7.

    Returns:
        List of shifts, including staff names, times, and slot statistics.
    """
    if not _is_tool_available("get_staff_schedule"):
        return build_tool_error_response(
            error_code="TOOL_NOT_AVAILABLE",
            message="Chức năng này không được phép sử dụng trong ngữ cảnh hiện tại.",
            recoverable=False,
            suggestion="Yêu cầu đăng nhập với quyền chủ phòng khám hoặc quản lý.",
        )

    try:
        ctx = require_tool_runtime_context()
    except Exception as e:
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=str(e),
            recoverable=False,
        )

    token = _require_auth_token()
    client = get_backend_client()

    # Resolve clinic_id if hint provided
    active_clinic_id = clinic_id or ctx.clinic_id
    if clinic_name_hint:
        try:
            from app.core.tools.mcp_tools.clinic_tools import get_my_clinics

            resp = await get_my_clinics(clinic_name_hint=clinic_name_hint)
            if resp.get("success") and resp.get("target_clinic_id"):
                active_clinic_id = resp["target_clinic_id"]
        except Exception:
            pass

    if not active_clinic_id:
        return build_tool_error_response(
            error_code="CLINIC_NOT_FOUND",
            message="Không tìm thấy thông tin phòng khám.",
            recoverable=False,
            suggestion="Yêu cầu đăng nhập với quyền CLINIC_OWNER hoặc CLINIC_MANAGER.",
        )

    try:
        # Determine dates
        now = datetime.now(timezone.utc)
        if date:
            try:
                start_date_obj = datetime.strptime(date, "%Y-%m-%d").date()
            except ValueError:
                return build_tool_error_response(
                    error_code="INVALID_DATE",
                    message="Ngay khong hop le. Vui long su dung dinh dang YYYY-MM-DD.",
                    recoverable=True,
                )
        else:
            start_date_obj = now.date()

        effective_days = min(max(int(days), 1), 7)
        end_date_obj = start_date_obj + timedelta(days=effective_days - 1)

        start_date_str = start_date_obj.isoformat()
        end_date_str = end_date_obj.isoformat()

        logger.info(
            f"Fetching shifts for clinic {ctx.clinic_id} from {start_date_str} to {end_date_str}"
        )
        shifts = await client.get_clinic_shifts(
            token, active_clinic_id, start_date_str, end_date_str
        )

        if not isinstance(shifts, list):
            shifts = []

        # Build UI schema representation
        ui_shifts = []
        total_available = 0
        total_booked = 0

        for shift in shifts:
            work_date = shift.get("displayDate") or shift.get("workDate")
            start_t = shift.get("startTime", "")[:5]
            end_t = shift.get("endTime", "")[:5]
            time_str = f"{start_t} - {end_t}"

            avail = shift.get("availableSlots", 0)
            booked = shift.get("bookedSlots", 0)

            total_available += avail
            total_booked += booked

            ui_shifts.append(
                {
                    "shift_id": shift.get("shiftId"),
                    "staff_name": shift.get("staffName", "Unknown"),
                    "date": work_date,
                    "time": time_str,
                    "available_slots": avail,
                    "booked_slots": booked,
                    "total_slots": shift.get("totalSlots", 0),
                    "is_continuation": shift.get("isContinuation", False),
                }
            )

        return build_tool_success_response(
            data={
                "clinic_id": ctx.clinic_id,
                "start_date": start_date_str,
                "end_date": end_date_str,
                "total_shifts": len(ui_shifts),
                "total_available_slots": total_available,
                "total_booked_slots": total_booked,
                "shifts": ui_shifts,
                "ui_card": {
                    "type": "staff_schedule_card",
                    "data": {
                        "date": start_date_str
                        if effective_days == 1
                        else f"{start_date_str} to {end_date_str}",
                        "shifts": ui_shifts,
                    },
                },
            },
            metadata={"is_final": False},
        )
    except BackendClientError as e:
        logger.error(f"Error in get_staff_schedule: {e}")
        error_code = classify_error_code(str(e))
        return build_tool_error_response(
            error_code=error_code,
            message=f"Không thể lấy lịch làm việc: {str(e)}",
            recoverable=True,
            suggestion="Vui lòng thử lại sau.",
        )
    except Exception as e:
        logger.error(f"Error in get_staff_schedule: {e}")
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=f"Lỗi hệ thống khi lấy lịch làm việc: {str(e)}",
            recoverable=True,
        )


@mcp_server.tool
async def get_slot_availability(
    date: Optional[str] = None,
    staff_name: Optional[str] = None,
    clinic_name_hint: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get detailed slot availability for the clinic.
    Use clinic_name_hint to find IDs automatically.
    Use this when asking for empty slots or checking which pets are booked.

    Args:
        date: Date to check (YYYY-MM-DD). Default is today.
        staff_name: Optional staff name to filter by.

    Returns:
        Detailed grid of slots (time, status, booked pet/service if any).
    """
    if not _is_tool_available("get_slot_availability"):
        return build_tool_error_response(
            error_code="TOOL_NOT_AVAILABLE",
            message="Chức năng này không được phép sử dụng trong ngữ cảnh hiện tại.",
            recoverable=False,
            suggestion="Yêu cầu đăng nhập với quyền chủ phòng khám hoặc quản lý.",
        )

    try:
        ctx = require_tool_runtime_context()
    except Exception as e:
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=str(e),
            recoverable=False,
        )

    token = _require_auth_token()
    client = get_backend_client()

    # Resolve clinic_id if hint provided
    active_clinic_id = clinic_id or ctx.clinic_id
    if clinic_name_hint:
        try:
            from app.core.tools.mcp_tools.clinic_tools import get_my_clinics

            resp = await get_my_clinics(clinic_name_hint=clinic_name_hint)
            if resp.get("success") and resp.get("target_clinic_id"):
                active_clinic_id = resp["target_clinic_id"]
        except Exception:
            pass

    if not active_clinic_id:
        return build_tool_error_response(
            error_code="CLINIC_NOT_FOUND",
            message="Không tìm thấy thông tin phòng khám.",
            recoverable=False,
        )

    try:
        now = datetime.now(timezone.utc)
        if date:
            try:
                target_date_obj = datetime.strptime(date, "%Y-%m-%d").date()
            except ValueError:
                return build_tool_error_response(
                    error_code="INVALID_DATE",
                    message="Ngay khong hop le (YYYY-MM-DD).",
                    recoverable=True,
                )
        else:
            target_date_obj = now.date()

        target_date_str = target_date_obj.isoformat()

        logger.info(
            f"Fetching slot availability for clinic {ctx.clinic_id} on {target_date_str}"
        )
        shifts = await client.get_clinic_staff_shifts(
            token, active_clinic_id, target_date_str, target_date_str
        )

        if not isinstance(shifts, list):
            shifts = []

        all_slots = []
        for shift in shifts:
            s_name = shift.get("staffName", "Unknown")
            if staff_name and staff_name.lower() not in s_name.lower():
                continue

            shift_slots = shift.get("slots", [])
            if not shift_slots:
                continue

            for slot in shift_slots:
                # Format to HH:MM
                start_time = slot.get("startTime", "")[:5]
                status = slot.get("status", "UNKNOWN")

                slot_data = {
                    "time": start_time,
                    "status": status,
                    "staff_name": s_name,
                    "shift_id": shift.get("shiftId"),
                }

                if status == "BOOKED":
                    slot_data["pet_name"] = slot.get("petName", "Unknown Pet")
                    slot_data["service"] = slot.get("serviceName", "Unknown Service")
                    slot_data["booking_id"] = slot.get("bookingId")

                all_slots.append(slot_data)

        # Sort slots by time
        all_slots.sort(key=lambda x: x["time"])

        return build_tool_success_response(
            data={
                "clinic_id": ctx.clinic_id,
                "date": target_date_str,
                "staff_filter": staff_name,
                "total_slots": len(all_slots),
                "slots": all_slots,
                "ui_card": {
                    "type": "slot_grid_card",
                    "data": {
                        "date": target_date_str,
                        "staff_name": staff_name or "All Staff",
                        "slots": all_slots,
                    },
                },
            },
            metadata={"is_final": False},
        )
    except BackendClientError as e:
        logger.error(f"Error in get_slot_availability: {e}")
        error_code = classify_error_code(str(e))
        return build_tool_error_response(
            error_code=error_code,
            message=f"Không thể lấy danh sách slot: {str(e)}",
            recoverable=True,
            suggestion="Vui lòng thử lại sau.",
        )
    except Exception as e:
        logger.error(f"Error in get_slot_availability: {e}")
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=f"Lỗi hệ thống khi lấy danh sách slot: {str(e)}",
            recoverable=True,
        )
