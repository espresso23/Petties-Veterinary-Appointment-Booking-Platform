"""
PETTIES AGENT SERVICE - Rate Limiter

Rate limiting for WebSocket chat endpoints using token bucket algorithm.
Protects against abuse and ensures fair resource usage.

Package: app.core.middleware
Version: v1.0.0

Usage:
    limiter = RateLimiter(
        requests_per_minute=30,
        tokens_per_minute=10000,  # For token-based limiting
    )

    if not limiter.check(user_id):
        raise WebSocketRateLimitError()
"""

from __future__ import annotations

import time
import asyncio
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, Optional, Tuple



@dataclass
class RateLimitResult:
    """Result of rate limit check."""

    allowed: bool
    remaining_requests: int
    remaining_tokens: int
    reset_in_seconds: float
    retry_after_seconds: Optional[float] = None


class TokenBucket:
    """
    Token bucket algorithm for rate limiting.

    Refill strategy:
    - Add `refill_rate` tokens per second
    - Burst capacity: `max_tokens`
    """

    def __init__(
        self,
        max_tokens: int,
        refill_rate: float,
        initial_tokens: Optional[float] = None,
    ):
        """
        Initialize token bucket.

        Args:
            max_tokens: Maximum tokens (burst capacity)
            refill_rate: Tokens added per second
            initial_tokens: Starting tokens (defaults to max_tokens)
        """
        self.max_tokens = float(max_tokens)
        self.refill_rate = float(refill_rate)
        self.tokens = (
            initial_tokens if initial_tokens is not None else float(max_tokens)
        )
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    def _refill(self) -> None:
        """Refill tokens based on elapsed time."""
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.max_tokens, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

    async def consume(self, tokens: int = 1) -> bool:
        """
        Try to consume tokens.

        Args:
            tokens: Number of tokens to consume

        Returns:
            True if tokens were consumed, False if not enough tokens
        """
        async with self._lock:
            self._refill()
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False

    def available_tokens(self) -> float:
        """Get available tokens without consuming."""
        self._refill()
        return self.tokens

    def time_until_tokens(self, tokens: int = 1) -> float:
        """Calculate seconds until enough tokens available."""
        if self.tokens >= tokens:
            return 0.0
        needed = tokens - self.tokens
        return needed / self.refill_rate


