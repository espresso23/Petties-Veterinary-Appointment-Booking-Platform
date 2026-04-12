"""
Booking guidance helpers for the ReAct agent.

This module intentionally stays thin:
- expose the booking tool set
- provide semantic guidance for the LLM
- avoid keyword-based booking intent detection or rigid flow control
"""

from typing import Any, List, Optional, Set


BOOKING_TOOL_NAMES: Set[str] = {
    # Data lookup tools
    "get_user_pets",
    "get_clinic_services",
    "search_clinics_nearby",
    "check_available_slots",
    "create_booking_for_user",
    # Utility MCP Tools
    "get_current_datetime",
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


def is_pet_owner_chat_role(user_role: Optional[str]) -> bool:
    return not is_clinic_copilot_role(user_role)


def has_booking_tools_enabled(enabled_tools_lower: Set[str]) -> bool:
    """Return True when at least one booking tool is available."""
    return bool(enabled_tools_lower.intersection(BOOKING_TOOL_NAMES))


def build_booking_prompt_guidance(
    messages: List[Any],
    context: str,
    enabled_tools_lower: Set[str],
    user_role: Optional[str] = None,
) -> str:
    """Return semantic booking guidance without forcing a hardcoded flow."""
    if not has_booking_tools_enabled(enabled_tools_lower):
        return ""

    _ = messages
    _ = context

    lines = ["=== BOOKING TOOLS ==="]

    if is_clinic_copilot_role(user_role):
        lines.append(
            "- Ban dang o che do clinic copilot. Cac tool booking chi la nang luc tra cuu noi bo, khong phai consumer booking wizard cho PET_OWNER."
        )
        lines.append(
            "- Khong tu dong mo flow hoi pet -> dich vu -> phong kham -> gio nhu dang dat lich thay cho chu nuoi."
        )
        lines.append(
            "- Neu nguoi dung hoi slot, dich vu hoac lich hen, tra loi nhu dong nghiep noi bo: uu tien tra cuu, tom tat, de xuat thao tac tiep theo."
        )
    else:
        # PET_OWNER Guidance - form-first simple flow
        lines.append(
            "- FORM-FIRST FLOW: Khi user muon dat lich, uu tien thu thap du thong tin can thiet de hien thi form/xac nhan nhanh."
        )
        lines.append(
            "- Neu co thong tin (pet, clinic, service, date, time) tu message dau tien, hay truyen het vao cac tool lookup/create phu hop."
        )
        lines.append(
            "- SERVICE MAPPING: uu tien service_ids neu da co tu UI; neu user noi ten dich vu thi dung service_hint de tra cuu."
        )
        lines.append(
            "- Uu tien de nguoi dung chon tren UI Card thay vi hoi dap qua nhieu bang text."
        )

    if "search_clinics_nearby" in enabled_tools_lower:
        if is_clinic_copilot_role(user_role):
            lines.append(
                "- Dung search_clinics_nearby chi khi can so sanh hoac tra cuu theo vi tri thuc te."
            )
        else:
            lines.append(
                "- Dung search_clinics_nearby de tim phong kham; neu user da neu ten cu the, dung clinic_hint."
            )
            lines.append(
                "- Khi user mo ta nhu cau 'tim phong kham co dich vu X', truyen service_hint=X de loc clinic."
            )

    if "check_available_slots" in enabled_tools_lower:
        lines.append(
            "- Dung check_available_slots de kiem tra lich trong thuc te cho phong kham da chon."
        )

    if "create_booking_for_user" in enabled_tools_lower and is_pet_owner_chat_role(user_role):
        lines.append("- Chi goi create_booking_for_user khi user da xac nhan hoan tat tren UI Card.")

    lines.append("- Dung semantic params: clinic_hint, service_hint, date_expression, time_preference.")

    return "\n".join(lines) + "\n"
