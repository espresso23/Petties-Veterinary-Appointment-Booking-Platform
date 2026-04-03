"""
Booking guidance helpers for the ReAct agent.

This module intentionally stays thin:
- expose the booking tool set
- provide semantic guidance for the LLM
- avoid keyword-based booking intent detection or rigid flow control
"""

from typing import Any, List, Set


BOOKING_TOOL_NAMES: Set[str] = {
    # Data lookup tools
    "get_user_pets",
    "get_clinic_services",
    "search_clinics_nearby",
    "check_available_slots",
    "create_booking_for_user",
    # Booking State MCP Tools
    "start_booking_session",
    "get_booking_session",
    "end_booking_session",
    "update_booking_draft",
    "get_booking_draft_summary",
    "suspend_booking_session",
    "resume_booking_session",
    # Utility MCP Tools
    "resolve_date_time",
    "resolve_booking_context",
    # Fast Booking Tools
    "quick_booking_search",
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

    lines = ["=== BOOKING TOOLS ==="]

    # Fast Booking Flow Guidance (NEW)
    if "quick_booking_search" in enabled_tools_lower:
        lines.append(
            "- FAST BOOKING: Khi user muon dat lich nhanh, dung quick_booking_search de tim clinic + service + slot trong 1 lan goi"
        )
        lines.append(
            "- Sau khi co ket qua tu quick_booking_search, neu co clinic phu hop thi goi start_booking_session(initial_draft=...) de tao draft ngay"
        )
        lines.append(
            "- Neu chua co day du thong tin (pet, clinic, service, date, time), van co the tao draft voi thong tin co san va de user tu dien them"
        )
        lines.append(
            "- Sau khi tao draft, thong bao cho user: 'Da tao lich so bo, cac thong tin da co: [...], can them: [...]' va hoi xem co can giup gi khong"
        )
        lines.append(
            "- Khi user hoi 'lich cua toi' hoac 'thong tin dat lich', hien thi full draft voi get_booking_draft_summary"
        )

    session_tools = {
        "start_booking_session",
        "get_booking_session",
        "update_booking_draft",
        "end_booking_session",
        "suspend_booking_session",
        "resume_booking_session",
    }
    if enabled_tools_lower.intersection(session_tools):
        lines.append(
            "- Khi co initial_draft tu prompt (pet, clinic, service, date), ưu tien goi start_booking_session(..., initial_draft=...) de tao draft NGAY"
        )
        lines.append(
            "- Neu dang co booking session active, uu tien tiep tuc session do thay vi hoi lai thong tin da co"
        )
    if "get_booking_session" in enabled_tools_lower:
        lines.append(
            "- Dung get_booking_session de doc draft hien tai khi can nho lai state"
        )
    if "update_booking_draft" in enabled_tools_lower:
        lines.append(
            "- Dung update_booking_draft moi khi user doi pet, phong kham, dich vu, ngay, gio, hoac loai booking"
        )
    if {
        "suspend_booking_session",
        "resume_booking_session",
    }.issubset(enabled_tools_lower):
        lines.append(
            "- Neu user tam hoi sang viec khac trong luc booking dang mo, co the dung suspend_booking_session va resume_booking_session"
        )
    if "search_clinics_nearby" in enabled_tools_lower:
        lines.append(
            "- Dung search_clinics_nearby la tool clinic discovery chinh; neu user neu ten phong kham cu the thi truyen clinic_hint thay vi doi sang tool khac"
        )
        lines.append(
            "- Khi user mô ta nhu câu 'tim phòng khám có dịch vụ X', truyền service_hint=X để lọc clinic"
        )
    if "check_available_slots" in enabled_tools_lower:
        lines.append(
            "- Dung check_available_slots khi can xac nhan slot that su cho mot phong kham da biet hoac da resolve duoc; khong dung search_clinics_nearby de gia lap slot"
        )
        lines.append(
            "- Khi user hoi 'ngày nào còn slot' hoặc 'có lịch không', ưu tiên gọi check_available_slots"
        )
    lines.append(
        "- Dung semantic params: clinic_hint, service_hint, date_expression, time_preference"
    )
    if "create_booking_for_user" in enabled_tools_lower:
        lines.append("- Chi goi create_booking khi user da xac nhan ro rang")
        lines.append(
            "- Conditional booking: 'neu con slot thi tao' -> auto_create_if_available=True"
        )
        lines.append(
            "- Khi tao booking thanh cong, goi end_booking_session(reason='COMPLETED') de danh dau hoan tat"
        )

    return "\n".join(lines) + "\n"
