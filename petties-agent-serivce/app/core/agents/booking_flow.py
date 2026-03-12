"""
PETTIES AGENT SERVICE - Booking Domain Logic

All booking-related detection, context snapshot building, and
prompt guidance generation.

Package: app.core.agents
Version: v1.1.0 (Extracted from single_agent.py)
"""

from typing import Dict, List, Any, Optional, Set
import re

from app.core.agents.text_utils import (
    extract_latest_user_message,
    extract_all_user_messages,
)


BOOKING_TOOL_NAMES: Set[str] = {
    "get_user_pets",
    "get_clinic_services",
    "search_clinics_nearby",
    "check_available_slots",
    "create_booking_for_user",
}

BOOKING_KEYWORDS = [
    "đặt lịch",
    "đặt khám",
    "booking",
    "book lịch",
    "lịch khám",
    "khung giờ",
    "slot",
    "phòng khám",
    "dịch vụ",
    "bác sĩ đến nhà",
    "khám tại nhà",
    "home visit",
    "in clinic",
]


def has_booking_tools_enabled(enabled_tools_lower: Set[str]) -> bool:
    """Check if any booking-related tools are enabled."""
    return bool(enabled_tools_lower.intersection(BOOKING_TOOL_NAMES))


def is_booking_request(text: str) -> bool:
    """Check if the text contains booking intent keywords."""
    normalized = (text or "").lower()
    return any(kw in normalized for kw in BOOKING_KEYWORDS)


def detect_booking_type(*texts: str) -> Optional[str]:
    """Detect booking type (home_visit or in_clinic) from texts."""
    combined = "\n".join(t for t in texts if t).lower()
    if any(
        kw in combined
        for kw in [
            "tại nhà",
            "ở nhà",
            "home visit",
            "khám tại nhà",
            "bác sĩ đến nhà",
            "đến nhà khám",
        ]
    ):
        return "home_visit"
    if any(
        kw in combined
        for kw in [
            "tại phòng khám",
            "ở phòng khám",
            "in clinic",
            "đến phòng khám",
            "ra phòng khám",
        ]
    ):
        return "in_clinic"
    return None


def build_booking_context_snapshot(
    messages: List[Any],
    context: str,
) -> Dict[str, bool]:
    """Analyse conversation to determine which booking fields are known."""
    user_messages = extract_all_user_messages(messages)
    combined_user = "\n".join(user_messages)
    combined = "\n".join(part for part in [combined_user, context] if part)
    latest = extract_latest_user_message(messages)

    booking_type = detect_booking_type(combined)
    _ci = re.IGNORECASE

    return {
        "has_booking_intent": is_booking_request(combined or latest),
        "booking_type_known": booking_type is not None,
        "is_home_visit": booking_type == "home_visit",
        "is_in_clinic": booking_type == "in_clinic",
        "clinic_known": bool(
            re.search(
                r"clinic[_ ]?id|clinicId|phòng khám\s+[^\n]+|clinic\s+[^\n]+",
                combined,
                _ci,
            )
        ),
        "service_known": bool(
            re.search(
                r"service[_ ]?ids?|serviceId|dịch vụ|tiêm phòng|khám tổng quát|triệt sản|spa|xét nghiệm",
                combined,
                _ci,
            )
        ),
        "pet_known": bool(
            re.search(
                r"pet[_ ]?id|petId|thú cưng tên|bé\s+[A-Za-zÀ-ỹ0-9_]+", combined, _ci
            )
        ),
        "date_known": bool(
            re.search(
                r"booking_date|\b\d{4}-\d{2}-\d{2}\b|ngày mai|hôm nay|thứ\s*[2-8]",
                combined,
                _ci,
            )
        ),
        "time_known": bool(
            re.search(
                r"start_time|\b\d{1,2}:\d{2}\b|buổi sáng|buổi chiều|buổi tối|slot",
                combined,
                _ci,
            )
        ),
        "address_known": bool(
            re.search(
                r"địa chỉ|address|latitude|longitude|query_location|khu vực",
                combined,
                _ci,
            )
        ),
    }


