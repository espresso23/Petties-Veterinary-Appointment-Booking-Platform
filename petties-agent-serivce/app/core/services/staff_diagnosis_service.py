"""
Staff diagnosis synthesis service.

This service combines:
- Gemini Vision for image understanding
- Hybrid RAG for internal knowledge-base and knowledge-graph evidence
- Case Memory for confirmed EMR cases
- DB-backed disease mapping
- Diagnosis protocols so SOAP and prescriptions stay aligned

No web search is used in the doctor diagnostic flow.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from uuid import uuid4

from loguru import logger

from app.api.schemas.diagnosis_contracts import (
    DiagnosisClinicalContext,
    DiagnosisSuggestion,
    DoctorDiagnosisSynthesisResponse,
    GeminiVisionDiagnosisRequest,
    GeminiVisionDiagnosisResponse,
    PrescriptionSuggestion,
    SoapSuggestions,
    StaffDiagnosisRequest,
)
from app.core.rag.case_memory import CaseResult, get_case_memory_service
from app.core.rag.hybrid_engine import HybridChunk, HybridResult, get_hybrid_rag_engine
from app.core.services.diagnosis_protocol_service import (
    ProtocolDecision,
    get_diagnosis_protocol_service,
)
from app.core.services.disease_mapping_service import get_disease_mapping_service
from app.core.vision.gemini_vision_adapter import get_gemini_vision_adapter
from app.db.postgres.session import AsyncSessionLocal
from app.services.llm_client import BaseLLMClient, get_llm_client_from_db


@dataclass
class DifferentialCandidate:
    canonical_code: Optional[str]
    display_name_vi: str
    score: float = 0.0
    supporting_reasons: List[str] = field(default_factory=list)

    def add_reason(self, reason: str) -> None:
        reason = (reason or "").strip()
        if reason and reason not in self.supporting_reasons:
            self.supporting_reasons.append(reason)


class StaffDiagnosisService:
    """Build staff diagnosis response from multimodal input and internal evidence."""

    def __init__(self) -> None:
        self._llm_client: Optional[BaseLLMClient] = None

    async def analyze_case(
        self,
        request: StaffDiagnosisRequest,
    ) -> DoctorDiagnosisSynthesisResponse:
        request_id = request.request_id or str(uuid4())

        service = get_disease_mapping_service()
        if service._should_refresh():
            await service.refresh_from_db()

        vision_response = GeminiVisionDiagnosisResponse(request_id=request_id)
        if request.image_analysis_mode == "describe_only":
            if request.image_urls:
                vision_response = await self._analyze_vision(request_id, request)
            return DoctorDiagnosisSynthesisResponse(
                request_id=request_id,
                vision_findings=vision_response.visual_findings,
                image_descriptions=vision_response.image_descriptions,
                image_analysis=self._build_image_analysis(
                    request.image_urls, vision_response
                ),
                disclaimer="Mô tả ảnh do AI hỗ trợ. Bác sĩ cần đối chiếu thăm khám lâm sàng.",
            )
        preloaded_cases = await self._query_case_memory(
            query=self._build_case_memory_prefetch_query(request),
            request=request,
        )
        if self._should_run_vision(request, preloaded_cases):
            vision_response = await self._analyze_vision(request_id, request)
        elif request.image_urls:
            logger.debug(
                "Skipped image analysis for request {} due to strong case match",
                request_id,
            )

        retrieval_query = self._build_retrieval_query(request, vision_response)
        hybrid_result, similar_cases = await self._retrieve_internal_context(
            query=retrieval_query,
            request=request,
            preloaded_cases=preloaded_cases,
        )

        top_differentials = self._build_top_differentials(
            request=request,
            vision_response=vision_response,
            hybrid_result=hybrid_result,
            similar_cases=similar_cases,
        )
        protocol_decision = get_diagnosis_protocol_service().build_decision(
            request=request,
            primary_diagnosis=top_differentials[0] if top_differentials else None,
        )
        emr_protocol_patterns = self._extract_protocol_patterns_from_cases(
            similar_cases
        )
        if emr_protocol_patterns:
            logger.info(
                f"Found {len(emr_protocol_patterns)} protocol patterns from EMR cases"
            )
            protocol_decision = get_diagnosis_protocol_service().apply_emr_patterns(
                protocol_decision=protocol_decision,
                emr_patterns=emr_protocol_patterns,
                request=request,
            )

        has_internal_evidence = bool(hybrid_result.chunks or similar_cases)
        if not has_internal_evidence:
            protocol_decision.summary = (
                "Chưa có đủ bằng chứng nội bộ từ Knowledge Base hoặc Case Memory. "
                "AI có thể dựa vào triệu chứng và kiến thức chung để gợi ý đơn thuốc tham khảo. "
                + protocol_decision.summary
            ).strip()

        llm_synthesis = await self._synthesize_with_llm(
            request=request,
            top_differentials=top_differentials,
            hybrid_result=hybrid_result,
            similar_cases=similar_cases,
            protocol_decision=protocol_decision,
            vision_response=vision_response,
        )
        if llm_synthesis and llm_synthesis.get("top_differentials"):
            top_differentials = llm_synthesis["top_differentials"]

        image_analysis = self._build_image_analysis(request.image_urls, vision_response)
        suggested_questions = (
            llm_synthesis.get("suggested_questions") if llm_synthesis else None
        )
        soap_suggestions = (
            llm_synthesis.get("soap_suggestions") if llm_synthesis else None
        )

        llm_prescriptions = (
            llm_synthesis.get("prescription_suggestions") if llm_synthesis else None
        )
        has_protocol_prescriptions = bool(protocol_decision.prescriptions)
        if has_protocol_prescriptions:
            final_prescriptions = protocol_decision.prescriptions
        elif llm_prescriptions:
            final_prescriptions = llm_prescriptions
        else:
            final_prescriptions = []

        has_llm_prescription = (
            bool(llm_prescriptions) and not has_protocol_prescriptions
        )

        return DoctorDiagnosisSynthesisResponse(
            request_id=request_id,
            top_differentials=top_differentials,
            supporting_evidence_from_kb=self._format_hybrid_evidence(hybrid_result),
            similar_confirmed_cases=self._format_similar_cases(similar_cases),
            vision_findings=vision_response.visual_findings,
            image_descriptions=vision_response.image_descriptions,
            image_analysis=image_analysis,
            suggested_questions=suggested_questions
            or self._build_follow_up_questions(request, protocol_decision),
            soap_suggestions=soap_suggestions
            or self._build_soap_suggestions(
                request=request,
                top_differentials=top_differentials,
                vision_response=vision_response,
                hybrid_result=hybrid_result,
                similar_cases=similar_cases,
                protocol_decision=protocol_decision,
            ),
            prescription_suggestions=final_prescriptions,
            disclaimer="Gợi ý từ tài liệu nội bộ. Bác sĩ cần xác nhận lại chẩn đoán."
            + (
                " Lưu ý: Đơn thuốc được gợi ý từ AI - cần bác sĩ xác nhận trước khi kê đơn."
                if has_llm_prescription
                else ""
            ),
        )

    async def _analyze_vision(
        self,
        request_id: str,
        request: StaffDiagnosisRequest,
    ) -> GeminiVisionDiagnosisResponse:
        vision_request = GeminiVisionDiagnosisRequest(
            request_id=request_id,
            species=request.species,
            image_urls=request.image_urls,
            doctor_description=request.doctor_description,
            body_part=request.body_part,
            clinical_context=DiagnosisClinicalContext(
                symptoms=request.symptoms,
                age_months=request.age_months,
                sex=request.sex,
            ),
        )
        try:
            return await get_gemini_vision_adapter().analyze(vision_request)
        except Exception as exc:
            logger.warning("Vision analysis failed in staff diagnosis: {}", exc)
            return GeminiVisionDiagnosisResponse(request_id=request_id)

    async def _retrieve_internal_context(
        self,
        *,
        query: str,
        request: StaffDiagnosisRequest,
        preloaded_cases: Optional[List[CaseResult]] = None,
    ) -> tuple[HybridResult, List[CaseResult]]:
        hybrid_task = self._query_hybrid_rag(query=query, request=request)
        if preloaded_cases is not None:
            hybrid_result = await hybrid_task
            return hybrid_result, preloaded_cases
        case_task = self._query_case_memory(query=query, request=request)
        return await asyncio.gather(hybrid_task, case_task)

    async def _query_hybrid_rag(
        self,
        *,
        query: str,
        request: StaffDiagnosisRequest,
    ) -> HybridResult:
        try:
            return await get_hybrid_rag_engine().query(
                query=query,
                top_k=5,
                min_score=0.45,
                pet_type=request.species.value,
                enable_rag=True,
                enable_kg=True,
                enable_case_memory=False,
            )
        except Exception as exc:
            logger.warning("Hybrid RAG query failed in staff diagnosis: {}", exc)
            return HybridResult(
                chunks=[],
                expanded_query=query,
                original_query=query,
                sources_used={},
            )

    async def _query_case_memory(
        self,
        *,
        query: str,
        request: StaffDiagnosisRequest,
    ) -> List[CaseResult]:
        try:
            return await get_case_memory_service().search_similar(
                query=query,
                top_k=3,
                min_score=0.6,
                image_urls=request.image_urls or None,
            )
        except Exception as exc:
            logger.warning("Case memory search failed in staff diagnosis: {}", exc)
            return []

    def _build_case_memory_prefetch_query(self, request: StaffDiagnosisRequest) -> str:
        parts: List[str] = [request.species.value]
        if request.breed:
            parts.append(request.breed)
        if request.body_part:
            parts.append(f"Vùng nghi ngờ: {request.body_part}")
        if request.doctor_description:
            parts.append(request.doctor_description)
        if request.symptoms:
            parts.append("Triệu chứng: " + ", ".join(request.symptoms))
        return (
            " | ".join(part for part in parts if part).strip() or request.species.value
        )

    def _should_run_vision(
        self, request: StaffDiagnosisRequest, similar_cases: List[CaseResult]
    ) -> bool:
        if not request.image_urls:
            return False
        if not similar_cases:
            return True

        top_case = similar_cases[0]
        payload = top_case.payload or {}

        has_diagnosis = bool(
            payload.get("display_name_vi")
            or payload.get("final_diagnosis_text")
            or payload.get("canonical_code")
        )
        if not has_diagnosis:
            return True

        is_provisional = payload.get("mapping_status") == "provisional"
        confirmation_count = payload.get("confirmation_count", 0)

        has_image_match = bool(request.image_urls)
        threshold = 0.7 if has_image_match else 0.85
        min_confirmations = 3

        if is_provisional:
            threshold += 0.1

        is_strong_match = (
            top_case.final_score >= threshold
            and confirmation_count >= min_confirmations
        )

        logger.debug(
            "Vision decision for request {}: score={:.2f} (threshold={}), "
            "confirmations={} (min={}), is_provisional={}, run_vision={}",
            request.request_id,
            top_case.final_score,
            threshold,
            confirmation_count,
            min_confirmations,
            is_provisional,
            not is_strong_match,
        )

        return not is_strong_match

    async def _get_llm_client(self) -> BaseLLMClient:
        if self._llm_client is not None:
            return self._llm_client
        async with AsyncSessionLocal() as db:
            self._llm_client = await get_llm_client_from_db(db)
        return self._llm_client

    def _build_retrieval_query(
        self,
        request: StaffDiagnosisRequest,
        vision_response: GeminiVisionDiagnosisResponse,
    ) -> str:
        parts: List[str] = [request.species.value]

        if request.breed:
            parts.append(request.breed)
        if request.weight_kg:
            parts.append(f"Cân nặng: {request.weight_kg:.1f} kg")
        if request.body_part:
            parts.append(f"Vùng nghi ngờ: {request.body_part}")
        if request.doctor_description:
            parts.append(request.doctor_description)
        if request.symptoms:
            parts.append("Triệu chứng: " + ", ".join(request.symptoms))
        if request.allergies:
            parts.append("Dị ứng đã biết: " + ", ".join(request.allergies))
        if vision_response.visual_findings:
            parts.append(
                "Dấu hiệu ảnh: " + "; ".join(vision_response.visual_findings[:3])
            )
        if vision_response.top_conditions:
            parts.append(
                "Nhãn bệnh từ ảnh: "
                + ", ".join(
                    condition.display_name_vi or condition.raw_label
                    for condition in vision_response.top_conditions[:3]
                )
            )

        return (
            " | ".join(part for part in parts if part).strip() or request.species.value
        )

    async def _synthesize_with_llm(
        self,
        *,
        request: StaffDiagnosisRequest,
        top_differentials: List[DiagnosisSuggestion],
        hybrid_result: HybridResult,
        similar_cases: List[CaseResult],
        protocol_decision: ProtocolDecision,
        vision_response: GeminiVisionDiagnosisResponse,
    ) -> Optional[Dict[str, Any]]:
        try:
            llm_client = await self._get_llm_client()
            response = await llm_client.generate(
                self._build_llm_synthesis_prompt(
                    request=request,
                    top_differentials=top_differentials,
                    hybrid_result=hybrid_result,
                    similar_cases=similar_cases,
                    protocol_decision=protocol_decision,
                    vision_response=vision_response,
                ),
                temperature=0.2,
                max_tokens=1800,
            )
            logger.debug(
                f"LLM synthesis raw response (first 500 chars): {response.content[:500]}"
            )
            parsed = self._parse_llm_synthesis_response(
                response.content,
                top_differentials,
            )
            if parsed:
                logger.info(
                    f"LLM synthesis parsed: top_differentials={len(parsed.get('top_differentials', []))}, "
                    f"prescriptions={len(parsed.get('prescription_suggestions', []))}, "
                    f"soap_suggestions={'yes' if parsed.get('soap_suggestions') else 'no'}"
                )
            else:
                logger.warning("LLM synthesis response parsing failed")
            return parsed
        except Exception as exc:
            logger.warning("Staff diagnosis LLM synthesis failed: {}", exc)
            return None

    def _build_llm_synthesis_prompt(
        self,
        *,
        request: StaffDiagnosisRequest,
        top_differentials: List[DiagnosisSuggestion],
        hybrid_result: HybridResult,
        similar_cases: List[CaseResult],
        protocol_decision: ProtocolDecision,
        vision_response: GeminiVisionDiagnosisResponse,
    ) -> str:
        payload = {
            "request": {
                "species": request.species.value,
                "breed": request.breed,
                "age_months": request.age_months,
                "weight_kg": request.weight_kg,
                "body_part": request.body_part,
                "doctor_description": request.doctor_description,
                "symptoms": request.symptoms,
                "allergies": request.allergies,
            },
            "vision_findings": vision_response.visual_findings,
            "image_descriptions": vision_response.image_descriptions,
            "top_differentials": [
                {
                    "canonical_code": item.canonical_code,
                    "display_name_vi": item.display_name_vi,
                    "confidence_note": item.confidence_note,
                    "supporting_reasons": item.supporting_reasons,
                }
                for item in top_differentials
            ],
            "supporting_evidence_from_kb": self._format_hybrid_evidence(hybrid_result),
            "similar_confirmed_cases": self._format_similar_cases(similar_cases),
            "protocol_summary": protocol_decision.summary,
            "protocol_cautions": protocol_decision.cautions,
            "protocol_missing_inputs": protocol_decision.missing_inputs,
            "prescriptions": [
                {
                    "medicine_name": rx.medicine_name,
                    "dosage": rx.dosage,
                    "frequency": rx.frequency,
                    "duration_days": rx.duration_days,
                    "instructions": rx.instructions,
                    "caution": rx.caution,
                    "route": rx.route,
                }
                for rx in protocol_decision.prescriptions
            ],
            "has_internal_protocol": bool(protocol_decision.prescriptions),
        }
        return f"""Bạn là trợ lý AI nội bộ hỗ trợ staff/vet tổng hợp ca bệnh cho Petties.
