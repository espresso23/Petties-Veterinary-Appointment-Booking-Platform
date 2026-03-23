"""
PETTIES AGENT SERVICE - WebSocket Chat Handler
Real-time chat with streaming responses

Package: app.api.websocket
Purpose: WebSocket endpoint with generic tool response dispatching
Version: v2.0.0 (Tool self-contained UI cards - no hardcoded extractors)

Design:
- Tools define their own ui_card in return value
- chat.py uses generic dispatcher to extract and send ui_card
- No hardcoded tool names or extraction logic
"""

import asyncio
import json
import logging
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from contextlib import suppress
from typing import Any, Dict, List, NamedTuple, Optional

from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState

from app.api.middleware.auth import CurrentUser, decode_jwt_token
from app.api.websocket.chat_constants import (
    WS_REASON_AUTH_REQUIRED,
    WS_REASON_INVALID_AUTH,
    WS_REASON_PLAYGROUND_FORBIDDEN,
    WS_REASON_SESSION_FORBIDDEN,
)
from app.core.agents.factory import AgentFactory
from app.core.chat_context import (
    BUSINESS_CHAT,
    PLAYGROUND_TEST,
    default_context_for_user,
    normalize_context_type,
)
from app.core.database.mongodb import (
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
)
from app.db.postgres.session import AsyncSessionLocal
from app.config.settings import settings

logger = logging.getLogger(__name__)


def _truncate(text: str, max_len: int = 160) -> str:
    s = (text or "").strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 3].rstrip() + "..."


