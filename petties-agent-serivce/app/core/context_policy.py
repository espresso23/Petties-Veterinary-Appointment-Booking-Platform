"""
PETTIES AGENT SERVICE - Context Policy Service
Role/context-based tool governance cho business chat va admin playground.

Package: app.core
Purpose:
    - Xac dinh tool whitelist theo user_role va context_type
    - Bo sung prompt guardrails theo context de agent khong dung sai tool
"""

from typing import Iterable, List, Optional, Sequence

from app.core.chat_context import BUSINESS_CHAT, PLAYGROUND_TEST, normalize_context_type


PUBLIC_BUSINESS_TOOLS = {
    "pet_care_qa",
    "symptom_search",
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


class ContextPolicyService:
    """Service xay dung tool whitelist va prompt guardrails theo role/context."""

    ROLE_BUSINESS_TOOLS = {
        "PET_OWNER": {
            "pet_care_qa",
            "symptom_search",
            "web_search",
            "get_user_pets",
            "search_clinics_nearby",
            "check_available_slots",
            "create_booking_for_user",
            "get_clinic_services",
            "analyze_pet_image",
        },
        "STAFF": {
            "pet_care_qa",
            "symptom_search",
            "web_search",
            "get_user_pets",
            "search_clinics_nearby",
            "check_available_slots",
            "create_booking_for_user",
            "get_clinic_services",
            "analyze_pet_image",
            "get_patient_summary",
            "get_emr_history",
            "check_vaccination_status",
        },
        "CLINIC_MANAGER": {
            "pet_care_qa",
            "symptom_search",
            "web_search",
            "get_user_pets",
            "search_clinics_nearby",
            "check_available_slots",
            "create_booking_for_user",
            "get_clinic_services",
            "analyze_pet_image",
            "get_patient_summary",
            "get_emr_history",
            "check_vaccination_status",
            "analyze_revenue_trends",
            "suggest_staff_assignments",
            "create_staff_shifts",
            "optimize_schedules",
            "accept_sos_booking",
        },
        "CLINIC_OWNER": {
            "pet_care_qa",
            "symptom_search",
            "web_search",
            "get_user_pets",
            "search_clinics_nearby",
            "check_available_slots",
            "create_booking_for_user",
            "get_clinic_services",
            "analyze_pet_image",
            "get_patient_summary",
            "get_emr_history",
            "check_vaccination_status",
            "analyze_revenue_trends",
            "suggest_staff_assignments",
            "create_staff_shifts",
            "optimize_schedules",
            "accept_sos_booking",
            "generate_clinic_services",
            "compose_clinic_description",
            "suggest_service_pricing",
            "analyze_vet_workload",
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
        """Tra ve tool whitelist da filter theo role/context va tool availability."""
        normalized_context = normalize_context_type(context_type, BUSINESS_CHAT)
        normalized_role = cls.normalize_role(user_role)
        normalized_available = cls._normalize_tool_names(available_tools)

        if normalized_context == PLAYGROUND_TEST:
            if normalized_role != "ADMIN":
                return []
            return normalized_available

        allowed_lookup = {
            tool.lower()
            for tool in cls.ROLE_BUSINESS_TOOLS.get(normalized_role, PUBLIC_BUSINESS_TOOLS)
        }

        if not normalized_available:
            return list(cls.ROLE_BUSINESS_TOOLS.get(normalized_role, PUBLIC_BUSINESS_TOOLS))

        return [tool for tool in normalized_available if tool.lower() in allowed_lookup]

    @classmethod
    def build_system_prompt(
        cls,
        base_prompt: Optional[str],
        user_role: Optional[str],
        context_type: Optional[str],
        allowed_tools: Optional[Iterable[str]] = None,
    ) -> str:
        """Append prompt guardrails de agent nhin thay dung context va whitelist hien tai."""
        prompt = (base_prompt or "").rstrip()

        if not user_role and not context_type:
            return prompt

        normalized_role = cls.normalize_role(user_role)
        normalized_context = normalize_context_type(context_type, BUSINESS_CHAT)
        tool_list = list(dict.fromkeys(allowed_tools or []))
        tool_text = ", ".join(tool_list) if tool_list else "khong co tool nao"
        role_style = ROLE_RESPONSE_STYLES.get(
            normalized_role,
            ROLE_RESPONSE_STYLES["PET_OWNER"],
        )

        if normalized_context == PLAYGROUND_TEST:
            guardrail = (
                "Bạn đang chạy trong PLAYGROUND_TEST dành riêng cho ADMIN. "
                "Chỉ được dùng đúng các tool trong whitelist hiện tại: "
                f"{tool_text}. "
                "Nếu một tool không nằm trong danh sách này thì không được tự ý gọi. "
                f"{role_style}"
            )
        else:
            guardrail = (
                f"Bạn đang phục vụ hội thoại BUSINESS_CHAT cho role {normalized_role}. "
                "Chỉ được dùng các tool nghiệp vụ đã được whitelist cho role này: "
                f"{tool_text}. "
                "Nếu câu hỏi nằm ngoài các tool được phép thì hãy trả lời an toàn hoặc hướng dẫn người dùng liên hệ đúng bộ phận. "
                f"{role_style}"
            )

        if "create_booking_for_user" in tool_list:
            guardrail = (
                f"{guardrail} Không được gọi create_booking_for_user nếu người dùng chưa xác nhận rõ ràng đầy đủ thông tin booking. "
                "Trước khi tạo booking, phải tóm tắt pet, clinic, ngày, giờ và dịch vụ để người dùng xác nhận."
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