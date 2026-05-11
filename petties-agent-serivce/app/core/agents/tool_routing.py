"""
Thin post-parse validator for booking-related tool calls.

This module intentionally avoids keyword routing and flow rewrites.
It only:
- normalizes simple parameter shapes
- enriches calls with full-conversation context fields
- validates a minimal set of required inputs before execution
"""

from __future__ import annotations

from typing import Any, Callable, Dict, Iterable, List, Optional
import re
import logging

from app.core.agents.booking_context import (
    parse_conditional_intent,
    resolve_booking_datetime_inputs,
)
from app.core.agents.booking_flow import BOOKING_TOOL_NAMES
from app.core.agents.text_utils import (
    extract_all_user_messages,
    extract_latest_user_message,
)
from app.core.tool_runtime_context import (
    get_booking_context_cache,
    get_tool_runtime_context,
)
from app.core.tools.mcp_resources import get_resource_by_backing_tool

logger = logging.getLogger(__name__)
_BOOKING_ALLOWED_ROLES = {"PET_OWNER", "ADMIN"}
_READONLY_TOOL_RESOURCE_CANDIDATES = {
    "get_user_pets",
}


BOOKING_TOOL_PARAM_ALLOWLIST: Dict[str, set[str]] = {
    "get_user_pets": {"user_id", "pet_hint"},
    "get_clinic_services": {
        "clinic_id",
        "clinic_hint",
        "pet_species",
        "is_home_visit",
        "service_hint",
        "booking_type",
        "transcript",
        "latest_message",
    },
    # Utility Tools
    "resolve_booking_context": set(),
    "search_clinics_nearby": {
        "latitude",
        "longitude",
        "radius_km",
        "top_k",
        "address",
        "clinic_hint",
        "service_hint",
        "pet_id",
        "pet_species",
        "booking_type",
        "transcript",
        "latest_message",
    },
    "check_available_slots": {
        "clinic_id",
        "clinic_hint",
        "date",
        "date_expression",
        "service_ids",
        "exact_time",
        "time_preference",
        "pet_id",
        "pet_species",
        "booking_type",
        "service_hint",
        "transcript",
        "latest_message",
    },
    "create_booking_for_user": {
        "pet_id",
        "clinic_id",
        "clinic_hint",
        "booking_date",
        "start_time",
        "service_ids",
        "items",
        "booking_type",
        "notes",
        "home_address",
        "home_lat",
        "home_long",
        "distance_km",
        "user_id",
        "confirmed",
        "auto_create_if_available",
        "date_expression",
        "time_preference",
        "transcript",
        "latest_message",
    },
}


