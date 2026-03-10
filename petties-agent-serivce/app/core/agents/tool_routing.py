"""
PETTIES AGENT SERVICE - Post-Parse Tool Routing Rules

Rule engine that validates and enriches tool calls before execution
(e.g. booking flow validation).

Package: app.core.agents
Version: v2.0.0 (Removed medical routing after tool merge)
"""

from typing import Dict, Any, List, Set
from loguru import logger

from app.core.agents.booking_flow import (
    BOOKING_TOOL_NAMES,
    has_booking_tools_enabled,
    build_booking_context_snapshot,
)


def apply_booking_tool_routing(
    parsed: Dict[str, Any],
    messages: List[Any],
    react_steps: List[Dict[str, Any]],
    enabled_tools_lower: Set[str],
    build_context_fn,
) -> Dict[str, Any]:
    """Validate and enrich booking tool calls before execution.

    Guards against premature create_booking / check_available_slots calls
    by verifying required fields and user confirmation.

    Args:
        parsed: Output from thought_parser.parse_thought().
        messages: Conversation messages.
        react_steps: Previous ReAct steps.
        enabled_tools_lower: Lowercase set of enabled tool names.
        build_context_fn: Callable to build context string from react_steps.

    Returns:
        Possibly-modified parsed dict.
    """
    tool_name = str(parsed.get("tool_name") or "").strip().lower()
    if tool_name not in BOOKING_TOOL_NAMES:
        return parsed

    context = build_context_fn(react_steps)
    snapshot = build_booking_context_snapshot(messages, context)
    if not snapshot["has_booking_intent"]:
        return parsed

    tool_params = dict(parsed.get("tool_params") or {})

    # Block check_available_slots / create_booking if booking type unknown
    if (
        tool_name in {"check_available_slots", "create_booking_for_user"}
        and not snapshot["booking_type_known"]
    ):
        return {
            **parsed,
            "tool_name": None,
            "tool_params": {},
            "should_end": True,
            "thought": (
                "Để mình hỗ trợ đặt lịch đúng flow, bạn muốn khám tại phòng khám hay bác sĩ đến nhà ạ? "
                "Mình sẽ dựa theo lựa chọn này để chỉ hỏi tiếp những thông tin còn thiếu."
            ),
        }

    if tool_name == "create_booking_for_user":
        return _validate_create_booking(parsed, tool_params, snapshot)

    return parsed


def _validate_create_booking(
    parsed: Dict[str, Any],
    tool_params: Dict[str, Any],
    snapshot: Dict[str, bool],
) -> Dict[str, Any]:
    """Validate required fields and confirmation for create_booking_for_user."""
    # Auto-fill booking_type from context
    if not tool_params.get("booking_type"):
        if snapshot["is_home_visit"]:
            tool_params["booking_type"] = "HOME_VISIT"
        elif snapshot["is_in_clinic"]:
            tool_params["booking_type"] = "IN_CLINIC"

    normalized_type = str(tool_params.get("booking_type") or "").upper()

    # Check required fields
    required = {
        "pet_id": "thú cưng",
        "clinic_id": "phòng khám",
        "booking_date": "ngày khám",
        "start_time": "giờ khám",
        "service_ids": "dịch vụ",
    }
    missing = [label for key, label in required.items() if not tool_params.get(key)]
    if missing:
        return {
            **parsed,
            "tool_name": None,
            "tool_params": {},
            "should_end": True,
            "thought": (
                "Trước khi tạo booking, mình còn thiếu: "
                f"{', '.join(missing)}. Bạn giúp mình bổ sung các thông tin này nhé."
            ),
        }

    # Check home visit specific fields
    if normalized_type == "HOME_VISIT":
        home_required = {
            "home_address": "địa chỉ khám tại nhà",
            "home_lat": "tọa độ vĩ độ",
            "home_long": "tọa độ kinh độ",
            "distance_km": "khoảng cách di chuyển",
        }
        home_missing = [
            label
            for key, label in home_required.items()
            if tool_params.get(key) in (None, "")
        ]
        if home_missing:
            return {
                **parsed,
                "tool_name": None,
                "tool_params": {},
                "should_end": True,
                "thought": (
                    "Để tạo booking khám tại nhà, mình còn thiếu: "
                    f"{', '.join(home_missing)}. Bạn giúp mình bổ sung nhé."
                ),
            }

    # Check user confirmation
    if tool_params.get("confirmed") is not True:
        services = tool_params.get("service_ids") or []
        service_text = (
            ", ".join(str(s) for s in services)
            if isinstance(services, list) and services
            else "dịch vụ đã chọn"
        )
        type_text = (
            "khám tại nhà" if normalized_type == "HOME_VISIT" else "khám tại phòng khám"
        )
        extra = ""
        if normalized_type == "HOME_VISIT":
            extra = (
                f", địa chỉ `{tool_params.get('home_address')}`, "
                f"khoảng cách `{tool_params.get('distance_km')}` km"
            )
        return {
            **parsed,
            "tool_name": None,
            "tool_params": {},
            "should_end": True,
            "thought": (
                f"Mình đã có đủ thông tin sơ bộ cho lịch {type_text}. "
                f"Bạn vui lòng xác nhận giúp mình: pet `{tool_params.get('pet_id')}`, "
                f"phòng khám `{tool_params.get('clinic_id')}`, "
                f"ngày `{tool_params.get('booking_date')}`, giờ `{tool_params.get('start_time')}`, "
                f"dịch vụ `{service_text}`{extra}. "
                "Nếu đúng hết, mình sẽ tạo booking ở bước tiếp theo."
            ),
        }

    return {**parsed, "tool_params": tool_params}
