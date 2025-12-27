"""
PETTIES AGENT SERVICE - WebSocket Chat Handler
Real-time chat with streaming responses

Package: app.api.websocket
Purpose: WebSocket endpoint for Playground chat with real SingleAgent integration
Version: v1.0.0 (Connected to SingleAgent.stream())
"""

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Optional, List, Any
import json
import logging
from datetime import datetime

from app.core.agents.factory import AgentFactory
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

    async def connect(self, websocket: WebSocket, session_id: str):
        """Store active connection (WebSocket must be accepted already)"""
        # WebSocket is accepted in the endpoint
        self.active_connections[session_id] = websocket
        logger.info(f"WebSocket connected: {session_id}")

    def disconnect(self, session_id: str):
        """Remove connection"""
        if session_id in self.active_connections:
            del self.active_connections[session_id]
            logger.info(f"WebSocket disconnected: {session_id}")

    async def send_message(self, session_id: str, message: dict):
        """Send message to specific session"""
        websocket = self.active_connections.get(session_id)
        if websocket:
            try:
                # Basic check for state (optional but safer)
                from fastapi.websockets import WebSocketState
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json(message)
            except (RuntimeError, Exception) as e:
                logger.error(f"Failed to send message to {session_id}: {e}")
                # Don't delete yet, disconnect() will handle it or next send will fail
                logger.error(f"Failed to send message: {e}")

    async def send_text(self, session_id: str, text: str):
        """Send text message to specific session"""
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_text(text)

    async def broadcast(self, message: dict):
        """Broadcast message to all connections"""
        for connection in self.active_connections.values():
            await connection.send_json(message)


# Global connection manager
manager = ConnectionManager()


def map_react_step_to_message(step: Dict[str, Any], step_index: int) -> Dict[str, Any]:
    """
    Map ReActStep to WebSocket message format

    Args:
        step: ReActStep from SingleAgent
        step_index: Index of this step in the trace

    Returns:
        WebSocket message dict
    """
    step_type = step.get("step_type", "unknown")

    if step_type == "thought":
        return {
            "type": "thinking",
            "step_index": step_index,
            "content": step.get("content", ""),
            "tool_name": step.get("tool_name"),
            "tool_params": step.get("tool_params"),
            "timestamp": datetime.now().isoformat()
        }
    elif step_type == "action":
        return {
            "type": "tool_call",
            "step_index": step_index,
            "tool_name": step.get("tool_name", "unknown"),
            "tool_params": step.get("tool_params", {}),
            "content": step.get("content", ""),
            "timestamp": datetime.now().isoformat()
        }
    elif step_type == "observation":
        return {
            "type": "tool_result",
            "step_index": step_index,
            "tool_name": step.get("tool_name"),
            "result": step.get("tool_result"),
            "content": step.get("content", ""),
            "timestamp": datetime.now().isoformat()
        }
    else:
        return {
            "type": "info",
            "step_index": step_index,
            "content": step.get("content", ""),
            "timestamp": datetime.now().isoformat()
        }


