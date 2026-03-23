"""
WebSocket Chat Constants

Định nghĩa các constants cho WebSocket chat handlers.

Package: app.api.websocket
"""

# WebSocket close reasons
WS_REASON_AUTH_REQUIRED = "Authentication required"
WS_REASON_INVALID_AUTH = "Invalid authentication token"
WS_REASON_PLAYGROUND_FORBIDDEN = "Playground access forbidden"
WS_REASON_SESSION_FORBIDDEN = "Session access forbidden"
WS_REASON_SUBSCRIPTION_REQUIRED = "Active subscription required"

__all__ = [
    "WS_REASON_AUTH_REQUIRED",
    "WS_REASON_INVALID_AUTH",
    "WS_REASON_PLAYGROUND_FORBIDDEN",
    "WS_REASON_SESSION_FORBIDDEN",
    "WS_REASON_SUBSCRIPTION_REQUIRED",
]
