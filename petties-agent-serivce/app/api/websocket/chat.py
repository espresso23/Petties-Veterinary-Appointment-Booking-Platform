"""
PETTIES AGENT SERVICE - WebSocket Chat Handler
Real-time chat with streaming responses

Package: app.api.websocket
Purpose: WebSocket endpoint for Playground chat with real SingleAgent integration
Version: v1.1.0 (Fixes for images, logging, and stability)
"""

import asyncio
import json
import logging
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from contextlib import suppress
from typing import Any, Dict, List, Optional

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
        normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
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

def extract_clinic_suggestion(tool_result: Any) -> Optional[Dict[str, Any]]:
    """Extract clinic suggestion payload from ToolExecutor-wrapped results."""
    payload = tool_result
    if isinstance(tool_result, dict) and isinstance(tool_result.get("data"), dict):
        payload = tool_result.get("data") or {}
    if not isinstance(payload, dict):
        return None

    clinics = payload.get("clinics") or []
    if not isinstance(clinics, list) or not clinics:
        return None

    location = payload.get("query_location") or {}
    if not isinstance(location, dict):
        location = {}

    total_found = payload.get("total_found")
    try:
        total_found = int(total_found) if total_found is not None else len(clinics)
    except Exception:
        total_found = len(clinics)

    if payload.get("auto_select_clinic") or (
        payload.get("resolved_clinic") and total_found == 1 and payload.get("match_mode") == "explicit_name"
    ):
        return None

    return {
        "clinics": clinics[:5],
        "total_found": total_found,
        "location": location,
    }


def _unwrap_tool_payload(tool_result: Any) -> Optional[Dict[str, Any]]:
    payload = tool_result
    if isinstance(tool_result, dict) and isinstance(tool_result.get("data"), dict):
        payload = tool_result.get("data") or {}
    return payload if isinstance(payload, dict) else None


def _collect_booking_lookup_maps(react_trace: List[Dict[str, Any]]) -> Dict[str, Dict[str, str]]:
    pet_names: Dict[str, str] = {}
    clinic_names: Dict[str, str] = {}
    service_names: Dict[str, str] = {}

    for step in react_trace:
        if not isinstance(step, dict):
            continue
        payload = _unwrap_tool_payload(step.get("tool_result"))
        if not payload:
            continue

        tool_name = str(step.get("tool_name") or "").strip().lower()
        if tool_name == "get_user_pets":
            for pet in payload.get("pets") or []:
                if not isinstance(pet, dict):
                    continue
                pet_id = str(pet.get("id") or "").strip()
                pet_name = str(pet.get("name") or "").strip()
                if pet_id and pet_name:
                    pet_names[pet_id] = pet_name
        elif tool_name == "search_clinics_nearby":
            for clinic in payload.get("clinics") or []:
                if not isinstance(clinic, dict):
                    continue
                clinic_id = str(clinic.get("id") or clinic.get("clinic_id") or "").strip()
                clinic_name = str(clinic.get("name") or "").strip()
                if clinic_id and clinic_name:
                    clinic_names[clinic_id] = clinic_name
        elif tool_name == "get_clinic_services":
            for service in payload.get("services") or []:
                if not isinstance(service, dict):
                    continue
                service_id = str(service.get("id") or "").strip()
                service_name = str(service.get("name") or "").strip()
                if service_id and service_name:
                    service_names[service_id] = service_name
        elif tool_name == "check_available_slots":
            resolved_ids = payload.get("resolved_service_ids") or []
            resolved_names = payload.get("resolved_service_names") or []
            if isinstance(resolved_ids, list) and isinstance(resolved_names, list):
                for index, service_id in enumerate(resolved_ids):
                    service_id = str(service_id or "").strip()
                    if not service_id:
                        continue
                    if index < len(resolved_names):
                        service_name = str(resolved_names[index] or "").strip()
                        if service_name:
                            service_names[service_id] = service_name

    return {
        "pet_names": pet_names,
        "clinic_names": clinic_names,
        "service_names": service_names,
    }


