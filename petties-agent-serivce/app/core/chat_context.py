"""
PETTIES AGENT SERVICE - Chat Context Constants

Purpose:
    - Chuẩn hóa context type cho AI chat runtime
    - Tách business chat và admin playground
"""

from typing import Optional


BUSINESS_CHAT = "BUSINESS_CHAT"
PLAYGROUND_TEST = "PLAYGROUND_TEST"
VALID_CONTEXT_TYPES = {BUSINESS_CHAT, PLAYGROUND_TEST}


def normalize_context_type(value: Optional[str], default: str = BUSINESS_CHAT) -> str:
    """Normalize context type và validate value hợp lệ."""
    normalized = (value or default).strip().upper()
    if normalized not in VALID_CONTEXT_TYPES:
        raise ValueError(f"Unsupported context type: {value}")
    return normalized


def default_context_for_user(is_admin: bool) -> str:
    """Admin mặc định vào playground, user khác mặc định business chat."""
    return PLAYGROUND_TEST if is_admin else BUSINESS_CHAT


def is_playground_context(context_type: str) -> bool:
    return normalize_context_type(context_type) == PLAYGROUND_TEST