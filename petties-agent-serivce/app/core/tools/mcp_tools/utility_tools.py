from __future__ import annotations

import re
from datetime import date as date_cls, datetime, timedelta
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from loguru import logger

from app.core.agents.booking_context import resolve_booking_datetime_inputs
from app.core.agents.text_utils import normalize_vietnamese_text
from app.core.tool_runtime_context import require_tool_runtime_context
from app.core.tools.auth_deps import AuthenticationRequiredError, _require_auth_token
from app.core.tools.contracts import (
    build_tool_error_response,
    build_tool_success_response,
    classify_error_code,
)
from app.core.tools.mcp_server import mcp_server


VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def _normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _extract_first_group(pattern: str, text: str) -> Optional[str]:
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if not match:
        return None
    return _normalize_whitespace(match.group(1))


def _extract_booking_entities_from_text(user_message: str) -> Dict[str, Any]:
    message = _normalize_whitespace(user_message)
    lowered = message.lower()
    normalized = normalize_vietnamese_text(message)

    booking_intent = any(
        phrase in lowered
        for phrase in [
            "đặt lịch",
            "dat lich",
            "hẹn khám",
            "hen kham",
            "đặt hẹn",
            "book lịch",
        ]
    )
    cancel_intent = any(
        phrase in lowered
        for phrase in ["hủy lịch", "huy lich", "không đặt nữa", "khong dat nua"]
    )
    resume_intent = any(
        phrase in lowered
        for phrase in [
            "tiếp tục đặt lịch",
            "tiep tuc dat lich",
            "đặt lịch tiếp",
            "dat lich tiep",
        ]
    )

    clinic_hint = _extract_first_group(
        r"(?:phòng khám|phong kham|clinic|ở|o)\s+([A-Za-z0-9À-ỹ][A-Za-z0-9À-ỹ\s\-]{1,80})",
        message,
    )
    pet_hint = _extract_first_group(
        r"(?:cho bé|cho be|cho thú cưng|cho thu cung|cho pet|bé|be)\s+([A-Za-z0-9À-ỹ][A-Za-z0-9À-ỹ\s\-]{0,50})",
        message,
    )

    service_hint = None
    for known_service in [
        "khám tổng quát",
        "kham tong quat",
        "khám bệnh",
        "kham benh",
        "tiêm phòng",
        "tiem phong",
        "triệt sản",
        "triet san",
        "spa",
        "tắm",
        "tam",
    ]:
        if known_service in lowered:
            service_hint = known_service
            break

    booking_type = None
    if any(token in lowered for token in ["tại nhà", "tai nha", "home visit"]):
        booking_type = "HOME_VISIT"
    elif any(
        token in lowered for token in ["tại phòng khám", "tai phong kham", "in clinic"]
    ):
        booking_type = "IN_CLINIC"

    datetime_resolution = resolve_booking_datetime_inputs(
        date_expression=message,
        latest_message=message,
        transcript=message,
    )
    resolved_date = datetime_resolution.get("booking_date") or datetime_resolution.get(
        "date"
    )
    if not resolved_date and any(
        token in normalized
        for token in ["ngay mai", "sang mai", "chieu mai", "toi mai", "mai"]
    ):
        resolved_date = (datetime.now(VN_TZ).date() + timedelta(days=1)).isoformat()

    return {
        "booking_intent": booking_intent,
        "cancel_intent": cancel_intent,
        "resume_intent": resume_intent,
        "pet_hint": pet_hint,
        "clinic_hint": clinic_hint,
        "service_hint": service_hint,
        "booking_type": booking_type,
        "booking_date": resolved_date,
        "start_time": datetime_resolution.get("start_time")
        or datetime_resolution.get("exact_time"),
        "time_preference": datetime_resolution.get("time_preference"),
        "raw_message": message,
    }


