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
    # Booking State MCP Tools (Consolidated)
    "sync_booking_draft",
    "get_booking_session_info",
    "close_booking_session",
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
        # PET_OWNER Guidance - FAST DRAFT FLOW
        lines.append(
            "- FAST DRAFT FLOW: Khi user muon dat lich, luon uu tien goi sync_booking_draft de tao/cap nhat ban nhap NGAY TRONG 1 LUOT."
        )
        lines.append(
            "- Neu co thong tin (pet, clinic, service, date, time) tu message dau tiên, hay truyen het vao sync_booking_draft."
        )
        lines.append(
            "- SERVICE MAPPING: Truyen ten dich vu vao service_names; tool se tu anh xa sang ID thuc cho ban (dung service_ids neu da biet ID)."
        )
        lines.append(
            "- Sau khi goi sync_booking_draft, hay chao moi nguoi dung xem va hoan thien Form tren UI Card thay vi tiep tuc hoi text."
        )
        lines.append(
            "- Luon dung get_booking_session_info neu can nho lai trang thai hien tai cua ban nhap."
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
        lines.append("- Sau khi thanh cong, luon goi close_booking_session(status='COMPLETED') de danh dau hoan tat.")

    lines.append("- Dung semantic params: clinic_hint, service_hint, date_expression, time_preference.")

    return "\n".join(lines) + "\n"
