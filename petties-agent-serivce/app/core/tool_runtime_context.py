"""Runtime context cho tool execution trong business chat."""

from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass
from typing import Optional


@dataclass
class ToolRuntimeContext:
    user_id: str
    role: str
    auth_token: Optional[str] = None
    clinic_id: Optional[str] = None
    session_id: Optional[str] = None
    context_type: Optional[str] = None


_tool_runtime_context: ContextVar[Optional[ToolRuntimeContext]] = ContextVar(
    "tool_runtime_context",
    default=None,
)


def set_tool_runtime_context(context: ToolRuntimeContext) -> Token:
    return _tool_runtime_context.set(context)


def reset_tool_runtime_context(token: Token) -> None:
    _tool_runtime_context.reset(token)


def get_tool_runtime_context() -> Optional[ToolRuntimeContext]:
    return _tool_runtime_context.get()


def require_tool_runtime_context() -> ToolRuntimeContext:
    context = get_tool_runtime_context()
    if context is None:
        raise RuntimeError("Không tìm thấy runtime context cho tool execution")
    return context