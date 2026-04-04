"""
Booking guidance helpers for the ReAct agent.

This module intentionally stays thin:
- expose the booking tool set
- provide semantic guidance for the LLM
- avoid keyword-based booking intent detection or rigid flow control
"""

from typing import Any, List, Set


BOOKING_TOOL_NAMES: Set[str] = {
    "get_user_pets",
    "get_clinic_services",
    "search_clinics_nearby",
    "check_available_slots",
    "create_booking_for_user",
}


def has_booking_tools_enabled(enabled_tools_lower: Set[str]) -> bool:
    """Return True when at least one booking tool is available."""
    return bool(enabled_tools_lower.intersection(BOOKING_TOOL_NAMES))


def build_booking_prompt_guidance(
    messages: List[Any],
    context: str,
    enabled_tools_lower: Set[str],
) -> str:
    """Return semantic booking guidance without forcing a hardcoded flow."""
    if not has_booking_tools_enabled(enabled_tools_lower):
        return ""

    _ = messages
    _ = context

    return (
        "=== BOOKING TOOLS ===\n"
        "- Dung semantic params: clinic_hint, service_hint, date_expression, time_preference\n"
        "- Chi goi create_booking khi user da xac nhan ro rang\n"
        "- Conditional booking: 'neu con slot thi tao' -> auto_create_if_available=True\n"
    )
