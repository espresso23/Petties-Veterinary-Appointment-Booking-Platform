"""
PETTIES AGENT SERVICE - Chat API Routes
REST endpoints for chat session management

Package: app.api.routes
Purpose: Chat session and history management
Version: v0.0.1
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import logging
import uuid

from app.db.postgres.session import get_db
from app.api.middleware.auth import get_current_user_optional, CurrentUser

logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix="/chat", tags=["Chat"])


# ===== SCHEMAS =====

class ChatMessage(BaseModel):
    """Single chat message"""
    role: str  # user, assistant, system
    content: str
    timestamp: Optional[datetime] = None


class CreateSessionRequest(BaseModel):
    """Create new chat session"""
    agent_id: Optional[int] = None
    title: Optional[str] = None


class CreateSessionResponse(BaseModel):
    """Response after creating session"""
    success: bool
    session_id: str
    agent_id: Optional[int] = None
    created_at: datetime


class SendMessageRequest(BaseModel):
    """Send message to chat"""
    message: str = Field(..., min_length=1)
    agent_id: Optional[int] = None


class SendMessageResponse(BaseModel):
    """Response after sending message"""
    success: bool
    session_id: str
    user_message: str
    assistant_response: str
    timestamp: datetime


class ChatSessionResponse(BaseModel):
    """Chat session with messages"""
    session_id: str
    agent_id: Optional[int] = None
    title: Optional[str] = None
    messages: List[ChatMessage] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SessionListResponse(BaseModel):
    """List of sessions"""
    total: int
    sessions: List[ChatSessionResponse]


# ===== IN-MEMORY STORAGE (Placeholder) =====
# TODO: Replace with PostgreSQL storage

chat_sessions: dict = {}


# ===== ENDPOINTS =====

@router.post(
    "/sessions",
    response_model=CreateSessionResponse,
    summary="Create new chat session"
)
async def create_session(
    request: CreateSessionRequest,
    user: Optional[CurrentUser] = Depends(get_current_user_optional)
):
    """
    Create a new chat session
    
    Returns session_id for subsequent messages
    """
    session_id = str(uuid.uuid4())
    
    chat_sessions[session_id] = {
        "session_id": session_id,
        "agent_id": request.agent_id,
        "title": request.title or f"Chat {datetime.now().strftime('%H:%M')}",
        "messages": [],
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "user_id": user.user_id if user else None
    }
    
    logger.info(f"Created chat session: {session_id}")
    
    return CreateSessionResponse(
        success=True,
        session_id=session_id,
        agent_id=request.agent_id,
        created_at=datetime.now()
    )


@router.get(
    "/sessions",
    response_model=SessionListResponse,
    summary="List chat sessions"
)
async def list_sessions(
    limit: int = 10,
    user: Optional[CurrentUser] = Depends(get_current_user_optional)
):
    """
    List recent chat sessions
    """
    sessions = list(chat_sessions.values())
    
    # Sort by updated_at descending
    sessions.sort(key=lambda x: x.get("updated_at", datetime.min), reverse=True)
    
    return SessionListResponse(
        total=len(sessions),
        sessions=[
            ChatSessionResponse(
                session_id=s["session_id"],
                agent_id=s.get("agent_id"),
                title=s.get("title"),
                messages=[],  # Don't include messages in list
                created_at=s.get("created_at"),
                updated_at=s.get("updated_at")
            )
            for s in sessions[:limit]
        ]
    )


@router.get(
    "/sessions/{session_id}",
    response_model=ChatSessionResponse,
    summary="Get chat session with messages"
)
async def get_session(session_id: str):
    """
    Get chat session with all messages
    """
    if session_id not in chat_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = chat_sessions[session_id]
    
    return ChatSessionResponse(
        session_id=session["session_id"],
        agent_id=session.get("agent_id"),
        title=session.get("title"),
        messages=[ChatMessage(**m) for m in session.get("messages", [])],
        created_at=session.get("created_at"),
        updated_at=session.get("updated_at")
    )


@router.post(
    "/sessions/{session_id}/messages",
    response_model=SendMessageResponse,
    summary="Send message to chat session"
)
async def send_message(
    session_id: str,
    request: SendMessageRequest
):
    """
    Send message to chat session
    
    Returns placeholder response (real implementation uses WebSocket)
    """
    if session_id not in chat_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = chat_sessions[session_id]
    
    # Add user message
    user_msg = {
        "role": "user",
        "content": request.message,
        "timestamp": datetime.now()
    }
    session["messages"].append(user_msg)
    
    # Generate placeholder response
    assistant_response = f"[Placeholder] Received: {request.message[:50]}... Please use WebSocket /ws/chat/{session_id} for real-time streaming."
    
    assistant_msg = {
        "role": "assistant",
        "content": assistant_response,
        "timestamp": datetime.now()
    }
    session["messages"].append(assistant_msg)
    session["updated_at"] = datetime.now()
    
    return SendMessageResponse(
        success=True,
        session_id=session_id,
        user_message=request.message,
        assistant_response=assistant_response,
        timestamp=datetime.now()
    )


@router.delete(
    "/sessions/{session_id}",
    summary="Delete chat session"
)
async def delete_session(session_id: str):
    """
    Delete chat session
    """
    if session_id not in chat_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    del chat_sessions[session_id]
    
    return {"success": True, "message": f"Session {session_id} deleted"}