Chỉ dùng dữ liệu nội bộ đã cho. Nếu dữ liệu ảnh rỗng thì không được bịa thêm mô tả ảnh.
Nếu Case Memory đã đủ mạnh thì ưu tiên tổng hợp từ Case Memory và Knowledge Base, không cần giả định rằng vision đã chạy.

QUAN TRỌNG về đơn thuốc:
- Nếu has_internal_protocol=true: Giữ nguyên đơn thuốc từ protocol nội bộ (nếu có)
- Nếu has_internal_protocol=false (KHÔNG có trong KB/Case Memory):
  - BẮT BUỘC phải gợi ý ít nhất 1-2 loại thuốc phổ biến, phù hợp với triệu chứng/chẩn đoán
  - Dựa vào kiến thức thú y chung để suggest thuốc điều trị triệu chứng
  - Ghi rõ disclaimer là "Cần xác nhận từ bác sĩ" vì không có trong data nội bộ

Viết hoàn toàn bằng tiếng Việt, ngắn gọn, lâm sàng, không thêm markdown. Chỉ trả về JSON hợp lệ.

DỮ LIỆU:
{json.dumps(payload, ensure_ascii=False, indent=2)}

JSON:
{{
  "top_differentials": [
    {{
      "display_name_vi": "Tên chẩn đoán",
      "confidence_note": "Mức gợi ý: cao|trung bình|thấp",
      "supporting_reasons": ["Lý do 1", "Lý do 2"]
    }}
  ],
  "soap_suggestions": {{
    "subjective_draft": "...",
    "objective_draft": "...",
    "assessment_draft": "...",
    "plan_draft": "..."
  }},
  "suggested_questions": ["...", "...", "..."],
  "prescription_suggestions": [
    {{
      "medicine_name": "Tên thuốc",
      "dosage": "Liều dùng",
      "frequency": "Tần suất",
      "duration_days": Số_ngày,
      "instructions": "Hướng dẫn sử dụng",
      "caution": "Lưu ý (nếu có)"
    }}
  ],
  "prescription_disclaimer": "Cần xác nhận từ bác sĩ|Đã kiểm chứng"
}}
"""

    def _parse_llm_synthesis_response(
        self,
        content: str,
        fallback_differentials: List[DiagnosisSuggestion],
    ) -> Optional[Dict[str, Any]]:
        raw = (content or "").strip()
        if not raw:
            return None
        try:
            if "```" in raw:
                raw = raw.split("```json")[-1].split("```")[0].strip()
            payload = json.loads(raw)
            if not isinstance(payload, dict):
                return None
        except Exception:
            return None

        result: Dict[str, Any] = {}
        differentials = payload.get("top_differentials")
        if isinstance(differentials, list) and differentials:
            normalized: List[DiagnosisSuggestion] = []
            for index, item in enumerate(differentials[:3]):
                if not isinstance(item, dict):
                    continue
                fallback = (
                    fallback_differentials[index]
                    if index < len(fallback_differentials)
                    else None
                )
                display_name = str(item.get("display_name_vi") or "").strip()
                if not display_name and fallback is not None:
                    display_name = fallback.display_name_vi
                if not display_name:
                    continue
                reasons = item.get("supporting_reasons") or []
                if not isinstance(reasons, list):
                    reasons = []
                normalized.append(
                    DiagnosisSuggestion(
                        canonical_code=fallback.canonical_code if fallback else None,
                        display_name_vi=display_name,
                        confidence_note=str(
                            item.get("confidence_note")
                            or (
                                fallback.confidence_note
                                if fallback
                                else "Mức gợi ý: trung bình"
                            )
                        ),
                        supporting_reasons=[
                            str(reason).strip()
                            for reason in reasons
                            if str(reason).strip()
                        ]
                        or (fallback.supporting_reasons if fallback else []),
                    )
                )
            if normalized:
                result["top_differentials"] = normalized

        soap = payload.get("soap_suggestions")
        if isinstance(soap, dict):
            result["soap_suggestions"] = SoapSuggestions(
                subjective_draft=str(soap.get("subjective_draft") or ""),
                objective_draft=str(soap.get("objective_draft") or ""),
                assessment_draft=str(soap.get("assessment_draft") or ""),
                plan_draft=str(soap.get("plan_draft") or ""),
            )

        suggested_questions = payload.get("suggested_questions")
        if isinstance(suggested_questions, list):
            result["suggested_questions"] = [
                str(item).strip() for item in suggested_questions if str(item).strip()
            ][:5]

        prescriptions = payload.get("prescription_suggestions")
        if isinstance(prescriptions, list) and prescriptions:
            parsed_rx: List[PrescriptionSuggestion] = []
            for rx in prescriptions:
                if not isinstance(rx, dict):
                    continue
                medicine = str(rx.get("medicine_name") or "").strip()
                if not medicine:
                    continue
                parsed_rx.append(
                    PrescriptionSuggestion(
                        medicine_name=medicine,
                        dosage=str(rx.get("dosage") or ""),
                        frequency=str(rx.get("frequency") or ""),
                        duration_days=rx.get("duration_days"),
                        instructions=str(rx.get("instructions") or ""),
                        caution=rx.get("caution"),
                        source="llm_fallback",
                        source_detail=payload.get("prescription_disclaimer")
                        or "Gợi ý từ LLM - cần xác nhận bác sĩ",
                    )
                )
            if parsed_rx:
                result["prescription_suggestions"] = parsed_rx

        return result or None

    def _build_top_differentials(
        self,
        *,
        request: StaffDiagnosisRequest,
        vision_response: GeminiVisionDiagnosisResponse,
        hybrid_result: HybridResult,
        similar_cases: List[CaseResult],
    ) -> List[DiagnosisSuggestion]:
        candidates: Dict[str, DifferentialCandidate] = {}

        self._merge_vision_candidates(candidates, vision_response, request)
        self._merge_hybrid_candidates(candidates, hybrid_result, request)
        self._merge_case_memory_candidates(candidates, similar_cases)

        if not candidates:
            for fallback in self._fallback_differentials(request):
                key = fallback.canonical_code or fallback.display_name_vi.lower()
                candidates[key] = DifferentialCandidate(
                    canonical_code=fallback.canonical_code,
                    display_name_vi=fallback.display_name_vi,
                    score=0.35,
                    supporting_reasons=list(fallback.supporting_reasons),
                )

        shared_reasons = self._build_retrieval_reason_snippets(
            hybrid_result, similar_cases
        )
        for candidate in candidates.values():
            for reason in shared_reasons:
                candidate.add_reason(reason)

        sorted_candidates = sorted(
            candidates.values(),
            key=lambda item: item.score,
            reverse=True,
        )[:3]

        return [
            DiagnosisSuggestion(
                canonical_code=item.canonical_code,
                display_name_vi=item.display_name_vi,
                confidence_note=self._confidence_note(
                    self._normalize_score(item.score)
                ),
                supporting_reasons=item.supporting_reasons
                or ["Chưa có đủ tín hiệu nội bộ để củng cố mạnh cho chẩn đoán này."],
            )
            for item in sorted_candidates
        ]

    def _merge_vision_candidates(
        self,
        candidates: Dict[str, DifferentialCandidate],
        vision_response: GeminiVisionDiagnosisResponse,
        request: StaffDiagnosisRequest,
    ) -> None:
        mapper = get_disease_mapping_service()

        for condition in vision_response.top_conditions[:3]:
            mapping = None
            if not condition.canonical_code:
                mapping = mapper.map_label(
                    raw_label=condition.display_name_vi or condition.raw_label,
                    source_type="vision",
                    species=request.species.value,
                )

            canonical_code = condition.canonical_code or (
                mapping.canonical_code if mapping else None
            )
            display_name = (
                condition.display_name_vi
                or (mapping.display_name_vi if mapping else None)
                or condition.raw_label
            )
            key = canonical_code or display_name.lower()
            candidate = candidates.setdefault(
                key,
                DifferentialCandidate(
                    canonical_code=canonical_code,
                    display_name_vi=display_name,
                ),
            )
            candidate.score += 0.6 + max(condition.confidence_score, 0.0)
            candidate.add_reason(
                condition.reason
                or "AI nhìn ảnh ghi nhận dấu hiệu phù hợp với hướng bệnh này."
            )
            if request.doctor_description:
                candidate.add_reason("Khớp với mô tả lâm sàng bác sĩ nhập trong EMR.")

    def _merge_hybrid_candidates(
        self,
        candidates: Dict[str, DifferentialCandidate],
        hybrid_result: HybridResult,
        request: StaffDiagnosisRequest,
    ) -> None:
        mapper = get_disease_mapping_service()

        for chunk in hybrid_result.chunks:
            if chunk.source not in {"rag", "kg"}:
                continue

            mapping = mapper.find_canonical_in_text(
                text=chunk.content,
                preferred_source_types=["kb", "vision", "emr"],
                species=request.species.value,
            )
            if not mapping.mapped or not mapping.display_name_vi:
                continue

            key = mapping.canonical_code or mapping.display_name_vi.lower()
            candidate = candidates.setdefault(
                key,
                DifferentialCandidate(
                    canonical_code=mapping.canonical_code,
                    display_name_vi=mapping.display_name_vi,
                ),
            )
            candidate.score += min(chunk.score, 1.0) * 0.7
            candidate.add_reason(
                f"{self._format_chunk_source(chunk)} ghi nhận thông tin phù hợp với hướng bệnh này."
            )

    def _merge_case_memory_candidates(
        self,
        candidates: Dict[str, DifferentialCandidate],
        similar_cases: List[CaseResult],
    ) -> None:
        mapper = get_disease_mapping_service()

        for case in similar_cases:
            payload = case.payload or {}
            is_provisional = payload.get("mapping_status") == "provisional"
            raw_label = (
                payload.get("display_name_vi")
                or payload.get("final_diagnosis_text")
                or payload.get("canonical_code")
                or ""
            )
            mapping = mapper.map_label(
                raw_label=raw_label,
                source_type="emr",
                species=str(payload.get("species") or "all"),
            )

            canonical_code = payload.get("canonical_code") or mapping.canonical_code
            display_name = (
                payload.get("display_name_vi")
                or mapping.display_name_vi
                or payload.get("final_diagnosis_text")
                or raw_label
            )
            if not display_name:
                continue

            key = canonical_code or display_name.lower()
            candidate = candidates.setdefault(
                key,
                DifferentialCandidate(
                    canonical_code=canonical_code,
                    display_name_vi=display_name,
                ),
            )
            score_cap = 0.75 if is_provisional else 1.4
            candidate.score += min(case.final_score, score_cap)

            complaint = payload.get("chief_complaint")
            species = payload.get("species")
            if species and complaint:
                prefix = "Ca EMR tạm gán nhãn" if is_provisional else "Ca EMR xác nhận"
                candidate.add_reason(
                    f"{prefix} ở {species} có biểu hiện gần giống: {complaint}."
                )
            elif complaint:
                prefix = "Ca EMR tạm gán nhãn" if is_provisional else "Ca EMR xác nhận"
                candidate.add_reason(f"{prefix} có biểu hiện gần giống: {complaint}.")

            final_diagnosis = payload.get("final_diagnosis_text")
            if final_diagnosis:
                if is_provisional:
                    candidate.add_reason(
                        f"Ca tương tự hiện đang ở trạng thái tạm gán nhãn: {final_diagnosis}."
                    )
                else:
                    candidate.add_reason(
                        f"Ca tương tự đã chốt chẩn đoán: {final_diagnosis}."
                    )

    def _build_retrieval_reason_snippets(
        self,
        hybrid_result: HybridResult,
        similar_cases: List[CaseResult],
    ) -> List[str]:
        reasons: List[str] = []

        best_kb_chunk = next(
            (chunk for chunk in hybrid_result.chunks if chunk.source in {"rag", "kg"}),
            None,
        )
        if best_kb_chunk is not None:
            reasons.append(
                f"Đã đối chiếu với {self._format_chunk_source(best_kb_chunk).lower()} nội bộ."
            )
        if similar_cases:
            reasons.append("Đã tìm thấy ca EMR xác nhận tương tự trong Case Memory.")
        return reasons

    def _format_hybrid_evidence(self, hybrid_result: HybridResult) -> List[str]:
        evidence: List[str] = []
        for chunk in hybrid_result.chunks[:5]:
            evidence.append(
                f"{self._format_chunk_source(chunk)} (độ liên quan {chunk.score:.2f}): "
                f"{self._truncate_text(chunk.content, 220)}"
            )
        return evidence or [
            "Không tìm thấy thông tin phù hợp trong kho tri thức nội bộ cho ca bệnh này."
        ]

    def _format_similar_cases(self, similar_cases: List[CaseResult]) -> List[str]:
        if not similar_cases:
            return [
                "Không tìm thấy ca EMR xác nhận đủ gần để đối chiếu cho tình huống hiện tại."
            ]

        lines: List[str] = []
        for index, case in enumerate(similar_cases[:3], start=1):
            payload = case.payload or {}
            diagnosis = (
                payload.get("display_name_vi")
                or payload.get("final_diagnosis_text")
                or "Chưa rõ chẩn đoán"
            )
            species = payload.get("species") or "thú cưng"
            complaint = (
                payload.get("chief_complaint")
                or payload.get("clinical_notes")
                or case.content
            )
            detail = self._truncate_text(str(complaint), 160)
            line = (
                f"Ca EMR tương tự #{index} ({species}, điểm {case.final_score:.2f}): "
                f"{diagnosis}. Biểu hiện chính: {detail}"
            )
            if payload.get("mapping_status") == "provisional":
                line += ". Trạng thái đối chiếu: tạm gán nhãn"
            if payload.get("exam_at"):
                line += f". Ngày khám: {payload['exam_at']}"
            lines.append(line)
        return lines

    def _extract_protocol_patterns_from_cases(
        self,
        similar_cases: List[CaseResult],
    ) -> List[Dict[str, Any]]:
        """
        Trích xuất protocol patterns từ các ca EMR tương tự.

        Patterns bao gồm: SOAP template, đơn thuốc, xét nghiệm thường dùng.
        Không hardcode - hoàn toàn học từ EMR confirmed.
        """
        patterns = []
        for case in similar_cases:
            payload = case.payload or {}
            protocol_pattern = payload.get("protocol_pattern")
            if not protocol_pattern:
                continue

            pattern_entry = {
                "case_id": payload.get("case_id", ""),
                "score": case.final_score,
                "species": payload.get("species"),
                "canonical_code": payload.get("canonical_code"),
                "confirmed_at": protocol_pattern.get("confirmed_at"),
                "soap_template": protocol_pattern.get("soap_template"),
                "common_prescriptions": protocol_pattern.get(
                    "common_prescriptions", []
                ),
                "common_tests": protocol_pattern.get("common_tests", []),
                "common_recommendations": protocol_pattern.get(
                    "common_recommendations", []
                ),
            }
            patterns.append(pattern_entry)

        return patterns

    def _build_image_analysis(
        self,
        image_urls: List[str],
        vision_response: Any,
    ) -> List[Dict[str, str]]:
        """
        Build image analysis mapping: URL → AI description.

        Maps each uploaded image URL to its AI-generated description
        in the order images were uploaded for Staff preview.
        """
        if not image_urls:
            return []

        descriptions = vision_response.image_descriptions or []

        result = []
        for i, url in enumerate(image_urls):
            description = descriptions[i] if i < len(descriptions) else None
            result.append(
                {
                    "url": url,
                    "description": description or "Chưa có mô tả từ AI",
                    "order": i + 1,
                }
            )

        return result

    def _format_chunk_source(self, chunk: HybridChunk) -> str:
        metadata = chunk.metadata or {}
        if chunk.source == "rag":
            return metadata.get("document_name") or "Kho tri thức nội bộ"
        if chunk.source == "kg":
            return "Knowledge Graph nội bộ"
        if chunk.source == "case_memory":
            return "Case Memory EMR xác nhận"
        return "Nguồn nội bộ"

    def _build_follow_up_questions(
        self,
        request: StaffDiagnosisRequest,
        protocol_decision: ProtocolDecision,
    ) -> List[str]:
        questions = [
            "Triệu chứng xuất hiện từ khi nào và diễn tiến ra sao?",
            "Bé có sốt, bỏ ăn hoặc thay đổi hành vi gần đây không?",
        ]
        if request.image_urls:
            questions.append(
                "Ảnh hiện tại được chụp trước hay sau khi đã vệ sinh hoặc xử lý tổn thương?"
            )
        for missing_input in protocol_decision.missing_inputs:
            questions.append(
                f"Cần bổ sung {missing_input} để hoàn thiện protocol điều trị cho bé."
            )
        return questions

    def _fallback_differentials(
        self, request: StaffDiagnosisRequest
    ) -> List[DiagnosisSuggestion]:
        """
        Generic fallback when KB, Vision, and Case Memory all return empty.

        Policy (per PLAN.md data-driven rule):
        - NO keyword heuristic matching on doctor_description.
        - NO hardcoded body-system guessing from symptom text.
        - Return a single "insufficient evidence" suggestion so the doctor
          knows to gather more clinical data before the system can assist.
        """
        return [
            DiagnosisSuggestion(
                canonical_code=None,
                display_name_vi="Cần phân biệt thêm trước khi kết luận cho thú cưng",
                confidence_note="Mức gợi ý: thấp",
                supporting_reasons=[
                    "Chưa có đủ tín hiệu từ Knowledge Base, Vision hoặc Case Memory để chốt hướng bệnh.",
                    "Ưu tiên thăm khám trực tiếp và khai thác thêm tiền sử bệnh trước khi kê đơn.",
                ],
            )
        ]

    def _build_soap_suggestions(
        self,
        *,
        request: StaffDiagnosisRequest,
        top_differentials: List[DiagnosisSuggestion],
        vision_response: GeminiVisionDiagnosisResponse,
        hybrid_result: HybridResult,
        similar_cases: List[CaseResult],
        protocol_decision: ProtocolDecision,
    ) -> SoapSuggestions:
        top_label = (
            top_differentials[0].display_name_vi
            if top_differentials
            else "chưa xác định"
        )
        symptom_text = (
            ", ".join(request.symptoms)
            if request.symptoms
            else request.doctor_description
        )
        symptom_text = symptom_text or ""

        objective_text = self._build_objective_draft(
            request=request,
            vision_response=vision_response,
        )
        assessment_text = self._build_assessment_draft(
            top_label=top_label,
            top_differentials=top_differentials,
            vision_response=vision_response,
            similar_cases=similar_cases,
            protocol_decision=protocol_decision,
        )
        plan_text = self._build_plan_draft(
            top_label=top_label,
            request=request,
            protocol_decision=protocol_decision,
        )

        return SoapSuggestions(
            subjective_draft=symptom_text,
            objective_draft=objective_text,
            assessment_draft=assessment_text,
            plan_draft=plan_text,
        )

    def _build_objective_draft(
        self,
        *,
        request: StaffDiagnosisRequest,
        vision_response: GeminiVisionDiagnosisResponse,
    ) -> str:
        if request.soap_draft.objective.strip():
            return request.soap_draft.objective.strip()

        parts: List[str] = []

        if vision_response.visual_findings:
            for finding in vision_response.visual_findings[:4]:
                parts.append(finding.strip())

        if vision_response.image_descriptions:
            for desc in vision_response.image_descriptions[:3]:
                if desc.strip() and desc.strip() not in [p.strip() for p in parts]:
                    parts.append(desc.strip())

        if request.body_part:
            parts.insert(0, f"Vùng khám: {request.body_part}.")

        if not parts:
            if request.image_urls:
                return ""
            return ""

        return " ".join(parts)

    def _build_assessment_draft(
        self,
        *,
        top_label: str,
        top_differentials: List[DiagnosisSuggestion],
        vision_response: GeminiVisionDiagnosisResponse,
        similar_cases: List[CaseResult],
        protocol_decision: ProtocolDecision,
    ) -> str:
        parts: List[str] = []

        top_label_lower = top_label.lower()
        if "chưa" in top_label_lower or "cần phân biệt" in top_label_lower:
            if vision_response.top_conditions:
                parts.append(
                    f"Nghi {vision_response.top_conditions[0].display_name_vi or vision_response.top_conditions[0].raw_label}."
                )
            if similar_cases:
                payload = similar_cases[0].payload or {}
                raw = payload.get("display_name_vi") or payload.get(
                    "final_diagnosis_text"
                )
                if raw and "chưa" not in raw.lower():
                    parts.append(f"Đối chiếu ca EMR tương tự: {raw}.")
        else:
            parts.append(top_label)

        if not parts:
            parts.append("Chưa xác định.")

        return " ".join(parts)

    def _build_plan_draft(
        self,
        *,
        top_label: str,
        request: StaffDiagnosisRequest,
        protocol_decision: ProtocolDecision,
    ) -> str:
        lines: List[str] = []
        step = 0

        if protocol_decision.prescriptions:
            for rx in protocol_decision.prescriptions[:5]:
                step += 1
                dosage_str = f" - Liều: {rx.dosage}" if rx.dosage else ""
                route_str = f" - Đường dùng: {rx.route}" if rx.route else ""
                freq_str = f" - Tần suất: {rx.frequency}" if rx.frequency else ""
                duration_str = (
                    f" - Thời gian: {rx.duration_days} ngày" if rx.duration_days else ""
                )
                caution_str = f" [Lưu ý: {rx.caution}]" if rx.caution else ""
                lines.append(
                    f"{step}. {rx.medicine_name}{dosage_str}{route_str}{freq_str}{duration_str}{caution_str}"
                )

        if protocol_decision.cautions:
            for caution in protocol_decision.cautions:
                if caution.strip() and caution not in " ".join(lines):
                    lines.append(f"Lưu ý: {caution}")

        if request.allergies:
            lines.append(
                f"Chống chỉ định với dị ứng đã ghi nhận: {', '.join(request.allergies)}."
            )

        if protocol_decision.missing_inputs:
            for missing in protocol_decision.missing_inputs:
                if "cân nặng" in missing.lower():
                    lines.append(f"⚠ Cần bổ sung cân nặng để tính liều chính xác.")

        if request.weight_kg:
            lines.append(f"Cân nặng: {request.weight_kg:.1f} kg.")

        if not lines:
            lines.append(
                "1. Cần bổ sung thăm khám lâm sàng và đối chiếu thêm dữ liệu trước khi chốt hướng điều trị."
            )
            lines.append(
                "2. Theo dõi diễn tiến triệu chứng và cân nhắc chỉ định xét nghiệm phù hợp nếu biểu hiện kéo dài hoặc nặng lên."
            )
            lines.append(
                "3. Tái khám hoặc đánh giá lại sau khi đã có thêm evidence nội bộ và kết quả lâm sàng."
            )

        return "\n".join(lines)

    def _confidence_note(self, score: float) -> str:
        if score >= 0.75:
            return "Mức gợi ý: cao"
        if score >= 0.45:
            return "Mức gợi ý: trung bình"
        return "Mức gợi ý: thấp"

    def _normalize_score(self, value: float) -> float:
        if value <= 0:
            return 0.0
        if value >= 1.8:
            return 0.95
        return min(value / 1.8, 0.95)

    def _truncate_text(self, value: str, limit: int) -> str:
        text = " ".join((value or "").split())
        if len(text) <= limit:
            return text
        return text[: limit - 3].rstrip() + "..."


_staff_diagnosis_service: Optional[StaffDiagnosisService] = None


def get_staff_diagnosis_service() -> StaffDiagnosisService:
    global _staff_diagnosis_service
    if _staff_diagnosis_service is None:
        _staff_diagnosis_service = StaffDiagnosisService()
    return _staff_diagnosis_service
