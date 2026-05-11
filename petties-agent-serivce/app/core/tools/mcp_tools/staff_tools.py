"""
PETTIES AGENT SERVICE - Staff & Scheduling Tools
Tools for clinic managers and owners to manage staff schedules and slot availability.
"""

from typing import Any, Dict, Optional
from datetime import datetime, timezone, timedelta

from app.core.tools.contracts import (
    build_tool_success_response,
    build_tool_error_response,
    classify_error_code,
)
from app.core.tools.mcp_server import mcp_server
from app.core.tool_runtime_context import require_tool_runtime_context
from app.core.tools.auth_deps import _require_auth_token
from app.services.backend_client import BackendClientError, get_backend_client
from app.core.tools.booking_helpers import (
    _standardize_booking_tool_response,
    _attach_booking_error_metadata,
)
from app.core.tools.mcp_tools.appointment_tools import get_my_booking_info
from loguru import logger
from app.core.tools.tool_policy import get_tool_policy

def _is_tool_available(tool_name: str) -> bool:
    """Check if tool is registered in policy."""
    return get_tool_policy(tool_name) is not None

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
    logger.info("🔧 [TOOL] ===== get_available_staff_for_reassign =====")
    logger.info(f"  ├─ Input: booking_id={booking_id}, service_id={service_id}")

    try:
        token = _require_auth_token()
    except Exception as e:
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
    logger.info("🔧 [TOOL] ===== reassign_staff_for_service =====")
    logger.info(
        f"  ├─ Input: booking_id={booking_id}, service_id={service_id}, booking_service_item_id={booking_service_item_id}, new_staff_id={new_staff_id}"
    )

    try:
        token = _require_auth_token()
    except Exception as e:
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
    logger.info("🔧 [TOOL] ===== confirm_booking_manager =====")
    logger.info(f"  ├─ Input: booking_id={booking_id}")

    try:
        token = _require_auth_token()
    except Exception as e:
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
    logger.info("🔧 [TOOL] ===== cancel_booking_manager =====")
    logger.info(
        f"  ├─ Input: booking_id={booking_id}, booking_code={booking_code_hint}, reason={reason}"
    )

    client = get_backend_client()
    try:
        token = _require_auth_token()
    except Exception as e:
        return build_tool_error_response(
            error_code="UNAUTHORIZED",
            message=str(e),
            recoverable=True,
            suggestion="Vui lòng đăng nhập lại.",
        )

    # Resolve booking_id from booking_code_hint if needed
    if not booking_id and booking_code_hint:
        try:
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
    logger.info("🔧 [TOOL] ===== view_clinic_bookings =====")
    logger.info(
        f"  ├─ Input: clinic_id={clinic_id}, status={status}, booking_type={booking_type}, page={page}, size={size}"
    )

    try:
        token = _require_auth_token()
    except Exception as e:
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
