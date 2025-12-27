"""
Sentry Error Tracking Configuration
Auto-reports errors to Slack via Sentry integration
"""
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.httpx import HttpxIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
import logging

from app.config.settings import settings


def init_sentry():
    """
    Initialize Sentry SDK for error tracking
    
    Errors will be automatically sent to Sentry and forwarded to Slack
    based on alert rules configured in Sentry dashboard.
    """
    
    if not settings.SENTRY_DSN:
        print("⚠️ Sentry DSN not configured, error tracking disabled")
        return
    
    # Configure logging integration
    logging_integration = LoggingIntegration(
        level=logging.INFO,        # Capture INFO and above as breadcrumbs
        event_level=logging.ERROR  # Send ERROR and above as events
    )
    
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        
        # Enable integrations
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            HttpxIntegration(),
            logging_integration,
        ],
        
        # Sample rate for performance monitoring (10% of requests)
        traces_sample_rate=0.1,
        
        # Profile sample rate (10% of sampled transactions)
        profiles_sample_rate=0.1,
        
        # Filter before sending
        before_send=_before_send_filter,
        
        # Attach stack trace to all messages
        attach_stacktrace=True,
        
        # Enable sending of default PII (user info)
        send_default_pii=False,
        
        # Release version
        release=f"petties-ai-service@{settings.APP_VERSION}",
    )
    
    print(f"✅ Sentry initialized - Environment: {settings.ENVIRONMENT}")


def _before_send_filter(event, hint):
    """
    Filter sensitive data before sending to Sentry
    
    - Removes API keys, tokens, passwords from request data
    - Removes sensitive headers
    """
    
    # Remove sensitive headers
    if "request" in event and "headers" in event["request"]:
        headers = event["request"]["headers"]
        sensitive_headers = [
            "authorization", 
            "cookie", 
            "x-api-key",
            "x-openrouter-api-key",
            "x-cohere-api-key",
        ]
        for header in sensitive_headers:
            if header in headers:
                headers[header] = "[REDACTED]"
    
    # Remove sensitive data from request body
    if "request" in event and "data" in event["request"]:
        data = event["request"]["data"]
        if isinstance(data, str):
            import re
            # Redact common sensitive fields
            patterns = [
                r'"(password|token|api_key|secret|apiKey|accessToken)":\s*"[^"]*"',
                r'"(OPENROUTER_API_KEY|COHERE_API_KEY|DEEPSEEK_API_KEY)":\s*"[^"]*"',
            ]
            for pattern in patterns:
                data = re.sub(pattern, r'"\1":"[REDACTED]"', data)
            event["request"]["data"] = data
    
    return event


def set_user_context(user_id: str, email: str = None, role: str = None):
    """
    Set user context for error tracking
    
    Call this after user authentication to include user info in error reports
    
    Args:
        user_id: Unique user identifier
        email: User email (optional)
        role: User role like VET, CLINIC_MANAGER, etc. (optional)
    """
    sentry_sdk.set_user({
        "id": user_id,
        "email": email,
        "role": role,
    })


def clear_user_context():
    """Clear user context (call on logout)"""
    sentry_sdk.set_user(None)


def capture_exception(error: Exception, extra: dict = None):
    """
    Manually capture exception
    
    Use this to report errors that are caught and handled
    
    Args:
        error: The exception to report
        extra: Additional context data (optional)
    
    Example:
        try:
            risky_operation()
        except Exception as e:
            capture_exception(e, {"operation": "risky_operation", "user_id": "123"})
    """
    with sentry_sdk.push_scope() as scope:
        if extra:
            for key, value in extra.items():
                scope.set_extra(key, value)
        sentry_sdk.capture_exception(error)


def capture_message(message: str, level: str = "info", extra: dict = None):
    """
    Manually capture message
    
    Use this to report important events that aren't errors
    
    Args:
        message: The message to report
        level: Log level (debug, info, warning, error, fatal)
        extra: Additional context data (optional)
    
    Example:
        capture_message("LLM response slow", level="warning", {"response_time": 5.2})
    """
    with sentry_sdk.push_scope() as scope:
        if extra:
            for key, value in extra.items():
                scope.set_extra(key, value)
        sentry_sdk.capture_message(message, level=level)


def add_breadcrumb(message: str, category: str = "info", data: dict = None):
    """
    Add breadcrumb for debugging
    
    Breadcrumbs create a trail of events leading up to an error
    
    Args:
        message: Description of the event
        category: Category like 'http', 'navigation', 'query', etc.
        data: Additional data (optional)
    
    Example:
        add_breadcrumb("Called booking API", category="http", {"endpoint": "/api/bookings"})
    """
    sentry_sdk.add_breadcrumb(
        message=message,
        category=category,
        data=data or {},
        level="info",
    )
