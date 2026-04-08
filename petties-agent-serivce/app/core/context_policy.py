"""
PETTIES AGENT SERVICE - Context Policy Service
Role/context-based tool governance cho business chat và admin playground.

Package: app.core
Purpose:
    - Xác định tool whitelist theo user_role và context_type
    - Bổ sung prompt guardrails theo context để agent không dùng sai tool
"""

from typing import Iterable, List, Optional, Sequence

from app.core.chat_context import BUSINESS_CHAT, PLAYGROUND_TEST, normalize_context_type


PUBLIC_BUSINESS_TOOLS = {
    "pet_knowledge_search",
    "web_search",
}

PLAYGROUND_TOOLS = {
    "pet_knowledge_search",
    "web_search",
}

ROLE_RESPONSE_STYLES = {
    "PET_OWNER": (
        "Cách trả lời cho PET_OWNER: dùng ngôn ngữ thân thiện, dễ hiểu, tránh thuật ngữ quá chuyên môn. "
        "Ưu tiên hướng dẫn từng bước rõ ràng để chủ nuôi dễ làm theo."
    ),
    "STAFF": (
        "Cách trả lời cho STAFF: đi thẳng vào chuyên môn, ưu tiên thông tin lâm sàng, tiền sử và dữ kiện y khoa liên quan. "
        "Có thể dùng thuật ngữ chuyên môn khi cần nhưng vẫn phải mạch lạc."
    ),
    "CLINIC_MANAGER": (
        "Cách trả lời cho CLINIC_MANAGER: ưu tiên góc nhìn vận hành phòng khám, phân bổ nguồn lực, lịch làm việc và hiệu suất. "
        "Khi phù hợp, trình bày theo gạch đầu dòng hoặc checklist hành động."
    ),
    "CLINIC_OWNER": (
        "Cách trả lời cho CLINIC_OWNER: ưu tiên góc nhìn điều hành, doanh thu, chất lượng dịch vụ, định giá và tăng trưởng phòng khám. "
        "Nhấn mạnh tác động kinh doanh và đề xuất quyết định thực tế."
    ),
    "ADMIN": (
        "Cách trả lời cho ADMIN: trung lập, rõ ràng, có cấu trúc, ưu tiên tính kiểm soát hệ thống và tuân thủ cấu hình hiện tại."
    ),
}

ROLE_PRODUCT_MODES = {
    "PET_OWNER": (
        "Che do san pham: AI chat cho chu nuoi. Co the tu van, giai thich va ho tro booking o muc do chat assistant."
    ),
    "STAFF": (
        "Che do san pham: AI copilot noi bo cho STAFF. Uu tien thao tac nghiep vu, EMR, benh nhan va van hanh, khong dong vai consumer chatbot. "
        "Co the xem lich kham trong ngay (get_clinic_today_summary) va kiem tra tiem chung (check_vaccination_status)."
    ),
    "CLINIC_MANAGER": (
        "Che do san pham: AI copilot cho CLINIC_MANAGER. Uu tien van hanh, lich hen, nhan su va dieu phoi, khong dong vai consumer chatbot. "
        "Co the xem doanh thu, lich lam viec, slot, xac nhan/huy booking va phan cong lai nhan vien."
    ),
    "CLINIC_OWNER": (
        "Che do san pham: AI copilot cho CLINIC_OWNER. Uu tien goc nhin dieu hanh va kinh doanh, khong dong vai consumer chatbot. "
        "Co the tao dich vu, cap nhat gia, xem thong ke doanh thu va quan ly toan bo phong kham."
    ),
    "ADMIN": (
        "Che do san pham: AI control assistant cho ADMIN, uu tien kiem soat he thong va cau hinh."
    ),
}


