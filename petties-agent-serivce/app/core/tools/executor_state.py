"""
PETTIES AGENT SERVICE - Executor State

Thread-safe state management for tool execution context.
Tracks dropped parameters across async calls.

Package: app.core.tools
Version: v1.0.0
"""

from contextvars import ContextVar
from typing import Any, Dict, Optional


_dropped_params_var: ContextVar[Dict[str, Any]] = ContextVar(
    "dropped_params",
    default=None,
)


class ExecutorState:
    """
    Thread-safe state for executor.

    Tracks:
    - dropped_params: Parameters that were filtered out due to schema mismatch
    """

    def set_dropped_params(self, params: Dict[str, Any]) -> None:
        """Store dropped parameters for this execution context."""
        _dropped_params_var.set(params)

    def get_dropped_params(self) -> Dict[str, Any]:
        """Get dropped parameters if any."""
        return _dropped_params_var.get() or {}

    def clear_dropped_params(self) -> None:
        """Clear dropped parameters after use."""
        _dropped_params_var.set(None)


# Global singleton instance
_executor_state: Optional[ExecutorState] = None


def get_executor_state() -> ExecutorState:
    """Get singleton ExecutorState instance."""
    global _executor_state
    if _executor_state is None:
        _executor_state = ExecutorState()
    return _executor_state


def set_dropped_params(params: Dict[str, Any]) -> None:
    """Convenience function to set dropped params."""
    get_executor_state().set_dropped_params(params)


def get_dropped_params() -> Dict[str, Any]:
    """Convenience function to get dropped params."""
    return get_executor_state().get_dropped_params()


def clear_dropped_params() -> None:
    """Convenience function to clear dropped params."""
    get_executor_state().clear_dropped_params()
