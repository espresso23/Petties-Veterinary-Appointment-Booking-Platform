"""
PETTIES AGENT SERVICE - WebSocket Chat Handler
Real-time chat with streaming responses

Package: app.api.websocket
Purpose: WebSocket endpoint with generic UI schema dispatching
Version: v2.1.0 (Presentation Layer owned `ui_schema`)

Design:
- Tools return structured business data
- Presentation Layer converts tool results into `ui_schema`
- chat.py streams reasoning plus versioned UI schema payloads
"""

import asyncio
import json
import logging
import re
import time
import unicodedata
import uuid
from datetime import datetime, timezone
from contextlib import suppress
from typing import Any, Dict, List, NamedTuple, Optional

from fastapi import HTTPException, WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState

from app.api.middleware.auth import CurrentUser, decode_jwt_token
from app.api.websocket.chat_constants import (
    WS_REASON_AUTH_REQUIRED,
    WS_REASON_INVALID_AUTH,
    WS_REASON_PLAYGROUND_FORBIDDEN,
    WS_REASON_SESSION_FORBIDDEN,
    WS_REASON_SUBSCRIPTION_REQUIRED,
)
from app.api.middleware.subscription_guard import verify_subscription_logic
from app.core.agents.factory import AgentFactory
from app.core.agents.state import map_booking_status_to_stage
from app.core.agents.thinking_formatter import (
    format_thinking_for_stream,
)
from app.core.presentation.builder import build_ui_schema
from app.core.presentation.ui_schema import ActionType
from app.core.chat_context import (
    BUSINESS_CHAT,
    PLAYGROUND_TEST,
    default_context_for_user,
    normalize_context_type,
)
from app.core.database.mongodb import (
    expire_chat_session_state_if_needed,
    get_chat_history,
    get_chat_session,
    save_chat_message,
    save_chat_session,
    touch_chat_session,
)
from app.core.tool_runtime_context import (
    ToolRuntimeContext,
    reset_tool_runtime_context,
    set_tool_runtime_context,
    get_tool_runtime_context,
)
from app.db.postgres.session import AsyncSessionLocal
from app.config.settings import settings

logger = logging.getLogger(__name__)

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_UI_ACTION_SPECS: Dict[str, Dict[str, Any]] = {
    "start_booking": {"allowed": set()},
    "select_pet": {
        "allowed": {"pet_id", "pet_name"},
        "required_any": [{"pet_id"}],
    },
    "select_booking_type": {
        "allowed": {"booking_type"},
        "required": {"booking_type"},
    },
    "select_service_category": {
        "allowed": {"category"},
        "required": {"category"},
    },
    "select_clinic": {
        "allowed": {"clinic_id", "clinic_name", "clinic_address"},
        "required_any": [{"clinic_id"}, {"clinic_name"}],
    },
    "select_services": {
        "allowed": {"service_ids", "service_names", "clinic_id"},
        "required": {"service_ids"},
    },
    "select_date": {
        "allowed": {"booking_date"},
        "required": {"booking_date"},
    },
    "select_slot": {
        "allowed": {"clinic_id", "booking_date", "start_time", "service_ids", "pet_id"},
        "required": {"booking_date", "start_time"},
    },
    "confirm_booking": {
        "allowed": {
            "pet_id",
            "clinic_id",
            "booking_date",
            "start_time",
            "service_ids",
            "booking_type",
            "home_address",
            "home_lat",
            "home_long",
            "distance_km",
        },
        "required_any": [
            {"pet_id"},
            {"clinic_id"},
            {"service_ids"},
            {"booking_date", "start_time"},
        ],
    },
    "confirm_service_create": {
        "allowed": {
            "name",
            "description",
            "base_price",
            "slots_required",
            "duration_time",
            "is_active",
            "is_home_visit",
            "service_category",
            "pet_type",
            "reminder_interval",
            "reminder_unit",
            "weight_prices",
            "vaccine_template_id",
            "dose_prices",
        },
        "required": {"name", "base_price", "slots_required"},
    },
    "confirm_service_batch_create": {
        "allowed": {"services"},
        "required": {"services"},
    },
    "confirm_service_update": {
        "allowed": {
            "service_id",
            "service_name",
            "name",
            "base_price",
            "description",
            "is_active",
            "duration_time",
            "slots_required",
            "is_home_visit",
            "service_category",
            "pet_type",
            "reminder_interval",
            "reminder_unit",
            "weight_prices",
            "vaccine_template_id",
            "dose_prices",
        },
        "required_any": [{"service_id"}, {"service_name"}],
    },
    "cancel_or_change": {"allowed": {"change_target", "reason"}},
    "change_pet": {
        "allowed": {
            "pet_id",
            "pet_name",
            "clinic_id",
            "clinic_name",
            "booking_date",
            "start_time",
            "booking_type",
            "service_ids",
            "service_names",
        }
    },
    "change_clinic": {
        "allowed": {
            "pet_id",
            "pet_name",
            "clinic_id",
            "clinic_name",
            "booking_date",
            "start_time",
            "booking_type",
            "service_ids",
            "service_names",
        }
    },
    "change_service": {
        "allowed": {
            "pet_id",
            "pet_name",
            "clinic_id",
            "clinic_name",
            "booking_date",
            "start_time",
            "booking_type",
            "service_ids",
            "service_names",
        }
    },
    "change_date": {
        "allowed": {
            "pet_id",
            "pet_name",
            "clinic_id",
            "clinic_name",
            "booking_date",
            "start_time",
            "booking_type",
            "service_ids",
            "service_names",
        }
    },
    "change_time": {
        "allowed": {
            "pet_id",
            "pet_name",
            "clinic_id",
            "clinic_name",
            "booking_date",
            "start_time",
            "booking_type",
            "service_ids",
            "service_names",
        }
    },
    "request_booking_revision": {
        "allowed": {
            "pet_id",
            "clinic_id",
            "booking_date",
            "start_time",
            "service_ids",
            "service_names",
            "booking_type",
        }
    },
    ActionType.RETRY_WITH_CHANGE.value: {"allowed": {"change_target", "reason"}},
    ActionType.CANCEL_FLOW.value: {"allowed": {"reason"}},
    ActionType.OPEN_NATIVE_CONFIRM.value: {"allowed": {"confirm_target"}},
    ActionType.OPEN_DETAIL.value: {"allowed": {"target_id", "target_type"}},
    ActionType.DISMISS.value: {"allowed": {"reason"}},
    "select_item": {
        "allowed": {
            "item_id",
            "item_type",
            "source",
            "clinic_id",
            "clinic_name",
            "service_id",
            "service_name",
            "service_ids",
            "service_names",
            "slot_date",
            "slot_time",
            "pet_id",
            "pet_name",
        },
        "required_any": [{"item_id"}],
    },
}


class StreamTerminated(Exception):
    """Stop chat processing after a terminal websocket event has been emitted."""


def _truncate(text: str, max_len: int = 160) -> str:
    s = (text or "").strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 3].rstrip() + "..."


def summarize_thought(text: Any) -> str:
    """Return a safe, short, user-facing reasoning summary."""
    if not isinstance(text, str):
        return "Đang suy luận: mình đang phân tích yêu cầu của bạn."

    s = text.strip()
    if not s:
        return "Đang suy luận: mình đang phân tích yêu cầu của bạn."

    # Strip common prefixes.
    s = re.sub(r"^\s*thought\s*:\s*", "", s, flags=re.IGNORECASE).strip()
    s = re.sub(r"^\s*suy\s+nghi\s*:\s*", "", s, flags=re.IGNORECASE).strip()

    # Keep first line only.
    s = s.splitlines()[0].strip()

    # Remove any accidental tool markers.
    s = re.split(r"\btool\s*:\b", s, maxsplit=1, flags=re.IGNORECASE)[0].strip()
    s = re.split(r"\btool\s*input\s*:\b", s, maxsplit=1, flags=re.IGNORECASE)[0].strip()

    s = strip_redundant_greeting(s)
    if not s:
        return "Đang suy luận: mình đang phân tích yêu cầu của bạn."
    if not s.lower().startswith("đang suy luận:"):
        s = f"Đang suy luận: {s}"
    return _truncate(s, 180)


