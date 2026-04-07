from __future__ import annotations

import difflib
from typing import Any, Dict, List, Optional

from loguru import logger

from app.core.agents.booking_session import (
    BookingSessionState,
    cancel_booking_session,
    complete_booking_session,
    merge_booking_draft,
    resume_booking_session as resume_booking_state,
    start_booking_session,
)
from app.core.database.mongodb import update_booking_state_in_db
from app.core.tool_runtime_context import require_tool_runtime_context
from app.core.tools.auth_deps import AuthenticationRequiredError, _require_auth_token
from app.core.tools.contracts import (
    build_tool_error_response,
    build_tool_success_response,
)
from app.core.tools.mcp_server import mcp_server
from app.services.backend_client import SpringBackendClient as BackendClient


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
        "stage": state.stage,
    }


async def _map_service_names_to_ids(
    service_names: List[str], clinic_id: str, token: str
) -> tuple[List[str], List[str], List[str]]:
    """
    So khớp danh sách tên dịch vụ với dữ liệu thực tế từ Backend.
    Trả về: (matched_ids, matched_names, unmapped_names)
    """
    if not service_names or not clinic_id:
        return [], [], []

    client = BackendClient()
    try:
        # Lấy danh sách dịch vụ thực tế của clinic
        services_response = await client.get_clinic_services(token, clinic_id=clinic_id)

        # Xử lý các định dạng response khác nhau từ backend
        if isinstance(services_response, dict) and "data" in services_response:
            real_services = services_response["data"]
        elif isinstance(services_response, dict) and "content" in services_response:
            real_services = services_response["content"]
        else:
            real_services = services_response

        if not isinstance(real_services, list):
            logger.warning(f"Backend returned non-list services: {real_services}")
            return [], [], service_names

        matched_ids = []
        matched_names = []
        unmapped_names = []

        # Chuẩn bị dữ liệu thực tế để so khớp
        # Đưa vào một dict để tra cứu nhanh hơn: lowcase_name -> service_info
        real_service_map = {}
        for s in real_services:
            name = str(s.get("name", "")).lower().strip()
            if name:
                real_service_map[name] = s

        all_real_names = list(real_service_map.keys())

        for input_name in service_names:
            input_name_clean = input_name.lower().strip()
            if not input_name_clean:
                continue

            # 1. Khớp chính xác
            if input_name_clean in real_service_map:
                s = real_service_map[input_name_clean]
                # Thử lấy ID theo thứ tự ưu tiên: serviceId -> id -> service_id
                s_id = s.get("serviceId") or s.get("id") or s.get("service_id")
                if s_id:
                    matched_ids.append(str(s_id))
                    matched_names.append(str(s.get("name")))
                continue

            # 2. Khớp mờ (Fuzzy matching)
            matches = difflib.get_close_matches(
                input_name_clean, all_real_names, n=1, cutoff=0.7
            )
            if matches:
                best_match = matches[0]
                s = real_service_map[best_match]
                s_id = s.get("serviceId") or s.get("id") or s.get("service_id")
                if s_id:
                    matched_ids.append(str(s_id))
                    matched_names.append(str(s.get("name")))
                continue

            # 3. Không tìm thấy
            unmapped_names.append(input_name)

        return matched_ids, matched_names, unmapped_names

    except Exception as e:
        logger.error(f"Error mapping services: {e}")
        return [], [], service_names


