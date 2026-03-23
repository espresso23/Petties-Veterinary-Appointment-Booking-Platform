"""MongoDB-only chat session APIs với ownership và context isolation."""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import logging
import uuid

from app.api.middleware.auth import CurrentUser, get_current_user
from app.api.middleware.subscription_guard import check_active_subscription
from app.api.schemas.feedback_schemas import (
    FeedbackRequest,
    FeedbackResponse,
    UpdateFeedbackRequest,
    DeleteFeedbackResponse,
    FeedbackStatsResponse,
    FeedbackListResponse,
    FeedbackItem,
)
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
    metadata: Optional[dict] = None


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
    """Response after saving user message (AI response via WebSocket only)"""

    success: bool
    session_id: str
    message_id: str
    user_message: str
    timestamp: datetime
    hint: str = (
        "Kết nối WebSocket /ws/chat/{session_id}?token={jwt} để nhận phản hồi từ AI"
    )


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
        raise HTTPException(
            status_code=403, detail="Chỉ admin mới được dùng Playground"
        )


def _validate_session_access(session: Optional[dict], user: CurrentUser) -> dict:
    if not session:
        raise HTTPException(status_code=404, detail="Không tìm thấy session")

    # Ẩn session đã bị đánh dấu xóa khỏi người dùng
    if session.get("deleted"):
        raise HTTPException(status_code=404, detail="Không tìm thấy session")

    if session.get("user_id") != user.user_id:
        raise HTTPException(
            status_code=403, detail="Bạn không có quyền truy cập session này"
        )

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
        metadata=message.get("metadata", {}),
    )


def _map_session(
    session: dict, messages: Optional[List[dict]] = None
) -> ChatSessionResponse:
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
    "/sessions", response_model=CreateSessionResponse, summary="Create new chat session"
)
async def create_session(
    request: CreateSessionRequest, 
    user: CurrentUser = Depends(get_current_user),
    _Subscription: bool = Depends(check_active_subscription)
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
        "title": request.title or f"Chat {now.strftime('%H:%M')}",
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
        created_at=now,
    )


@router.get(
    "/sessions", response_model=SessionListResponse, summary="List chat sessions"
)
async def list_sessions(
    limit: int = 10,
    context_type: Optional[str] = Query(
        None, description="BUSINESS_CHAT hoặc PLAYGROUND_TEST"
    ),
    user: CurrentUser = Depends(get_current_user),
):
    """
    List recent chat sessions
    """
    normalized_context = (
        normalize_context_type(context_type, BUSINESS_CHAT) if context_type else None
    )
    if normalized_context:
        _ensure_context_access(user, normalized_context)

    sessions = await list_chat_sessions_by_owner(
        user_id=user.user_id,
        context_type=normalized_context,
        limit=limit,
    )

    return SessionListResponse(
        total=len(sessions), sessions=[_map_session(s) for s in sessions]
    )


@router.get(
    "/sessions/{session_id}",
    response_model=ChatSessionResponse,
    summary="Get chat session with messages",
)
async def get_session(session_id: str, user: CurrentUser = Depends(get_current_user)):
    """
    Get chat session with all messages
    """
    session = _validate_session_access(await get_chat_session(session_id), user)
    messages = await get_chat_history(session_id)
    return _map_session(session, messages)


@router.post(
    "/sessions/{session_id}/messages",
    response_model=SendMessageResponse,
    summary="Send message to chat session",
)
async def send_message(
    session_id: str,
    request: SendMessageRequest,
    user: CurrentUser = Depends(get_current_user),
    _Subscription: bool = Depends(check_active_subscription)
):
    """
    Save user message to chat session.

    This REST endpoint only persists the user message.
    AI responses are delivered via WebSocket at /ws/chat/{session_id}?token={jwt}.
    """
    session = _validate_session_access(await get_chat_session(session_id), user)
    context_type = session.get("context_type", BUSINESS_CHAT)
    now = datetime.now(timezone.utc)
    message_id = str(uuid.uuid4())

    user_msg = {
        "message_id": message_id,
        "session_id": session_id,
        "user_id": user.user_id,
        "role": "user",
        "content": request.message,
        "context_type": context_type,
        "timestamp": now,
    }
    await save_chat_message(user_msg)
    await touch_chat_session(session_id)

    return SendMessageResponse(
        success=True,
        session_id=session_id,
        message_id=message_id,
        user_message=request.message,
        timestamp=now,
    )