def extract_service_chips(tool_result: Any) -> Optional[Dict[str, Any]]:
    payload = _unwrap_tool_payload(tool_result)
    if not payload:
        return None

    raw_services = (
        payload.get("matched_services")
        or payload.get("suggested_service_options")
        or payload.get("services")
        or []
    )
    if not isinstance(raw_services, list):
        return None

    services = []
    for service in raw_services:
        if not isinstance(service, dict):
            continue
        service_id = str(service.get("id") or "").strip()
        service_name = str(service.get("name") or "").strip()
        if not service_name:
            continue
        services.append(
            {
                "id": service_id,
                "name": service_name,
                "base_price": service.get("base_price"),
                "category": service.get("category"),
            }
        )

    if not services:
        return None

    return {
        "clinic_id": payload.get("clinic_id"),
        "services": services[:6],
        "message": payload.get("message")
        or "Mình đã lấy được danh sách dịch vụ phù hợp. Bạn chọn dịch vụ cần đặt lịch nhé.",
    }


def extract_slot_grid(tool_result: Any) -> Optional[Dict[str, Any]]:
    payload = _unwrap_tool_payload(tool_result)
    if not payload:
        return None

    recommended_slots = payload.get("recommended_slots") or []
    alternative_slots = payload.get("alternative_slots") or []
    if not isinstance(recommended_slots, list):
        recommended_slots = []
    if not isinstance(alternative_slots, list):
        alternative_slots = []

    all_slots = [*recommended_slots, *alternative_slots]
    if not all_slots:
        return None

    return {
        "clinic_id": payload.get("clinic_id"),
        "booking_date": payload.get("date"),
        "service_ids": payload.get("resolved_service_ids") or [],
        "service_names": payload.get("resolved_service_names") or payload.get("services") or [],
        "recommended_slots": recommended_slots[:6],
        "alternative_slots": alternative_slots[:6],
        "total_slots": payload.get("total_slots") or len(all_slots),
        "message": payload.get("message")
        or "Mình đã tìm được các khung giờ phù hợp. Bạn chọn một khung giờ để tiếp tục nhé.",
    }


