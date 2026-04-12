"""
Gemini vision adapter for doctor diagnostic flow.

This adapter:
- accepts standardized request contract
- sends image + text context to LLM provider (OpenRouter Gemini)
- parses structured JSON response
- maps condition labels to canonical disease codes
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from loguru import logger

from app.ai_diagnose.schemas import (
    GeminiVisionDiagnosisRequest,
    GeminiVisionDiagnosisResponse,
    VisionTopCondition,
)
from app.core.services.disease_mapping_service import get_disease_mapping_service
from app.db.postgres.session import AsyncSessionLocal
from app.services.llm_client import get_llm_client, get_llm_client_from_db


class GeminiVisionAdapter:
    """Adapter for image understanding in the new diagnosis architecture."""

    async def analyze(
        self, request: GeminiVisionDiagnosisRequest
    ) -> GeminiVisionDiagnosisResponse:
        if not request.image_urls:
            return GeminiVisionDiagnosisResponse(
                request_id=request.request_id,
                visual_findings=[],
                image_descriptions=[],
                top_conditions=[],
                needs_more_data=True,
                missing_information=["Chưa có hình ảnh để phân tích"],
                safety_notes=[
                    "Phân tích hình ảnh chỉ có giá trị hỗ trợ, không thay thế chẩn đoán lâm sàng."
                ],
            )

        try:
            prompt = self._build_prompt(request)
            logger.info(
                f"Vision analyze: {len(request.image_urls)} images for request {request.request_id}"
            )
            try:
                async with AsyncSessionLocal() as db:
                    llm_client = await get_llm_client_from_db(db)
            except Exception as exc:
                logger.warning(
                    f"DB-backed LLM config unavailable, fallback to env client: {exc}"
                )
                llm_client = get_llm_client()
            llm_response = await llm_client.generate(
                prompt=prompt,
                images=request.image_urls,
                temperature=0.1,
            )
            model_name = getattr(llm_response, "model", "unknown")
            logger.info(
                f"Vision LLM response length: {len(llm_response.content)} chars, model: {model_name}"
            )
            parsed = self._parse_response_content(llm_response.content)
            response = self._to_contract_response(request.request_id, parsed)
            return self._map_top_conditions(response)
        except Exception as exc:
            logger.error(f"Gemini vision adapter failed: {exc}")
            return GeminiVisionDiagnosisResponse(
                request_id=request.request_id,
                visual_findings=[],
                image_descriptions=[],
                top_conditions=[],
                needs_more_data=True,
                missing_information=[
                    "Không đọc được phản hồi từ mô hình phân tích ảnh"
                ],
                safety_notes=[
                    "Tạm thời không có kết quả từ mô hình ảnh. Hãy ưu tiên Knowledge Base nội bộ và EMR đã xác nhận."
                ],
            )

    def _build_prompt(self, request: GeminiVisionDiagnosisRequest) -> str:
        symptoms = ", ".join(request.clinical_context.symptoms) or "không có"
        return (
            "Bạn là trợ lý phân tích hình ảnh thú y cho bác sĩ.\n"
            "Nhiệm vụ: phân tích các ảnh bệnh lý của thú cưng, mô tả dấu hiệu nhìn thấy và gợi ý các hướng bệnh liên quan nhất.\n"
            "Ảnh được gửi theo đúng thứ tự upload, bạn phải mô tả đúng theo thứ tự đó.\n"
            "Tất cả nội dung trong JSON phải bằng tiếng Việt rõ ràng, ngắn gọn, không dùng tiếng Anh trừ tên thuốc hoặc thuật ngữ y khoa quá phổ biến.\n"
            "Không khẳng định chắc chắn chẩn đoán cuối cùng. Chỉ trả về JSON hợp lệ, không thêm markdown hay giải thích ngoài JSON.\n\n"
            f"Loài: {request.species.value}\n"
            f"Vùng nghi ngờ: {request.body_part or 'chưa rõ'}\n"
            f"Mô tả bác sĩ: {request.doctor_description or 'chưa có'}\n"
            f"Triệu chứng: {symptoms}\n"
            f"Thời gian diễn tiến: {request.clinical_context.duration or 'chưa rõ'}\n"
            f"Tuổi theo tháng: {request.clinical_context.age_months or 'chưa rõ'}\n"
            f"Giới tính: {request.clinical_context.sex.value}\n\n"
            "Trả về JSON nghiêm ngặt với các khóa:\n"
            "{\n"
            '  "visual_findings": ["..."],\n'
            '  "image_descriptions": ["mô tả ảnh 1", "mô tả ảnh 2"],\n'
            '  "top_conditions": [\n'
            "    {\n"
            '      "raw_label": "tên bệnh hoặc hướng bệnh",\n'
            '      "confidence_score": 0.0,\n'
            '      "reason": "lý do ngắn gọn bằng tiếng Việt"\n'
            "    }\n"
            "  ],\n"
            '  "needs_more_data": true,\n'
            '  "missing_information": ["..."],\n'
            '  "safety_notes": ["..."]\n'
            "}"
        )

    def _parse_response_content(self, content: str) -> Dict[str, Any]:
        content = (content or "").strip()
        if not content:
            raise ValueError("Empty vision response")

        # Try direct JSON first
        try:
            value = json.loads(content)
            if isinstance(value, dict):
                return value
        except json.JSONDecodeError:
            pass

        # Fallback: extract first JSON object block
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("No JSON object found in vision response")

        block = content[start : end + 1]
        value = json.loads(block)
        if not isinstance(value, dict):
            raise ValueError("Vision response JSON is not an object")
        return value

    def _to_contract_response(
        self, request_id: str, payload: Dict[str, Any]
    ) -> GeminiVisionDiagnosisResponse:
        visual_findings = payload.get("visual_findings", []) or []
        image_descriptions = payload.get("image_descriptions", []) or []
        top_conditions = payload.get("top_conditions", []) or []
        missing_information = payload.get("missing_information", []) or []
        safety_notes = payload.get("safety_notes", []) or []

        parsed_conditions: List[VisionTopCondition] = []
        for item in top_conditions:
            if not isinstance(item, dict):
                continue
            parsed_conditions.append(
                VisionTopCondition(
                    raw_label=str(item.get("raw_label", "")),
                    confidence_score=float(item.get("confidence_score", 0.0) or 0.0),
                    reason=str(item.get("reason", "")),
                )
            )

        return GeminiVisionDiagnosisResponse(
            request_id=request_id,
            visual_findings=[str(x) for x in visual_findings if isinstance(x, str)],
            image_descriptions=self._normalize_image_descriptions(image_descriptions),
            top_conditions=parsed_conditions,
            needs_more_data=bool(payload.get("needs_more_data", False)),
            missing_information=[
                str(x) for x in missing_information if isinstance(x, str)
            ],
            safety_notes=[str(x) for x in safety_notes if isinstance(x, str)],
        )

    def _map_top_conditions(
        self, response: GeminiVisionDiagnosisResponse
    ) -> GeminiVisionDiagnosisResponse:
        mapper = get_disease_mapping_service()
        mapped_conditions: List[VisionTopCondition] = []

        for condition in response.top_conditions:
            result = mapper.map_label(
                raw_label=condition.raw_label,
                source_type="vision",
            )
            mapped_conditions.append(
                VisionTopCondition(
                    raw_label=condition.raw_label,
                    canonical_code=result.canonical_code,
                    display_name_vi=result.display_name_vi,
                    confidence_score=condition.confidence_score,
                    reason=condition.reason,
                    unmapped_label=not result.mapped,
                )
            )

        return GeminiVisionDiagnosisResponse(
            request_id=response.request_id,
            visual_findings=response.visual_findings,
            image_descriptions=response.image_descriptions,
            top_conditions=mapped_conditions,
            needs_more_data=response.needs_more_data,
            missing_information=response.missing_information,
            safety_notes=response.safety_notes,
        )

    def _normalize_image_descriptions(self, raw_items: Any) -> List[str]:
        if not isinstance(raw_items, list):
            return []

        descriptions: List[str] = []
        for item in raw_items:
            if isinstance(item, str):
                descriptions.append(item)
                continue
            if isinstance(item, dict):
                value = item.get("description")
                if isinstance(value, str):
                    descriptions.append(value)
        return descriptions


_gemini_vision_adapter: Optional[GeminiVisionAdapter] = None


def get_gemini_vision_adapter() -> GeminiVisionAdapter:
    global _gemini_vision_adapter
    if _gemini_vision_adapter is None:
        _gemini_vision_adapter = GeminiVisionAdapter()
    return _gemini_vision_adapter