def _collect_tool_timing_summary(react_trace: List[Dict[str, Any]]) -> Dict[str, Any]:
    tools: List[Dict[str, Any]] = []
    for step in react_trace:
        if not isinstance(step, dict):
            continue
        if str(step.get("step_type") or "").strip().lower() != "observation":
            continue
        tool_name = str(step.get("tool_name") or "").strip()
        tool_result = step.get("tool_result")
        if not tool_name or not isinstance(tool_result, dict):
            continue
        metadata = (
            tool_result.get("metadata")
            if isinstance(tool_result.get("metadata"), dict)
            else {}
        )
        timing_ms = metadata.get("timing_ms") if isinstance(metadata, dict) else None
        if not isinstance(timing_ms, dict) or not timing_ms:
            continue
        tools.append({"tool_name": tool_name, "timing_ms": timing_ms})
    return {"tools": tools}


class ConnectionManager:
    """
    WebSocket connection manager

    Manages active connections and broadcasts messages
    """

    def __init__(self):
        # Active connections: session_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, session_id: str):
        """Store active connection (WebSocket must be accepted already)"""
        async with self._lock:
            self.active_connections[session_id] = websocket
            logger.info(f"WebSocket connected: {session_id}")

    def disconnect(self, session_id: str):
        """Remove connection (dict.pop is atomic in CPython)"""
        self.active_connections.pop(session_id, None)
        logger.info(f"WebSocket disconnected: {session_id}")

    async def send_message(self, session_id: str, message: dict):
        """Send message to specific session"""
        websocket = self.active_connections.get(session_id)
        if websocket:
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send message to {session_id}: {e}")

    async def send_text(self, session_id: str, text: str):
        """Send text message to specific session"""
        websocket = self.active_connections.get(session_id)
        if websocket:
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_text(text)
            except Exception as e:
                logger.error(f"Failed to send text to {session_id}: {e}")

    async def broadcast(self, message: dict):
        """Broadcast message to all connections"""
        for connection in list(self.active_connections.values()):
            try:
                if connection.client_state == WebSocketState.CONNECTED:
                    await connection.send_json(message)
            except Exception:
                continue


# Global connection manager
manager = ConnectionManager()


def normalize_react_step(step: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "step_type": step.get("step_type", "unknown"),
        "content": step.get("content", ""),
        "tool_name": step.get("tool_name"),
        "tool_params": step.get("tool_params"),
        "tool_result": step.get("tool_result"),
    }


def map_react_step_to_message(step: Dict[str, Any], step_index: int) -> Dict[str, Any]:
    """
    Map ReActStep to WebSocket message format
    """
    step_type = step.get("step_type", "unknown")
    now_iso = datetime.now(timezone.utc).isoformat()

    if step_type == "thought":
        # Provide a short, safe reasoning summary (expandable on client),
        # not the full chain-of-thought.
        thought_summary = summarize_thought(step.get("content", ""))
        redacted_step = dict(step) if isinstance(step, dict) else {}
        redacted_step["content"] = thought_summary
        return {
            "type": "thinking",
            "step_index": step_index,
            "content": thought_summary,
            "tool_name": None,
            "tool_params": None,
            "react_step": normalize_react_step(redacted_step),
            "timestamp": now_iso,
        }
    elif step_type == "action":
        streamed = format_thinking_for_stream([step])
        action_content = streamed[0] if streamed else step.get("content", "")
        enriched_step = dict(step) if isinstance(step, dict) else {}
        enriched_step["content"] = action_content
        return {
            "type": "tool_call",
            "step_index": step_index,
            "tool_name": step.get("tool_name", "unknown"),
            "tool_params": step.get("tool_params", {}),
            "content": action_content,
            "react_step": normalize_react_step(enriched_step),
            "timestamp": now_iso,
        }
    elif step_type == "observation":
        streamed = format_thinking_for_stream([step])
        observation_content = streamed[0] if streamed else step.get("content", "")
        enriched_step = dict(step) if isinstance(step, dict) else {}
        enriched_step["content"] = observation_content
        return {
            "type": "tool_result",
            "step_index": step_index,
            "tool_name": step.get("tool_name"),
            "result": step.get("tool_result"),
            "content": observation_content,
            "react_step": normalize_react_step(enriched_step),
            "timestamp": now_iso,
        }
    else:
        return {
            "type": "info",
            "step_index": step_index,
            "content": step.get("content", ""),
            "timestamp": now_iso,
        }


def iter_stream_chunks(text: str, max_chars: int = 64):
    """Chunk text for pseudo-streaming without breaking Vietnamese too badly."""
    if not text:
        return

    # Keep whitespace/newlines by splitting into "text" and "whitespace" parts.
    parts = re.split(r"(\s+)", text)
    buf = ""

    for part in parts:
        if not part:
            continue
        if len(buf) + len(part) <= max_chars:
            buf += part
            continue

        if buf:
            yield buf
            buf = ""

        if len(part) <= max_chars:
            buf = part
            continue

        # Hard split very long segments (rare, but keeps streaming moving).
        for i in range(0, len(part), max_chars):
            yield part[i : i + max_chars]

    if buf:
        yield buf


def strip_redundant_greeting(text: str) -> str:
    """Strip repeated greeting or concierge-style intro from assistant text."""
    if not isinstance(text, str):
        return ""

    def _normalize_intro_text(value: str) -> str:
        normalized = (value or "").strip().lower().replace("\u0111", "d")
        normalized = unicodedata.normalize("NFD", normalized)
        normalized = "".join(
            ch for ch in normalized if unicodedata.category(ch) != "Mn"
        )
        normalized = re.sub(r"\s+", " ", normalized).strip()
        return normalized

    def _is_generic_intro_segment(segment: str) -> bool:
        normalized = _normalize_intro_text(segment)
        if not normalized:
            return False
        generic_prefixes = [
            "xin chao",
            "chao ban",
            "chao anh",
            "chao chi",
            "hello",
            "toi la tro ly ai cua petties",
            "minh la tro ly ai cua petties",
            "toi rat vui duoc ho tro",
            "minh rat vui duoc ho tro",
            "rat vui duoc ho tro",
            "ban can giup do gi",
            "ban co the cho toi biet ban can giup do gi",
        ]
        return any(normalized.startswith(prefix) for prefix in generic_prefixes)

    remainder = text.strip()
    for _ in range(6):
        if not remainder:
            break
        parts = re.split(r"(?<=[\.!?\n])\s+", remainder, maxsplit=1)
        first_segment = str(parts[0] or "").strip()
        if not _is_generic_intro_segment(first_segment):
            break
        remainder = parts[1].lstrip() if len(parts) > 1 else ""

    return remainder.strip()


