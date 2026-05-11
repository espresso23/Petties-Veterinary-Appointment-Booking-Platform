"""
Lean semantic guidance for the AI Agent.
Avoids rigid flow control; focuses on goals and constraints.
"""

from typing import Any, List, Optional, Set

BOOKING_TOOL_NAMES: Set[str] = {
    "get_user_pets",
    "get_clinic_services",
    "search_clinics_nearby",
    "check_available_slots",
    "create_booking_for_user",
    "quick_booking_search",
    "resolve_booking_context",
}

CLINIC_COPILOT_ROLES: Set[str] = {
    "STAFF",
    "CLINIC_MANAGER",
    "CLINIC_OWNER",
}

def normalize_agent_role(user_role: Optional[str]) -> str:
    return str(user_role or "PET_OWNER").strip().upper()

def is_clinic_copilot_role(user_role: Optional[str]) -> bool:
    return normalize_agent_role(user_role) in CLINIC_COPILOT_ROLES

def has_booking_tools_enabled(enabled_tools_lower: Set[str]) -> bool:
    return bool(enabled_tools_lower.intersection(BOOKING_TOOL_NAMES))

def build_booking_prompt_guidance(
    messages: List[Any],
    context: str,
    enabled_tools_lower: Set[str],
    user_role: Optional[str] = None,
) -> str:
    """Return semantic booking guidance focusing on intent and goal."""
    if not has_booking_tools_enabled(enabled_tools_lower):
        return ""

    lines = ["=== GOALS & CONSTRAINTS ==="]
    
    if is_clinic_copilot_role(user_role):
        lines.append("- GOAL: Support clinic operations and internal data lookup.")
        lines.append("- STYLE: Professional, internal staff tone. Don't use consumer wizards.")
    else:
        lines.append("- GOAL: Facilitate fast appointment booking.")
        lines.append("- STRATEGY: Use `quick_booking_search` first to get pets, clinics, and services at once.")
        lines.append("- UI-FIRST: Prefer UI Schema/Cards over long textual descriptions.")

    lines.append("- DATA: Trust 'Observation' data for IDs (clinic_id, pet_id, service_ids).")
    lines.append("- FLOW: Be flexible. If user changes mind or asks questions, answer naturally then resume flow.")

    return "\n".join(lines) + "\n"
