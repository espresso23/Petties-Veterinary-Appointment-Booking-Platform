"""Runtime context cho tool execution trong business chat.

AsyncContextManager pattern để đảm bảo thread-safety trong async environment.

Usage:
    async with ToolRuntimeContextManager(context):
        result = await execute_tool("get_user_pets", {})
        # context is available here
    # context is automatically cleared here
"""

from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from typing import Any, Dict, Generator, List, Optional, AsyncGenerator
from datetime import datetime, timedelta
from contextlib import asynccontextmanager


@dataclass
class ConditionalIntent:
    """Track 'nếu...thì...' conditional user intents for booking."""

    condition_type: str  # e.g., "slot_available", "clinic_confirmed"
    action: str  # e.g., "create_booking"
    condition_details: Dict[str, Any] = field(default_factory=dict)
    raw_text: str = ""  # Original user text
    timestamp: datetime = field(default_factory=datetime.now)
    auto_follow_up: bool = True  # Whether to auto-execute when condition met

    def is_expired(self, ttl_minutes: int = 10) -> bool:
        return datetime.now() - self.timestamp > timedelta(minutes=ttl_minutes)


@dataclass
class ToolRuntimeContext:
    """Runtime context data for tool execution."""

    user_id: str
    role: str
    auth_token: Optional[str] = None
    clinic_id: Optional[str] = None
    session_id: Optional[str] = None
    context_type: Optional[str] = None
    booking_state: Optional[Dict[str, Any]] = None


@dataclass
class CachedClinicResolution:
    """Cached clinic resolution with TTL."""

    clinic_hint: str
    resolved_clinic_id: str
    resolved_clinic: Optional[Dict] = None
    clinic_options: List[Dict] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.now)

    def is_expired(self, ttl_minutes: int = 5) -> bool:
        return datetime.now() - self.timestamp > timedelta(minutes=ttl_minutes)


@dataclass
class BookingContextCache:
    """Cache for booking-related context."""

    clinic_resolution: Optional[CachedClinicResolution] = None
    conditional_intent: Optional[ConditionalIntent] = None

    def cache_clinic_resolution(
        self,
        clinic_hint: str,
        resolved_clinic_id: str,
        resolved_clinic: Optional[Dict] = None,
        clinic_options: List[Dict] = None,
    ) -> None:
        self.clinic_resolution = CachedClinicResolution(
            clinic_hint=clinic_hint,
            resolved_clinic_id=resolved_clinic_id,
            resolved_clinic=resolved_clinic,
            clinic_options=clinic_options or [],
        )

    def get_clinic_resolution(
        self, clinic_hint: str
    ) -> Optional[CachedClinicResolution]:
        if self.clinic_resolution is None:
            return None
        if self.clinic_resolution.clinic_hint != clinic_hint:
            return None
        if self.clinic_resolution.is_expired():
            self.clinic_resolution = None
            return None
        return self.clinic_resolution

    def set_conditional_intent(self, intent: ConditionalIntent) -> None:
        """Store a conditional intent from user message."""
        self.conditional_intent = intent

    def get_conditional_intent(self) -> Optional[ConditionalIntent]:
        """Get active conditional intent if not expired."""
        if self.conditional_intent is None:
            return None
        if self.conditional_intent.is_expired():
            self.conditional_intent = None
            return None
        return self.conditional_intent

    def clear_conditional_intent(self) -> None:
        """Clear the conditional intent after it's been fulfilled or cancelled."""
        self.conditional_intent = None

    def clear(self) -> None:
        self.clinic_resolution = None
        self.conditional_intent = None


# ============================================================================
# CONTEXT VARIABLES
# ============================================================================

_tool_runtime_context_var: ContextVar[Optional[ToolRuntimeContext]] = ContextVar(
    "tool_runtime_context",
    default=None,
)

_booking_context_cache_var: ContextVar[BookingContextCache] = ContextVar(
    "booking_context_cache",
    default=None,
)


# ============================================================================
# CONTEXT MANAGER CLASS
# ============================================================================