def _coerce_float(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _coerce_int(value: Any, default: int) -> int:
    if value in (None, ""):
        return default
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def _coerce_bool(value: Any) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    if value in (None, ""):
        return None
    normalized = str(value).strip().lower()
    if normalized in {"true", "1", "yes"}:
        return True
    if normalized in {"false", "0", "no"}:
        return False
    return None


def _normalize_service_ids(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [str(value).strip()] if str(value).strip() else []


def _normalize_booking_type(value: Any) -> Optional[str]:
    normalized = str(value or "").strip().upper()
    return normalized or None


def _all_user_text(messages: List[Any]) -> str:
    return "\n".join(extract_all_user_messages(messages))


def _extract_runtime_location(context: str) -> Dict[str, Any]:
    if not context:
        return {}

    location: Dict[str, Any] = {}

    lat_match = re.search(
        r"latitude\s*=\s*([+-]?\d+(?:\.\d+)?)", context, re.IGNORECASE
    )
    lng_match = re.search(
        r"longitude\s*=\s*([+-]?\d+(?:\.\d+)?)", context, re.IGNORECASE
    )
    address_match = re.search(r"address\s*=\s*([^\n]+)", context, re.IGNORECASE)

    if lat_match:
        location["latitude"] = _coerce_float(lat_match.group(1))
    if lng_match:
        location["longitude"] = _coerce_float(lng_match.group(1))
    if address_match:
        address = str(address_match.group(1)).strip().rstrip(",")
        if address:
            location["address"] = address

    return location


def _extract_last_booking_identity(
    react_steps: List[Dict[str, Any]],
) -> Dict[str, Optional[str]]:
    """Lấy clinic_id/pet_id gần nhất từ action hoặc observation trước đó."""
    last_clinic_id: Optional[str] = None
    last_pet_id: Optional[str] = None

    for step in reversed(react_steps or []):
        if not isinstance(step, dict):
            continue

        step_type = str(step.get("step_type") or "").strip().lower()
        if step_type == "action":
            params = step.get("tool_params")
            if isinstance(params, dict):
                if not last_clinic_id:
                    candidate = str(params.get("clinic_id") or "").strip()
                    if candidate:
                        last_clinic_id = candidate
                if not last_pet_id:
                    candidate = str(params.get("pet_id") or "").strip()
                    if candidate:
                        last_pet_id = candidate
        elif step_type == "observation":
            result = step.get("tool_result")
            payload = result.get("data") if isinstance(result, dict) else None
            if isinstance(payload, dict):
                if not last_clinic_id:
                    candidate = str(
                        payload.get("resolved_clinic_id")
                        or payload.get("clinic_id")
                        or ""
                    ).strip()
                    if candidate:
                        last_clinic_id = candidate
                if not last_pet_id:
                    candidate = str(
                        payload.get("resolved_pet_id") or payload.get("pet_id") or ""
                    ).strip()
                    if candidate:
                        last_pet_id = candidate

        if last_clinic_id and last_pet_id:
            break

    return {"clinic_id": last_clinic_id, "pet_id": last_pet_id}


def _build_missing_input_response(message: str) -> Dict[str, Any]:
    return {
        "tool_name": None,
        "tool_params": {},
        "should_end": True,
        "thought": message,
    }


def _build_resource_uri_for_tool(
    tool_name: str,
    tool_params: Dict[str, Any],
) -> Optional[str]:
    ctx = get_tool_runtime_context()
    if tool_name == "get_user_pets":
        user_id = str(tool_params.get("user_id") or getattr(ctx, "user_id", "") or "").strip()
        if not user_id:
            return None
        return f"petties://users/{user_id}/pets"

    if tool_name == "get_clinic_services":
        clinic_id = str(tool_params.get("clinic_id") or "").strip()
        if clinic_id:
            return f"petties://clinics/{clinic_id}/services"
        return None

    if tool_name == "check_available_slots":
        clinic_id = str(tool_params.get("clinic_id") or "").strip()
        if not clinic_id:
            return None
        date_value = str(tool_params.get("date") or "").strip()
        query = f"?date={date_value}" if date_value else ""
        return f"petties://clinics/{clinic_id}/slots{query}"

    return None


def _get_runtime_role() -> str:
    ctx = get_tool_runtime_context()
    return str(getattr(ctx, "role", "") or "").strip().upper()


def _get_runtime_booking_draft() -> Dict[str, Any]:
    ctx = get_tool_runtime_context()
    if not ctx or not isinstance(ctx.booking_state, dict):
        return {}
    draft = ctx.booking_state.get("draft")
    if not isinstance(draft, dict):
        return {}
    return draft


def _filter_allowed_params(
    tool_name: str, tool_params: Dict[str, Any]
) -> Dict[str, Any]:
    allowlist = BOOKING_TOOL_PARAM_ALLOWLIST.get(tool_name)
    if not allowlist:
        return tool_params

    stripped_keys = [key for key in tool_params.keys() if key not in allowlist]
    if stripped_keys:
        logger.warning(
            f"Tool '{tool_name}' received unexpected params that will be stripped: {stripped_keys}. "
            f"Allowed params: {allowlist}"
        )

    return {key: value for key, value in tool_params.items() if key in allowlist}


def _enrich_context_fields(
    tool_name: str, tool_params: Dict[str, Any], messages: List[Any]
) -> None:
    if tool_name not in BOOKING_TOOL_NAMES:
        return

    latest_message = extract_latest_user_message(messages)
    transcript = _all_user_text(messages)

    if "latest_message" in BOOKING_TOOL_PARAM_ALLOWLIST.get(
        tool_name, set()
    ) and not tool_params.get("latest_message"):
        tool_params["latest_message"] = latest_message
    if "transcript" in BOOKING_TOOL_PARAM_ALLOWLIST.get(
        tool_name, set()
    ) and not tool_params.get("transcript"):
        tool_params["transcript"] = transcript


def _normalize_booking_tool_params(
    tool_name: str,
    tool_params: Dict[str, Any],
    messages: List[Any],
    build_context_fn: Callable[[List[Dict[str, Any]]], str],
    react_steps: List[Dict[str, Any]],
) -> Dict[str, Any]:
    params = dict(tool_params or {})
    runtime_draft = _get_runtime_booking_draft()
    params = _filter_allowed_params(tool_name, params)
    _enrich_context_fields(tool_name, params, messages)

    if tool_name in {
        "search_clinics_nearby",
        "create_booking_for_user",
        "check_available_slots",
        "get_clinic_services",
    }:
        params["booking_type"] = _normalize_booking_type(params.get("booking_type"))

    if tool_name == "get_clinic_services":
        bool_value = _coerce_bool(params.get("is_home_visit"))
        if bool_value is None and params.get("booking_type"):
            params["is_home_visit"] = params["booking_type"] == "HOME_VISIT"
        elif bool_value is not None:
            params["is_home_visit"] = bool_value

    if tool_name in {
        "get_clinic_services",
        "check_available_slots",
        "create_booking_for_user",
    }:
        inherited_identity = _extract_last_booking_identity(react_steps)
        clinic_id = str(params.get("clinic_id") or "").strip()
        clinic_hint = str(params.get("clinic_hint") or "").strip()
        if not clinic_id and inherited_identity.get("clinic_id"):
            params["clinic_id"] = inherited_identity["clinic_id"]
        elif not clinic_id and clinic_hint:
            # Booking tools can resolve a clinic reference from clinic_id,
            # so preserve the hint by remapping it instead of dropping it.
            params["clinic_id"] = clinic_hint

        params.pop("clinic_hint", None)
        if not str(params.get("clinic_id") or "").strip():
            draft_clinic_id = str(runtime_draft.get("clinic_id") or "").strip()
            if draft_clinic_id:
                params["clinic_id"] = draft_clinic_id

    if tool_name in {"check_available_slots", "create_booking_for_user"}:
        incoming_service_ids = _normalize_service_ids(params.get("service_ids"))
        if not incoming_service_ids:
            incoming_service_ids = _normalize_service_ids(
                runtime_draft.get("service_ids")
            )
        params["service_ids"] = incoming_service_ids

        resolved_datetime = resolve_booking_datetime_inputs(
            date=params.get("date")
            if tool_name == "check_available_slots"
            else params.get("booking_date"),
            date_expression=params.get("date_expression"),
            exact_time=params.get("exact_time")
            if tool_name == "check_available_slots"
            else params.get("start_time"),
            time_preference=params.get("time_preference"),
            latest_message=params.get("latest_message"),
            transcript=params.get("transcript"),
        )
        date_key = "date" if tool_name == "check_available_slots" else "booking_date"
        time_key = (
            "exact_time" if tool_name == "check_available_slots" else "start_time"
        )

        if not params.get(date_key) and resolved_datetime.get("date"):
            params[date_key] = resolved_datetime["date"]
        if not params.get(date_key):
            draft_date = str(runtime_draft.get("booking_date") or "").strip()
            if draft_date:
                params[date_key] = draft_date
        if not params.get(time_key) and resolved_datetime.get("exact_time"):
            params[time_key] = resolved_datetime["exact_time"]
        if not params.get(time_key):
            draft_time = str(runtime_draft.get("start_time") or "").strip()
            if draft_time:
                params[time_key] = draft_time
        if not params.get("time_preference") and resolved_datetime.get(
            "time_preference"
        ):
            params["time_preference"] = resolved_datetime["time_preference"]

    if tool_name == "create_booking_for_user":
        if not str(params.get("clinic_id") or "").strip() and inherited_identity.get(
            "clinic_id"
        ):
            params["clinic_id"] = inherited_identity["clinic_id"]
        if not str(params.get("pet_id") or "").strip() and inherited_identity.get(
            "pet_id"
        ):
            params["pet_id"] = inherited_identity["pet_id"]

        confirmed = _coerce_bool(params.get("confirmed"))
        params["confirmed"] = bool(confirmed) if confirmed is not None else False

        latest_message = params.get("latest_message") or ""
        transcript = params.get("transcript") or ""
        conditional = parse_conditional_intent(latest_message, transcript)
        if conditional:
            cache = get_booking_context_cache()
            from app.core.tool_runtime_context import ConditionalIntent

            intent = ConditionalIntent(
                condition_type=conditional.get("condition_type", "explicit_request"),
                action=conditional.get("action", "create_booking"),
                condition_details=conditional.get("condition_details", {}),
                raw_text=conditional.get("raw_text", ""),
            )
            cache.set_conditional_intent(intent)
            if conditional.get("action") == "create_booking" and not params.get(
                "confirmed"
            ):
                params["auto_create_if_available"] = True
                logger.info(
                    f"Conditional intent detected: {conditional.get('condition_type')}, auto_create_if_available=True"
                )

    if tool_name == "search_clinics_nearby":
        params["radius_km"] = _coerce_float(params.get("radius_km")) or 5.0
        params["top_k"] = _coerce_int(params.get("top_k"), 5)

        params["latitude"] = _coerce_float(params.get("latitude"))
        params["longitude"] = _coerce_float(params.get("longitude"))

        runtime_location = _extract_runtime_location(build_context_fn(react_steps))
        if params.get("latitude") is None:
            params["latitude"] = _coerce_float(runtime_location.get("latitude"))
        if params.get("longitude") is None:
            params["longitude"] = _coerce_float(runtime_location.get("longitude"))
        if not params.get("address") and runtime_location.get("address"):
            params["address"] = runtime_location["address"]

    return params


def apply_booking_tool_routing(
    parsed: Dict[str, Any],
    messages: List[Any],
    react_steps: List[Dict[str, Any]],
    enabled_tools_lower: Iterable[str],
    build_context_fn: Callable[[List[Dict[str, Any]]], str],
) -> Dict[str, Any]:
    """
    Thin validator for booking tools.

    It normalizes booking params and can redirect read-only calls to resource path.
    """
    if not isinstance(parsed, dict):
        return parsed

    tool_name = str(parsed.get("tool_name") or "").strip()
    if not tool_name:
        return parsed

    normalized_tool = tool_name.lower()
    if normalized_tool not in set(enabled_tools_lower):
        return parsed

    if normalized_tool not in BOOKING_TOOL_NAMES:
        return parsed

    runtime_role = _get_runtime_role()
    if runtime_role and runtime_role not in _BOOKING_ALLOWED_ROLES:
        return {
            **parsed,
            **_build_missing_input_response(
                "Booking voi AI hien chi ap dung cho Pet Owner tren mobile. "
                "Vui long dung tro ly theo che do copilot noi bo."
            ),
        }

    tool_params = _normalize_booking_tool_params(
        normalized_tool,
        parsed.get("tool_params") or {},
        messages,
        build_context_fn,
        react_steps,
    )

    # Minimal guards for critical missing parameters to avoid tool errors/loops
    if normalized_tool in {"get_clinic_services", "check_available_slots", "create_booking_for_user"}:
        if not str(tool_params.get("clinic_id") or "").strip():
            return _build_missing_input_response(
                "Bạn muốn đặt lịch ở phòng khám nào vậy? Hãy cho mình biết tên phòng khám nhé."
            )

    if normalized_tool == "create_booking_for_user":
        if not str(tool_params.get("pet_id") or "").strip():
            return _build_missing_input_response(
                "Bạn đặt lịch khám cho bé nào nhỉ? Hãy chọn một bé trong danh sách của bạn."
            )
        if not tool_params.get("service_ids"):
            return _build_missing_input_response(
                "Bạn cần thực hiện dịch vụ nào cho bé? Hãy chọn dịch vụ từ danh mục phòng khám."
            )
        if not str(tool_params.get("booking_date") or "").strip() or not str(tool_params.get("start_time") or "").strip():
            return _build_missing_input_response(
                "Bạn muốn đặt lịch vào lúc nào? Hãy chọn ngày và giờ cụ thể giúp mình."
            )

    if (
        normalized_tool in _READONLY_TOOL_RESOURCE_CANDIDATES
        and "read_resource" in set(enabled_tools_lower)
    ):
        mapped_resource = get_resource_by_backing_tool(normalized_tool)
        resource_uri = _build_resource_uri_for_tool(normalized_tool, tool_params)
        if mapped_resource and resource_uri:
            return {
                **parsed,
                "tool_name": "read_resource",
                "tool_params": {
                    "resource_uri": resource_uri,
                    "fallback_params": tool_params,
                },
            }

    return {
        **parsed,
        "tool_name": normalized_tool,
        "tool_params": tool_params,
    }