@router.delete("/sessions/{session_id}", summary="Delete chat session")
async def delete_session_authenticated(
    session_id: str, user: CurrentUser = Depends(get_current_user)
):
    """Delete chat session nếu session thuộc owner hiện tại."""
    _validate_session_access(await get_chat_session(session_id), user)
    deleted = await delete_chat_session_document(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy session")

    return {"success": True, "message": f"Session {session_id} deleted"}


# ===== FEEDBACK ENDPOINTS =====


@router.post(
    "/feedback",
    response_model=FeedbackResponse,
    summary="Gửi feedback cho tin nhắn AI",
)
async def submit_feedback(
    request: FeedbackRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """
    Gửi feedback (thumbs_up / thumbs_down / report / confirmed / vet_confirmed)
    cho một tin nhắn AI cụ thể.

    - Positive feedback sẽ tự động embed vào Case Memory để cải thiện AI.
    - Feedback được auto-classify category dựa trên react_trace.
    - Weight tính theo role: VET/STAFF = 1.0, CLINIC_MANAGER/OWNER = 0.7,
      PET_OWNER = 0.6, ADMIN = 0.0 (playground only).
    """
    from app.core.services.feedback_service import get_feedback_service

    feedback_data = {
        "message_id": request.message_id,
        "session_id": request.session_id,
        "user_id": user.user_id,
        "user_role": user.role,
        "feedback_type": request.feedback_type.value,
        "feedback_reason": request.feedback_reason.value
        if request.feedback_reason
        else "",
        "feedback_text": request.feedback_text or "",
    }

    # Allow explicit category override, otherwise auto-classify
    if request.feedback_category:
        feedback_data["feedback_category"] = request.feedback_category.value

    service = get_feedback_service()
    result = await service.save_feedback(feedback_data)

    if result.get("status") == "error":
        raise HTTPException(
            status_code=500,
            detail=f"Không thể lưu feedback: {result.get('error', 'Unknown error')}",
        )

    return FeedbackResponse(
        success=True,
        feedback_id=result["feedback_id"],
        case_embedded=result.get("case_embedded", False),
        category=result.get("category", "general"),
        weight=result.get("weight", 0.0),
        message="Đã lưu feedback thành công",
    )


@router.get(
    "/feedback/stats",
    response_model=FeedbackStatsResponse,
    summary="Thống kê feedback",
)
async def get_feedback_stats(
    days: int = Query(default=30, ge=1, le=365, description="Số ngày thống kê"),
    user: CurrentUser = Depends(get_current_user),
):
    """
    Lấy thống kê feedback tổng hợp.

    - Admin: xem tất cả feedback.
    - Các role khác: chỉ xem feedback của chính mình.
    """
    from app.core.services.feedback_service import get_feedback_service

    service = get_feedback_service()

    # Admin sees all, others see only their own
    target_user_id = None if user.is_admin else user.user_id

    stats = await service.get_feedback_stats(user_id=target_user_id, days=days)

    return FeedbackStatsResponse(
        total=stats.get("total", 0),
        period_days=stats.get("period_days", days),
        by_type=stats.get("by_type", {}),
        by_category=stats.get("by_category", {}),
        positive_rate=stats.get("positive_rate", 0.0),
    )


@router.get(
    "/feedback/list",
    response_model=FeedbackListResponse,
    summary="Danh sách feedback chi tiết",
)
async def list_feedback(
    page: int = Query(default=1, ge=1, description="Số trang (bắt đầu từ 1)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Số lượng mỗi trang"),
    feedback_type: Optional[str] = Query(
        default=None,
        description="Lọc theo loại: thumbs_up, thumbs_down, report, confirmed, vet_confirmed",
    ),
    feedback_category: Optional[str] = Query(
        default=None,
        description="Lọc theo danh mục: medical, booking, clinic_ops, knowledge, general",
    ),
    user_role: Optional[str] = Query(
        default=None,
        description="Lọc theo role: PET_OWNER, STAFF, CLINIC_MANAGER, CLINIC_OWNER, ADMIN",
    ),
    date_from: Optional[str] = Query(
        default=None, description="Lọc từ ngày (YYYY-MM-DD)"
    ),
    date_to: Optional[str] = Query(
        default=None, description="Lọc đến ngày (YYYY-MM-DD)"
    ),
    user: CurrentUser = Depends(get_current_user),
):
    """
    Lấy danh sách feedback chi tiết với bộ lọc và phân trang.

    Chỉ ADMIN mới có quyền truy cập endpoint này.
    """
    if not user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Chỉ admin mới được xem danh sách feedback chi tiết",
        )

    from app.core.services.feedback_service import get_feedback_service

    service = get_feedback_service()
    result = await service.list_feedback(
        page=page,
        page_size=page_size,
        feedback_type=feedback_type,
        feedback_category=feedback_category,
        user_role=user_role,
        date_from=date_from,
        date_to=date_to,
    )

    return FeedbackListResponse(
        total=result.get("total", 0),
        page=result.get("page", page),
        page_size=result.get("page_size", page_size),
        items=[FeedbackItem(**item) for item in result.get("items", [])],
    )


@router.put(
    "/feedback/{feedback_id}",
    response_model=FeedbackResponse,
    summary="Sửa feedback đã gửi",
)
async def update_feedback(
    feedback_id: str,
    request: UpdateFeedbackRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """
    Sửa feedback đã gửi trước đó.

    - Chỉ chính người gửi hoặc ADMIN mới được sửa.
    - Nếu đổi từ positive → negative: case đã embed sẽ bị xóa khỏi Qdrant.
    - Nếu đổi từ negative → positive: case mới sẽ được embed.
    """
    from app.core.services.feedback_service import get_feedback_service

    update_data = {}
    if request.feedback_type is not None:
        update_data["feedback_type"] = request.feedback_type.value
    if request.feedback_category is not None:
        update_data["feedback_category"] = request.feedback_category.value
    if request.feedback_reason is not None:
        update_data["feedback_reason"] = request.feedback_reason.value
    if request.feedback_text is not None:
        update_data["feedback_text"] = request.feedback_text

    if not update_data:
        raise HTTPException(status_code=400, detail="Không có trường nào để cập nhật")

    service = get_feedback_service()
    result = await service.update_feedback(
        feedback_id=feedback_id,
        update_data=update_data,
        user_id=user.user_id,
        is_admin=user.is_admin,
    )

    if result.get("status") == "error":
        status_code = 404 if "không tìm thấy" in result["error"].lower() else 403
        raise HTTPException(status_code=status_code, detail=result["error"])

    return FeedbackResponse(
        status="updated",
        feedback_id=feedback_id,
        case_embedded=result.get("case_embedded", False),
        category=result.get("category", ""),
        weight=result.get("weight", 0.0),
    )


@router.delete(
    "/feedback/{feedback_id}",
    response_model=DeleteFeedbackResponse,
    summary="Xóa feedback đã gửi",
)
async def delete_feedback(
    feedback_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """
    Xóa feedback đã gửi trước đó.

    - Chỉ chính người gửi hoặc ADMIN mới được xóa.
    - Nếu feedback đã embed case vào Qdrant, case đó cũng sẽ bị xóa.
    """
    from app.core.services.feedback_service import get_feedback_service

    service = get_feedback_service()
    result = await service.delete_feedback(
        feedback_id=feedback_id,
        user_id=user.user_id,
        is_admin=user.is_admin,
    )

    if result.get("status") == "error":
        status_code = 404 if "không tìm thấy" in result["error"].lower() else 403
        raise HTTPException(status_code=status_code, detail=result["error"])

    return DeleteFeedbackResponse(
        success=True,
        feedback_id=feedback_id,
        case_deleted=result.get("case_deleted", False),
        message="Đã xóa feedback thành công",
    )
