"""Pet Health Summary synthesis service."""

from __future__ import annotations

import json
from typing import Any, Dict, Optional

from loguru import logger

from app.db.postgres.session import AsyncSessionLocal
from app.services.llm_client import BaseLLMClient, get_llm_client_from_db


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
        self._llm_client: Optional[BaseLLMClient] = None

    async def _get_llm_client(self) -> BaseLLMClient:
        if self._llm_client is not None:
            return self._llm_client

        async with AsyncSessionLocal() as db:
            self._llm_client = await get_llm_client_from_db(db)
        return self._llm_client

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
            emr_records: Danh sách EMR records, đã sắp xếp theo ngày giảm dần
            user_name: Tên chủ pet

        Returns:
            Dict chứa: latest_emr_summary, health_warnings, medication_reminders, suggested_actions, ai_insights
        """
        if not emr_records:
            return await self._synthesize_no_history(pet_info, user_name)

        latest_emr = emr_records[0]
        recent_emrs = emr_records[:3] if len(emr_records) > 1 else []

        prompt = self._build_prompt(pet_info, latest_emr, recent_emrs, user_name)

        try:
            llm_client = await self._get_llm_client()
            response = await llm_client.generate(prompt, temperature=0.3, max_tokens=1500)
            return self._parse_llm_response(response.content, latest_emr)
        except Exception as exc:
            logger.error(f"LLM synthesis failed: {exc}")
            return self._fallback_parse(latest_emr)

    async def _synthesize_no_history(
        self, pet_info: Dict[str, Any], user_name: str
    ) -> Dict[str, Any]:
        """Tổng hợp khi không có EMR history."""
        pet_name = pet_info.get("name", "thú cưng")
        species = pet_info.get("species", "")
        breed = pet_info.get("breed", "")

        prompt = f"""Bạn là trợ lý tóm tắt hồ sơ bệnh án cho staff/phòng khám thú y của Petties.
Nội dung dùng nội bộ trên màn tạo EMR, không viết như đang tư vấn cho chủ nuôi.
Văn phong ngắn gọn, lâm sàng, ưu tiên giúp staff nắm nhanh tình trạng hồ sơ.

Pet: {pet_name}
Loài: {species}
Giống: {breed}

Bệnh nhân chưa có lịch sử EMR. Hãy:
1. Xác nhận đây là ca chưa có hồ sơ khám trước đó.
2. Đề xuất các bước staff nên thực hiện khi tiếp nhận ban đầu.
3. Không dùng lời chào, không xưng hô với chủ nuôi, không đưa mẹo chăm sóc kiểu consumer.

Trả về JSON format:
{{
  "staff_summary": "...",
  "suggested_actions": [
    {{"type": "BOOK_FIRST_VISIT", "label": "...", "reason": "..."}}
  ],
  "intake_notes": ["...", "..."]
}}
"""

        try:
            llm_client = await self._get_llm_client()
            response = await llm_client.generate(prompt, temperature=0.3, max_tokens=1500)
            parsed = json.loads(response.content)
            return {
                "latest_emr_summary": None,
                "health_warnings": [],
                "medication_reminders": [],
                "suggested_actions": parsed.get("suggested_actions", []),
                "ai_insights": {
                    "summary": parsed.get("staff_summary", ""),
                    "intake_notes": parsed.get("intake_notes", []),
                },
            }
        except Exception as exc:
            logger.error(f"LLM synthesis for no history failed: {exc}")
            return {
                "latest_emr_summary": None,
                "health_warnings": [],
                "medication_reminders": [],
                "suggested_actions": [
                    {
                        "type": "BOOK_FIRST_VISIT",
                        "label": "Tiếp nhận khám ban đầu",
                        "reason": "Bệnh nhân chưa có EMR trước đó",
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

        return f"""Bạn là trợ lý AI tóm tắt hồ sơ bệnh án cho staff/phòng khám thú y của Petties.
Mục tiêu là giúp staff xem nhanh lịch sử khám trước khi tạo EMR mới.
Không viết như đang tư vấn cho pet owner. Không dùng lời khuyên chung chung cho chủ nuôi. Không thêm phần mở đầu hoặc kết luận xã giao.
Ưu tiên văn phong ngắn, rõ, thiên về lâm sàng và vận hành nội bộ.

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
    "diagnosis": "Tóm tắt chẩn đoán ngắn gọn theo ngôn ngữ chuyên môn",
    "treatment": "Tóm tắt điều trị hoặc hướng xử trí đã ghi nhận",
    "key_findings": ["Điểm lâm sàng quan trọng 1", "Điểm lâm sàng quan trọng 2"]
  }},
  "health_warnings": [
    {{"type": "RECHECK_REQUIRED|ALLERGY_ALERT|MEDICATION|NUTRITION|OTHER", "message": "Cảnh báo ngắn gọn để staff lưu ý", "severity": "HIGH|MEDIUM|LOW"}}
  ],
  "medication_reminders": [
    {{"medication": "Tên thuốc", "dosage": "Liều lượng", "frequency": "Tần suất", "purpose": "Mục đích"}}
  ],
  "suggested_actions": [
    {{"type": "BOOK_APPOINTMENT|FOLLOW_UP|VACCINATION|NUTRITION|OTHER", "label": "Hành động staff nên thực hiện", "reason": "Lý do ngắn gọn"}}
  ],
  "ai_insights": {{
    "summary": "Tóm tắt hồ sơ lâm sàng 2-3 câu dành cho staff",
    "trends": "Nhận xét xu hướng so với lần khám trước nếu có",
    "advice": "Khuyến nghị nội bộ cho staff, không xưng hô với chủ nuôi"
  }}
}}
```

Lưu ý:
- Chỉ trả về JSON, không có text khác
- Nếu không có thông tin nào thì để null hoặc mảng rỗng
- Severity: HIGH (cần hành động ngay), MEDIUM (nên theo dõi), LOW (thông tin)
- Dùng tiếng Việt
- Không dùng các cụm kiểu "bạn nên", "chủ nuôi nên", "hãy theo dõi bé tại nhà"
"""

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
        except (json.JSONDecodeError, IndexError) as exc:
            logger.warning(f"Failed to parse LLM response: {exc}, using fallback")
            return self._fallback_parse(latest_emr)

    def _fallback_parse(self, latest_emr: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback khi parse fail."""
        assessment = latest_emr.get("assessment", "")
        plan = latest_emr.get("plan", "")

        warnings = []
        if assessment and (
            "dị ứng" in assessment.lower() or "allergy" in assessment.lower()
        ):
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
