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
        "=== NGUYEN TAC BOOKING VOI AI ===\n"
        "- Chon booking tool dua tren y nghia cua hoi thoai va input schema, khong duoc route theo keyword cung.\n"
        "- Duoc phep goi nhieu booking tool lien tiep neu moi tool mo ra them context cho tool sau.\n"
        "- Chi fetch du lieu khi can. Khong preload pets, clinics, services neu cau hoi hien tai chua can.\n"
        "- Neu user da neu ten thu cung, phong kham, dich vu, ngay hoac khung gio thi khong hoi lai thong tin do.\n"
        "- Neu user da neu phong kham cu the thi uu tien phong kham do; chi dung GPS de tim gan day khi user yeu cau gan toi/gian day hoac chua co clinic target ro rang.\n"
        "- Voi booking, neu schema con thieu du lieu bat buoc thi hoi lai dung phan con thieu. Khong reset hoi thoai, khong chao lai, khong quay ve flow mac dinh.\n"
        "- Khi can chon pet tu nguyen canh hoi thoai, co the goi `get_user_pets` de lay pet_id, nhung chi khi ten pet chua du ro de goi tool tiep theo.\n"
        "- Uu tien truyen tham so semantic cho tools nhu `clinic_hint`, `service_hint`, `date_expression`, `time_preference`, `transcript`, `latest_message` khi schema co ho tro.\n"
        "- `create_booking_for_user` chi duoc goi khi user da the hien y muon tao yeu cau booking ro rang. Tool se tu bao missing fields neu thong tin chua du.\n"
        "\n"
        "=== MULTI-PET BOOKING ===\n"
        "- Neu user muon dat lich cho nhieu thu cung (vi du: '2 bé mèo', 'bé mèo va bé chó'), su dung multi-pet mode.\n"
        "- Multi-pet mode: truyen `items` param cho `create_booking_for_user` voi dinh dang:\n"
        '  items = [{"pet_id": "...", "pet_hint": "bé mèo 1", "service_ids": ["..."]}, {"pet_id": "...", "pet_hint": "bé chó", "service_ids": ["..."]}]\n'
        "- Moi thu cung se tao mot booking rieng tai cung phong kham, cung ngay, cung gio.\n"
        "- Neu user chi noi 'tiêm phòng' ma khong chi ro thu cung nao, hoi xac nhan thu cung truoc.\n"
        "- Neu user noi '2 bé mèo tiêm' -> items voi 2 pet cung service.\n"
        "- Neu user noi 'bé mèo tiêm, bé chó khám' -> items voi pet khac nhau, service khac nhau.\n"
    )
