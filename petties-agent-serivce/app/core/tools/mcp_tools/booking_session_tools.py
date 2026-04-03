from __future__ import annotations

from typing import Any, Dict, Optional

from loguru import logger

from app.core.agents.booking_session import (
    BookingSessionState,
    cancel_booking_session,
    complete_booking_session,
    merge_booking_draft,
    resume_booking_session as resume_booking_state,
    start_booking_session,
    suspend_booking_session as suspend_booking_state,
)
from app.core.database.mongodb import update_booking_state_in_db
from app.core.tool_runtime_context import require_tool_runtime_context
from app.core.tools.contracts import (
    build_tool_error_response,
    build_tool_success_response,
)
from app.core.tools.mcp_server import mcp_server


async def _save_state_to_db(state: BookingSessionState) -> None:
    ctx = require_tool_runtime_context()
    payload = state.model_dump(mode="json")
    ctx.booking_state = payload
    if ctx.session_id:
        await update_booking_state_in_db(ctx.session_id, payload)


async def _get_current_state() -> Optional[BookingSessionState]:
    ctx = require_tool_runtime_context()
    if not ctx.booking_state:
        return None
    try:
        return BookingSessionState.model_validate(ctx.booking_state)
    except Exception as exc:
        logger.error(f"Failed to parse booking state from runtime context: {exc}")
        return None


def _build_state_response(state: BookingSessionState) -> Dict[str, Any]:
    return {
        "state": state.model_dump(mode="json"),
        "summary": state.to_summary(),
        "missing_fields": state.missing_fields,
        "ready_for_review": state.is_ready_for_review,
    }


