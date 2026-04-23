"""
Prometheus metrics utilities for Petties AI service.

Provides a minimal, stable metric surface for:
- request count
- request duration
- in-flight requests
- error count
"""

from __future__ import annotations

import re
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

HTTP_REQUESTS_TOTAL = Counter(
    "petties_ai_http_requests_total",
    "Total HTTP requests handled by Petties AI service",
    ["method", "path", "status_code"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "petties_ai_http_request_duration_seconds",
    "HTTP request latency in seconds for Petties AI service",
    ["method", "path"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0),
)

HTTP_IN_FLIGHT_REQUESTS = Gauge(
    "petties_ai_http_in_flight_requests",
    "Current in-flight HTTP requests for Petties AI service",
    ["path"],
)

HTTP_ERRORS_TOTAL = Counter(
    "petties_ai_http_errors_total",
    "Total HTTP error responses (status >= 400) for Petties AI service",
    ["method", "path", "status_code"],
)

_UUID_PATTERN = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b"
)
_NUMERIC_SEGMENT_PATTERN = re.compile(r"/\d+")


def normalize_path(path: str) -> str:
    """Reduce path-cardinality for Prometheus labels."""
    normalized = _UUID_PATTERN.sub("{id}", path)
    normalized = _NUMERIC_SEGMENT_PATTERN.sub("/{id}", normalized)
    return normalized


def increment_inflight(path: str) -> None:
    HTTP_IN_FLIGHT_REQUESTS.labels(path=path).inc()


def decrement_inflight(path: str) -> None:
    HTTP_IN_FLIGHT_REQUESTS.labels(path=path).dec()


def observe_http_request(method: str, path: str, status_code: int, latency_ms: float) -> None:
    status_text = str(status_code)
    HTTP_REQUESTS_TOTAL.labels(method=method, path=path, status_code=status_text).inc()
    HTTP_REQUEST_DURATION_SECONDS.labels(method=method, path=path).observe(max(latency_ms, 0.0) / 1000.0)

    if status_code >= 400:
        HTTP_ERRORS_TOTAL.labels(method=method, path=path, status_code=status_text).inc()


def render_prometheus_metrics() -> bytes:
    return generate_latest()


__all__ = [
    "CONTENT_TYPE_LATEST",
    "normalize_path",
    "increment_inflight",
    "decrement_inflight",
    "observe_http_request",
    "render_prometheus_metrics",
]