class ToolRuntimeContextManager:
    """
    Async context manager for tool runtime context.

    Usage:
        async with ToolRuntimeContextManager(context) as ctx:
            result = await execute_tool("get_user_pets", {})
        # Context is automatically cleared

    Or using generator style:
        async with tool_runtime_context(context):
            # use context
    """

    __slots__ = ("_context", "_token")

    def __init__(self, context: ToolRuntimeContext):
        self._context: ToolRuntimeContext = context
        self._token: Optional[Token] = None

    async def __aenter__(self) -> ToolRuntimeContext:
        """Set context and return it."""
        self._token = _tool_runtime_context_var.set(self._context)
        return self._context

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Clear context on exit."""
        if self._token is not None:
            _tool_runtime_context_var.reset(self._token)


@asynccontextmanager
async def tool_runtime_context(
    context: ToolRuntimeContext,
) -> AsyncGenerator[ToolRuntimeContext, None]:
    """
    Async context manager for tool runtime context.

    Usage:
        async with tool_runtime_context(context) as ctx:
            result = await execute_tool("get_user_pets", {})
    """
    token = _tool_runtime_context_var.set(context)
    try:
        yield context
    finally:
        _tool_runtime_context_var.reset(token)


# ============================================================================
# LEGACY FUNCTIONS (with deprecation warnings)
# ============================================================================


def set_tool_runtime_context(context: ToolRuntimeContext) -> Token:
    """Set tool runtime context (legacy function)."""
    return _tool_runtime_context_var.set(context)


def reset_tool_runtime_context(token: Token) -> None:
    """Reset tool runtime context (legacy function)."""
    _tool_runtime_context_var.reset(token)


def get_tool_runtime_context() -> Optional[ToolRuntimeContext]:
    """Get current tool runtime context."""
    return _tool_runtime_context_var.get()


def require_tool_runtime_context() -> ToolRuntimeContext:
    """Get current context or raise if not set."""
    context = get_tool_runtime_context()
    if context is None:
        raise RuntimeError("Khong tim thay runtime context cho tool execution")
    return context


def get_booking_context_cache() -> BookingContextCache:
    """Get or create booking context cache."""
    cache = _booking_context_cache_var.get()
    if cache is None:
        cache = BookingContextCache()
        _booking_context_cache_var.set(cache)
    return cache


# ============================================================================
# ASYNC CONTEXT MANAGER FOR BOOKING CACHE
# ============================================================================


class BookingContextManager:
    """
    Async context manager for booking context cache.

    Usage:
        async with BookingContextManager() as cache:
            cache.cache_clinic_resolution(...)
    """

    __slots__ = ("_cache", "_token")

    def __init__(self):
        self._cache: Optional[BookingContextCache] = None
        self._token: Optional[Token] = None

    async def __aenter__(self) -> BookingContextCache:
        """Create and set cache."""
        self._cache = BookingContextCache()
        self._token = _booking_context_cache_var.set(self._cache)
        return self._cache

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Clear cache on exit."""
        if self._token is not None:
            _booking_context_cache_var.reset(self._token)


@asynccontextmanager
async def booking_context() -> AsyncGenerator[BookingContextCache, None]:
    """
    Async context manager for booking context cache.

    Usage:
        async with booking_context() as cache:
            cache.cache_clinic_resolution(...)
    """
    cache = BookingContextCache()
    token = _booking_context_cache_var.set(cache)
    try:
        yield cache
    finally:
        _booking_context_cache_var.reset(token)


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================


def clear_all_context() -> None:
    """Clear all runtime contexts (for testing/cleanup)."""
    _tool_runtime_context_var.set(None)
    _booking_context_cache_var.set(None)


def get_current_user_id() -> Optional[str]:
    """Get current user ID from context."""
    ctx = get_tool_runtime_context()
    return ctx.user_id if ctx else None


def get_current_role() -> Optional[str]:
    """Get current role from context."""
    ctx = get_tool_runtime_context()
    return ctx.role if ctx else None


def get_current_clinic_id() -> Optional[str]:
    """Get current clinic ID from context."""
    ctx = get_tool_runtime_context()
    return ctx.clinic_id if ctx else None