@mcp_server.tool(
    name="start_booking_session",
    description="Bắt đầu hoặc khởi tạo lại phiên đặt lịch với intent và dữ liệu nháp ban đầu nếu có.",
)
async def start_booking_session_tool(
    intent: str = "create_booking",
    initial_draft: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    state = start_booking_session(intent=intent, initial_draft=initial_draft)
    await _save_state_to_db(state)
    return build_tool_success_response(
        {"message": "Đã khởi tạo phiên đặt lịch.", **_build_state_response(state)}
    )


@mcp_server.tool(
    name="get_booking_session",
    description="Lấy booking session hiện tại để biết draft, trạng thái, và các trường còn thiếu.",
)
async def get_booking_session() -> Dict[str, Any]:
    state = await _get_current_state()
    if not state:
        return build_tool_error_response(
            error_code="BOOKING_SESSION_NOT_FOUND",
            message="Không có phiên đặt lịch đang hoạt động.",
            recoverable=True,
            suggestion="Bạn có thể bắt đầu lại bằng thao tác đặt lịch mới.",
            metadata={"state": None},
        )
    return build_tool_success_response(_build_state_response(state))


@mcp_server.tool(
    name="end_booking_session",
    description="Kết thúc booking session hiện tại khi hoàn tất hoặc khi người dùng hủy.",
)
async def end_booking_session(reason: str = "CANCELLED") -> Dict[str, Any]:
    state = await _get_current_state()
    if not state:
        return build_tool_error_response(
            error_code="BOOKING_SESSION_NOT_FOUND",
            message="Không có phiên đặt lịch để kết thúc.",
            recoverable=True,
            suggestion="Bạn có thể bắt đầu một phiên đặt lịch mới khi cần.",
        )

    normalized_reason = str(reason or "CANCELLED").strip().upper()
    if normalized_reason == "COMPLETED":
        updated_state = complete_booking_session(state)
        message = "Đã đánh dấu phiên đặt lịch là hoàn tất."
    else:
        updated_state = cancel_booking_session(state, reason=normalized_reason)
        message = "Đã hủy phiên đặt lịch."

    await _save_state_to_db(updated_state)
    return build_tool_success_response(
        {"message": message, **_build_state_response(updated_state)}
    )


@mcp_server.tool(
    name="update_booking_draft",
    description="Cập nhật các trường của booking draft và tự động áp dụng invalidation rules khi dữ liệu thay đổi.",
)
async def update_booking_draft(
    pet_id: Optional[str] = None,
    pet_name: Optional[str] = None,
    clinic_id: Optional[str] = None,
    clinic_hint: Optional[str] = None,
    clinic_name: Optional[str] = None,
    service_ids: Optional[list[str]] = None,
    service_names: Optional[list[str]] = None,
    booking_date: Optional[str] = None,
    start_time: Optional[str] = None,
    time_preference: Optional[str] = None,
    booking_type: Optional[str] = None,
    home_address: Optional[str] = None,
    home_lat: Optional[float] = None,
    home_long: Optional[float] = None,
) -> Dict[str, Any]:
    state = await _get_current_state()
    if not state:
        return build_tool_error_response(
            error_code="BOOKING_SESSION_NOT_FOUND",
            message="Không có phiên đặt lịch đang hoạt động.",
            recoverable=True,
            suggestion="Hãy gọi start_booking_session trước khi cập nhật draft.",
        )

    updates = {
        "pet_id": pet_id,
        "pet_name": pet_name,
        "clinic_id": clinic_id,
        "clinic_hint": clinic_hint,
        "clinic_name": clinic_name,
        "service_ids": service_ids,
        "service_names": service_names,
        "booking_date": booking_date,
        "start_time": start_time,
        "time_preference": time_preference,
        "booking_type": booking_type,
        "home_address": home_address,
        "home_lat": home_lat,
        "home_long": home_long,
    }

    result = merge_booking_draft(state, updates)
    await _save_state_to_db(state)
    return build_tool_success_response(
        {
            "message": "Đã cập nhật booking draft.",
            **result,
            "state": state.model_dump(mode="json"),
        }
    )


@mcp_server.tool(
    name="get_booking_draft_summary",
    description="Lấy tóm tắt booking draft hiện tại, gồm thông tin đã có và các trường còn thiếu.",
)
async def get_booking_draft_summary() -> Dict[str, Any]:
    state = await _get_current_state()
    if not state:
        return build_tool_error_response(
            error_code="BOOKING_SESSION_NOT_FOUND",
            message="Không có phiên đặt lịch đang hoạt động.",
            recoverable=True,
            suggestion="Hãy bắt đầu phiên đặt lịch mới trước.",
        )
    return build_tool_success_response(
        {
            "status": "Sẵn sàng review"
            if state.is_ready_for_review
            else "Chưa đủ thông tin",
            **_build_state_response(state),
        }
    )


@mcp_server.tool(
    name="suspend_booking_session",
    description="Tạm dừng booking session hiện tại để trả lời câu hỏi ngoài luồng nhưng vẫn giữ lại draft.",
)
async def suspend_booking_session(
    reason: str = "Người dùng tạm hỏi sang việc khác",
) -> Dict[str, Any]:
    state = await _get_current_state()
    if not state:
        return build_tool_error_response(
            error_code="BOOKING_SESSION_NOT_FOUND",
            message="Không có phiên đặt lịch để tạm dừng.",
            recoverable=True,
            suggestion="Hãy bắt đầu phiên đặt lịch mới nếu bạn muốn tiếp tục.",
        )
    updated_state = suspend_booking_state(state, reason=reason)
    await _save_state_to_db(updated_state)
    return build_tool_success_response(
        {
            "message": "Đã tạm dừng phiên đặt lịch.",
            **_build_state_response(updated_state),
        }
    )


@mcp_server.tool(
    name="resume_booking_session",
    description="Tiếp tục booking session đang bị tạm dừng và khôi phục trạng thái thu thập hiện tại.",
)
async def resume_booking_session() -> Dict[str, Any]:
    state = await _get_current_state()
    if not state:
        return build_tool_error_response(
            error_code="BOOKING_SESSION_NOT_FOUND",
            message="Không có phiên đặt lịch để tiếp tục.",
            recoverable=True,
            suggestion="Hãy bắt đầu phiên đặt lịch mới.",
        )
    updated_state = resume_booking_state(state)
    await _save_state_to_db(updated_state)
    return build_tool_success_response(
        {
            "message": "Đã tiếp tục phiên đặt lịch.",
            **_build_state_response(updated_state),
        }
    )