def summarize_thought(text: Any) -> str:
    """Return a safe, short, user-facing reasoning summary."""
    if not isinstance(text, str):
        return "Dang phan tich yeu cau..."

    s = text.strip()
    if not s:
        return "Dang phan tich yeu cau..."

    # Strip common prefixes.
    s = re.sub(r"^\s*thought\s*:\s*", "", s, flags=re.IGNORECASE).strip()
    s = re.sub(r"^\s*suy\s+nghi\s*:\s*", "", s, flags=re.IGNORECASE).strip()

    # Keep first line only.
    s = s.splitlines()[0].strip()

    # Remove any accidental tool markers.
    s = re.split(r"\btool\s*:\b", s, maxsplit=1, flags=re.IGNORECASE)[0].strip()
    s = re.split(r"\btool\s*input\s*:\b", s, maxsplit=1, flags=re.IGNORECASE)[0].strip()

    s = strip_redundant_greeting(s)
    return _truncate(s, 160) if s else "Dang phan tich yeu cau..."


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
        return {
            "type": "tool_call",
            "step_index": step_index,
            "tool_name": step.get("tool_name", "unknown"),
            "tool_params": step.get("tool_params", {}),
            "content": step.get("content", ""),
            "react_step": normalize_react_step(step),
            "timestamp": now_iso,
        }
    elif step_type == "observation":
        return {
            "type": "tool_result",
            "step_index": step_index,
            "tool_name": step.get("tool_name"),
            "result": step.get("tool_result"),
            "content": step.get("content", ""),
            "react_step": normalize_react_step(step),
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

    return normalized


def extract_ui_card(step: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Generic UI card extractor - reads ui_card from tool's return value.

    Design: Tools define their own ui_card in return value.
    chat.py is agnostic to tool names and data structures.
    """
    tool_result = step.get("tool_result") or {}

    if isinstance(tool_result, dict) and isinstance(tool_result.get("data"), dict):
        tool_result = tool_result.get("data") or {}

    ui_card = tool_result.get("ui_card")
    if not ui_card or not isinstance(ui_card, dict):
        return None

    ui_type = ui_card.get("type")
    if not ui_type:
        return None

    result = {"type": ui_type}
    for key, value in ui_card.items():
        if key == "type":
            continue
        result[key] = value

    return result


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
    if not isinstance(raw_ui_action, dict):
        return None

    action_type = str(raw_ui_action.get("type") or "").strip().lower()
    if not action_type:
        return None

    payload: Dict[str, Any] = {"type": action_type}
    for key, value in raw_ui_action.items():
        if key == "type" or value in (None, "", [], {}):
            continue
        payload[str(key)] = _compact_metadata_value(value)
    return payload


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
    agent_id: Optional[int]
    provider_override: Optional[str]
    model_override: Optional[str]
    image_urls: List[str]
    location: Optional[Dict[str, Any]]
    ui_action: Optional[Dict[str, Any]]
    raw_message: str


def _parse_raw_message(
    message: str,
    agent_id: Optional[int],
    provider_override: Optional[str],
    model_override: Optional[str],
    images: Optional[List[str]],
) -> ParsedMessage:
    try:
        data = json.loads(message)
        user_message = data.get("message", message)
        agent_id = data.get("agent_id", agent_id)
        provider_override = data.get("provider", provider_override)
        model_override = data.get("model", model_override)
        images = data.get("images", [])

        raw_ui_action = data.get("ui_action")
        ui_action = raw_ui_action if isinstance(raw_ui_action, dict) else None

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
        agent_id=agent_id,
        provider_override=provider_override,
        model_override=model_override,
        image_urls=image_urls,
        location=location,
        ui_action=ui_action,
        raw_message=message,
    )


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
    session_context: str,
    images: List[str],
    location: Optional[Dict[str, Any]],
    ui_action: Optional[Dict[str, Any]],
) -> None:
    metadata = {
        "images": images,
        "location": location,
        "ui_action": ui_action,
    }
    await save_chat_message(
        {
            "message_id": str(uuid.uuid4()),
            "session_id": session_id,
            "user_id": user_id,
            "role": "user",
            "content": user_message,
            "context_type": session_context,
            "metadata": metadata,
            "timestamp": datetime.now(timezone.utc),
        }
    )


async def _setup_agent(
    session_id: str,
    db_session: Any,
    user: CurrentUser,
    agent_id: Optional[int],
    provider_override: Optional[str],
    model_override: Optional[str],
    session_context: str,
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
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    runtime_token = set_tool_runtime_context(
        ToolRuntimeContext(
            user_id=user.user_id,
            role=user.role,
            auth_token=None,
            clinic_id=user.clinic_id,
            session_id=session_id,
            context_type=session_context,
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
    sent_ui_types: Dict[str, bool] = {}
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
                if safe_step.get("step_type") == "thought":
                    safe_step["content"] = ""
                react_trace.append({"step_index": step_index, **safe_step})
                await manager.send_message(session_id, ws_message)

                if (
                    str(safe_step.get("step_type") or "").strip().lower()
                    == "observation"
                ):
                    ui_payload = extract_ui_card(safe_step)
                    if ui_payload:
                        ui_type = ui_payload.get("type")
                        if not sent_ui_types.get(ui_type):
                            sent_ui_types[ui_type] = True
                            await manager.send_message(
                                session_id,
                                {
                                    **ui_payload,
                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                },
                            )
                step_index += 1

            elif event_type == "token":
                continue

            elif event_type == "final_answer":
                full_response = event.get("content", full_response) or ""
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
                raise asyncio.CancelledError()

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
        raise

    return full_response, react_trace, step_index


async def _finalize_and_persist(
    session_id: str,
    user: CurrentUser,
    session_context: str,
    agent_id: Optional[int],
    full_response: str,
    react_trace: List[Dict[str, Any]],
    user_message: str,
    has_prior_assistant_message: bool,
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
            "total_steps": len(react_trace),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )

    logger.info(f"Chat stream completed: {session_id} ({len(react_trace)} steps)")


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
                agent_id=parsed.agent_id,
                provider_override=None,
                model_override=None,
                image_urls=parsed.image_urls,
                location=parsed.location,
                ui_action=parsed.ui_action,
                raw_message=parsed.raw_message,
            )

        await _send_ack(
            session_id,
            parsed.agent_id,
            parsed.provider_override,
            parsed.model_override,
        )

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
                    parsed.agent_id,
                    parsed.provider_override,
                    parsed.model_override,
                    session_context,
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
                full_response, react_trace, _ = await _stream_and_collect(
                    agent,
                    enriched_message,
                    session_id,
                    parsed.image_urls if parsed.image_urls else None,
                    location,
                    chat_history if chat_history else None,
                    user.role,
                )
            finally:
                reset_tool_runtime_context(runtime_token)

        # 5. Finalize (outside DB session — no agent/runtime context needed)
        await _finalize_and_persist(
            session_id,
            user,
            session_context,
            parsed.agent_id,
            full_response,
            react_trace,
            parsed.user_message,
            has_prior,
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

            context_type = normalize_context_type(
                session.get("context_type"), BUSINESS_CHAT
            )
            if context_type == PLAYGROUND_TEST and not user.is_admin:
                await websocket.close(code=1008, reason=WS_REASON_PLAYGROUND_FORBIDDEN)
                return

        await manager.connect(websocket, session_id)
        try:
            # 4. History Restore
            restore_history_limit = max(
                1, min(int(getattr(settings, "CHAT_HISTORY_RESTORE_LIMIT", 50)), 200)
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
                    "timestamp": now_iso,
                },
            )

            if history:
                await manager.send_message(
                    session_id,
                    {
                        "type": "history",
                        "session_id": session_id,
                        "messages": [
                            {
                                "message_id": item.get("message_id"),
                                "role": item.get("role"),
                                "content": item.get("content"),
                                "timestamp": item.get("timestamp").isoformat()
                                if hasattr(item.get("timestamp"), "isoformat")
                                else str(item.get("timestamp")),
                                "react_trace": item.get("react_trace"),
                            }
                            for item in history
                        ],
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