def extract_booking_summary(
    tool_result: Any,
    react_trace: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    payload = _unwrap_tool_payload(tool_result)
    if not payload:
        return None

    preview = payload.get("booking_preview")
    if not isinstance(preview, dict):
        return None

    lookup = _collect_booking_lookup_maps(react_trace)
    pet_id = str(preview.get("pet_id") or "").strip()
    clinic_id = str(preview.get("clinic_id") or "").strip()
    service_ids = [
        str(service_id).strip()
        for service_id in (preview.get("service_ids") or [])
        if str(service_id).strip()
    ]
    service_names = [
        lookup["service_names"].get(service_id, service_id)
        for service_id in service_ids
    ]

    return {
        "pet_id": pet_id,
        "pet_name": lookup["pet_names"].get(pet_id),
        "clinic_id": clinic_id,
        "clinic_name": lookup["clinic_names"].get(clinic_id),
        "booking_date": preview.get("booking_date"),
        "start_time": preview.get("start_time"),
        "service_ids": service_ids,
        "service_names": service_names,
        "booking_type": preview.get("booking_type"),
        "notes": preview.get("notes"),
        "home_address": preview.get("home_address"),
        "message": payload.get("message")
        or "Mình đã tổng hợp đủ thông tin cơ bản. Bạn xác nhận để mình tạo yêu cầu đặt lịch nhé.",
    }


def extract_booking_created(tool_result: Any) -> Optional[Dict[str, Any]]:
    payload = _unwrap_tool_payload(tool_result)
    if not payload or payload.get("success") is not True:
        return None

    booking = payload.get("booking")
    if not isinstance(booking, dict):
        return None

    return {
        "booking": booking,
        "message": payload.get("message")
        or "Mình đã tạo yêu cầu đặt lịch thành công. Clinic manager sẽ xác nhận sau.",
    }


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


def _extract_latest_location_from_history(chat_history_raw: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
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
    Handle incoming chat message with real SingleAgent integration
    """
    react_trace: List[Dict[str, Any]] = []
    full_response = ""
    step_index = 0
    streamed_final_answer = False
    sent_clinic_suggestion = False
    sent_service_chips = False
    sent_slot_grid = False
    sent_booking_summary = False
    sent_booking_created = False
    location_payload: Optional[Dict[str, Any]] = None
    ui_action_payload: Optional[Dict[str, Any]] = None
    try:
        # 1. Parse message metadata
        try:
            data = json.loads(message)
            user_message = data.get("message", message)
            agent_id = data.get("agent_id", agent_id)
            provider_override = data.get("provider", provider_override)
            model_override = data.get("model", model_override)
            images = data.get("images", [])
            raw_ui_action = data.get("ui_action")
            if isinstance(raw_ui_action, dict):
                ui_action_payload = raw_ui_action
            # Optional location from mobile client to reduce manual input
            raw_location = data.get("location")
            lat = data.get("latitude")
            lng = data.get("longitude")
            address = None
            if isinstance(raw_location, dict):
                lat = lat if lat is not None else raw_location.get("lat") or raw_location.get("latitude")
                lng = lng if lng is not None else raw_location.get("lng") or raw_location.get("longitude")
                address = raw_location.get("address") or raw_location.get("formatted_address")
            if lat is not None and lng is not None:
                location_payload = _normalize_location_payload(
                    {"lat": lat, "lng": lng, "address": address}
                )
        except json.JSONDecodeError:
            user_message = message
            images = []

        if not isinstance(images, list):
            images = []

        # 2. Filter valid image URLs/base64
        image_urls = []
        for img in images:
            if not isinstance(img, str):
                continue
            img = img.strip()
            if not img:
                continue
            if img.startswith("http://") or img.startswith("https://"):
                image_urls.append(img)
            elif img.startswith("data:") or len(img) > 100:
                image_urls.append(img)

        if session_context != PLAYGROUND_TEST:
            provider_override = None
            model_override = None

        now_iso = datetime.now(timezone.utc).isoformat()
        await manager.send_message(
            session_id,
            {
                "type": "ack",
                # ACK là trạng thái hệ thống, không echo lại câu user trong UI "thinking".
                "message": "Đã nhận yêu cầu.",
                "agent_id": agent_id,
                "provider": provider_override,
                "model": model_override,
                "timestamp": now_iso,
            },
        )

        current_turn_metadata = {
            "images": image_urls,
            "location": location_payload,
            "ui_action": ui_action_payload,
        }
        enriched_user_message = _augment_content_with_metadata(
            user_message,
            current_turn_metadata,
        )

        if str(user_message or "").strip() != "" or image_urls or ui_action_payload or location_payload:
            await save_chat_message(
                {
                    "message_id": str(uuid.uuid4()),
                    "session_id": session_id,
                    "user_id": user.user_id,
                    "role": "user",
                    "content": user_message,
                    "context_type": session_context,
                    "metadata": current_turn_metadata,
                    "timestamp": datetime.now(timezone.utc),
                }
            )

        await touch_chat_session(session_id)

        # 4. Agent Execution Context
        async with AsyncSessionLocal() as db:
            try:
                if agent_id:
                    agent = await AgentFactory.get_agent_by_id(
                        agent_id=agent_id,
                        db_session=db,
                        provider_override=provider_override,
                        model_override=model_override,
                        user_role=user.role,
                        context_type=session_context,
                    )
                else:
                    agent = await AgentFactory.get_agent(
                        db_session=db,
                        provider_override=provider_override,
                        model_override=model_override,
                        user_role=user.role,
                        context_type=session_context,
                    )
            except ValueError as e:
                await manager.send_message(
                    session_id,
                    {
                        "type": "error",
                        "error": str(e),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )
                return

            if not agent:
                await manager.send_message(
                    session_id,
                    {
                        "type": "error",
                        "error": "Không tìm thấy cấu hình trợ lý AI phù hợp.",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )
                return

            # Agent info broadcast
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
                    auth_token=auth_token,
                    clinic_id=user.clinic_id,
                    session_id=session_id,
                    context_type=session_context,
                )
            )

            # 5. Get chat history for context (include images from history)
            context_history_limit = max(1, min(int(getattr(settings, 'CHAT_HISTORY_CONTEXT_LIMIT', 20)), 200))
            chat_history_raw = await get_chat_history(session_id, limit=context_history_limit)
            if location_payload is None:
                location_payload = _extract_latest_location_from_history(chat_history_raw)

            chat_history = []
            has_prior_assistant_message = False
            for msg in chat_history_raw:
                role = msg.get("role")
                content = msg.get("content", "")
                metadata = msg.get("metadata", {})
                augmented_content = _augment_content_with_metadata(content, metadata)
                if role in ["user", "assistant"] and augmented_content:
                    if role == "assistant":
                        has_prior_assistant_message = True
                    raw_images = metadata.get("images", [])

                    history_images = []
                    if raw_images:
                        for img in raw_images:
                            if isinstance(img, str) and img.strip():
                                if img.startswith("http://") or img.startswith(
                                    "https://"
                                ):
                                    history_images.append(img)
                                elif img.startswith("data:") or len(img) > 100:
                                    history_images.append(img)

                    msg_data = {
                        "role": role,
                        "content": augmented_content,
                    }
                    if history_images:
                        msg_data["images"] = history_images[:2]

                    chat_history.append(msg_data)
            # 6. Streaming loop (timeout protected)
            stream_total_timeout_s = max(
                1, int(getattr(settings, "AGENT_STREAM_TOTAL_TIMEOUT_SECONDS", 120))
            )
            stream_idle_timeout_s = max(
                1, int(getattr(settings, "AGENT_STREAM_IDLE_TIMEOUT_SECONDS", 30))
            )

            loop = asyncio.get_running_loop()
            deadline = loop.time() + float(stream_total_timeout_s)

            aiter = agent.stream(
                enriched_user_message,
                session_id,
                images=image_urls if image_urls else None,
                location=location_payload,
                chat_history=chat_history if chat_history else None,
                user_role=user.role,
            ).__aiter__()

            try:
                while True:
                    remaining_total = deadline - loop.time()
                    if remaining_total <= 0:
                        raise asyncio.TimeoutError()

                    timeout_s = min(float(stream_idle_timeout_s), float(remaining_total))
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

                        # Send clinic cards ASAP when the tool result arrives.
                        if (
                            str(safe_step.get("step_type") or "").strip().lower()
                            == "observation"
                        ):
                            tool_name = str(safe_step.get("tool_name") or "").strip().lower()
                            if not sent_clinic_suggestion and tool_name == "search_clinics_nearby":
                                suggestion = extract_clinic_suggestion(
                                    safe_step.get("tool_result")
                                )
                                if suggestion and suggestion.get("clinics"):
                                    sent_clinic_suggestion = True
                                    await manager.send_message(
                                        session_id,
                                        {
                                            "type": "clinic_suggestion",
                                            "clinics": suggestion["clinics"],
                                            "total_found": suggestion["total_found"],
                                            "location": suggestion["location"],
                                            "timestamp": datetime.now(timezone.utc).isoformat(),
                                        },
                                    )

                            if not sent_service_chips and tool_name == "get_clinic_services":
                                service_chips = extract_service_chips(
                                    safe_step.get("tool_result")
                                )
                                if service_chips and service_chips.get("services"):
                                    sent_service_chips = True
                                    await manager.send_message(
                                        session_id,
                                        {
                                            "type": "service_chips",
                                            **service_chips,
                                            "timestamp": datetime.now(timezone.utc).isoformat(),
                                        },
                                    )

                            if not sent_slot_grid and tool_name == "check_available_slots":
                                slot_grid = extract_slot_grid(
                                    safe_step.get("tool_result")
                                )
                                if slot_grid and (
                                    slot_grid.get("recommended_slots")
                                    or slot_grid.get("alternative_slots")
                                ):
                                    sent_slot_grid = True
                                    await manager.send_message(
                                        session_id,
                                        {
                                            "type": "slot_grid",
                                            **slot_grid,
                                            "timestamp": datetime.now(timezone.utc).isoformat(),
                                        },
                                    )

                            if tool_name == "create_booking_for_user":
                                if not sent_booking_summary:
                                    booking_summary = extract_booking_summary(
                                        safe_step.get("tool_result"),
                                        react_trace,
                                    )
                                    if booking_summary:
                                        sent_booking_summary = True
                                        await manager.send_message(
                                            session_id,
                                            {
                                                "type": "booking_summary",
                                                "summary": booking_summary,
                                                "message": booking_summary.get("message"),
                                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                            },
                                        )
                                if not sent_booking_created:
                                    booking_created = extract_booking_created(
                                        safe_step.get("tool_result")
                                    )
                                    if booking_created:
                                        sent_booking_created = True
                                        await manager.send_message(
                                            session_id,
                                            {
                                                "type": "booking_created",
                                                **booking_created,
                                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                            },
                                        )
                        step_index += 1

                    elif event_type == "token":
                        # Không forward token streaming thô để tránh lộ ReAct/tool JSON.
                        # Client streaming được xử lý ở event final_answer (pseudo-stream).
                        continue

                    elif event_type == "final_answer":
                        full_response = event.get("content", full_response) or ""
                        full_response = sanitize_assistant_response(
                            full_response,
                            user_message=user_message,
                            has_prior_assistant_message=has_prior_assistant_message,
                        )
                        # Pseudo-stream ONLY the final answer (client UX wants streaming),
                        # but we must not stream intermediate ReAct tokens.
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
                        error_content = event.get("content", "Không rõ lỗi")
                        await manager.send_message(
                            session_id,
                            {
                                "type": "error",
                                "error": str(error_content),
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            },
                        )
                        return

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
                return
            finally:
                reset_tool_runtime_context(runtime_token)

        # 6. Finalization & Persistence

        # Safety fallback (should be rare now that the agent finalizes missing answers)
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

        if not full_response.strip():
            has_clinic_suggestion = any(
                str(step.get("tool_name") or "").strip().lower()
                == "search_clinics_nearby"
                for step in react_trace
            )
            has_pet_list = any(
                str(step.get("tool_name") or "").strip().lower() == "get_user_pets"
                for step in react_trace
            )
            if has_clinic_suggestion:
                full_response = (
                    "M\u00ecnh \u0111\u00e3 g\u1ee3i \u00fd m\u1ed9t s\u1ed1 ph\u00f2ng kh\u00e1m g\u1ea7n b\u1ea1n \u1edf b\u00ean d\u01b0\u1edbi. "
                    "B\u1ea1n ch\u1ecdn 1 ph\u00f2ng kh\u00e1m r\u1ed3i m\u00ecnh ti\u1ebfp t\u1ee5c \u0111\u1eb7t l\u1ecbch trong chat nh\u00e9."
                )
            elif has_pet_list:
                full_response = (
                    "M\u00ecnh \u0111\u00e3 l\u1ea5y \u0111\u01b0\u1ee3c danh s\u00e1ch th\u00fa c\u01b0ng c\u1ee7a b\u1ea1n. "
                    "B\u1ea1n cho m\u00ecnh bi\u1ebft b\u00e9 n\u00e0o c\u1ea7n \u0111\u1eb7t l\u1ecbch nh\u00e9."
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

        # Fallback: send clinic suggestion at the end if not already sent.
        if not sent_clinic_suggestion:
            clinic_data = None
            for step in react_trace:
                if step.get("tool_name") == "search_clinics_nearby":
                    clinic_data = extract_clinic_suggestion(step.get("tool_result"))
                    if clinic_data:
                        break

            if clinic_data and clinic_data.get("clinics"):
                await manager.send_message(
                    session_id,
                    {
                        "type": "clinic_suggestion",
                        "clinics": clinic_data["clinics"],
                        "total_found": clinic_data["total_found"],
                        "location": clinic_data["location"],
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )

        await manager.send_message(
            session_id,
            {
                "type": "complete",
                "full_response": full_response,
                "react_trace": react_trace,
                "agent_id": agent_id,
                "total_steps": step_index,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        logger.info(f"Chat stream completed: {session_id} ({step_index} steps)")

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






