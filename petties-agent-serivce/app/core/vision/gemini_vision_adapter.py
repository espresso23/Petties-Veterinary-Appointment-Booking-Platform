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

from app.api.schemas.diagnosis_contracts import (
    GeminiVisionDiagnosisRequest,
    GeminiVisionDiagnosisResponse,
    VisionTopCondition,
)
from app.core.services.disease_mapping_service import get_disease_mapping_service
from app.db.postgres.session import AsyncSessionLocal
from app.services.llm_client import get_llm_client_from_db


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
                missing_information=["No image provided"],
                safety_notes=[
                    "Vision analysis requires image input and does not replace clinical diagnosis."
                ],
            )

        try:
            prompt = self._build_prompt(request)
            async with AsyncSessionLocal() as db:
                llm_client = await get_llm_client_from_db(db)
            llm_response = await llm_client.generate(
                prompt=prompt,
                images=request.image_urls,
                temperature=0.1,
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
                missing_information=["Vision model response could not be parsed"],
                safety_notes=[
                    "Vision output is unavailable. Please rely on internal KB and confirmed EMR."
                ],
            )

    def _build_prompt(self, request: GeminiVisionDiagnosisRequest) -> str:
        symptoms = ", ".join(request.clinical_context.symptoms) or "none"
        return (
            "You are a veterinary image analysis assistant.\n"
            "Task: analyze provided pet medical image(s) and suggest top related conditions.\n"
            "Images are ordered exactly as uploaded. You must describe each image in the same order.\n"
            "Do not provide final diagnosis certainty. Return JSON only.\n\n"
            f"Species: {request.species.value}\n"
            f"Body part: {request.body_part or 'unknown'}\n"
            f"Doctor description: {request.doctor_description or 'none'}\n"
            f"Symptoms: {symptoms}\n"
            f"Duration: {request.clinical_context.duration or 'unknown'}\n"
            f"Age months: {request.clinical_context.age_months or 'unknown'}\n"
            f"Sex: {request.clinical_context.sex.value}\n\n"
            "Return strict JSON with keys:\n"
            "{\n"
            '  "visual_findings": ["..."],\n'
            '  "image_descriptions": ["description for image 1", "description for image 2"],\n'
            '  "top_conditions": [\n'
            "    {\n"
            '      "raw_label": "string",\n'
            '      "confidence_score": 0.0,\n'
            '      "reason": "string"\n'
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
