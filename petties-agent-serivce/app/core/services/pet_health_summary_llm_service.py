"""
Pet Health Summary LLM Synthesis Service.

Package: app.core.services
Purpose: Tổng hợp thông tin sức khỏe pet bằng LLM (Gemini)
"""

from typing import Dict, Any, Optional
from loguru import logger
import json

from app.services.llm_client import create_llm_client, LLMConfig


class PetHealthSummaryLLMService:
    """Service để tổng hợp health summary bằng LLM."""

    _instance: Optional["PetHealthSummaryLLMService"] = None

    def __new__(cls) -> "PetHealthSummaryLLMService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._llm_client = create_llm_client(
            LLMConfig(
                provider="openrouter",
                model="google/gemini-2.0-flash-001",
                temperature=0.3,
                max_tokens=1500,
            )
        )

    async def synthesize_summary(
        self,
        pet_info: Dict[str, Any],
        emr_records: list,
        user_name: str = "",
    ) -> Dict[str, Any]:
        """
        Tổng hợp health summary bằng LLM.

        Args:
            pet_info: Thông tin pet cơ bản
            emr_records: Danh sách EMR records (đã sắp xếp theo ngày giảm dần)
            user_name: Tên chủ pet (để personalize)

        Returns:
            Dict chứa: latest_emr_summary, health_warnings, medication_reminders, suggested_actions, ai_insights
        """
        if not emr_records:
            return await self._synthesize_no_history(pet_info, user_name)

        latest_emr = emr_records[0]
        recent_emrs = emr_records[:3] if len(emr_records) > 1 else []

        prompt = self._build_prompt(pet_info, latest_emr, recent_emrs, user_name)

        try:
            response = await self._llm_client.generate(prompt)
            return self._parse_llm_response(response.content, latest_emr)
        except Exception as e:
            logger.error(f"LLM synthesis failed: {e}")
            return {
                "error": f"Không thể tổng hợp thông tin: {str(e)}",
                "latest_emr_summary": None,
                "health_warnings": [],
                "medication_reminders": [],
                "suggested_actions": [],
                "ai_insights": None,
            }

    async def _synthesize_no_history(
        self, pet_info: Dict[str, Any], user_name: str
    ) -> Dict[str, Any]:
        """Tổng hợp khi không có EMR history."""
        pet_name = pet_info.get("name", "thú cưng")
        species = pet_info.get("species", "")
        breed = pet_info.get("breed", "")

        prompt = f"""Bạn là bác sĩ thú y virtual của Petties. Hãy tạo thông tin tổng quang sức khỏe cho pet của user.

Pet: {pet_name}
Loài: {species}
Giống: {breed}

User chưa có lịch sử khám cho thú cưng này. Hãy:
1. Tạo lời chào welcome cho user
2. Gợi ý hành động phù hợp (đặt lịch khám lần đầu)
3. Cung cấp vài mẹo chăm sóc sức khỏe ban đầu

Trả về JSON format:
{{
  "welcome_message": "...",
  "suggested_actions": [
    {{"type": "BOOK_FIRST_VISIT", "label": "...", "reason": "..."}}
  ],
  "care_tips": ["...", "..."]
}}
"""

        try:
            response = await self._llm_client.generate(prompt)
            parsed = json.loads(response.content)
            return {
                "latest_emr_summary": None,
                "health_warnings": [],
                "medication_reminders": [],
                "suggested_actions": parsed.get("suggested_actions", []),
                "ai_insights": {
                    "welcome": parsed.get("welcome_message", ""),
                    "care_tips": parsed.get("care_tips", []),
                },
            }
        except Exception as e:
            logger.error(f"LLM synthesis for no history failed: {e}")
            return {
                "latest_emr_summary": None,
                "health_warnings": [],
                "medication_reminders": [],
                "suggested_actions": [
                    {
                        "type": "BOOK_FIRST_VISIT",
                        "label": "Đặt lịch khám lần đầu",
                        "reason": "Pet chưa có lịch sử khám",
                    }
                ],
                "ai_insights": None,
            }

    def _build_prompt(
        self,
        pet_info: Dict[str, Any],
        latest_emr: Dict[str, Any],
        recent_emrs: list,
        user_name: str,
    ) -> str:
        """Build prompt cho LLM."""
        pet_name = pet_info.get("name", "thú cưng")
        species = pet_info.get("species", "")
        breed = pet_info.get("breed", "")
        age_months = pet_info.get("ageMonths") or pet_info.get("age_months")
        weight = pet_info.get("weightKg") or pet_info.get("weight")

        age_str = (
            f"{age_months // 12} tuổi {age_months % 12} tháng"
            if age_months
            else "không rõ tuổi"
        )

        emr_json = json.dumps(latest_emr, ensure_ascii=False, indent=2)
        recent_json = (
            json.dumps(recent_emrs, ensure_ascii=False, indent=2)
            if recent_emrs
            else "[]"
        )

        prompt = f"""Bạn là bác sĩ thú y virtual của Petties. Hãy phân tích và tổng hợp thông tin sức khỏe cho pet của user.

# Thông tin Pet:
- Tên: {pet_name}
- Loài: {species}
- Giống: {breed}
- Tuổi: {age_str}
- Cân nặng: {weight} kg

# EMR gần nhất:
{emr_json}

# EMR gần đây (để so sánh):
{recent_json}

# Nhiệm vụ:
Phân tích thông tin trên và trả về JSON format:

```json
{{
  "latest_emr_summary": {{
    "exam_date": "Ngày khám",
    "clinic_name": "Tên phòng khám",
    "diagnosis": "Tóm tắt chẩn đoán ngắn gọn",
    "treatment": "Tóm tắt điều trị",
    "key_findings": ["Điểm quan trọng 1", "Điểm quan trọng 2"]
  }},
  "health_warnings": [
    {{"type": "RECHECK_REQUIRED|ALLERGY_ALERT|MEDICATION|NUTRITION|OTHER", "message": "Mô tả cảnh báo", "severity": "HIGH|MEDIUM|LOW"}}
  ],
  "medication_reminders": [
    {{"medication": "Tên thuốc", "dosage": "Liều lượng", "frequency": "Tần suất", "purpose": "Mục đích"}}
  ],
  "suggested_actions": [
    {{"type": "BOOK_APPOINTMENT|FOLLOW_UP|VACCINATION|NUTRITION|OTHER", "label": "Nút bấm", "reason": "Lý do"}}
  ],
  "ai_insights": {{
    "summary": "Tóm tắt sức khỏe tổng quát 2-3 câu",
    "trends": "Nhận xét xu hướng so với lần khám trước (nếu có)",
    "advice": "Lời khuyên ngắn cho chủ pet"
  }}
}}
```

Lưu ý:
- Chỉ trả về JSON, không có text khác
- Nếu không có thông tin nào thì để null hoặc mảng rỗng
- Severity: HIGH (cần hành động ngay), MEDIUM (nên theo dõi), LOW (thông tin)
- Dùng tiếng Việt
"""

        return prompt

    def _parse_llm_response(
        self, response: str, latest_emr: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Parse LLM response thành structured output."""
        try:
            json_match = response.strip().split("```json")[-1].split("```")[0]
            parsed = json.loads(json_match.strip())
            return {
                "latest_emr_summary": parsed.get("latest_emm_summary")
                or parsed.get("latest_emr_summary"),
                "health_warnings": parsed.get("health_warnings", []),
                "medication_reminders": parsed.get("medication_reminders", []),
                "suggested_actions": parsed.get("suggested_actions", []),
                "ai_insights": parsed.get("ai_insights"),
            }
        except (json.JSONDecodeError, IndexError) as e:
            logger.warning(f"Failed to parse LLM response: {e}, using fallback")
            return self._fallback_parse(latest_emr)

    def _fallback_parse(self, latest_emr: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback khi parse fail."""
        assessment = latest_emr.get("assessment", "")
        plan = latest_emr.get("plan", "")

        warnings = []
        if assessment:
            if "dị ứng" in assessment.lower() or "allergy" in assessment.lower():
                warnings.append(
                    {
                        "type": "ALLERGY_ALERT",
                        "message": "Pet có tiền sử dị ứng",
                        "severity": "HIGH",
                    }
                )

        return {
            "latest_emr_summary": {
                "exam_date": latest_emr.get("examDate", ""),
                "diagnosis": assessment[:100] if assessment else "Không có",
                "treatment": plan[:100] if plan else "Không có",
            },
            "health_warnings": warnings,
            "medication_reminders": [],
            "suggested_actions": [
                {
                    "type": "FOLLOW_UP",
                    "label": "Tái khám",
                    "reason": "Kiểm tra tiến triển",
                }
            ],
            "ai_insights": None,
        }


_pet_health_summary_service: Optional[PetHealthSummaryLLMService] = None


def get_pet_health_summary_llm_service() -> PetHealthSummaryLLMService:
    global _pet_health_summary_service
    if _pet_health_summary_service is None:
        _pet_health_summary_service = PetHealthSummaryLLMService()
    return _pet_health_summary_service
