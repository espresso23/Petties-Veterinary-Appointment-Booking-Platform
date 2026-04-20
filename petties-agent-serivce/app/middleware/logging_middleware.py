"""
PETTIES AI SERVICE - Logging Middleware
Middleware for request/response logging with correlation ID

Package: app.middleware
Purpose: Centralized request/response logging với request ID tracking
Version: v1.0.0
"""

import logging
import time
import uuid
import re
import json
from typing import Callable
from jose import jwt, JWTError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.config.settings import settings
from app.services.audit_log_service import get_audit_log_service

logger = logging.getLogger(__name__)

SENSITIVE_HEADERS = {
    "authorization",
    "cookie",
    "x-api-key",
    "x-auth-token",
    "x-csrf-token",
    "x-request-token",
}

SENSITIVE_PARAMS = {
    "password",
    "token",
    "secret",
    "api_key",
    "apikey",
    "api-key",
    "credential",
}

EXCLUDE_PATHS = {
    "/health",
    "/",
    "/docs",
    "/redoc",
    "/openapi.json",
}


class LoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:8]
        trace_id = self._resolve_trace_id(request, request_id)

        start_time = time.time()

        client_ip = self._get_client_ip(request)
        method = request.method
        path = request.url.path
        query_params = dict(request.query_params)
        should_skip = path in EXCLUDE_PATHS

        masked_query = self._mask_sensitive_params(query_params)

        user_agent = request.headers.get("user-agent", "unknown")
        content_type = request.headers.get("content-type", "")

        request_context = {
            "service": settings.APP_NAME,
            "environment": settings.APP_ENV,
            "request_id": request_id,
            "trace_id": trace_id,
            "method": method,
            "path": path,
            "client_ip": client_ip,
            "query": json.dumps(masked_query, ensure_ascii=False),
            "content_type": content_type.split(";")[0],
            "user_agent": user_agent,
        }
        actor_context = self._build_actor_context(request, client_ip=client_ip)

        if not should_skip:
            logger.info("Incoming request", extra={**request_context, "event": "http_request"})

        try:
            response = await call_next(request)

            duration_ms = (time.time() - start_time) * 1000
            status_code = response.status_code

            response.headers["X-Request-ID"] = request_id

            if not should_skip:
                response_context = {
                    **request_context,
                    "event": "http_response",
                    "status_code": status_code,
                    "latency_ms": round(duration_ms, 2),
                }

                if status_code >= 500:
                    logger.error("Request completed with server error", extra=response_context)
                elif status_code >= 400:
                    logger.warning("Request completed with client error", extra=response_context)
                else:
                    logger.info("Request completed", extra=response_context)

                await self._write_audit_event(
                    actor_context=actor_context,
                    request_context=request_context,
                    status_code=status_code,
                    latency_ms=round(duration_ms, 2),
                    error_reason=None,
                )

            return response

        except Exception as exc:
            duration_ms = (time.time() - start_time) * 1000
            logger.exception(
                "Request failed with exception",
                extra={
                    **request_context,
                    "event": "http_exception",
                    "status_code": 500,
                    "latency_ms": round(duration_ms, 2),
                    "error_code": type(exc).__name__,
                },
            )

            if not should_skip:
                await self._write_audit_event(
                    actor_context=actor_context,
                    request_context=request_context,
                    status_code=500,
                    latency_ms=round(duration_ms, 2),
                    error_reason=f"{type(exc).__name__}: {exc}",
                )
            raise

    async def _write_audit_event(
        self,
        *,
        actor_context: dict,
        request_context: dict,
        status_code: int,
        latency_ms: float,
        error_reason: str | None,
    ) -> None:
        try:
            audit_service = get_audit_log_service()
            await audit_service.write_event(
                service=request_context.get("service", "ai-service"),
                environment=request_context.get("environment", "development"),
                actor=actor_context,
                action=f"API_{request_context.get('method', 'UNKNOWN')}",
                resource={
                    "type": "http_endpoint",
                    "id": request_context.get("path", ""),
                },
                result={
                    "status": self._map_result_status(status_code),
                    "reason": error_reason,
                },
                correlation={
                    "request_id": request_context.get("request_id"),
                    "trace_id": request_context.get("trace_id"),
                },
                metadata={
                    "method": request_context.get("method"),
                    "path": request_context.get("path"),
                    "status_code": status_code,
                    "latency_ms": latency_ms,
                    "query": request_context.get("query"),
                    "content_type": request_context.get("content_type"),
                },
            )
        except Exception as audit_err:
            logger.warning(f"Failed to write audit log: {audit_err}")

    def _map_result_status(self, status_code: int) -> str:
        if status_code >= 500:
            return "FAILED"
        if status_code >= 400:
            return "DENIED"
        return "SUCCESS"

    def _build_actor_context(self, request: Request, client_ip: str) -> dict:
        user_id = request.headers.get("x-user-id")
        role = request.headers.get("x-user-role") or request.headers.get("x-user-roles")
        auth_type = "gateway" if user_id else "anonymous"

        if not user_id:
            token = self._extract_bearer_token(request.headers.get("authorization", ""))
            if token:
                claims = self._decode_jwt_claims(token)
                if claims:
                    user_id = str(claims.get("userId") or claims.get("sub") or "anonymous")
                    claim_role = claims.get("role") or claims.get("roles")
                    if isinstance(claim_role, list):
                        claim_role = claim_role[0] if claim_role else "USER"
                    role = str(claim_role or role or "USER").replace("ROLE_", "").upper()
                    auth_type = "jwt"

        return {
            "user_id": user_id or "anonymous",
            "role": (role or "ANONYMOUS"),
            "auth_type": auth_type,
            "ip": client_ip,
            "user_agent": request.headers.get("user-agent", "unknown"),
        }

    def _extract_bearer_token(self, authorization_header: str) -> str | None:
        if not authorization_header:
            return None
        if not authorization_header.startswith("Bearer "):
            return None
        return authorization_header.replace("Bearer ", "", 1).strip() or None

    def _decode_jwt_claims(self, token: str) -> dict | None:
        try:
            return jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=["HS256", "HS384", "HS512"],
            )
        except JWTError:
            return None

    def _get_client_ip(self, request: Request) -> str:
        x_forwarded_for = request.headers.get("x-forwarded-for")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()

        x_real_ip = request.headers.get("x-real-ip")
        if x_real_ip:
            return x_real_ip

        if request.client:
            return request.client.host

        return "unknown"

    def _mask_sensitive_headers(self, headers: dict) -> dict:
        masked = {}
        for key, value in headers.items():
            lower_key = key.lower()
            if lower_key in SENSITIVE_HEADERS:
                if lower_key == "authorization":
                    if value.startswith("Bearer "):
                        masked[key] = "Bearer ***REDACTED***"
                    else:
                        masked[key] = "***REDACTED***"
                else:
                    masked[key] = "***REDACTED***"
            else:
                masked[key] = value
        return masked

    def _mask_sensitive_params(self, params: dict) -> dict:
        masked = {}
        for key, value in params.items():
            lower_key = key.lower()
            if lower_key in SENSITIVE_PARAMS or re.search(
                r"(password|token|secret|api[_-]?key|credential)", lower_key
            ):
                masked[key] = "***REDACTED***"
            else:
                masked[key] = value
        return masked

    def _resolve_trace_id(self, request: Request, fallback_request_id: str) -> str:
        traceparent = request.headers.get("traceparent")
        if traceparent:
            parts = traceparent.split("-")
            if len(parts) >= 4 and parts[1]:
                return parts[1]

        b3_trace_id = request.headers.get("x-b3-traceid")
        if b3_trace_id:
            return b3_trace_id

        return fallback_request_id


def get_request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "")


def add_request_context(request_id: str, **kwargs):
    context = {"request_id": request_id}
    context.update(kwargs)
    return context