class SlidingWindowCounter:
    """
    Sliding window counter for request-based rate limiting.

    More accurate than fixed window, less memory than full sliding window.
    """

    def __init__(
        self,
        max_requests: int,
        window_seconds: int = 60,
    ):
        """
        Initialize sliding window counter.

        Args:
            max_requests: Maximum requests per window
            window_seconds: Window size in seconds
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, list] = defaultdict(list)
        self._lock = asyncio.Lock()

    def _clean_old_requests(self, key: str, now: float) -> None:
        """Remove requests outside the window."""
        cutoff = now - self.window_seconds
        self.requests[key] = [ts for ts in self.requests[key] if ts > cutoff]

    async def check(self, key: str) -> Tuple[bool, int, float]:
        """
        Check if request is allowed.

        Args:
            key: Identifier (user_id, session_id, IP, etc.)

        Returns:
            Tuple of (allowed, remaining_requests, retry_after_seconds)
        """
        async with self._lock:
            now = time.monotonic()
            self._clean_old_requests(key, now)

            if len(self.requests[key]) < self.max_requests:
                self.requests[key].append(now)
                remaining = self.max_requests - len(self.requests[key])
                return True, remaining, 0.0
            else:
                oldest = min(self.requests[key])
                retry_after = self.window_seconds - (now - oldest)
                return False, 0, max(0.0, retry_after)

    async def get_remaining(self, key: str) -> int:
        """Get remaining requests without counting."""
        async with self._lock:
            now = time.monotonic()
            self._clean_old_requests(key, now)
            return max(0, self.max_requests - len(self.requests[key]))


class RateLimiter:
    """
    Combined rate limiter using both token bucket and sliding window.

    Supports:
    - Request-based limiting (per user/session)
    - Token-based limiting (for LLM token budget)
    - IP-based limiting (for anonymous access)
    """

    def __init__(
        self,
        requests_per_minute: int = 30,
        tokens_per_minute: int = 10000,
        burst_per_minute: int = 10,
        session_requests_per_hour: int = 200,
    ):
        """
        Initialize rate limiter.

        Args:
            requests_per_minute: Max requests per minute per user
            tokens_per_minute: Max tokens per minute (for LLM budget)
            burst_per_minute: Burst capacity per minute
            session_requests_per_hour: Max requests per session per hour
        """
        # Request limiting: requests per minute
        self.request_limiter = SlidingWindowCounter(
            max_requests=requests_per_minute,
            window_seconds=60,
        )

        # Token limiting: tokens per minute (refill rate)
        self.token_bucket = TokenBucket(
            max_tokens=tokens_per_minute,
            refill_rate=tokens_per_minute / 60.0,  # tokens per second
        )

        # Burst limiting: sliding window for burst
        self.burst_limiter = SlidingWindowCounter(
            max_requests=burst_per_minute,
            window_seconds=60,
        )

        # Session limiting: requests per hour
        self.session_limiter = SlidingWindowCounter(
            max_requests=session_requests_per_hour,
            window_seconds=3600,
        )

        self._enabled = True

    def disable(self) -> None:
        """Disable rate limiting (for testing)."""
        self._enabled = False

    def enable(self) -> None:
        """Enable rate limiting."""
        self._enabled = True

    async def check_request(self, user_id: str, session_id: str) -> RateLimitResult:
        """
        Check if request is allowed for user/session.

        Args:
            user_id: User identifier
            session_id: Session identifier

        Returns:
            RateLimitResult with allow/deny decision
        """
        if not self._enabled:
            return RateLimitResult(
                allowed=True,
                remaining_requests=9999,
                remaining_tokens=999999,
                reset_in_seconds=0.0,
            )

        # Check request limit
        allowed, remaining, retry_after = await self.request_limiter.check(user_id)
        if not allowed:
            return RateLimitResult(
                allowed=False,
                remaining_requests=0,
                remaining_tokens=0,
                reset_in_seconds=retry_after,
                retry_after_seconds=retry_after,
            )

        # Check session limit
        session_allowed, _, session_retry = await self.session_limiter.check(session_id)
        if not session_allowed:
            return RateLimitResult(
                allowed=False,
                remaining_requests=remaining,
                remaining_tokens=0,
                reset_in_seconds=session_retry,
                retry_after_seconds=session_retry,
            )

        # Check burst limit
        burst_key = f"{user_id}:burst"
        burst_allowed, burst_remaining, burst_retry = await self.burst_limiter.check(
            burst_key
        )
        if not burst_allowed:
            return RateLimitResult(
                allowed=False,
                remaining_requests=remaining,
                remaining_tokens=0,
                reset_in_seconds=burst_retry,
                retry_after_seconds=burst_retry,
            )

        # Check token budget
        available_tokens = self.token_bucket.available_tokens()

        return RateLimitResult(
            allowed=True,
            remaining_requests=min(remaining, burst_remaining),
            remaining_tokens=int(available_tokens),
            reset_in_seconds=60.0,
        )

    async def check_tokens(self, tokens: int) -> Tuple[bool, float]:
        """
        Check if token budget is available.

        Args:
            tokens: Number of tokens needed

        Returns:
            Tuple of (allowed, retry_after_seconds)
        """
        if not self._enabled:
            return True, 0.0

        allowed = await self.token_bucket.consume(tokens)
        if allowed:
            return True, 0.0

        retry_after = self.token_bucket.time_until_tokens(tokens)
        return False, retry_after

    async def get_user_stats(self, user_id: str) -> Dict[str, int]:
        """Get rate limit stats for user."""
        return {
            "remaining_requests": await self.request_limiter.get_remaining(user_id),
            "available_tokens": int(self.token_bucket.available_tokens()),
        }


# ============================================================================
# MIDDLEWARE INTEGRATION
# ============================================================================


class RateLimitMiddleware:
    """
    FastAPI/Starlette middleware for rate limiting.

    Usage in FastAPI:
        limiter = RateLimiter()
        app.middleware("http")(lambda req, call_next: limiter.middleware(req, call_next))
    """

    def __init__(
        self,
        limiter: RateLimiter,
        identifier_func: Optional[callable] = None,
    ):
        """
        Initialize middleware.

        Args:
            limiter: RateLimiter instance
            identifier_func: Function to extract identifier from request
        """
        self.limiter = limiter
        self.identifier_func = identifier_func or self._default_identifier

    def _default_identifier(self, request) -> str:
        """Default identifier: IP address."""
        if hasattr(request, "client"):
            return request.client.host or "unknown"
        return "unknown"

    async def __call__(self, request, call_next):
        """Middleware handler."""
        path = request.url.path if hasattr(request, "url") else ""
        if request.method in ("OPTIONS", "HEAD"):
            return await call_next(request)

        if path in ("/", "/health", "/metrics") or path.startswith(
            ("/docs", "/redoc", "/openapi")
        ):
            return await call_next(request)

        user_id = self.identifier_func(request)
        session_id = getattr(request, "session_id", user_id)

        result = await self.limiter.check_request(user_id, session_id)

        if not result.allowed:
            from fastapi.responses import JSONResponse

            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too many requests",
                    "retry_after": result.retry_after_seconds,
                    "remaining_requests": 0,
                },
                headers={
                    "Retry-After": str(int(result.retry_after_seconds or 60)),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(result.reset_in_seconds)),
                },
            )

        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Remaining"] = str(result.remaining_requests)
        response.headers["X-RateLimit-Reset"] = str(int(result.reset_in_seconds))

        return response


# ============================================================================
# GLOBAL INSTANCE
# ============================================================================

_rate_limiter: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    """Get singleton rate limiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        from app.config.settings import settings

        _rate_limiter = RateLimiter(
            requests_per_minute=settings.RATE_LIMIT_REQUESTS_PER_MINUTE,
            burst_per_minute=settings.RATE_LIMIT_BURST_PER_MINUTE,
            session_requests_per_hour=settings.RATE_LIMIT_SESSION_REQUESTS_PER_HOUR,
        )
        if not settings.RATE_LIMIT_ENABLED:
            _rate_limiter.disable()
    return _rate_limiter


def reset_rate_limiter() -> None:
    """Reset singleton (for testing)."""
    global _rate_limiter
    _rate_limiter = None