def build_booking_prompt_guidance(
    messages: List[Any],
    context: str,
    enabled_tools_lower: Set[str],
) -> str:
    """Build booking-specific prompt guidance for the LLM.

    Returns empty string if no booking tools are enabled.
    """
    if not has_booking_tools_enabled(enabled_tools_lower):
        return ""

    snapshot = build_booking_context_snapshot(messages, context)
    if not snapshot["has_booking_intent"]:
        return (
            "=== QUY TRÌNH HỖ TRỢ ĐẶT LỊCH (Khi phù hợp) ===\n"
            "- Khi người dùng bắt đầu muốn đặt lịch, chỉ hỏi NHỮNG THÔNG TIN CÒN THIẾU.\n"
            "- Ưu tiên xác định rõ hình thức khám trước: tại phòng khám hay tại nhà.\n"
            "- Nếu người dùng đã nêu sẵn phòng khám, dịch vụ, thú cưng hoặc thời gian thì KHÔNG hỏi lại.\n"
            "- Nếu dịch vụ là tiêm chủng, vẫn xử lý như service bình thường trong flow booking; "
            "có thể nêu giá theo mũi để người dùng tự chọn như flow thủ công, "
            "nhưng KHÔNG tạo flow riêng hoặc hỏi quá chuyên sâu.\n"
            "- Chỉ gọi `create_booking_for_user` sau khi đã tóm tắt đầy đủ và người dùng xác nhận rõ ràng.\n"
        )

    known: List[str] = []
    missing: List[str] = []

    if snapshot["is_home_visit"]:
        known.append("hình thức khám: tại nhà")
    elif snapshot["is_in_clinic"]:
        known.append("hình thức khám: tại phòng khám")
    else:
        missing.append("hình thức khám (tại nhà hay tại phòng khám)")

    field_mapping = [
        ("clinic_known", "phòng khám"),
        ("service_known", "dịch vụ"),
        ("pet_known", "thú cưng cụ thể"),
        ("date_known", "ngày khám"),
        ("time_known", "giờ khám"),
    ]
    for key, label in field_mapping:
        (known if snapshot[key] else missing).append(label)

    if snapshot["is_home_visit"]:
        target = known if snapshot["address_known"] else missing
        target.append("địa chỉ/khu vực khám tại nhà")

    known_text = ", ".join(known) if known else "chưa có thông tin chắc chắn"
    missing_text = (
        ", ".join(missing) if missing else "không còn thiếu thông tin quan trọng"
    )

    return (
        f"=== QUY TRÌNH HỖ TRỢ ĐẶT LỊCH (Quan trọng) ===\n"
        f"- Người dùng đang có ý định đặt lịch. Hãy dùng đúng ngữ cảnh hiện có và CHỈ hỏi phần còn thiếu.\n"
        f"- Thứ tự ưu tiên:\n"
        f"  1. Nếu CHƯA rõ hình thức khám, hỏi trước: tại nhà hay tại phòng khám.\n"
        f"  2. Nếu đã rõ phòng khám/dịch vụ/thú cưng/thời gian thì không hỏi lại các mục đó.\n"
        f"    2a. Nếu dịch vụ là tiêm chủng, vẫn coi là service bình thường; "
        f"có thể cho người dùng biết giá theo mũi/dose nếu đã có dữ liệu, "
        f"rồi để người dùng chọn tự nhiên như flow booking thủ công.\n"
        f"  3. Nếu là khám tại nhà, cần xác nhận địa chỉ/khu vực trước khi chốt lịch.\n"
        f"  4. Chỉ gọi `check_available_slots` khi đã có đủ phòng khám + dịch vụ + ngày và đã rõ hình thức khám.\n"
        f"  5. Chỉ gọi `create_booking_for_user` sau khi tóm tắt lại booking và người dùng xác nhận rõ ràng.\n"
        f"- Nếu người dùng chọn khám tại nhà nhưng flow/tool hiện tại chưa tạo booking tại nhà đầy đủ, "
        f"hãy nói rõ và hướng dẫn sang bước xác nhận/handoff phù hợp thay vì tự tạo booking sai loại.\n"
        f"- Với tiêm chủng, ưu tiên giữ trải nghiệm giống flow thủ công hiện tại: "
        f"hiển thị/thông báo giá theo mũi nếu có, nhưng không bắt buộc phải mở thêm quy trình đặc biệt "
        f"ngoài các thông tin booking cơ bản.\n\n"
        f"Ngữ cảnh booking đã nhận ra:\n"
        f"- Đã biết: {known_text}\n"
        f"- Còn thiếu/ cần xác nhận: {missing_text}\n"
    )
