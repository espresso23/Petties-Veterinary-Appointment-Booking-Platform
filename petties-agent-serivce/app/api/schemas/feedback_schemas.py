"""
PETTIES AI SERVICE - Feedback API Schemas

Pydantic models for feedback endpoints:
    - POST /chat/feedback  -> FeedbackRequest / FeedbackResponse
    - GET  /chat/feedback/stats -> FeedbackStatsResponse

Package: app.api.schemas
Purpose: Request/response validation for feedback API
Version: v1.0.0
"""

from enum import Enum
from typing import Dict, Optional

from pydantic import BaseModel, Field


# ============================================================
# ENUMS
# ============================================================


class FeedbackType(str, Enum):
    """Loại feedback người dùng gửi."""

    THUMBS_UP = "thumbs_up"
    THUMBS_DOWN = "thumbs_down"
    REPORT = "report"
    CONFIRMED = "confirmed"  # Staff/Vet xác nhận rõ ràng
    VET_CONFIRMED = "vet_confirmed"  # Bác sĩ thú y xác nhận chẩn đoán


class FeedbackCategory(str, Enum):
    """Danh mục tương tác AI được đánh giá."""

    MEDICAL = "medical"
    BOOKING = "booking"
    CLINIC_OPS = "clinic_ops"
    KNOWLEDGE = "knowledge"
    GENERAL = "general"


class FeedbackReason(str, Enum):
    """Lý do cho negative feedback hoặc report."""

    INCORRECT_INFO = "incorrect_info"
    UNHELPFUL = "unhelpful"
    OFFENSIVE = "offensive"
    WRONG_TOOL = "wrong_tool"
    SLOW_RESPONSE = "slow_response"
    OTHER = "other"


# ============================================================
# REQUEST SCHEMAS
# ============================================================


class FeedbackRequest(BaseModel):
    """Request body cho POST /chat/feedback."""

    message_id: str = Field(
        ...,
        description="UUID của tin nhắn AI được đánh giá",
        examples=["550e8400-e29b-41d4-a716-446655440000"],
    )
    session_id: str = Field(
        ...,
        description="UUID của phiên chat",
        examples=["660e8400-e29b-41d4-a716-446655440001"],
    )
    feedback_type: FeedbackType = Field(
        default=FeedbackType.THUMBS_UP,
        description="Loại feedback: thumbs_up, thumbs_down, report, confirmed, vet_confirmed",
    )
    feedback_category: Optional[FeedbackCategory] = Field(
        default=None,
        description="Phân loại tương tác (tự phân loại nếu không gửi). "
        "medical | booking | clinic_ops | knowledge | general",
    )
    feedback_reason: Optional[FeedbackReason] = Field(
        default=None,
        description="Lý do negative feedback (chỉ cần khi thumbs_down hoặc report)",
    )
    feedback_text: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Nội dung góp ý chi tiết (tùy chọn)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "message_id": "550e8400-e29b-41d4-a716-446655440000",
                    "session_id": "660e8400-e29b-41d4-a716-446655440001",
                    "feedback_type": "thumbs_up",
                    "feedback_category": "medical",
                    "feedback_text": "AI trả lời chính xác về triệu chứng rận tai",
                }
            ]
        }
    }


# ============================================================
# RESPONSE SCHEMAS
# ============================================================


class FeedbackResponse(BaseModel):
    """Response cho POST /chat/feedback."""

    status: str = Field(description="saved | error")
    feedback_id: Optional[str] = Field(
        default=None, description="UUID của feedback vừa lưu"
    )
    case_embedded: bool = Field(
        default=False,
        description="True nếu feedback positive đã được embed vào Case Memory",
    )
    category: str = Field(
        default="general",
        description="Category đã được phân loại (tự động hoặc thủ công)",
    )
    weight: float = Field(
        default=0.0,
        description="Trọng số feedback dựa trên role của người dùng",
    )
    error: Optional[str] = Field(default=None, description="Thông báo lỗi nếu có")


class FeedbackStatsResponse(BaseModel):
    """Response cho GET /chat/feedback/stats."""

    total: int = Field(description="Tổng số feedback trong kỳ")
    period_days: int = Field(default=30, description="Số ngày lookback")
    by_type: Dict[str, int] = Field(
        default_factory=dict,
        description="Số lượng theo feedback_type (thumbs_up, thumbs_down, ...)",
    )
    by_category: Dict[str, int] = Field(
        default_factory=dict,
        description="Số lượng theo category (medical, booking, ...)",
    )
    positive_rate: float = Field(
        default=0.0,
        description="Tỷ lệ feedback positive (0.0 - 1.0)",
    )
    error: Optional[str] = Field(default=None)


__all__ = [
    "FeedbackType",
    "FeedbackCategory",
    "FeedbackReason",
    "FeedbackRequest",
    "FeedbackResponse",
    "FeedbackStatsResponse",
]
