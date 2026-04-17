from __future__ import annotations

from typing import Optional
from app.core.tool_runtime_context import require_tool_runtime_context, get_tool_runtime_context


class AuthenticationRequiredError(RuntimeError):
    """Exception raised when an authenticated user is required."""
    pass


def _require_auth_token() -> str:
    """Yêu cầu JWT token - raise exception nếu không có token."""
    context = require_tool_runtime_context()
    if not context.auth_token:
        raise AuthenticationRequiredError(
            "Yeu cau dang nhap de su dung chuc nang nay. Vui long dang nhap truoc."
        )
    return context.auth_token


def _get_optional_auth_token() -> Optional[str]:
    """Lấy JWT token nếu có - không raise nếu không có."""
    context = get_tool_runtime_context()
    return context.auth_token if context else None
