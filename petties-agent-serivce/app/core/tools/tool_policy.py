"""
PETTIES AGENT SERVICE - Tool Policy Registry

Decorator-based registry for tool execution policies.
Allows extensible configuration of tool behavior.

Package: app.core.tools
Version: v1.0.0

Usage:
    # Register tool with custom policy
    @tool_policy(allow_empty_params=True, timeout_seconds=30)
    @mcp_server.tool
    async def my_tool(...):
        ...

    # Check tool policy
    policy = get_tool_policy("my_tool")
    if policy and policy.allow_empty_params:
        ...
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, List, Optional


@dataclass
class ToolPolicy:
    """
    Policy configuration for a tool.

    Attributes:
        allow_empty_params: Whether tool accepts empty parameters
        timeout_seconds: Execution timeout
        requires_auth: Whether tool requires authentication
        allowed_roles: List of roles that can use this tool (None = all roles)
        max_retries: Number of retries on failure
        cache_ttl_seconds: Cache results for this duration
    """

    allow_empty_params: bool = False
    timeout_seconds: int = 30
    requires_auth: bool = True
    allowed_roles: Optional[List[str]] = None
    max_retries: int = 0
    cache_ttl_seconds: Optional[int] = None
    requires_context: bool = False  # Requires tool_runtime_context
    description: str = ""


# Global registry
_tool_policies: Dict[str, ToolPolicy] = {}

# Default policies for all tools
DEFAULT_POLICIES = {
    # Booking Tools
    "get_user_pets": ToolPolicy(
        allow_empty_params=True,
        requires_context=True,
        description="Get user pets - can be called without params to list all pets",
    ),
    "get_clinic_services": ToolPolicy(
        allow_empty_params=False,
        requires_context=True,
        description="Get clinic services - requires clinic_id",
    ),
    "search_clinics_nearby": ToolPolicy(
        allow_empty_params=False,
        requires_context=True,
        description="Search nearby clinics - requires location or clinic_hint",
    ),
    "check_available_slots": ToolPolicy(
        allow_empty_params=False,
        requires_context=True,
        description="Check available slots - requires clinic_id",
    ),
    "check_vaccination_status": ToolPolicy(
        allow_empty_params=False,
        requires_context=True,
        requires_auth=True,
        description="Check vaccination status - requires pet_id",
    ),
    "create_booking_for_user": ToolPolicy(
        allow_empty_params=False,
        requires_context=True,
        requires_auth=True,
        description="Create booking - requires full params and auth",
    ),
    # Medical/Staff Tools
    "pet_knowledge_search": ToolPolicy(
        allow_empty_params=False,
        requires_context=False,
        description="Search pet knowledge base - requires query",
    ),
    "web_search": ToolPolicy(
        allow_empty_params=False,
        requires_context=False,
        description="Search web for pet-related info - requires query",
    ),
    "get_staff_patients": ToolPolicy(
        allow_empty_params=True,
        requires_context=True,
        description="Get staff patients - can be called without params to list all",
    ),
    "get_patient_summary": ToolPolicy(
        allow_empty_params=False,
        requires_context=True,
        description="Get patient summary - requires pet_id",
    ),
    "get_emr_history": ToolPolicy(
        allow_empty_params=False,
        requires_context=True,
        description="Get EMR history - requires pet_id",
    ),
    "get_pet_health_summary": ToolPolicy(
        allow_empty_params=False,
        requires_context=True,
        requires_auth=True,
        description="Get pet health summary - requires pet_id and user_id",
    ),
    # Booking Tools - Additional
    "search_clinics_by_name": ToolPolicy(
        allow_empty_params=False,
        requires_context=True,
        requires_auth=True,
        description="Search clinics by name - compatibility helper, prefer search_clinics_nearby",
    ),
    "get_clinic_detail": ToolPolicy(
        allow_empty_params=False,
        requires_context=True,
        requires_auth=True,
        description="Get clinic detail by ID - requires clinic_id",
    ),
    "get_my_booking_info": ToolPolicy(
        allow_empty_params=False,
        requires_context=True,
        requires_auth=True,
        description="Get booking info by ID or code - requires booking_id or booking_code",
    ),
    "list_my_bookings": ToolPolicy(
        allow_empty_params=True,
        requires_context=True,
        requires_auth=True,
        description="List user bookings - optional status filter, default upcoming",
    ),
    # Utility Tools
    "resolve_date_time": ToolPolicy(
        allow_empty_params=False,
        requires_context=False,
        requires_auth=False,
        description="Resolve Vietnamese date/time expression to ISO format",
    ),
    "resolve_booking_context": ToolPolicy(
        allow_empty_params=True,
        requires_context=True,
        requires_auth=True,
        description="Get current booking session context",
    ),
    # Fast Booking Tool
    "quick_booking_search": ToolPolicy(
        allow_empty_params=False,
        requires_context=True,
        requires_auth=True,
        description="Fast booking search - find clinic + service + slot in one call",
    ),
}


def tool_policy(
    allow_empty_params: bool = False,
    timeout_seconds: int = 30,
    requires_auth: bool = True,
    allowed_roles: Optional[List[str]] = None,
    max_retries: int = 0,
    cache_ttl_seconds: Optional[int] = None,
    requires_context: bool = False,
) -> Callable:
    """
    Decorator to apply policy to a tool function.

    Usage:
        @tool_policy(allow_empty_params=True)
        @mcp_server.tool
        async def get_user_pets(...):
            ...
    """

    def decorator(func: Callable) -> Callable:
        policy = ToolPolicy(
            allow_empty_params=allow_empty_params,
            timeout_seconds=timeout_seconds,
            requires_auth=requires_auth,
            allowed_roles=allowed_roles,
            max_retries=max_retries,
            cache_ttl_seconds=cache_ttl_seconds,
            requires_context=requires_context,
        )

        # Register policy
        tool_name = getattr(func, "__name__", str(func))
        register_tool_policy(tool_name, policy)

        # Attach policy to function for introspection
        func._tool_policy = policy  # type: ignore

        return func

    return decorator


def register_tool_policy(tool_name: str, policy: ToolPolicy) -> None:
    """
    Register a policy for a tool.

    Args:
        tool_name: Name of the tool
        policy: ToolPolicy instance
    """
    _tool_policies[tool_name] = policy


def get_tool_policy(tool_name: str) -> Optional[ToolPolicy]:
    """
    Get policy for a tool.

    Args:
        tool_name: Name of the tool

    Returns:
        ToolPolicy if registered, None otherwise
    """
    # Check registry first
    if tool_name in _tool_policies:
        return _tool_policies[tool_name]

    # Fall back to default policies
    if tool_name in DEFAULT_POLICIES:
        return DEFAULT_POLICIES[tool_name]

    return None


def get_all_policies() -> Dict[str, ToolPolicy]:
    """Get all registered policies including defaults."""
    return {**_tool_policies, **DEFAULT_POLICIES}


def allow_empty_params(tool_name: str) -> bool:
    """
    Check if tool allows empty parameters.

    Args:
        tool_name: Name of the tool

    Returns:
        True if tool accepts empty params
    """
    policy = get_tool_policy(tool_name)
    return policy.allow_empty_params if policy else False


def requires_context(tool_name: str) -> bool:
    """
    Check if tool requires runtime context.

    Args:
        tool_name: Name of the tool

    Returns:
        True if tool requires context
    """
    policy = get_tool_policy(tool_name)
    return policy.requires_context if policy else False


def check_role_access(tool_name: str, role: str) -> bool:
    """
    Check if role has access to tool.

    Args:
        tool_name: Name of the tool
        role: User role

    Returns:
        True if role is allowed
    """
    policy = get_tool_policy(tool_name)
    if not policy:
        return True  # No policy = allow all

    if policy.allowed_roles is None:
        return True  # No role restriction

    return role.upper() in {r.upper() for r in policy.allowed_roles}


def get_timeout(tool_name: str) -> int:
    """
    Get timeout for tool.

    Args:
        tool_name: Name of the tool

    Returns:
        Timeout in seconds
    """
    policy = get_tool_policy(tool_name)
    return policy.timeout_seconds if policy else 30
