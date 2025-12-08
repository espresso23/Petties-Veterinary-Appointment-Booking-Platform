"""
PETTIES AGENT SERVICE - WebSocket Chat Handler
Real-time chat with streaming responses

Package: app.api.websocket
Purpose: WebSocket endpoint for Playground chat
Version: v0.0.1
"""

from fastapi import WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List, Optional
import json
import logging
import asyncio
from datetime import datetime

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
        """Accept and store connection"""
        await websocket.accept()
        self.active_connections[session_id] = websocket
        logger.info(f"WebSocket connected: {session_id}")
    
    def disconnect(self, session_id: str):
        """Remove connection"""
        if session_id in self.active_connections:
            del self.active_connections[session_id]
            logger.info(f"WebSocket disconnected: {session_id}")
    
    async def send_message(self, session_id: str, message: dict):
        """Send message to specific session"""
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_json(message)
    
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


async def handle_chat_message(
    websocket: WebSocket,
    session_id: str,
    message: str,
    agent_id: Optional[int] = None
):
    """
    Handle incoming chat message
    
    This is a placeholder implementation.
    Real implementation will:
    1. Load agent configuration
    2. Create LangGraph workflow
    3. Stream thinking process
    4. Stream tool calls
    5. Stream final response
    """
    try:
        # Parse message
        try:
            data = json.loads(message)
            user_message = data.get("message", message)
            agent_id = data.get("agent_id", agent_id)
        except json.JSONDecodeError:
            user_message = message
        
        # Send acknowledgment
        await manager.send_message(session_id, {
            "type": "ack",
            "timestamp": datetime.now().isoformat()
        })
        
        # Simulate thinking process
        await manager.send_message(session_id, {
            "type": "thinking",
            "step": "intent_classification",
            "content": "Phân loại ý định người dùng..."
        })
        await asyncio.sleep(0.3)
        
        await manager.send_message(session_id, {
            "type": "thinking", 
            "step": "routing",
            "content": f"Điều phối đến Agent #{agent_id or 'Main'}..."
        })
        await asyncio.sleep(0.3)
        
        # Simulate streaming response
        response_parts = [
            "Xin chào! ",
            "Tôi là trợ lý AI của Petties. ",
            f"Bạn đã hỏi: '{user_message[:50]}...' ",
            "Đây là phản hồi mẫu từ WebSocket. ",
            "Trong phiên bản thực tế, tôi sẽ xử lý yêu cầu của bạn với LangGraph."
        ]
        
        for part in response_parts:
            await manager.send_message(session_id, {
                "type": "stream",
                "content": part
            })
            await asyncio.sleep(0.1)
        
        # Send completion
        await manager.send_message(session_id, {
            "type": "complete",
            "full_response": "".join(response_parts),
            "agent_id": agent_id,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error handling message: {e}")
        await manager.send_message(session_id, {
            "type": "error",
            "error": str(e)
        })


async def websocket_chat_endpoint(websocket: WebSocket, session_id: str = "default"):
    """
    WebSocket endpoint for chat
    
    URL: /ws/chat/{session_id}
    
    Message format (incoming):
        {"message": "User question", "agent_id": 1}
    
    Message format (outgoing):
        {"type": "thinking|stream|complete|error", ...}
    """
    await manager.connect(websocket, session_id)
    
    try:
        # Send welcome message
        await manager.send_message(session_id, {
            "type": "connected",
            "session_id": session_id,
            "message": "Connected to Petties Agent Chat",
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
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(session_id)
