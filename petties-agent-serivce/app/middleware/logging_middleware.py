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
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

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

        start_time = time.time()

        client_ip = self._get_client_ip(request)
        method = request.method
        path = request.url.path
        query_params = dict(request.query_params)

        masked_query = self._mask_sensitive_params(query_params)

        user_agent = request.headers.get("user-agent", "unknown")
        content_type = request.headers.get("content-type", "")

        logger.info(
            f"[{request_id}] --> {method} {path} | "
            f"IP: {client_ip} | "
            f"Query: {masked_query} | "
            f"Type: {content_type.split(';')[0]}"
        )

        try:
            response = await call_next(request)

            duration_ms = (time.time() - start_time) * 1000
            status_code = response.status_code

            response.headers["X-Request-ID"] = request_id

            if status_code >= 500:
                logger.error(
                    f"[{request_id}] <-- {method} {path} | "
                    f"Status: {status_code} | "
                    f"Duration: {duration_ms:.2f}ms"
                )
            elif status_code >= 400:
                logger.warning(
                    f"[{request_id}] <-- {method} {path} | "
                    f"Status: {status_code} | "
                    f"Duration: {duration_ms:.2f}ms"
                )
            else:
                logger.info(
                    f"[{request_id}] <-- {method} {path} | "
                    f"Status: {status_code} | "
                    f"Duration: {duration_ms:.2f}ms"
                )

            return response

        except Exception as exc:
            duration_ms = (time.time() - start_time) * 1000
            logger.exception(
                f"[{request_id}] <-- {method} {path} | "
                f"Status: 500 | "
                f"Duration: {duration_ms:.2f}ms | "
                f"Error: {type(exc).__name__}: {exc}"
            )
            raise

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


def get_request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "")


def add_request_context(request_id: str, **kwargs):
    context = {"request_id": request_id}
    context.update(kwargs)
    return context