async def handle_chat_message(
    websocket: WebSocket,
    session_id: str,
    message: str,
    agent_id: Optional[int] = None,
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None
):
    """
    Handle incoming chat message with real SingleAgent integration

    Streams ReAct steps to frontend:
    1. thinking - Agent's reasoning
    2. tool_call - Tool being called with params
    3. tool_result - Result from tool execution
    4. stream - Token streaming from LLM
    5. complete - Final response with full react_trace

    Args:
        websocket: WebSocket connection
        session_id: Unique session identifier
        message: Raw message string (may be JSON)
        agent_id: Agent ID to use
        provider_override: Optional provider to use (openrouter/deepseek)
        model_override: Optional model to override agent's default model
    """
    react_trace: List[Dict[str, Any]] = []
    full_response = ""
    step_index = 0

    try:
        # Parse message
        try:
            data = json.loads(message)
            user_message = data.get("message", message)
            agent_id = data.get("agent_id", agent_id)
            provider_override = data.get("provider", provider_override)  # Get provider from message
            model_override = data.get("model", model_override)  # Get model from message
        except json.JSONDecodeError:
            user_message = message

        # Send acknowledgment
        await manager.send_message(session_id, {
            "type": "ack",
            "message": user_message,
            "agent_id": agent_id,
            "provider": provider_override,
            "model": model_override,
            "timestamp": datetime.now().isoformat()
        })

        # Get agent from database
        async with AsyncSessionLocal() as db:
            try:
                if agent_id:
                    # Get specific agent by ID with provider/model override
                    agent = await AgentFactory.get_agent_by_id(
                        agent_id=agent_id,
                        db_session=db,
                        provider_override=provider_override,
                        model_override=model_override
                    )
                else:
                    # Get default enabled agent with provider/model override
                    agent = await AgentFactory.get_agent(
                        db_session=db,
                        provider_override=provider_override,
                        model_override=model_override
                    )
            except ValueError as e:
                await manager.send_message(session_id, {
                    "type": "error",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                })
                return

            if not agent:
                await manager.send_message(session_id, {
                    "type": "error",
                    "error": f"Agent not found: {agent_id or 'default'}",
                    "timestamp": datetime.now().isoformat()
                })
                return

            # Send agent info with provider and model
            await manager.send_message(session_id, {
                "type": "agent_info",
                "agent_name": agent.name,
                "agent_type": agent.agent_type,
                "provider": provider_override or "openrouter",
                "model": model_override or "default",
                "timestamp": datetime.now().isoformat()
            })

            # Stream agent response
            logger.info(f"Starting agent stream for session {session_id}")

            async for event in agent.stream(user_message, session_id):
                # Safety check: ensure event is a dict
                if not isinstance(event, dict):
                    logger.warning(f"Agent stream yielded non-dict event ({type(event)}): {event}")
                    if isinstance(event, str):
                        event = {"type": "stream", "content": event}
                    else:
                        continue

                event_type = event.get("type", "")

                if event_type == "react_step":
                    # Map ReActStep to WebSocket message
                    step = event.get("step", {})
                    ws_message = map_react_step_to_message(step, step_index)

                    # Store in trace
                    react_trace.append({
                        "step_index": step_index,
                        **step
                    })

                    # Send to frontend
                    await manager.send_message(session_id, ws_message)
                    step_index += 1

                elif event_type == "token":
                    # Stream token from LLM
                    token_content = event.get("content", "")
                    full_response += token_content
                    await manager.send_message(session_id, {
                        "type": "stream",
                        "content": token_content,
                        "timestamp": datetime.now().isoformat()
                    })

                elif event_type == "final_answer":
                    # Final answer from agent
                    full_response = event.get("content", full_response)

                elif event_type == "error":
                    # Error during processing
                    error_msg = event.get("content", "Unknown error")
                    if isinstance(event, str): # Extra safety
                        error_msg = event

                    await manager.send_message(session_id, {
                        "type": "error",
                        "error": error_msg,
                        "timestamp": datetime.now().isoformat()
                    })
                    return

        # Send completion with full trace
        await manager.send_message(session_id, {
            "type": "complete",
            "full_response": full_response,
            "react_trace": react_trace,
            "agent_id": agent_id,
            "total_steps": step_index,
            "timestamp": datetime.now().isoformat()
        })

        logger.info(f"Agent stream completed for session {session_id}: {step_index} steps")

    except Exception as e:
        logger.error(f"Error handling message: {e}", exc_info=True)
        await manager.send_message(session_id, {
            "type": "error",
            "error": str(e),
            "react_trace": react_trace,  # Include partial trace for debugging
            "timestamp": datetime.now().isoformat()
        })



from app.api.middleware.auth import decode_jwt_token

async def websocket_chat_endpoint(websocket: WebSocket, session_id: str = "default"):
    """
    WebSocket endpoint for chat
    
    URL: /ws/chat/{session_id}?token={jwt_token}
    """
    try:
        logger.info(f"Incoming WebSocket connection: session_id={session_id}")
        
        # 1. Accept first (Fix 403 Forbidden on Handshake)
        from fastapi.websockets import WebSocketState
        if websocket.client_state == WebSocketState.CONNECTING:
            await websocket.accept()
            logger.debug(f"WebSocket accepted: {session_id}")
        else:
            logger.warning(f"WebSocket not in CONNECTING state: {websocket.client_state}")

        # 2. Validate Token
        token = websocket.query_params.get("token")
        user = None
        
        if token:
            try:
                user = await decode_jwt_token(token)
            except Exception as e:
                logger.error(f"Error during token validation: {e}", exc_info=True)
                user = None

        if not token or not user:
            error_msg = "Authentication required" if not token else "Invalid authentication"
            logger.warning(f"WebSocket connection rejected: {error_msg} for session {session_id}")
            # Send error message before closing if possible, or just close with code
            await websocket.close(code=1008, reason=error_msg[:123]) # Reason max 123 chars
            return
            
        logger.info(f"WebSocket auth success: {user.username} ({user.role})")

        # 3. Connect (Manager stores only)
        await manager.connect(websocket, session_id)

        try:
            # Send welcome message
            await manager.send_message(session_id, {
                "type": "connected",
                "session_id": session_id,
                "message": "Connected to Petties Agent Chat",
                "user": user.username,
                "supported_message_types": [
                    "thinking", "tool_call", "tool_result",
                    "stream", "complete", "error"
                ],
                "timestamp": datetime.now().isoformat()
            })

            # Listen for messages
            while True:
                data = await websocket.receive_text()
                await handle_chat_message(websocket, session_id, data)

        except WebSocketDisconnect:
            manager.disconnect(session_id)
            logger.info(f"Client disconnected: {session_id}")
        except Exception as e:
            logger.error(f"WebSocket execution error: {e}", exc_info=True)
            manager.disconnect(session_id)
            
    except Exception as e:
        logger.critical(f"Fatal WebSocket handler error: {e}", exc_info=True)
        try:
            await websocket.close(code=1011) # Internal error
        except:
            pass