def sanitize_assistant_response(
    text: str,
    *,
    user_message: str,
    has_prior_assistant_message: bool,
) -> str:
    """Normalize assistant copy so replies start directly with useful content."""
    if not isinstance(text, str):
        return ""

    normalized = text.strip()
    if not normalized:
        return ""

    def _normalize_intro_text(value: str) -> str:
        normalized_text = (value or "").strip().lower().replace("\u0111", "d")
        normalized_text = unicodedata.normalize("NFD", normalized_text)
        normalized_text = "".join(
            ch for ch in normalized_text if unicodedata.category(ch) != "Mn"
        )
        normalized_text = re.sub(r"\s+", " ", normalized_text).strip()
        return normalized_text

    normalized_user = _normalize_intro_text(str(user_message or ""))
    user_is_greeting = any(
        normalized_user.startswith(prefix)
        for prefix in ["xin chao", "chao", "hello", "hi"]
    )

    stripped = strip_redundant_greeting(normalized)
    starts_with_intro = stripped != normalized
    if starts_with_intro and (has_prior_assistant_message or not user_is_greeting):
        normalized = stripped

    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"```[a-zA-Z0-9_\-]*\n?", "", normalized)
    normalized = normalized.replace("```", "")

    normalized = re.sub(r"\*\*(.*?)\*\*", r"\1", normalized)
    normalized = re.sub(r"__[ \t]*(.*?)[ \t]*__", r"\1", normalized)
    normalized = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", normalized)
    normalized = normalized.replace("•", "- ")

    def _split_inline_numbered_items(raw: str) -> str:
        lines: List[str] = []
        for source_line in raw.split("\n"):
            line = source_line.strip()
            if not line:
                lines.append("")
                continue

            matches = list(re.finditer(r"\d+\.\s+", line))
            if len(matches) <= 1:
                lines.append(source_line)
                continue

            prefix = line[: matches[0].start()].strip(" -:;")
            if prefix:
                lines.append(prefix)

            for idx, match in enumerate(matches):
                start = match.start()
                end = matches[idx + 1].start() if idx + 1 < len(matches) else len(line)
                item = line[start:end].strip()
                if item:
                    lines.append(item)

        return "\n".join(lines)

    normalized = _split_inline_numbered_items(normalized)

    def _split_inline_bullets(raw: str) -> str:
        lines: List[str] = []
        for source_line in raw.split("\n"):
            line = source_line.strip()
            if not line:
                lines.append("")
                continue

            if " - " not in line or line.startswith("- "):
                lines.append(source_line)
                continue

            if any(token in line for token in ["http://", "https://"]):
                lines.append(source_line)
                continue

            segments = [segment.strip() for segment in line.split(" - ") if segment.strip()]
            if len(segments) <= 1:
                lines.append(source_line)
                continue

            lines.append(segments[0])
            for segment in segments[1:]:
                lines.append(f"- {segment}")

        return "\n".join(lines)

    normalized = _split_inline_bullets(normalized)

    normalized = re.sub(r"[ \t]+\n", "\n", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    normalized = re.sub(r"^(\d+)\.\s+", r"\1. ", normalized, flags=re.MULTILINE)
    normalized = re.sub(r"^\*\s+", "- ", normalized, flags=re.MULTILINE)
    normalized = re.sub(r"^-{2,}\s*", "- ", normalized, flags=re.MULTILINE)
    normalized = re.sub(r"\n([\-\*]\s)", r"\n\1", normalized)
    normalized = re.sub(r"(?m)^\s+$", "", normalized)

    return normalized


def _unwrap_tool_result_for_schema(
    tool_name: str, tool_result: Any
) -> Optional[Dict[str, Any]]:
    if not tool_name or not tool_result:
        return None

    if not isinstance(tool_result, dict):
        return {
            "tool_name": str(tool_name),
            "success": True,
            "data": tool_result,
        }

    normalized = dict(tool_result)

    # Executor wraps MCP result as {"success": bool, "data": {...}, "tool_name": "..."}.
    # The presentation layer needs the tool-level contract, not the executor wrapper.
    inner_data = normalized.get("data")
    inner_success = inner_data.get("success") if isinstance(inner_data, dict) else None
    inner_is_standardized = isinstance(inner_success, bool) and (
        (inner_success is True and "data" in inner_data)
        or (
            inner_success is False
            and (
                "message" in inner_data
                or "error_code" in inner_data
                or isinstance(inner_data.get("error"), dict)
            )
        )
    )
    if (
        normalized.get("tool_name") == tool_name
        and isinstance(inner_data, dict)
        and inner_is_standardized
    ):
        normalized = dict(inner_data)

    if (
        normalized.get("tool_name") == tool_name
        and normalized.get("success") is False
        and isinstance(normalized.get("error"), dict)
    ):
        normalized = dict(normalized["error"])
        normalized["success"] = False

    normalized["tool_name"] = str(tool_name)
    return normalized


def infer_stage_from_schema(step: Dict[str, Any], ui_schema: Dict[str, Any]) -> str:
    tool_name = str(step.get("tool_name") or "")
    components = ui_schema.get("components", [])
    component_types = {
        str(component.get("type") or "")
        for component in components
        if isinstance(component, dict)
    }

    if "booking_summary" in component_types:
        tool_result = (
            _unwrap_tool_result_for_schema(tool_name, step.get("tool_result")) or {}
        )
        data = (
            tool_result.get("data", {})
            if isinstance(tool_result.get("data"), dict)
            else {}
        )
        booking_payload = {}
        if isinstance(data.get("booking"), dict):
            booking_payload = data.get("booking") or {}
        elif isinstance(data.get("booking_preview"), dict):
            booking_payload = data.get("booking_preview") or {}

        has_created_booking = bool(
            booking_payload.get("id")
            or booking_payload.get("booking_id")
            or booking_payload.get("booking_code")
        )
        if has_created_booking or data.get("ready_to_create"):
            return "BOOKED"
        return "CONFIRMING"

    if component_types & {
        "clinic_card",
        "pet_card",
        "service_chip",
        "slot_button",
        "vaccination_card",
        "emr_summary",
        "empty_state",
        "error_card",
    }:
        return "PRESENTING"

    return "IDLE"


def infer_stage_from_booking_state(
    booking_state: Optional[Dict[str, Any]],
) -> Optional[str]:
    if not isinstance(booking_state, dict) or not booking_state:
        return None
    if booking_state.get("stage"):
        return str(booking_state.get("stage"))
    return map_booking_status_to_stage(
        booking_state.get("status"),
        active=bool(booking_state.get("active")),
    )


def build_ui_schema_for_step(step: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Builds a UISchemaV1 from a specific observation step.
    """
    tool_name = step.get("tool_name")
    tool_result = step.get("tool_result")

    tr_input = _unwrap_tool_result_for_schema(str(tool_name or ""), tool_result)
    if not tr_input:
        return None

    schema = build_ui_schema([tr_input])
    if not schema:
        return None

    return schema.model_dump()


def _normalize_location_payload(raw_location: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(raw_location, dict):
        return None

    lat = raw_location.get("lat")
    if lat is None:
        lat = raw_location.get("latitude")
    lng = raw_location.get("lng")
    if lng is None:
        lng = raw_location.get("longitude")
    address = raw_location.get("address") or raw_location.get("formatted_address")

    if lat is None or lng is None:
        return None

    try:
        payload: Dict[str, Any] = {"lat": float(lat), "lng": float(lng)}
    except (TypeError, ValueError):
        return None

    if isinstance(address, str) and address.strip():
        payload["address"] = address.strip()
    return payload


def _extract_latest_location_from_history(
    chat_history_raw: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    for msg in reversed(chat_history_raw or []):
        if not isinstance(msg, dict):
            continue
        metadata = msg.get("metadata") or {}
        location = _normalize_location_payload(metadata.get("location"))
        if location:
            return location
    return None


def _compact_metadata_value(value: Any) -> Any:
    if value is None or isinstance(value, (int, float, bool)):
        return value
    if isinstance(value, str):
        text = value.strip()
        return text[:237] + "..." if len(text) > 240 else text
    if isinstance(value, list):
        items = [_compact_metadata_value(item) for item in value[:8]]
        if len(value) > 8:
            items.append(f"... {len(value) - 8} more")
        return items
    if isinstance(value, dict):
        compacted: Dict[str, Any] = {}
        for index, (key, item) in enumerate(value.items()):
            if index >= 10:
                compacted["..."] = f"{len(value) - 10} more fields"
                break
            compacted[str(key)] = _compact_metadata_value(item)
        return compacted
    return str(value)


def _normalize_ui_action_payload(raw_ui_action: Any) -> Optional[Dict[str, Any]]:
    normalized, _ = _validate_ui_action_payload(raw_ui_action)
    return normalized


def _normalize_string_list(value: Any, *, max_items: int = 20) -> Optional[List[str]]:
    if not isinstance(value, list):
        return None
    normalized: List[str] = []
    for item in value[:max_items]:
        if not isinstance(item, str):
            continue
        trimmed = item.strip()
        if trimmed:
            normalized.append(trimmed)
    return normalized or None


def _normalize_service_batch(
    value: Any, *, max_items: int = 20
) -> Optional[List[Dict[str, Any]]]:
    if not isinstance(value, list):
        return None

    normalized: List[Dict[str, Any]] = []
    for item in value[:max_items]:
        if not isinstance(item, dict):
            continue
        name = _normalize_ui_action_field("name", item.get("name"))
        description = _normalize_ui_action_field("description", item.get("description"))
        base_price = _normalize_ui_action_field(
            "base_price",
            item.get("basePrice")
            if item.get("basePrice") is not None
            else item.get("base_price"),
        )
        slots_required = _normalize_ui_action_field(
            "slots_required",
            item.get("slotsRequired")
            if item.get("slotsRequired") is not None
            else item.get("slots_required"),
        )
        duration_time = _normalize_ui_action_field(
            "duration_time",
            item.get("durationTime")
            if item.get("durationTime") is not None
            else item.get("duration_time"),
        )
        is_active = _normalize_ui_action_field(
            "is_active",
            item.get("isActive")
            if item.get("isActive") is not None
            else item.get("is_active"),
        )
        is_home_visit = _normalize_ui_action_field(
            "is_home_visit",
            item.get("isHomeVisit")
            if item.get("isHomeVisit") is not None
            else item.get("is_home_visit"),
        )
        service_category = _normalize_ui_action_field(
            "service_category",
            item.get("serviceCategory")
            if item.get("serviceCategory") is not None
            else item.get("service_category"),
        )
        pet_type = _normalize_ui_action_field(
            "pet_type",
            item.get("petType")
            if item.get("petType") is not None
            else item.get("pet_type"),
        )
        reminder_interval = _normalize_ui_action_field(
            "reminder_interval",
            item.get("reminderInterval")
            if item.get("reminderInterval") is not None
            else item.get("reminder_interval"),
        )
        reminder_unit = _normalize_ui_action_field(
            "reminder_unit",
            item.get("reminderUnit")
            if item.get("reminderUnit") is not None
            else item.get("reminder_unit"),
        )
        weight_prices = _normalize_ui_action_field(
            "weight_prices",
            item.get("weightPrices")
            if item.get("weightPrices") is not None
            else item.get("weight_prices"),
        )
        vaccine_template_id = _normalize_ui_action_field(
            "vaccine_template_id",
            item.get("vaccineTemplateId")
            if item.get("vaccineTemplateId") is not None
            else item.get("vaccine_template_id"),
        )
        dose_prices = _normalize_ui_action_field(
            "dose_prices",
            item.get("dosePrices")
            if item.get("dosePrices") is not None
            else item.get("dose_prices"),
        )

        if not name or base_price is None or slots_required is None:
            continue

        normalized_item: Dict[str, Any] = {
            "name": name,
            "base_price": base_price,
            "slots_required": slots_required,
        }
        if description is not None:
            normalized_item["description"] = description
        if duration_time is not None:
            normalized_item["duration_time"] = duration_time
        if is_active is not None:
            normalized_item["is_active"] = is_active
        if is_home_visit is not None:
            normalized_item["is_home_visit"] = is_home_visit
        if service_category is not None:
            normalized_item["service_category"] = service_category
        if pet_type is not None:
            normalized_item["pet_type"] = pet_type
        if reminder_interval is not None:
            normalized_item["reminder_interval"] = reminder_interval
        if reminder_unit is not None:
            normalized_item["reminder_unit"] = reminder_unit
        if weight_prices is not None:
            normalized_item["weight_prices"] = weight_prices
        if vaccine_template_id is not None:
            normalized_item["vaccine_template_id"] = vaccine_template_id
        if dose_prices is not None:
            normalized_item["dose_prices"] = dose_prices
        normalized.append(normalized_item)

    return normalized or None


def _normalize_ui_action_field(key: str, value: Any) -> Any:
    if key in {
        "clinic_id",
        "clinic_name",
        "clinic_address",
        "service_id",
        "service_name",
        "group_id",
        "pet_id",
        "pet_name",
        "source",
        "change_target",
        "reason",
        "target_id",
        "target_type",
        "confirm_target",
        "name",
        "description",
        "service_category",
        "pet_type",
        "home_address",
        "reminder_unit",
        "vaccine_template_id",
    }:
        if not isinstance(value, str):
            return None
        trimmed = value.strip()
        return trimmed[:200] if trimmed else None
    if key == "item_id":
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return str(int(value))
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed[:200] if trimmed else None
        return None
    if key == "item_type":
        if not isinstance(value, str):
            return None
        normalized = value.strip().lower()
        if normalized in {"clinic", "service", "slot", "pet"}:
            return normalized
        return None
    if key == "booking_type":
        normalized = str(value or "").strip().upper()
        return normalized if normalized in {"IN_CLINIC", "HOME_VISIT"} else None
    if key == "category":
        normalized = str(value or "").strip().upper()
        return (
            normalized if normalized in {"CONSULT", "VACCINATION", "GROOMING"} else None
        )
    if key == "booking_date":
        normalized = str(value or "").strip()
        return normalized if _DATE_RE.match(normalized) else None
    if key == "slot_date":
        normalized = str(value or "").strip()
        return normalized if _DATE_RE.match(normalized) else None
    if key == "start_time":
        normalized = str(value or "").strip()
        return normalized if _TIME_RE.match(normalized) else None
    if key == "slot_time":
        normalized = str(value or "").strip()
        return normalized if _TIME_RE.match(normalized) else None
    if key in {"service_ids", "service_names"}:
        return _normalize_string_list(value)
    if key == "services":
        return _normalize_service_batch(value)
    if key in {"base_price", "slots_required", "duration_time"}:
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str) and value.strip().isdigit():
            return int(value.strip())
        return None
    if key == "reminder_interval":
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str) and value.strip().isdigit():
            return int(value.strip())
        return None
    if key in {"is_active", "is_home_visit"}:
        return value if isinstance(value, bool) else None
    if key in {"home_lat", "home_long", "distance_km"}:
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value.strip())
            except ValueError:
                return None
        return None
    if key == "weight_prices":
        if not isinstance(value, list):
            return None
        normalized_weight_prices: List[Dict[str, Any]] = []
        for item in value[:20]:
            if not isinstance(item, dict):
                continue
            min_weight = (
                item.get("min_weight")
                if item.get("min_weight") is not None
                else item.get("minWeight")
            )
            max_weight = (
                item.get("max_weight")
                if item.get("max_weight") is not None
                else item.get("maxWeight")
            )
            price = item.get("price")
            if (
                isinstance(min_weight, bool)
                or isinstance(max_weight, bool)
                or isinstance(price, bool)
            ):
                continue
            try:
                min_weight_value = float(min_weight)
                max_weight_value = float(max_weight)
                price_value = float(price)
            except Exception:
                continue
            normalized_weight_prices.append(
                {
                    "min_weight": min_weight_value,
                    "max_weight": max_weight_value,
                    "price": price_value,
                }
            )
        return normalized_weight_prices or None
    if key == "dose_prices":
        if not isinstance(value, list):
            return None
        normalized_dose_prices: List[Dict[str, Any]] = []
        for item in value[:20]:
            if not isinstance(item, dict):
                continue
            dose_number = (
                item.get("dose_number")
                if item.get("dose_number") is not None
                else item.get("doseNumber")
            )
            dose_label = (
                item.get("dose_label")
                if item.get("dose_label") is not None
                else item.get("doseLabel")
            )
            price = item.get("price")
            if isinstance(price, bool):
                continue
            try:
                price_value = float(price)
            except Exception:
                continue
            normalized_item: Dict[str, Any] = {"price": price_value}
            if dose_number is not None and not isinstance(dose_number, bool):
                try:
                    normalized_item["dose_number"] = int(dose_number)
                except Exception:
                    pass
            if isinstance(dose_label, str) and dose_label.strip():
                normalized_item["dose_label"] = dose_label.strip()[:200]
            normalized_dose_prices.append(normalized_item)
        return normalized_dose_prices or None
    return None


def _validate_ui_action_payload(
    raw_ui_action: Any,
) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
    if raw_ui_action is None:
        return None, None
    if not isinstance(raw_ui_action, dict):
        return None, "`ui_action` phải là object hợp lệ."

    action_type = str(raw_ui_action.get("type") or "").strip().lower()
    if not action_type:
        return None, "`ui_action.type` không được để trống."

    spec = _UI_ACTION_SPECS.get(action_type)
    if spec is None:
        return None, f"`ui_action.type` không được hỗ trợ: `{action_type}`."

    allowed_fields = set(spec.get("allowed", set()))
    sanitized: Dict[str, Any] = {"type": action_type}

    for key, value in raw_ui_action.items():
        if key == "type" or value in (None, "", [], {}):
            continue
        key_str = str(key)
        if key_str not in allowed_fields:
            return None, f"`ui_action` chứa trường không hợp lệ: `{key_str}`."
        normalized_value = _normalize_ui_action_field(key_str, value)
        if normalized_value is None:
            return (
                None,
                f"Giá trị của `{key_str}` không hợp lệ cho `ui_action.type={action_type}`.",
            )
        sanitized[key_str] = normalized_value

    required_fields = set(spec.get("required", set()))
    missing_required = [field for field in required_fields if field not in sanitized]
    if missing_required:
        return (
            None,
            f"Thiếu trường bắt buộc cho `ui_action.type={action_type}`: {', '.join(missing_required)}.",
        )

    required_any_groups = spec.get("required_any", [])
    if required_any_groups and not any(
        all(field in sanitized for field in group) for group in required_any_groups
    ):
        expected = [" + ".join(sorted(group)) for group in required_any_groups]
        return (
            None,
            f"`ui_action.type={action_type}` cần ít nhất một nhóm trường: {'; '.join(expected)}.",
        )

    return sanitized, None


def _build_ui_action_validation_error(message: str) -> Dict[str, Any]:
    return {
        "type": "error",
        "error": message,
        "error_code": "INVALID_UI_ACTION",
        "recoverable": True,
        "suggestion": "Vui lòng cập nhật ứng dụng hoặc thử lại thao tác với dữ liệu hợp lệ.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _augment_content_with_metadata(content: str, metadata: Dict[str, Any]) -> str:
    enriched = (content or "").strip()
    if not isinstance(metadata, dict):
        return enriched

    extra_context: Dict[str, Any] = {}
    ui_action = _normalize_ui_action_payload(metadata.get("ui_action"))
    if ui_action:
        extra_context["ui_action"] = ui_action
    location = _normalize_location_payload(metadata.get("location"))
    if location:
        extra_context["location"] = location

    if extra_context:
        metadata_note = json.dumps(
            _compact_metadata_value(extra_context),
            ensure_ascii=False,
            separators=(",", ":"),
        )
        enriched = (enriched + "\n" if enriched else "") + metadata_note

    return enriched


class ParsedMessage(NamedTuple):
    user_message: str
    display_message: Optional[str]
    agent_id: Optional[int]
    provider_override: Optional[str]
    model_override: Optional[str]
    image_urls: List[str]
    location: Optional[Dict[str, Any]]
    ui_action: Optional[Dict[str, Any]]
    ui_action_error: Optional[str]
    context_data: Dict[str, Any]
    raw_message: str


def _parse_raw_message(
    message: str,
    agent_id: Optional[int],
    provider_override: Optional[str],
    model_override: Optional[str],
    images: Optional[List[str]],
) -> ParsedMessage:
    ui_action_error: Optional[str] = None
    ui_action: Optional[Dict[str, Any]] = None
    location: Optional[Dict[str, Any]] = None
    display_message: Optional[str] = None
    context_data: Dict[str, Any] = {}
    try:
        data = json.loads(message)
        user_message = data.get("message", message)
        raw_display_message = data.get("display_message")
        if isinstance(raw_display_message, str):
            display_message = raw_display_message.strip() or None
        raw_context_data = data.get("context_data")
        if isinstance(raw_context_data, dict):
            context_data = {
                str(key): value for key, value in raw_context_data.items() if key
            }
        agent_id = data.get("agent_id", agent_id)
        provider_override = data.get("provider", provider_override)
        model_override = data.get("model", model_override)
        images = data.get("images", [])

        raw_ui_action = data.get("ui_action")
        ui_action, ui_action_error = _validate_ui_action_payload(raw_ui_action)

        if (
            isinstance(ui_action, dict)
            and not str(user_message or "").strip()
            and not ui_action_error
        ):
            synthesized_user_message = _build_user_message_from_ui_action(ui_action)
            if synthesized_user_message:
                user_message = synthesized_user_message

        raw_location = data.get("location")
        lat = data.get("latitude")
        lng = data.get("longitude")
        address = None
        if isinstance(raw_location, dict):
            lat = (
                lat
                if lat is not None
                else raw_location.get("lat") or raw_location.get("latitude")
            )
            lng = (
                lng
                if lng is not None
                else raw_location.get("lng") or raw_location.get("longitude")
            )
            address = raw_location.get("address") or raw_location.get(
                "formatted_address"
            )
        location = (
            {"lat": lat, "lng": lng, "address": address}
            if lat is not None and lng is not None
            else None
        )
        if location:
            location = _normalize_location_payload(location)

    except json.JSONDecodeError:
        user_message = message
        images = []

    if not isinstance(images, list):
        images = []

    image_urls = []
    for img in images:
        if not isinstance(img, str):
            continue
        img = img.strip()
        if not img:
            continue
        if (
            img.startswith("http://")
            or img.startswith("https://")
            or img.startswith("data:")
            or len(img) > 100
        ):
            image_urls.append(img)

    return ParsedMessage(
        user_message=user_message,
        display_message=display_message,
        agent_id=agent_id,
        provider_override=provider_override,
        model_override=model_override,
        image_urls=image_urls,
        location=location,
        ui_action=ui_action,
        ui_action_error=ui_action_error,
        context_data=context_data,
        raw_message=message,
    )


def _build_user_message_from_ui_action(
    ui_action: Optional[Dict[str, Any]],
) -> Optional[str]:
    if not isinstance(ui_action, dict):
        return None

    action_type = str(ui_action.get("type") or "").strip().lower()
    if action_type != "select_item":
        return None

    item_type = str(ui_action.get("item_type") or "").strip().lower()
    item_id = str(ui_action.get("item_id") or "").strip()

    if item_type == "clinic":
        clinic_name = str(ui_action.get("clinic_name") or "").strip()
        clinic_id = str(ui_action.get("clinic_id") or item_id).strip()
        if clinic_name:
            return (
                f"Tôi chọn phòng khám {clinic_name}. "
                "Hãy tiếp tục tạo gợi ý dịch vụ cho phòng khám này."
            )
        if clinic_id:
            return (
                f"Tôi đã chọn phòng khám có mã {clinic_id}. "
                "Hãy tiếp tục tạo gợi ý dịch vụ cho phòng khám này."
            )

    if item_type == "service":
        service_name = str(ui_action.get("service_name") or "").strip()
        if service_name:
            return f"Tôi chọn dịch vụ {service_name}."
        if item_id:
            return f"Tôi chọn dịch vụ có mã {item_id}."

    if item_type == "pet":
        pet_name = str(ui_action.get("pet_name") or "").strip()
        if pet_name:
            return f"Tôi chọn thú cưng {pet_name}."
        if item_id:
            return f"Tôi chọn thú cưng có mã {item_id}."

    if item_type == "slot":
        slot_date = str(ui_action.get("slot_date") or "").strip()
        slot_time = str(ui_action.get("slot_time") or "").strip()
        if slot_date and slot_time:
            return f"Tôi chọn khung giờ {slot_time} ngày {slot_date}."

    return None


def _resolve_runtime_clinic_id_from_ui_action(
    ui_action: Optional[Dict[str, Any]],
) -> Optional[str]:
    if not isinstance(ui_action, dict):
        return None

    action_type = str(ui_action.get("type") or "").strip().lower()
    if action_type != "select_item":
        return None

    item_type = str(ui_action.get("item_type") or "").strip().lower()
    if item_type != "clinic":
        return None

    clinic_id = str(
        ui_action.get("clinic_id") or ui_action.get("item_id") or ""
    ).strip()
    return clinic_id or None


def _resolve_runtime_clinic_id_for_request(
    user: CurrentUser,
    request_context_data: Optional[Dict[str, Any]],
    request_ui_action: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    clinic_id_from_action = _resolve_runtime_clinic_id_from_ui_action(request_ui_action)
    if clinic_id_from_action:
        return clinic_id_from_action

    if isinstance(request_context_data, dict):
        for key in ("clinic_id", "workingClinicId", "working_clinic_id"):
            value = request_context_data.get(key)
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text

    if user.clinic_id is not None and str(user.clinic_id).strip():
        return str(user.clinic_id).strip()
    return None


async def _send_ack(
    session_id: str,
    agent_id: Optional[int],
    provider_override: Optional[str],
    model_override: Optional[str],
) -> None:
    await manager.send_message(
        session_id,
        {
            "type": "ack",
            "message": "Đã nhận yêu cầu.",
            "agent_id": agent_id,
            "provider": provider_override,
            "model": model_override,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


async def _save_user_message(
    session_id: str,
    user_id: int,
    user_message: str,
    display_message: Optional[str],
    session_context: str,
    images: List[str],
    location: Optional[Dict[str, Any]],
    ui_action: Optional[Dict[str, Any]],
) -> None:
    persisted_content = (display_message or user_message or "").strip()
    metadata = {
        "images": images,
        "location": location,
        "ui_action": ui_action,
        "display_message": display_message,
    }
    await save_chat_message(
        {
            "message_id": str(uuid.uuid4()),
            "session_id": session_id,
            "user_id": user_id,
            "role": "user",
            "content": persisted_content,
            "context_type": session_context,
            "metadata": metadata,
            "timestamp": datetime.now(timezone.utc),
        }
    )


async def _setup_agent(
    session_id: str,
    db_session: Any,
    user: CurrentUser,
    auth_token: Optional[str],
    agent_id: Optional[int],
    provider_override: Optional[str],
    model_override: Optional[str],
    session_context: str,
    booking_state: Optional[Dict[str, Any]] = None,
    request_context_data: Optional[Dict[str, Any]] = None,
    request_ui_action: Optional[Dict[str, Any]] = None,
) -> tuple:
    if agent_id:
        agent = await AgentFactory.get_agent_by_id(
            agent_id=agent_id,
            db_session=db_session,
            provider_override=provider_override,
            model_override=model_override,
            user_role=user.role,
            context_type=session_context,
        )
    else:
        agent = await AgentFactory.get_agent(
            db_session=db_session,
            provider_override=provider_override,
            model_override=model_override,
            user_role=user.role,
            context_type=session_context,
        )

    if not agent:
        await manager.send_message(
            session_id,
            {
                "type": "error",
                "error": "Không tìm thấy cấu hình trợ lý AI phù hợp.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        raise ValueError("Agent not found")

    await manager.send_message(
        session_id,
        {
            "type": "agent_info",
            "agent_name": agent.name,
            "agent_type": agent.agent_type,
            "provider": provider_override or "openrouter",
            "model": model_override or "default",
            "allowed_tools": agent.enabled_tools,
            "allowed_resources": getattr(agent, "allowed_resources", []),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    resolved_runtime_clinic_id = _resolve_runtime_clinic_id_for_request(
        user,
        request_context_data,
        request_ui_action,
    )

    runtime_token = set_tool_runtime_context(
        ToolRuntimeContext(
            user_id=user.user_id,
            role=user.role,
            auth_token=auth_token,
            clinic_id=resolved_runtime_clinic_id,
            session_id=session_id,
            context_type=session_context,
            booking_state=booking_state,
        )
    )
    return agent, runtime_token


def _build_chat_context(
    chat_history_raw: List[Dict[str, Any]],
    location: Optional[Dict[str, Any]],
) -> tuple:
    if location is None:
        location = _extract_latest_location_from_history(chat_history_raw)

    chat_history = []
    has_prior_assistant_message = False
    for msg in chat_history_raw:
        role = msg.get("role")
        content = msg.get("content", "")
        metadata = msg.get("metadata", {})
        augmented = _augment_content_with_metadata(content, metadata)
        if role in ["user", "assistant"] and augmented:
            if role == "assistant":
                has_prior_assistant_message = True
            history_images = []
            for img in metadata.get("images", []):
                if isinstance(img, str) and img.strip():
                    if (
                        img.startswith("http://")
                        or img.startswith("https://")
                        or img.startswith("data:")
                        or len(img) > 100
                    ):
                        history_images.append(img)
            entry = {"role": role, "content": augmented}
            if history_images:
                entry["images"] = history_images[:2]
            chat_history.append(entry)

    return chat_history, has_prior_assistant_message, location


async def _emit_safe_thinking_stream(
    session_id: str,
    step: Dict[str, Any],
    *,
    step_index: int,
) -> None:
    thinking_texts = format_thinking_for_stream([step])
    for text in thinking_texts:
        cleaned = str(text or "").strip()
        if not cleaned:
            continue
        await manager.send_message(
            session_id,
            {
                "type": "thinking_stream",
                "content": cleaned,
                "step_index": step_index,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )


async def _stream_and_collect(
    agent: Any,
    enriched_message: str,
    session_id: str,
    images: Optional[List[str]],
    location: Optional[Dict[str, Any]],
    chat_history: Optional[List[Dict[str, Any]]],
    user_role: str,
) -> tuple:
    react_trace: List[Dict[str, Any]] = []
    step_index = 0
    full_response = ""
    ui_tool_results: List[Dict[str, Any]] = []
    persisted_ui_schema: Optional[Dict[str, Any]] = None
    sent_ui_schema = False
    streamed_final_answer = False

    loop = asyncio.get_running_loop()
    total_timeout = max(
        1, int(getattr(settings, "AGENT_STREAM_TOTAL_TIMEOUT_SECONDS", 120))
    )
    idle_timeout = max(
        1, int(getattr(settings, "AGENT_STREAM_IDLE_TIMEOUT_SECONDS", 30))
    )
    deadline = loop.time() + float(total_timeout)

    aiter = agent.stream(
        enriched_message,
        session_id,
        images=images,
        location=location,
        chat_history=chat_history,
        user_role=user_role,
    ).__aiter__()

    try:
        while True:
            remaining = deadline - loop.time()
            if remaining <= 0:
                raise asyncio.TimeoutError()
            timeout_s = min(float(idle_timeout), float(remaining))

            try:
                event = await asyncio.wait_for(aiter.__anext__(), timeout=timeout_s)
            except StopAsyncIteration:
                break

            if not isinstance(event, dict):
                continue

            event_type = event.get("type", "")

            if event_type == "react_step":
                step = event.get("step", {})
                ws_message = map_react_step_to_message(step, step_index)
                safe_step = dict(step) if isinstance(step, dict) else {}

                # Stream thinking in real-time for better UX
                step_type = str(safe_step.get("step_type") or "").strip().lower()

                if step_type == "thought":
                    await _emit_safe_thinking_stream(
                        session_id, safe_step, step_index=step_index
                    )
                    # Keep empty content in react_trace for backward compatibility
                    safe_step["content"] = ""

                elif step_type == "action":
                    await _emit_safe_thinking_stream(
                        session_id, safe_step, step_index=step_index
                    )

                elif step_type == "observation":
                    await _emit_safe_thinking_stream(
                        session_id, safe_step, step_index=step_index
                    )

                    normalized_ui_result = _unwrap_tool_result_for_schema(
                        str(safe_step.get("tool_name") or ""),
                        safe_step.get("tool_result"),
                    )
                    if normalized_ui_result:
                        ui_tool_results.append(normalized_ui_result)

                react_trace.append({"step_index": step_index, **safe_step})
                await manager.send_message(session_id, ws_message)
                step_index += 1

            elif event_type == "token":
                continue

            elif event_type == "final_answer":
                full_response = event.get("content", full_response) or ""

                # Retrieve updated state
                ctx = get_tool_runtime_context()
                current_booking_state = ctx.booking_state if ctx else None

                if not sent_ui_schema and ui_tool_results:
                    schema = build_ui_schema(ui_tool_results)
                    if schema:
                        schema_payload = schema.model_dump()
                        persisted_ui_schema = schema_payload
                        stage = infer_stage_from_booking_state(
                            current_booking_state
                        ) or infer_stage_from_schema(
                            {
                                "tool_name": ui_tool_results[-1].get("tool_name"),
                                "tool_result": ui_tool_results[-1],
                            },
                            schema_payload,
                        )
                        await manager.send_message(
                            session_id,
                            {
                                "type": "ui_schema",
                                "ui_schema": schema_payload,
                                "stage": stage,
                                "booking_state": current_booking_state,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            },
                        )
                        sent_ui_schema = True
                if not streamed_final_answer and full_response.strip():
                    streamed_final_answer = True
                    for chunk in iter_stream_chunks(full_response, max_chars=72):
                        await manager.send_message(
                            session_id,
                            {
                                "type": "stream",
                                "content": chunk,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            },
                        )

            elif event_type == "error":
                await manager.send_message(
                    session_id,
                    {
                        "type": "error",
                        "error": str(event.get("content", "Không rõ lỗi")),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )
                raise StreamTerminated("Agent emitted terminal error event")

    except asyncio.TimeoutError:
        with suppress(Exception):
            await aiter.aclose()
        await manager.send_message(
            session_id,
            {
                "type": "error",
                "error": "Quá thời gian phản hồi của trợ lý. Vui lòng thử lại.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        raise StreamTerminated("Agent stream timeout")

    # Retrieve updated state
    ctx = get_tool_runtime_context()
    current_booking_state = ctx.booking_state if ctx else None

    if not sent_ui_schema and ui_tool_results:
        schema = build_ui_schema(ui_tool_results)
        if schema:
            schema_payload = schema.model_dump()
            persisted_ui_schema = schema_payload
            stage = infer_stage_from_booking_state(
                current_booking_state
            ) or infer_stage_from_schema(
                {
                    "tool_name": ui_tool_results[-1].get("tool_name"),
                    "tool_result": ui_tool_results[-1],
                },
                schema_payload,
            )
            await manager.send_message(
                session_id,
                {
                    "type": "ui_schema",
                    "ui_schema": schema_payload,
                    "stage": stage,
                    "booking_state": current_booking_state,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )

    # Always try to send booking_state at the end if not sent through ui_schema
    if current_booking_state:
        final_stage = infer_stage_from_booking_state(current_booking_state)
        await manager.send_message(
            session_id,
            {
                "type": "booking_state_update",
                "booking_state": current_booking_state,
                "stage": final_stage,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

    return full_response, react_trace, step_index, persisted_ui_schema


async def _finalize_and_persist(
    session_id: str,
    user: CurrentUser,
    session_context: str,
    agent_id: Optional[int],
    full_response: str,
    react_trace: List[Dict[str, Any]],
    persisted_ui_schema: Optional[Dict[str, Any]],
    user_message: str,
    has_prior_assistant_message: bool,
    performance: Optional[Dict[str, Any]] = None,
) -> None:
    if not full_response.strip():
        full_response = (
            "Xin lỗi, mình chưa thể tổng hợp câu trả lời lúc này. "
            "Bạn thử gửi lại câu hỏi (hoặc nói rõ dịch vụ/ngày giờ mong muốn) giúp mình nhé."
        )

    full_response = sanitize_assistant_response(
        full_response,
        user_message=user_message,
        has_prior_assistant_message=has_prior_assistant_message,
    )

    assistant_tool_calls = [
        {
            "tool_name": step.get("tool_name"),
            "tool_params": step.get("tool_params"),
            "tool_result": step.get("tool_result"),
        }
        for step in react_trace
        if step.get("tool_name")
    ]

    assistant_metadata: Dict[str, Any] = {}
    if persisted_ui_schema:
        assistant_metadata["ui_schema"] = persisted_ui_schema
    if performance:
        assistant_metadata["performance"] = performance

    await save_chat_message(
        {
            "message_id": str(uuid.uuid4()),
            "session_id": session_id,
            "user_id": user.user_id,
            "role": "assistant",
            "content": full_response,
            "context_type": session_context,
            "react_trace": react_trace,
            "tool_calls": assistant_tool_calls,
            "metadata": assistant_metadata,
            "timestamp": datetime.now(timezone.utc),
        }
    )

    await touch_chat_session(session_id, {"agent_id": agent_id})

    await manager.send_message(
        session_id,
        {
            "type": "complete",
            "full_response": full_response,
            "react_trace": react_trace,
            "agent_id": agent_id,
            "performance": performance or {},
            "total_steps": len(react_trace),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    logger.info(
        "Chat stream completed: {} ({} steps, performance={})",
        session_id,
        len(react_trace),
        performance or {},
    )


async def handle_chat_message(
    websocket: WebSocket,
    session_id: str,
    user: CurrentUser,
    session_context: str,
    message: str,
    auth_token: Optional[str] = None,
    agent_id: Optional[int] = None,
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None,
    images: Optional[List[str]] = None,
):
    """
    Orchestrates the full chat lifecycle: parse → agent setup → stream → finalize.
    Each step is delegated to a focused helper function.
    """
    react_trace: List[Dict[str, Any]] = []
    full_response = ""
    persisted_ui_schema: Optional[Dict[str, Any]] = None
    request_started = time.perf_counter()

    # Rate limiting check
    from app.core.middleware.rate_limiter import get_rate_limiter

    limiter = get_rate_limiter()
    rate_result = await limiter.check_request(str(user.user_id), session_id)
    if not rate_result.allowed:
        await manager.send_message(
            session_id,
            {
                "type": "error",
                "error": "Bạn đã gửi quá nhiều tin nhắn. Vui lòng chờ trước khi gửi tiếp.",
                "error_code": "RATE_LIMITED",
                "retry_after_seconds": rate_result.retry_after_seconds,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        return

    try:
        # 1. Parse message
        parsed = _parse_raw_message(
            message=message,
            agent_id=agent_id,
            provider_override=provider_override,
            model_override=model_override,
            images=images,
        )

        if session_context != PLAYGROUND_TEST:
            parsed = ParsedMessage(
                user_message=parsed.user_message,
                display_message=parsed.display_message,
                agent_id=parsed.agent_id,
                provider_override=None,
                model_override=None,
                image_urls=parsed.image_urls,
                location=parsed.location,
                ui_action=parsed.ui_action,
                ui_action_error=parsed.ui_action_error,
                context_data=parsed.context_data,
                raw_message=parsed.raw_message,
            )

        await _send_ack(
            session_id,
            parsed.agent_id,
            parsed.provider_override,
            parsed.model_override,
        )

        if parsed.ui_action_error:
            await manager.send_message(
                session_id,
                _build_ui_action_validation_error(parsed.ui_action_error),
            )
            return

        # Load/expire booking state before touching session timestamp so stale sessions can reset cleanly
        session_data = await get_chat_session(session_id)
        session_data = await expire_chat_session_state_if_needed(
            session_id, session_data
        )
        booking_state = session_data.get("booking_state") if session_data else None

        if (
            str(parsed.user_message or "").strip()
            or parsed.image_urls
            or parsed.ui_action
            or parsed.location
        ):
            await _save_user_message(
                session_id,
                user.user_id,
                parsed.user_message,
                parsed.display_message,
                session_context,
                parsed.image_urls,
                parsed.location,
                parsed.ui_action,
            )

        await touch_chat_session(session_id)

        # 2. Setup agent
        async with AsyncSessionLocal() as db:
            try:
                agent, runtime_token = await _setup_agent(
                    session_id,
                    db,
                    user,
                    auth_token,
                    parsed.agent_id,
                    parsed.provider_override,
                    parsed.model_override,
                    session_context,
                    booking_state=booking_state,
                    request_context_data=parsed.context_data,
                    request_ui_action=parsed.ui_action,
                )
            except ValueError:
                return

            # 3. Build context
            chat_history_limit = max(
                1, min(int(getattr(settings, "CHAT_HISTORY_CONTEXT_LIMIT", 20)), 200)
            )
            history_raw = await get_chat_history(session_id, limit=chat_history_limit)
            chat_history, has_prior, location = _build_chat_context(
                history_raw, parsed.location
            )
            enriched_message = _augment_content_with_metadata(
                parsed.user_message,
                {
                    "images": parsed.image_urls,
                    "location": location,
                    "ui_action": parsed.ui_action,
                },
            )

            # 4. Stream
            try:
                (
                    full_response,
                    react_trace,
                    _,
                    persisted_ui_schema,
                ) = await _stream_and_collect(
                    agent,
                    enriched_message,
                    session_id,
                    parsed.image_urls if parsed.image_urls else None,
                    location,
                    chat_history if chat_history else None,
                    user.role,
                )
            except StreamTerminated:
                return
            finally:
                reset_tool_runtime_context(runtime_token)

        # 5. Finalize (outside DB session — no agent/runtime context needed)
        performance = _collect_tool_timing_summary(react_trace)
        performance["total_response_ms"] = int(
            (time.perf_counter() - request_started) * 1000
        )
        performance["steps"] = len(react_trace)
        await _finalize_and_persist(
            session_id,
            user,
            session_context,
            parsed.agent_id,
            full_response,
            react_trace,
            persisted_ui_schema,
            parsed.user_message,
            has_prior,
            performance,
        )

    except Exception as e:
        logger.error(f"Error handling current chat-message: {e}", exc_info=True)
        await manager.send_message(
            session_id,
            {
                "type": "error",
                "error": str(e),
                "react_trace": react_trace,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )


async def websocket_chat_endpoint(websocket: WebSocket, session_id: str = "default"):
    """
    WebSocket endpoint for chat /ws/chat/{session_id}
    """
    try:
        requested_context_type = websocket.query_params.get("context_type")

        # 1. Accept Handshake
        if websocket.client_state == WebSocketState.CONNECTING:
            await websocket.accept()
        else:
            return

        # 2. Authentication
        token = websocket.query_params.get("token")
        user = None

        if token:
            try:
                user = await decode_jwt_token(token)
            except Exception:
                user = None

        if not token or not user:
            reason = WS_REASON_AUTH_REQUIRED if not token else WS_REASON_INVALID_AUTH
            await websocket.close(code=1008, reason=reason)
            return

        # 2.5 Subscription Check
        # Only check for actual business chats or playground
        async with AsyncSessionLocal() as db:
            try:
                await verify_subscription_logic(user, db)
            except HTTPException:
                await websocket.close(code=1008, reason=WS_REASON_SUBSCRIPTION_REQUIRED)
                return

        # 3. Session Isolation & Context
        session = await get_chat_session(session_id)
        if session is None:
            context_type = normalize_context_type(
                requested_context_type,
                default_context_for_user(user.is_admin),
            )

            if context_type == PLAYGROUND_TEST and not user.is_admin:
                await websocket.close(code=1008, reason=WS_REASON_PLAYGROUND_FORBIDDEN)
                return

            now = datetime.now(timezone.utc)
            session = {
                "session_id": session_id,
                "agent_id": None,
                "title": f"Chat {now.strftime('%H:%M')}",
                "context_type": context_type,
                "created_at": now,
                "updated_at": now,
                "user_id": user.user_id,
                "user_role": user.role,
                "clinic_id": user.clinic_id,
            }
            await save_chat_session(session)
        else:
            if session.get("deleted") or session.get("user_id") != user.user_id:
                await websocket.close(code=1008, reason=WS_REASON_SESSION_FORBIDDEN)
                return

            session = await expire_chat_session_state_if_needed(session_id, session)

            context_type = normalize_context_type(
                session.get("context_type"), BUSINESS_CHAT
            )
            if context_type == PLAYGROUND_TEST and not user.is_admin:
                await websocket.close(code=1008, reason=WS_REASON_PLAYGROUND_FORBIDDEN)
                return

        if token or user:
            try:
                # If we have a user from token, but session already exists,
                # ensure we don't accidentally downgrade the role if the session was created
                # with a different role previously.
                if user and session and session.get("user_role") != user.role:
                    logger.warning(
                        f"Session role mismatch: {session_id}. "
                        f"Session: {session.get('user_role')}, Token: {user.role}. "
                        "Updating session to match latest token."
                    )
                    await touch_chat_session(
                        session_id,
                        {"user_role": user.role, "clinic_id": user.clinic_id},
                    )

                # ... existing logic ...
            except Exception as e:
                logger.error(f"Error validating role consistency: {e}")

        await manager.connect(websocket, session_id)
        try:
            # 4. History Restore
            restore_history_limit = max(
                1, min(int(getattr(settings, "CHAT_HISTORY_RESTORE_LIMIT", 100)), 200)
            )
            history = await get_chat_history(session_id, limit=restore_history_limit)
            now_iso = datetime.now(timezone.utc).isoformat()

            await manager.send_message(
                session_id,
                {
                    "type": "connected",
                    "session_id": session_id,
                    "user": user.username,
                    "context_type": context_type,
                    "booking_state": session.get("booking_state"),
                    "timestamp": now_iso,
                },
            )

            if history:
                await manager.send_message(
                    session_id,
                    {
                        "type": "history",
                        "session_id": session_id,
                        "booking_state": session.get("booking_state"),
                        "messages": [
                            {
                                "message_id": item.get("message_id"),
                                "role": item.get("role"),
                                "content": item.get("content"),
                                "timestamp": item.get("timestamp").isoformat()
                                if hasattr(item.get("timestamp"), "isoformat")
                                else str(item.get("timestamp")),
                                "react_trace": item.get("react_trace"),
                                "metadata": item.get("metadata") or {},
                            }
                            for item in history
                        ],
                        "timestamp": now_iso,
                    },
                )

            if session.get("booking_state"):
                restored_stage = infer_stage_from_booking_state(
                    session.get("booking_state")
                )
                await manager.send_message(
                    session_id,
                    {
                        "type": "booking_state_update",
                        "booking_state": session.get("booking_state"),
                        "stage": restored_stage,
                        "timestamp": now_iso,
                    },
                )

            # 5. Receive Loop
            while True:
                data = await websocket.receive_text()
                await handle_chat_message(
                    websocket, session_id, user, context_type, data, auth_token=token
                )

        except WebSocketDisconnect:
            manager.disconnect(session_id)
        except Exception as e:
            logger.error(f"WebSocket execution error: {e}", exc_info=True)
            manager.disconnect(session_id)

    except Exception as e:
        logger.critical(f"Fatal WebSocket error: {e}", exc_info=True)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
