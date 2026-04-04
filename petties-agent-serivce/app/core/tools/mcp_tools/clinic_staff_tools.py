"""
PETTIES AGENT SERVICE - Clinic Staff & Shift Tools
Tools for managing clinic staff and shift schedules.
"""

from typing import Any, Dict, Optional, List
import logging
from datetime import datetime, timezone, timedelta, date as date_cls

from app.core.tools.contracts import (
    build_tool_success_response,
    build_tool_error_response,
)
from app.core.tools.mcp_server import mcp_server
from app.core.tool_runtime_context import (
    get_tool_runtime_context,
    require_tool_runtime_context,
)
from app.services.backend_client import BackendClientError, get_backend_client
from app.core.tools.tool_policy import get_tool_policy

logger = logging.getLogger(__name__)


def _is_tool_available(tool_name: str) -> bool:
    """Check if tool is registered in policy."""
    return get_tool_policy(tool_name) is not None


def _require_auth_token() -> str:
    """Require JWT token - raise exception if none."""
    context = require_tool_runtime_context()
    if not context.auth_token:
        raise RuntimeError(
            "Yeu cau dang nhap de su dung chuc nang nay. Vui long dang nhap truoc."
        )
    return context.auth_token


@mcp_server.tool
async def get_clinic_staff(
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Lấy danh sách nhân viên của phòng khám hiện tại.

    Params:
        user_id: Override user ID (thường không cần truyền, lấy từ session)
        session_id: Session ID (thường không cần truyền, lấy từ session)
        clinic_id: Override clinic ID (thường không cần truyền, lấy từ session)

    Returns:
        Danh sách nhân viên với thông tin: userId, fullName, role, specialty, phone, email.
    """
    if not _is_tool_available("get_clinic_staff"):
        return build_tool_error_response(
            error_code="TOOL_NOT_AVAILABLE",
            message="Cong cu get_clinic_staff chua duoc kich hoat",
            recoverable=True,
            suggestion="Lien he quan tri vien de biet them",
        )

    ctx = get_tool_runtime_context()
    if not ctx or not ctx.clinic_id:
        return build_tool_error_response(
            error_code="UNAUTHORIZED",
            message="Không tìm thấy thông tin phòng khám trong phiên làm việc của bạn.",
            recoverable=False,
            suggestion="Yeu cau đăng nhập với quyền CLINIC_OWNER hoặc CLINIC_MANAGER.",
        )

    token = _require_auth_token()
    client = get_backend_client()

    try:
        staff_list = await client.get_clinic_staff(token, ctx.clinic_id)

        if staff_list is None:
            staff_list = []

        return build_tool_success_response(
            data={
                "staff": staff_list,
                "total": len(staff_list) if isinstance(staff_list, list) else 0,
                "clinic_id": ctx.clinic_id,
            },
            metadata={"ui_card": "clinic_staff_list", "is_final": True},
        )
    except BackendClientError as e:
        logger.error(f"Error in get_clinic_staff: {e}")
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=f"Không thể lấy danh sách nhân viên: {str(e)}",
            recoverable=True,
            suggestion="Vui long thu lai sau.",
        )
    except Exception as e:
        logger.error(f"System error in get_clinic_staff: {e}")
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=f"Lỗi hệ thống: {str(e)}",
            recoverable=True,
        )


@mcp_server.tool
async def get_clinic_shifts(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Lấy lịch làm việc (shifts) của phòng khám trong khoảng thời gian.

    Params:
        start_date: Ngày bắt đầu (YYYY-MM-DD). Mặc định là hôm nay.
        end_date: Ngày kết thúc (YYYY-MM-DD). Mặc định là 7 ngày sau start_date.
        user_id: Override user ID (thường không cần truyền, lấy từ session)
        session_id: Session ID (thường không cần truyền, lấy từ session)
        clinic_id: Override clinic ID (thường không cần truyền, lấy từ session)

    Returns:
        Danh sách shifts với thông tin nhân viên, giờ làm, và slots.
    """
    if not _is_tool_available("get_clinic_shifts"):
        return build_tool_error_response(
            error_code="TOOL_NOT_AVAILABLE",
            message="Cong cu get_clinic_shifts chua duoc kich hoat",
            recoverable=True,
            suggestion="Lien he quan tri vien de biet them",
        )

    ctx = get_tool_runtime_context()
    if not ctx or not ctx.clinic_id:
        return build_tool_error_response(
            error_code="UNAUTHORIZED",
            message="Không tìm thấy thông tin phòng khám trong phiên làm việc của bạn.",
            recoverable=False,
            suggestion="Yeu cau đăng nhập với quyền CLINIC_OWNER hoặc CLINIC_MANAGER.",
        )

    token = _require_auth_token()
    client = get_backend_client()

    try:
        now = datetime.now(timezone.utc)
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                return build_tool_error_response(
                    error_code="INVALID_DATE",
                    message="Ngày bắt đầu không hợp lệ. Vui long su dung dinh dang YYYY-MM-DD.",
                    recoverable=True,
                )
        else:
            start_dt = now.date()

        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
            except ValueError:
                return build_tool_error_response(
                    error_code="INVALID_DATE",
                    message="Ngày kết thúc không hợp lệ. Vui long su dung dinh dang YYYY-MM-DD.",
                    recoverable=True,
                )
        else:
            end_dt = start_dt + timedelta(days=6)

        shifts = await client.get_clinic_shifts(
            token, ctx.clinic_id, start_dt.isoformat(), end_dt.isoformat()
        )

        if shifts is None:
            shifts = []

        return build_tool_success_response(
            data={
                "shifts": shifts,
                "total": len(shifts) if isinstance(shifts, list) else 0,
                "start_date": start_dt.isoformat(),
                "end_date": end_dt.isoformat(),
                "clinic_id": ctx.clinic_id,
            },
            metadata={"ui_card": "clinic_shift_list", "is_final": True},
        )
    except BackendClientError as e:
        logger.error(f"Error in get_clinic_shifts: {e}")
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=f"Không thể lấy lịch làm việc: {str(e)}",
            recoverable=True,
            suggestion="Vui long thu lai sau.",
        )
    except Exception as e:
        logger.error(f"System error in get_clinic_shifts: {e}")
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=f"Lỗi hệ thống: {str(e)}",
            recoverable=True,
        )


