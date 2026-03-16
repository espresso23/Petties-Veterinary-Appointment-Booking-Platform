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
import uuid
from datetime import datetime, timezone
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

logger = logging.getLogger(__name__)


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
        return {
            "type": "thinking",
            "step_index": step_index,
            "content": step.get("content", ""),
            "tool_name": step.get("tool_name"),
            "tool_params": step.get("tool_params"),
            "react_step": normalize_react_step(step),
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

    try:
        # 1. Parse message metadata
        try:
            data = json.loads(message)
            user_message = data.get("message", message)
            agent_id = data.get("agent_id", agent_id)
            provider_override = data.get("provider", provider_override)
            model_override = data.get("model", model_override)
            images = data.get("images", [])
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

        # 3. Send acknowledgment and Save user message
        now_iso = datetime.now(timezone.utc).isoformat()
        await manager.send_message(
            session_id,
            {
                "type": "ack",
                "message": user_message,
                "agent_id": agent_id,
                "provider": provider_override,
                "model": model_override,
                "timestamp": now_iso,
            },
        )

        await save_chat_message(
            {
                "message_id": str(uuid.uuid4()),
                "session_id": session_id,
                "user_id": user.user_id,
                "role": "user",
                "content": user_message,
                "context_type": session_context,
                "metadata": {
                    "images": image_urls,
                },
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
                        "timestamp": now_iso,
                    },
                )
                return

            if not agent:
                await manager.send_message(
                    session_id,
                    {
                        "type": "error",
                        "error": f"Agent not found: {agent_id or 'default'}",
                        "timestamp": now_iso,
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
                    "timestamp": now_iso,
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
            chat_history_raw = await get_chat_history(session_id, limit=5)

            chat_history = []
            for msg in chat_history_raw:
                role = msg.get("role")
                content = msg.get("content", "")
                if role in ["user", "assistant"] and content:
                    metadata = msg.get("metadata", {})
                    raw_images = metadata.get("images", [])

                    images = []
                    if raw_images:
                        for img in raw_images:
                            if isinstance(img, str) and img.strip():
                                if img.startswith("http://") or img.startswith(
                                    "https://"
                                ):
                                    images.append(img)
                                elif img.startswith("data:") or len(img) > 100:
                                    images.append(img)

                    msg_data = {
                        "role": role,
                        "content": content,
                    }
                    if images:
                        msg_data["images"] = images[:2]

                    chat_history.append(msg_data)

            # 6. Streaming loop
            try:
                async for event in agent.stream(
                    user_message,
                    session_id,
                    images=image_urls if image_urls else None,
                    chat_history=chat_history if chat_history else None,
                    user_role=user.role,
                ):
                    if not isinstance(event, dict):
                        continue

                    event_type = event.get("type", "")

                    if event_type == "react_step":
                        step = event.get("step", {})
                        ws_message = map_react_step_to_message(step, step_index)
                        react_trace.append({"step_index": step_index, **step})
                        await manager.send_message(session_id, ws_message)
                        step_index += 1

                    elif event_type == "token":
                        token_content = event.get("content", "")
                        full_response += token_content
                        await manager.send_message(
                            session_id,
                            {
                                "type": "stream",
                                "content": token_content,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            },
                        )

                    elif event_type == "final_answer":
                        full_response = event.get("content", full_response)

                    elif event_type == "error":
                        error_content = event.get("content", "Unknown error")
                        await manager.send_message(
                            session_id,
                            {
                                "type": "error",
                                "error": str(error_content),
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            },
                        )
                        return
            finally:
                reset_tool_runtime_context(runtime_token)

        # 6. Finalization & Persistence

        # Fallback for empty responses (take last observation if available)
        if not full_response.strip() and react_trace:
            last_obs = next(
                (
                    s
                    for s in reversed(react_trace)
                    if s.get("step_type") == "observation"
                ),
                None,
            )
            if last_obs:
                full_response = last_obs.get("content", "No content found in trace.")
            else:
                full_response = "Agent completed without a final response."

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

        # Extract clinic data from react_trace for UI rendering
        clinic_data = None
        for step in react_trace:
            if step.get("tool_name") == "search_clinics_nearby":
                tool_result = step.get("tool_result", {})
                if isinstance(tool_result, dict) and tool_result.get("clinics"):
                    clinic_data = {
                        "clinics": tool_result.get("clinics", [])[:5],
                        "total_found": tool_result.get("total_found", 0),
                        "location": tool_result.get("query_location", {}),
                    }
                    break

        # Send clinic suggestion message if clinics found
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
            history = await get_chat_history(session_id)
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
