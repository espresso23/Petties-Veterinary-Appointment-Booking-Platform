"""MongoDB-only chat session APIs với ownership và context isolation."""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import logging
import uuid

from app.api.middleware.auth import CurrentUser, get_current_user
from app.core.chat_context import (
    BUSINESS_CHAT,
    PLAYGROUND_TEST,
    normalize_context_type,
)
from app.core.database.mongodb import (
    save_chat_session,
    save_chat_message,
    get_chat_history,
    get_chat_session,
    list_chat_sessions_by_owner,
    touch_chat_session,
    delete_chat_session as delete_chat_session_document,
)

logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix="/chat", tags=["Chat"])


# ===== SCHEMAS =====

class ChatMessage(BaseModel):
    """Single chat message"""
    message_id: Optional[str] = None
    user_id: Optional[str] = None
    role: str  # user, assistant, system
    content: str
    context_type: Optional[str] = None
    timestamp: Optional[datetime] = None
    react_trace: Optional[list] = None


class CreateSessionRequest(BaseModel):
    """Create new chat session"""
    agent_id: Optional[int] = None
    title: Optional[str] = None
    context_type: Literal["BUSINESS_CHAT", "PLAYGROUND_TEST"] = BUSINESS_CHAT


class CreateSessionResponse(BaseModel):
    """Response after creating session"""
    success: bool
    session_id: str
    agent_id: Optional[int] = None
    context_type: str
    user_role: str
    clinic_id: Optional[str] = None
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
    context_type: str = BUSINESS_CHAT
    user_role: Optional[str] = None
    clinic_id: Optional[str] = None
    messages: List[ChatMessage] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SessionListResponse(BaseModel):
    """List of sessions"""
    total: int
    sessions: List[ChatSessionResponse]


def _ensure_context_access(user: CurrentUser, context_type: str):
    if context_type == PLAYGROUND_TEST and not user.is_admin:
        raise HTTPException(status_code=403, detail="Chỉ admin mới được dùng Playground")


def _validate_session_access(session: Optional[dict], user: CurrentUser) -> dict:
    if not session:
        raise HTTPException(status_code=404, detail="Không tìm thấy session")

    if session.get("user_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập session này")

    context_type = normalize_context_type(session.get("context_type"), BUSINESS_CHAT)
    _ensure_context_access(user, context_type)
    return session


def _map_message(message: dict) -> ChatMessage:
    timestamp = message.get("timestamp")
    if isinstance(timestamp, str):
        try:
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            timestamp = None

    return ChatMessage(
        message_id=message.get("message_id"),
        user_id=message.get("user_id"),
        role=message.get("role", "assistant"),
        content=message.get("content", ""),
        context_type=message.get("context_type"),
        timestamp=timestamp,
        react_trace=message.get("react_trace"),
    )


def _map_session(session: dict, messages: Optional[List[dict]] = None) -> ChatSessionResponse:
    return ChatSessionResponse(
        session_id=session.get("session_id"),
        agent_id=session.get("agent_id"),
        title=session.get("title"),
        context_type=session.get("context_type", BUSINESS_CHAT),
        user_role=session.get("user_role"),
        clinic_id=session.get("clinic_id"),
        messages=[_map_message(message) for message in (messages or [])],
        created_at=session.get("created_at"),
        updated_at=session.get("updated_at"),
    )


# ===== ENDPOINTS =====

@router.post(
    "/sessions",
    response_model=CreateSessionResponse,
    summary="Create new chat session"
)
async def create_session(
    request: CreateSessionRequest,
    user: CurrentUser = Depends(get_current_user)
):
    """
    Create a new chat session
    
    Returns session_id for subsequent messages
    """
    context_type = normalize_context_type(request.context_type, BUSINESS_CHAT)
    _ensure_context_access(user, context_type)

    now = datetime.now(timezone.utc)
    session_id = str(uuid.uuid4())

    session_data = {
        "session_id": session_id,
        "agent_id": request.agent_id,
        "title": request.title or f"Chat {datetime.now().strftime('%H:%M')}",
        "context_type": context_type,
        "created_at": now,
        "updated_at": now,
        "user_id": user.user_id,
        "user_role": user.role,
        "clinic_id": user.clinic_id,
    }

    await save_chat_session(session_data)
    logger.info(f"Created chat session: {session_id}")

    return CreateSessionResponse(
        success=True,
        session_id=session_id,
        agent_id=request.agent_id,
        context_type=context_type,
        user_role=user.role,
        clinic_id=user.clinic_id,
        created_at=now
    )


@router.get(
    "/sessions",
    response_model=SessionListResponse,
    summary="List chat sessions"
)
async def list_sessions(
    limit: int = 10,
    context_type: Optional[str] = Query(None, description="BUSINESS_CHAT hoặc PLAYGROUND_TEST"),
    user: CurrentUser = Depends(get_current_user)
):
    """
    List recent chat sessions
    """
    normalized_context = normalize_context_type(context_type, BUSINESS_CHAT) if context_type else None
    if normalized_context:
        _ensure_context_access(user, normalized_context)

    sessions = await list_chat_sessions_by_owner(
        user_id=user.user_id,
        context_type=normalized_context,
        limit=limit,
    )

    return SessionListResponse(
        total=len(sessions),
        sessions=[_map_session(s) for s in sessions[:limit]]
    )


@router.get(
    "/sessions/{session_id}",
    response_model=ChatSessionResponse,
    summary="Get chat session with messages"
)
async def get_session(
    session_id: str,
    user: CurrentUser = Depends(get_current_user)
):
    """
    Get chat session with all messages
    """
    session = _validate_session_access(await get_chat_session(session_id), user)
    messages = await get_chat_history(session_id)
    return _map_session(session, messages)


@router.post(
    "/sessions/{session_id}/messages",
    response_model=SendMessageResponse,
    summary="Send message to chat session"
)
async def send_message(
    session_id: str,
    request: SendMessageRequest,
    user: CurrentUser = Depends(get_current_user)
):
    """
    Send message to chat session
    
    Returns placeholder response (real implementation uses WebSocket)
    """
    session = _validate_session_access(await get_chat_session(session_id), user)
    context_type = session.get("context_type", BUSINESS_CHAT)
    now = datetime.now(timezone.utc)

    user_msg = {
        "message_id": str(uuid.uuid4()),
        "session_id": session_id,
        "user_id": user.user_id,
        "role": "user",
        "content": request.message,
        "context_type": context_type,
        "timestamp": now,
    }
    await save_chat_message(user_msg)

    assistant_response = f"[Placeholder] Received: {request.message[:50]}... Please use WebSocket /ws/chat/{session_id} for real-time streaming."

    assistant_msg = {
        "message_id": str(uuid.uuid4()),
        "session_id": session_id,
        "user_id": user.user_id,
        "role": "assistant",
        "content": assistant_response,
        "context_type": context_type,
        "timestamp": now,
    }
    await save_chat_message(assistant_msg)
    await touch_chat_session(session_id)

    return SendMessageResponse(
        success=True,
        session_id=session_id,
        user_message=request.message,
        assistant_response=assistant_response,
        timestamp=now
    )


@router.delete(
    "/sessions/{session_id}",
    summary="Delete chat session"
)
async def delete_session_authenticated(
    session_id: str,
    user: CurrentUser = Depends(get_current_user)
):
    """Delete chat session nếu session thuộc owner hiện tại."""
    _validate_session_access(await get_chat_session(session_id), user)
    deleted = await delete_chat_session_document(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy session")

    return {"success": True, "message": f"Session {session_id} deleted"}