@mcp_server.tool(
    name="sync_booking_draft",
    description=(
        "Tool Flagship để đồng bộ hóa bản nháp đặt lịch. Tự động khởi tạo hoặc tiếp tục phiên nếu cần. "
        "Hỗ trợ Service Mapping thời gian thực: Ánh xạ tên dịch vụ (service_names) sang ID thực của Backend."
    ),
)
async def sync_booking_draft(
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
    intent: str = "create_booking",
) -> Dict[str, Any]:
    token = _require_auth_token()
    state = await _get_current_state()

    # 1. Khởi tạo hoặc Resume session
    if not state:
        state = start_booking_session(intent=intent)
        logger.info(f"Started new booking session for intent: {intent}")
    elif state.status == "SUSPENDED":
        state = resume_booking_state(state)
        logger.info("Resumed suspended booking session")

    # 2. Xử lý Service Mapping nếu có tên dịch vụ và đã xác định được clinic
    final_service_ids = service_ids or []
    final_service_names = service_names or []
    unmapped_services = []

    # Ưu tiên clinic_id trong draft nếu bản cập nhật không có clinic_id mới
    active_clinic_id = clinic_id or state.draft.clinic_id

    if service_names and active_clinic_id:
        m_ids, m_names, u_names = await _map_service_names_to_ids(
            service_names, active_clinic_id, token
        )

        # Hợp nhất các ID tìm được (tránh trùng lặp)
        id_set = set(final_service_ids)
        name_set = set(final_service_names)

        for mid, mname in zip(m_ids, m_names):
            id_set.add(mid)
            name_set.add(mname)

        final_service_ids = list(id_set)
        final_service_names = list(name_set)
        unmapped_services = u_names

    # 3. Cập nhật Draft
    updates = {
        "pet_id": pet_id,
        "pet_name": pet_name,
        "clinic_id": clinic_id,
        "clinic_hint": clinic_hint,
        "clinic_name": clinic_name,
        "service_ids": final_service_ids,
        "service_names": final_service_names,
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

    response_data = {
        "message": "Đã đồng bộ bản nháp đặt lịch.",
        "unmapped_services": unmapped_services,
        **_build_state_response(state),
    }

    # Thêm gợi ý UI Form nếu còn thiếu thông tin quan trọng
    if state.missing_fields:
        response_data["metadata"] = {"suggest_ui_form": True}

    return build_tool_success_response(response_data)


@mcp_server.tool(
    name="get_booking_session_info",
    description="Lấy thông tin chi tiết về phiên đặt lịch hiện tại, bao gồm bản nháp và các trường còn thiếu.",
)
async def get_booking_session_info() -> Dict[str, Any]:
    try:
        _require_auth_token()
    except AuthenticationRequiredError as exc:
        return build_tool_error_response(
            error_code="UNAUTHORIZED",
            message=str(exc),
            recoverable=True,
        )

    state = await _get_current_state()
    if not state:
        return build_tool_error_response(
            error_code="BOOKING_SESSION_NOT_FOUND",
            message="Không có phiên đặt lịch đang hoạt động.",
            recoverable=True,
        )
    return build_tool_success_response(_build_state_response(state))


@mcp_server.tool(
    name="close_booking_session",
    description="Kết thúc phiên đặt lịch hiện tại (Hoàn tất hoặc Hủy).",
)
async def close_booking_session(
    status: str = "CANCELLED", reason: Optional[str] = None
) -> Dict[str, Any]:
    try:
        _require_auth_token()
    except AuthenticationRequiredError as exc:
        return build_tool_error_response(
            error_code="UNAUTHORIZED",
            message=str(exc),
            recoverable=True,
        )

    state = await _get_current_state()
    if not state:
        return build_tool_error_response(
            error_code="BOOKING_SESSION_NOT_FOUND",
            message="Không có phiên đặt lịch để kết thúc.",
        )

    norm_status = status.upper().strip()
    if norm_status == "COMPLETED":
        updated_state = complete_booking_session(state)
        msg = "Đã hoàn tất phiên đặt lịch."
    else:
        updated_state = cancel_booking_session(state, reason=reason or "USER_CANCELLED")
        msg = f"Đã hủy phiên đặt lịch. Lý do: {reason or 'Người dùng hủy'}"

    await _save_state_to_db(updated_state)
    return build_tool_success_response(
        {"message": msg, **_build_state_response(updated_state)}
    )