@mcp_server.tool(
    name="get_current_datetime",
    description="Lấy ngày giờ hiện tại theo múi giờ Việt Nam để suy luận các cụm như hôm nay, ngày mai, cuối tuần này.",
)
async def resolve_date_time(
    time_expression: str,
    reference_date_iso: Optional[str] = None,
) -> Dict[str, Any]:
    if not str(time_expression or "").strip():
        return build_tool_error_response(
            error_code="INVALID_INPUT",
            message="Thiếu time_expression để phân tích ngày giờ.",
            recoverable=True,
            suggestion="Vui lòng gửi cụm ngày giờ như 'ngày mai 9 giờ'.",
        )

    try:
        reference_date = None
        if reference_date_iso:
            reference_date = date_cls.fromisoformat(reference_date_iso)

        resolved = resolve_booking_datetime_inputs(
            date_expression=time_expression,
            latest_message=time_expression,
            transcript=time_expression,
            reference_date=reference_date,
        )
        return build_tool_success_response(
            {
                "input_expression": time_expression,
                "reference_date_iso": reference_date_iso,
                "resolved_date": resolved.get("booking_date") or resolved.get("date"),
                "resolved_time": resolved.get("start_time")
                or resolved.get("exact_time"),
                "time_preference": resolved.get("time_preference"),
            }
        )
    except Exception as exc:
        logger.error(f"Error resolving date time '{time_expression}': {exc}")
        return build_tool_error_response(
            error_code=classify_error_code(str(exc)),
            message="Không thể phân tích cụm ngày giờ lúc này.",
            recoverable=True,
            suggestion="Vui lòng thử lại với mô tả thời gian rõ ràng hơn.",
            metadata={"root_error": str(exc), "time_expression": time_expression},
        )


@mcp_server.tool(
    name="resolve_booking_context",
    description="Lấy runtime context hiện tại của phiên chat để hỗ trợ booking flow mà không phải đoán user/session metadata.",
)
async def resolve_booking_context() -> Dict[str, Any]:
    try:
        _require_auth_token()
    except AuthenticationRequiredError as exc:
        return build_tool_error_response(
            error_code="UNAUTHORIZED",
            message=str(exc),
            recoverable=True,
            suggestion="Vui long dang nhap lai roi thu lai.",
        )

    try:
        ctx = require_tool_runtime_context()
        booking_state = ctx.booking_state or None
        draft = booking_state.get("draft") if isinstance(booking_state, dict) else None
        return build_tool_success_response(
            {
                "session_id": ctx.session_id,
                "user_id": ctx.user_id,
                "role": ctx.role,
                "assigned_clinic_id": ctx.clinic_id,
                "booking_state": booking_state,
                "booking_draft": draft if isinstance(draft, dict) else None,
            }
        )
    except Exception as exc:
        return build_tool_error_response(
            error_code=classify_error_code(str(exc), default="UNAUTHORIZED"),
            message="Không thể lấy thông tin ngữ cảnh đặt lịch hiện tại.",
            recoverable=True,
            suggestion="Vui lòng đăng nhập lại rồi thử lại.",
            metadata={"root_error": str(exc)},
        )


@mcp_server.tool(
    name="read_resource",
    description="Đọc dữ liệu nghiệp vụ read-only theo Resource URI (compatibility layer cho migration Resource vs Tool).",
)
async def read_resource(
    resource_uri: str,
    fallback_params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if not str(resource_uri or "").strip():
        return build_tool_error_response(
            error_code="INVALID_INPUT",
            message="Thiếu resource_uri để đọc dữ liệu.",
            recoverable=True,
            suggestion="Vui lòng gửi resource URI theo định dạng petties://...",
        )

    try:
        _require_auth_token()
    except AuthenticationRequiredError as exc:
        return build_tool_error_response(
            error_code="UNAUTHORIZED",
            message=str(exc),
            recoverable=True,
            suggestion="Vui lòng đăng nhập lại để truy cập dữ liệu.",
        )

    try:
        from app.core.tools.mcp_server import call_mcp_resource

        resource_result = await call_mcp_resource(resource_uri, fallback_params or {})
        telemetry = resource_result.get("telemetry") or {}
        return build_tool_success_response(
            {
                "resource_uri": resource_result.get("resource_uri"),
                "resource_name": resource_result.get("resource_name"),
                "cache_ttl_seconds": resource_result.get("cache_ttl_seconds"),
                "payload": resource_result.get("data"),
                "deprecated_tool": telemetry.get("deprecated_tool"),
                "migration_phase": "phase0_compatibility",
            }
        )
    except PermissionError as exc:
        return build_tool_error_response(
            error_code="FORBIDDEN",
            message=str(exc),
            recoverable=False,
        )
    except Exception as exc:
        logger.error(f"Error reading resource {resource_uri}: {exc}")
        return build_tool_error_response(
            error_code=classify_error_code(str(exc)),
            message="Không thể đọc resource ở thời điểm hiện tại.",
            recoverable=True,
            suggestion="Vui lòng thử lại sau hoặc fallback sang tool cũ.",
            metadata={"resource_uri": resource_uri, "root_error": str(exc)},
        )
