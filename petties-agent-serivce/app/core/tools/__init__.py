"""
PETTIES AGENT SERVICE - Tools Package
FastMCP Code-based Tools System

Package: app.core.tools
Purpose: Agent tools registry and execution
Version: v1.0.0 - RAG-only tools
"""

from app.core.tools.scanner import ToolScanner, tool_scanner
from app.core.tools.executor import ToolExecutor, tool_executor
from app.core.tools.executor_state import (
    ExecutorState,
    get_executor_state,
    set_dropped_params,
    get_dropped_params,
    clear_dropped_params,
)

__all__ = [
    "ToolScanner",
    "tool_scanner",
    "ToolExecutor",
    "tool_executor",
    "ExecutorState",
    "get_executor_state",
    "set_dropped_params",
    "get_dropped_params",
    "clear_dropped_params",
]