class ContextPolicyService:
    """Service xây dựng tool whitelist và prompt guardrails theo role/context."""

    ROLE_BUSINESS_TOOLS = {
        "PET_OWNER": {
            "pet_knowledge_search",
            "web_search",
            "get_user_pets",
            "get_pet_health_summary",
            "sync_booking_draft",
            "get_booking_session_info",
            "close_booking_session",
            "search_clinics_nearby",
            "check_available_slots",
            "create_booking_for_user",
            "get_clinic_services",
            "list_my_bookings",
            "get_my_booking_info",
            "check_vaccination_status",
            "get_current_datetime",
            "resolve_booking_context",
        },
        "STAFF": {
            "get_staff_patients",
            "get_patient_summary",
            "get_emr_history",
            "get_my_clinics",
            "get_clinic_today_summary",
            "check_vaccination_status",
            "sync_booking_draft",
            "get_booking_session_info",
            "close_booking_session",
        },
        "CLINIC_MANAGER": {
            "list_clinic_services",
            "get_clinic_services",
            "get_my_clinics",
            "get_clinic_today_summary",
            "analyze_revenue_trends",
            "get_clinic_metrics",
            "get_staff_schedule",
            "get_slot_availability",
            "view_clinic_bookings",
            "get_available_staff_for_reassign",
            "reassign_staff_for_service",
            "confirm_booking_manager",
            "cancel_booking_manager",
            "sync_booking_draft",
            "get_booking_session_info",
            "close_booking_session",
        },
        "CLINIC_OWNER": {
            "list_clinic_services",
            "get_clinic_services",
            "create_clinic_service",
            "update_service_info",
            "execute_update_service_confirmed",
            "generate_clinic_services",
            "inherit_service_from_template",
            "get_my_clinics",
            "view_clinic_bookings",
            "get_clinic_today_summary",
            "confirm_booking_manager",
            "cancel_booking_manager",
            "get_available_staff_for_reassign",
            "reassign_staff_for_service",
            "analyze_revenue_trends",
            "get_clinic_metrics",
            "get_owner_stats_overview",
            "get_staff_schedule",
            "get_slot_availability",
            "sync_booking_draft",
            "get_booking_session_info",
            "close_booking_session",
        },
        "ADMIN": set(PUBLIC_BUSINESS_TOOLS),
    }

    @classmethod
    def get_allowed_tools(
        cls,
        user_role: Optional[str],
        context_type: Optional[str],
        available_tools: Optional[Sequence[str]] = None,
    ) -> List[str]:
        """Trả về tool whitelist đã filter theo role/context và tool availability."""
        normalized_context = normalize_context_type(context_type, BUSINESS_CHAT)
        normalized_role = cls.normalize_role(user_role)
        normalized_available = cls._normalize_tool_names(available_tools)

        if normalized_context == PLAYGROUND_TEST:
            if normalized_role != "ADMIN":
                return []
            if not normalized_available:
                return list(PLAYGROUND_TOOLS)
            return [
                tool
                for tool in normalized_available
                if tool.lower() in PLAYGROUND_TOOLS
            ]

        allowed_lookup = {
            tool.lower()
            for tool in cls.ROLE_BUSINESS_TOOLS.get(
                normalized_role, PUBLIC_BUSINESS_TOOLS
            )
        }

        if not normalized_available:
            return list(
                cls.ROLE_BUSINESS_TOOLS.get(normalized_role, PUBLIC_BUSINESS_TOOLS)
            )

        return [tool for tool in normalized_available if tool.lower() in allowed_lookup]

    @classmethod
    def build_system_prompt(
        cls,
        base_prompt: Optional[str],
        user_role: Optional[str],
        context_type: Optional[str],
        allowed_tools: Optional[Iterable[str]] = None,
    ) -> str:
        """Append prompt guardrails để agent nhìn thấy đúng context và whitelist hiện tại."""
        prompt = (base_prompt or "").rstrip()

        if not user_role and not context_type:
            return prompt

        normalized_role = cls.normalize_role(user_role)
        normalized_context = normalize_context_type(context_type, BUSINESS_CHAT)
        tool_list = list(dict.fromkeys(allowed_tools or []))
        tool_text = ", ".join(tool_list) if tool_list else "không có tool nào"
        role_style = ROLE_RESPONSE_STYLES.get(
            normalized_role,
            ROLE_RESPONSE_STYLES["PET_OWNER"],
        )
        product_mode = ROLE_PRODUCT_MODES.get(
            normalized_role,
            ROLE_PRODUCT_MODES["PET_OWNER"],
        )

        if normalized_context == PLAYGROUND_TEST:
            guardrail = (
                "Bạn đang chạy trong PLAYGROUND_TEST dành riêng cho ADMIN. "
                "Chỉ được dùng đúng các tool trong whitelist hiện tại: "
                f"{tool_text}. "
                "Nếu một tool không nằm trong danh sách này thì không được tự ý gọi. "
                f"{role_style} {product_mode}"
            )
        else:
            guardrail = (
                f"Bạn đang phục vụ hội thoại BUSINESS_CHAT cho role {normalized_role}. "
                "Chỉ được dùng các tool nghiệp vụ đã được whitelist cho role này: "
                f"{tool_text}. "
                "Nếu câu hỏi nằm ngoài các tool được phép thì hãy trả lời an toàn hoặc hướng dẫn người dùng liên hệ đúng bộ phận. "
                f"{role_style} {product_mode}"
            )

        if normalized_role == "STAFF":
            guardrail = (
                f"{guardrail} Với các câu hỏi chẩn đoán bệnh cho bác sĩ hoặc staff, không được dùng web_search "
                "hoặc nguồn web bên ngoài. Chỉ được dựa trên knowledge base nội bộ, dữ liệu EMR đã xác nhận "
                "và các nguồn nội bộ đáng tin cậy trong hệ thống. Nếu không tìm thấy thông tin phù hợp trong "
                "nguồn nội bộ, hãy trả lời rõ: 'Hiện chưa có thông tin về bệnh này trong hệ thống tri thức nội bộ.'"
            )

        if "create_booking_for_user" in tool_list:
            guardrail = (
                f"{guardrail} Không được gọi create_booking_for_user nếu người dùng chưa xác nhận rõ ràng đầy đủ thông tin booking. "
                "Trước khi tạo booking, phải tóm tắt loại khám, pet, clinic, ngày, giờ và dịch vụ để người dùng xác nhận. "
                "Nếu là HOME_VISIT thì còn phải có địa chỉ, tọa độ và khoảng cách di chuyển. "
                "Nếu dịch vụ là tiêm chủng, hãy giữ cách tư vấn giống flow thủ công: có thể nêu giá theo mũi/dose cho người dùng biết và chọn, "
                "nhưng không tự tạo flow riêng hoặc yêu cầu thông tin chuyên sâu không cần thiết."
            )

        if normalized_role in {"STAFF", "CLINIC_MANAGER", "CLINIC_OWNER"}:
            guardrail = (
                f"{guardrail} Khong duoc tu dong dan hoi thoai theo consumer booking wizard cua PET_OWNER "
                "(vi du: tu mo flow hoi pet -> dich vu -> phong kham -> gio) tru khi nguoi dung dang yeu cau ro rang mot thao tac booking noi bo va tool do duoc whitelist."
            )

        if normalized_role == "PET_OWNER":
            guardrail = (
                f"{guardrail} Tuyet doi khong xu ly nhu copilot van hanh clinic (doanh thu, dieu phoi staff, booking manager actions). "
                "Neu nguoi dung hoi van hanh noi bo clinic, hay thong bao ro rang day khong phai pham vi PET_OWNER chatbot."
            )

        if not prompt:
            return guardrail

        return f"{prompt}\n\n{guardrail}"

    @staticmethod
    def normalize_role(user_role: Optional[str]) -> str:
        return (user_role or "PET_OWNER").strip().upper()

    @staticmethod
    def _normalize_tool_names(tool_names: Optional[Sequence[str]]) -> List[str]:
        if not tool_names:
            return []

        normalized: List[str] = []
        seen = set()
        for tool_name in tool_names:
            if not tool_name:
                continue
            clean_name = str(tool_name).strip()
            lowered = clean_name.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            normalized.append(clean_name)
        return normalized