@mcp_server.tool
async def check_booking_availability(
    booking_id: str,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Kiểm tra tình trạng nhân viên cho một lịch hẹn cụ thể.
    Dùng để xem dịch vụ nào thiếu nhân viên và gợi ý phân công lại.

    Params:
        booking_id: ID của lịch hẹn cần kiểm tra.
        user_id: Override user ID (thường không cần truyền, lấy từ session)
        session_id: Session ID (thường không cần truyền, lấy từ session)
        clinic_id: Override clinic ID (thường không cần truyền, lấy từ session)

    Returns:
        StaffAvailabilityCheckResponse với thông tin:
        - allServicesHaveStaff: Tất cả dịch vụ đã có nhân viên chưa
        - services: Danh sách dịch vụ với trạng thái nhân viên
        - alternativeTimeSlots: Các khung giờ thay thế nếu thiếu nhân viên
    """
    if not _is_tool_available("check_booking_availability"):
        return build_tool_error_response(
            error_code="TOOL_NOT_AVAILABLE",
            message="Cong cu check_booking_availability chua duoc kich hoat",
            recoverable=True,
            suggestion="Lien he quan tri vien de biet them",
        )

    token = _require_auth_token()
    client = get_backend_client()

    try:
        availability = await client.get_booking_availability(token, booking_id)

        return build_tool_success_response(
            data={
                "booking_id": booking_id,
                "availability": availability,
                "all_services_have_staff": availability.get(
                    "allServicesHaveStaff", False
                ),
                "services": availability.get("services", []),
                "alternative_time_slots": availability.get("alternativeTimeSlots", []),
            },
            metadata={"ui_card": "booking_availability_check", "is_final": True},
        )
    except BackendClientError as e:
        logger.error(f"Error in check_booking_availability: {e}")
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=f"Không thể kiểm tra tình trạng nhân viên: {str(e)}",
            recoverable=True,
            suggestion="Vui long thu lai sau.",
        )
    except Exception as e:
        logger.error(f"System error in check_booking_availability: {e}")
        return build_tool_error_response(
            error_code="INTERNAL_ERROR",
            message=f"Lỗi hệ thống: {str(e)}",
            recoverable=True,
        )
