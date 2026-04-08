"""
Staff diagnosis synthesis service.

This service combines:
- Gemini Vision for image understanding
- Hybrid RAG for internal knowledge-base and case-memory evidence
- Case Memory for confirmed EMR cases
- DB-backed disease mapping
- Diagnosis protocols so SOAP and prescriptions stay aligned

No web search is used in the doctor diagnostic flow.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from uuid import uuid4

from loguru import logger

from app.core.rag.case_memory import CaseResult, get_case_memory_service
from app.core.rag.hybrid_engine import HybridChunk, HybridResult, get_hybrid_rag_engine
from app.core.services.disease_mapping_service import get_disease_mapping_service
from app.core.vision.gemini_vision_adapter import get_gemini_vision_adapter
from app.db.postgres.session import AsyncSessionLocal
from app.services.llm_client import BaseLLMClient, get_llm_client_from_db

from .diagnosis_protocol_service import (
    ProtocolDecision,
    get_diagnosis_protocol_service,
)
from .schemas import (
    DiagnosisClinicalContext,
    DiagnosisSuggestion,
    DoctorDiagnosisSynthesisResponse,
    GeminiVisionDiagnosisRequest,
    GeminiVisionDiagnosisResponse,
    PrescriptionSuggestion,
    SoapSuggestions,
    StaffDiagnosisRequest,
)


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


@dataclass
class CachedAnalysisContext:
    created_at: datetime
    evidence_mode: str
    evidence_banner: str
    score_label: str
    top_differentials: List[DiagnosisSuggestion]
    hybrid_result: HybridResult
    similar_cases: List[CaseResult]
    vision_response: GeminiVisionDiagnosisResponse
    image_analysis: List[dict]


@dataclass
class SoapGroundingBundle:
    subjective: Dict[str, Any] = field(default_factory=dict)
    objective: Dict[str, Any] = field(default_factory=dict)
    assessment: Dict[str, Any] = field(default_factory=dict)
    plan: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "subjective": self.subjective,
            "objective": self.objective,
            "assessment": self.assessment,
            "plan": self.plan,
        }


class StaffDiagnosisService:
    """Build staff diagnosis response from multimodal input and internal evidence."""
    _MAX_MEDICATION_RETRY = 2

    def __init__(self) -> None:
        self._llm_client: Optional[BaseLLMClient] = None
        self._analysis_cache: Dict[str, CachedAnalysisContext] = {}
        self._analysis_cache_ttl = timedelta(minutes=20)

    async def analyze_case(
        self,
        request: StaffDiagnosisRequest,
    ) -> DoctorDiagnosisSynthesisResponse:
        request_id = request.request_id or str(uuid4())

        if request.synthesis_mode == "selected_only":
            cached_response = await self._build_selected_only_response(
                request_id=request_id,
                request=request,
            )
            if cached_response is not None:
                return cached_response

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

        retrieval_query = self._build_retrieval_query(request, vision_response)
        hybrid_result, similar_cases = await self._retrieve_internal_context(
            query=retrieval_query,
            request=request,
            preloaded_cases=preloaded_cases,
        )
        evidence_mode = self._resolve_evidence_mode(
            hybrid_result=hybrid_result,
            similar_cases=similar_cases,
            vision_response=vision_response,
        )
        evidence_banner, score_label = self._resolve_evidence_labels(evidence_mode)

        top_differentials = self._build_top_differentials(
            request=request,
            vision_response=vision_response,
            hybrid_result=hybrid_result,
            similar_cases=similar_cases,
            evidence_mode=evidence_mode,
        )
        base_top_differentials = list(top_differentials)
        selected_primary = self._resolve_selected_diagnosis(
            request=request,
            top_differentials=top_differentials,
        )
        has_selected_diagnosis = selected_primary is not None
        protocol_decision = get_diagnosis_protocol_service().build_decision(
            request=request,
            primary_diagnosis=selected_primary,
        )
        emr_protocol_patterns = self._extract_protocol_patterns_from_cases(
            similar_cases
        )
        logger.info(
            f"Extracted {len(emr_protocol_patterns) if emr_protocol_patterns else 0} protocol patterns"
        )
        if emr_protocol_patterns:
            logger.info(
                f"Found {len(emr_protocol_patterns)} protocol patterns from EMR cases"
            )
            logger.info("Calling apply_emr_patterns...")
            protocol_decision = get_diagnosis_protocol_service().apply_emr_patterns(
                protocol_decision=protocol_decision,
                emr_patterns=emr_protocol_patterns,
                request=request,
            )
            logger.info("apply_emr_patterns completed")

        has_internal_evidence = bool(hybrid_result.chunks or similar_cases)
        if not has_internal_evidence:
            protocol_decision.summary = (
                "AI ưu tiên tổng hợp triệu chứng hiện tại để gợi ý hỗ trợ nhập EMR nhanh hơn. "
                + protocol_decision.summary
            ).strip()

        llm_synthesis: Optional[Dict[str, Any]] = None
        logger.info(
            f"Starting LLM synthesis with {len(top_differentials)} differentials, "
            f"{len(hybrid_result.chunks)} KB chunks, {len(similar_cases)} similar cases"
        )
        llm_synthesis = await self._synthesize_with_llm(
            request=request,
            top_differentials=top_differentials,
            hybrid_result=hybrid_result,
            similar_cases=similar_cases,
            protocol_decision=protocol_decision,
            vision_response=vision_response,
            force_medication=False,
        )
        logger.info(
            f"LLM synthesis completed: {'success' if llm_synthesis else 'failed/empty'}"
        )
        if llm_synthesis and llm_synthesis.get("top_differentials"):
            top_differentials = self._merge_top_differentials_with_fallback(
                preferred=llm_synthesis["top_differentials"],
                fallback=base_top_differentials,
                request=request,
                evidence_mode=evidence_mode,
            )
        else:
            top_differentials = self._merge_top_differentials_with_fallback(
                preferred=top_differentials,
                fallback=[],
                request=request,
                evidence_mode=evidence_mode,
            )

        requires_medication = self._requires_medication(
            selected_primary=selected_primary,
            protocol_decision=protocol_decision,
        )
        if requires_medication:
            llm_synthesis = await self._retry_llm_until_medication_complete(
                request=request,
                top_differentials=top_differentials,
                hybrid_result=hybrid_result,
                similar_cases=similar_cases,
                protocol_decision=protocol_decision,
                vision_response=vision_response,
                initial_synthesis=llm_synthesis,
            )

        image_analysis = self._build_image_analysis(request.image_urls, vision_response)
        effective_protocol_decision = self._merge_safety_suggestions(
            protocol_decision=protocol_decision,
            llm_synthesis=llm_synthesis,
        )
        suggested_questions = (
            self._sanitize_text_list(
                llm_synthesis.get("suggested_questions"), max_items=5
            )
            if llm_synthesis
            else []
        )
        base_soap_suggestions = self._build_soap_suggestions(
            request=request,
            top_differentials=top_differentials,
            primary_diagnosis=selected_primary,
            vision_response=vision_response,
            hybrid_result=hybrid_result,
            similar_cases=similar_cases,
            protocol_decision=effective_protocol_decision,
        )
        soap_suggestions = self._merge_soap_suggestions_with_llm(
            base_soap=base_soap_suggestions,
            llm_synthesis=llm_synthesis,
            selected_primary=selected_primary,
        )

        llm_prescriptions = (
            llm_synthesis.get("prescription_suggestions") if llm_synthesis else None
        )
        has_emr_pattern_prescriptions = has_selected_diagnosis and bool(
            effective_protocol_decision.prescriptions
        )
        if has_emr_pattern_prescriptions:
            final_prescriptions = effective_protocol_decision.prescriptions
        elif llm_prescriptions:
            final_prescriptions = llm_prescriptions
        else:
            final_prescriptions = []
        final_prescriptions = self._ensure_prescription_usage_instructions(
            final_prescriptions
        )
        payload_status = "ok"
        payload_warnings: List[str] = []
        if requires_medication:
            is_payload_ok, payload_errors = self._validate_emr_payload_completeness(
                requires_medication=True,
                prescription_suggestions=final_prescriptions,
                top_differentials=top_differentials,
                soap_suggestions=soap_suggestions,
            )
            if not is_payload_ok:
                payload_status = "incomplete"
                payload_warnings = payload_errors

        has_llm_prescription = (
            bool(llm_prescriptions) and not has_emr_pattern_prescriptions
        )

        self._cache_analysis_context(
            request_id=request_id,
            evidence_mode=evidence_mode,
            evidence_banner=evidence_banner,
            score_label=score_label,
            top_differentials=top_differentials,
            hybrid_result=hybrid_result,
            similar_cases=similar_cases,
            vision_response=vision_response,
            image_analysis=image_analysis,
        )

        return DoctorDiagnosisSynthesisResponse(
            request_id=request_id,
            evidence_mode=evidence_mode,
            evidence_banner=evidence_banner,
            score_label=score_label,
            top_differentials=top_differentials,
            supporting_evidence_from_kb=self._format_hybrid_evidence(hybrid_result),
            similar_confirmed_cases=self._format_similar_cases(similar_cases),
            vision_findings=vision_response.visual_findings,
            image_descriptions=vision_response.image_descriptions,
            image_analysis=image_analysis,
            suggested_questions=suggested_questions
            or self._build_follow_up_questions(request, effective_protocol_decision),
            soap_suggestions=soap_suggestions,
            prescription_suggestions=final_prescriptions,
            payload_status=payload_status,
            payload_warnings=payload_warnings,
            disclaimer="Gợi ý từ tài liệu nội bộ. Bác sĩ cần xác nhận lại chẩn đoán."
            + (
                " Chọn một chẩn đoán trong danh sách gợi ý để mở gợi ý điều trị và SOAP ở các bước sau."
                if not has_selected_diagnosis
                else ""
            )
            + (
                " Lưu ý: Đơn thuốc được gợi ý từ AI - cần bác sĩ xác nhận trước khi kê đơn."
                if has_llm_prescription
                else ""
            ),
        )

    async def _build_selected_only_response(
        self,
        *,
        request_id: str,
        request: StaffDiagnosisRequest,
    ) -> Optional[DoctorDiagnosisSynthesisResponse]:
        previous_request_id = (request.previous_request_id or "").strip()
        if not previous_request_id:
            return None

        cached = self._get_cached_analysis_context(previous_request_id)
        if cached is None:
            logger.info(
                "selected_only mode skipped: cache miss for previous_request_id={}.",
                previous_request_id,
            )
            return None

        cached_top_differentials = self._merge_top_differentials_with_fallback(
            preferred=cached.top_differentials,
            fallback=[],
            request=request,
            evidence_mode=cached.evidence_mode,
        )
        selected_primary = self._resolve_selected_diagnosis(
            request=request,
            top_differentials=cached_top_differentials,
        )
        has_selected_diagnosis = selected_primary is not None

        protocol_decision = get_diagnosis_protocol_service().build_decision(
            request=request,
            primary_diagnosis=selected_primary,
        )
        emr_protocol_patterns = self._extract_protocol_patterns_from_cases(
            cached.similar_cases
        )
        if emr_protocol_patterns:
            protocol_decision = get_diagnosis_protocol_service().apply_emr_patterns(
                protocol_decision=protocol_decision,
                emr_patterns=emr_protocol_patterns,
                request=request,
            )

        llm_synthesis: Optional[Dict[str, Any]] = await self._synthesize_with_llm(
            request=request,
            top_differentials=cached_top_differentials,
            hybrid_result=cached.hybrid_result,
            similar_cases=cached.similar_cases,
            protocol_decision=protocol_decision,
            vision_response=cached.vision_response,
            force_medication=False,
        )

        response_top_differentials = cached_top_differentials
        if llm_synthesis and llm_synthesis.get("top_differentials"):
            response_top_differentials = self._merge_top_differentials_with_fallback(
                preferred=llm_synthesis["top_differentials"],
                fallback=cached_top_differentials,
                request=request,
                evidence_mode=cached.evidence_mode,
            )

        effective_protocol_decision = self._merge_safety_suggestions(
            protocol_decision=protocol_decision,
            llm_synthesis=llm_synthesis,
        )
        requires_medication = self._requires_medication(
            selected_primary=selected_primary,
            protocol_decision=protocol_decision,
        )
        if requires_medication:
            llm_synthesis = await self._retry_llm_until_medication_complete(
                request=request,
                top_differentials=response_top_differentials,
                hybrid_result=cached.hybrid_result,
                similar_cases=cached.similar_cases,
                protocol_decision=effective_protocol_decision,
                vision_response=cached.vision_response,
                initial_synthesis=llm_synthesis,
            )
            effective_protocol_decision = self._merge_safety_suggestions(
                protocol_decision=protocol_decision,
                llm_synthesis=llm_synthesis,
            )

        base_soap_suggestions = self._build_soap_suggestions(
            request=request,
            top_differentials=response_top_differentials,
            primary_diagnosis=selected_primary,
            vision_response=cached.vision_response,
            hybrid_result=cached.hybrid_result,
            similar_cases=cached.similar_cases,
            protocol_decision=effective_protocol_decision,
        )
        soap_suggestions = self._merge_soap_suggestions_with_llm(
            base_soap=base_soap_suggestions,
            llm_synthesis=llm_synthesis,
            selected_primary=selected_primary,
        )

        llm_prescriptions = (
            llm_synthesis.get("prescription_suggestions") if llm_synthesis else None
        )
        has_emr_pattern_prescriptions = has_selected_diagnosis and bool(
            effective_protocol_decision.prescriptions
        )
        if has_emr_pattern_prescriptions:
            final_prescriptions = effective_protocol_decision.prescriptions
        elif llm_prescriptions:
            final_prescriptions = llm_prescriptions
        else:
            final_prescriptions = []
        final_prescriptions = self._ensure_prescription_usage_instructions(
            final_prescriptions
        )
        payload_status = "ok"
        payload_warnings: List[str] = []
        if requires_medication:
            is_payload_ok, payload_errors = self._validate_emr_payload_completeness(
                requires_medication=True,
                prescription_suggestions=final_prescriptions,
                top_differentials=response_top_differentials,
                soap_suggestions=soap_suggestions,
            )
            if not is_payload_ok:
                payload_status = "incomplete"
                payload_warnings = payload_errors

        has_llm_prescription = (
            bool(llm_prescriptions) and not has_emr_pattern_prescriptions
        )

        return DoctorDiagnosisSynthesisResponse(
            request_id=request_id,
            evidence_mode=cached.evidence_mode,
            evidence_banner=cached.evidence_banner,
            score_label=cached.score_label,
            top_differentials=response_top_differentials,
            supporting_evidence_from_kb=self._format_hybrid_evidence(
                cached.hybrid_result
            ),
            similar_confirmed_cases=self._format_similar_cases(cached.similar_cases),
            vision_findings=cached.vision_response.visual_findings,
            image_descriptions=cached.vision_response.image_descriptions,
            image_analysis=cached.image_analysis,
            suggested_questions=(
                self._sanitize_text_list(
                    llm_synthesis.get("suggested_questions") if llm_synthesis else [],
                    max_items=5,
                )
                or self._build_follow_up_questions(request, effective_protocol_decision)
            ),
            soap_suggestions=soap_suggestions,
            prescription_suggestions=final_prescriptions,
            payload_status=payload_status,
            payload_warnings=payload_warnings,
            disclaimer="Gợi ý từ tài liệu nội bộ. Bác sĩ cần xác nhận lại chẩn đoán."
            + (
                " Chọn một chẩn đoán trong danh sách gợi ý để mở gợi ý điều trị và SOAP ở các bước sau."
                if not has_selected_diagnosis
                else ""
            )
            + (
                " Lưu ý: Đơn thuốc được gợi ý từ AI - cần bác sĩ xác nhận trước khi kê đơn."
                if has_llm_prescription
                else ""
            )
            + " (selected_only: đã tái sử dụng context từ lượt phân tích trước)",
        )

    def _cache_analysis_context(
        self,
        *,
        request_id: str,
        evidence_mode: str,
        evidence_banner: str,
        score_label: str,
        top_differentials: List[DiagnosisSuggestion],
        hybrid_result: HybridResult,
        similar_cases: List[CaseResult],
        vision_response: GeminiVisionDiagnosisResponse,
        image_analysis: List[dict],
    ) -> None:
        self._prune_analysis_cache()
        self._analysis_cache[request_id] = CachedAnalysisContext(
            created_at=datetime.utcnow(),
            evidence_mode=evidence_mode,
            evidence_banner=evidence_banner,
            score_label=score_label,
            top_differentials=top_differentials,
            hybrid_result=hybrid_result,
            similar_cases=similar_cases,
            vision_response=vision_response,
            image_analysis=image_analysis,
        )

    def _get_cached_analysis_context(
        self, previous_request_id: str
    ) -> Optional[CachedAnalysisContext]:
        self._prune_analysis_cache()
        return self._analysis_cache.get(previous_request_id)

    def _prune_analysis_cache(self) -> None:
        now = datetime.utcnow()
        expired_keys = [
            key
            for key, value in self._analysis_cache.items()
            if now - value.created_at > self._analysis_cache_ttl
        ]
        for key in expired_keys:
            self._analysis_cache.pop(key, None)

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
            result = await get_hybrid_rag_engine().query(
                query=query,
                top_k=5,
                min_score=0.45,
                pet_type=request.species.value,
                enable_rag=True,
                enable_case_memory=False,
            )

            request_focus_tags = self._extract_request_focus_tags(request)
            if request_focus_tags and result.chunks:
                filtered_chunks: List[HybridChunk] = []
                for chunk in result.chunks:
                    metadata = chunk.metadata or {}
                    evidence_text = " ".join(
                        part
                        for part in [
                            str(metadata.get("document_name") or ""),
                            chunk.content,
                        ]
                        if part
                    )
                    if self._is_evidence_focus_aligned(
                        request=request,
                        evidence_text=evidence_text,
                    ):
                        filtered_chunks.append(chunk)

                if len(filtered_chunks) < len(result.chunks):
                    logger.info(
                        "Filtered {} KB/KG chunks by symptom focus alignment.",
                        len(result.chunks) - len(filtered_chunks),
                    )

                result = HybridResult(
                    chunks=filtered_chunks,
                    expanded_query=result.expanded_query,
                    original_query=result.original_query,
                    sources_used=result.sources_used,
                )

            return result
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
            raw_cases = await get_case_memory_service().search_similar(
                query=query,
                top_k=3,
                min_score=0.6,
                image_urls=request.image_urls or None,
            )

            confirmed_cases = [
                case
                for case in raw_cases
                if self._is_confirmed_case_payload(case.payload)
            ]
            if len(confirmed_cases) < len(raw_cases):
                logger.info(
                    "Filtered {} provisional case-memory matches from diagnosis ranking.",
                    len(raw_cases) - len(confirmed_cases),
                )

            request_focus_tags = self._extract_request_focus_tags(request)
            if request_focus_tags and confirmed_cases:
                focus_aligned_cases: List[CaseResult] = []
                for case in confirmed_cases:
                    payload = case.payload or {}
                    evidence_text = " ".join(
                        part
                        for part in [
                            str(payload.get("chief_complaint") or ""),
                            str(payload.get("clinical_notes") or ""),
                            str(payload.get("display_name_vi") or ""),
                            str(payload.get("final_diagnosis_text") or ""),
                            case.content,
                        ]
                        if part
                    )
                    if self._is_evidence_focus_aligned(
                        request=request,
                        evidence_text=evidence_text,
                    ):
                        focus_aligned_cases.append(case)

                if len(focus_aligned_cases) < len(confirmed_cases):
                    logger.info(
                        "Filtered {} case-memory matches by symptom focus alignment.",
                        len(confirmed_cases) - len(focus_aligned_cases),
                    )

                confirmed_cases = focus_aligned_cases

            return confirmed_cases
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
        if similar_cases:
            top_case = similar_cases[0]
            logger.debug(
                "Vision analysis forced for request {}: top case score={:.2f}, images_present=true",
                request.request_id,
                top_case.final_score,
            )
        return True

    async def _get_llm_client(self) -> BaseLLMClient:
        if self._llm_client is not None:
            return self._llm_client
        logger.info("Fetching LLM client from DB settings...")
        async with AsyncSessionLocal() as db:
            self._llm_client = await get_llm_client_from_db(db)
        logger.info(f"LLM client ready: {self._llm_client}")
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

    def _serialize_prescriptions_for_prompt(
        self,
        prescriptions: List[PrescriptionSuggestion],
    ) -> List[Dict[str, Any]]:
        return [
            {
                "medicine_name": rx.medicine_name,
                "times_of_day": self._normalize_times_of_day(rx.times_of_day),
                "before_after_meal": rx.before_after_meal,
                "frequency_note": rx.frequency_note,
                "duration_days": rx.duration_days,
                "instructions": rx.instructions,
                "caution": rx.caution,
            }
            for rx in prescriptions
        ]

    def _build_default_prescription_instruction(
        self,
        prescription: PrescriptionSuggestion,
    ) -> str:
        parts: List[str] = []
        if prescription.times_of_day:
            parts.append("Thời điểm: " + ", ".join(prescription.times_of_day))
        if prescription.before_after_meal:
            parts.append(f"Bữa ăn: {prescription.before_after_meal}")
        if prescription.frequency_note:
            parts.append(f"Ghi chú tần suất: {prescription.frequency_note}")
        if prescription.duration_days:
            parts.append(f"Thời gian dùng: {prescription.duration_days} ngày")

        instruction = (
            ". ".join(parts) + "."
            if parts
            else "Dùng theo chỉ định của bác sĩ thú y và theo dõi đáp ứng lâm sàng."
        )

        caution = str(prescription.caution or "").strip()
        if caution:
            instruction = f"{instruction} Lưu ý: {caution}"

        return instruction.strip()

    def _ensure_prescription_usage_instructions(
        self,
        prescriptions: List[PrescriptionSuggestion],
    ) -> List[PrescriptionSuggestion]:
        normalized: List[PrescriptionSuggestion] = []
        for rx in prescriptions or []:
            if not isinstance(rx, PrescriptionSuggestion):
                continue

            existing_instruction = str(rx.instructions or "").strip()
            if existing_instruction:
                normalized.append(rx)
                continue

            fallback_instruction = self._build_default_prescription_instruction(rx)
            normalized.append(
                rx.model_copy(update={"instructions": fallback_instruction})
            )

        return normalized

    def _extract_protocol_test_names(self, tests: Any) -> List[str]:
        if not isinstance(tests, list):
            return []

        normalized: List[str] = []
        seen: set[str] = set()
        for item in tests:
            if isinstance(item, dict):
                text = str(item.get("test") or "").strip()
            else:
                text = str(item or "").strip()
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(text)
            if len(normalized) >= 5:
                break
        return normalized

    def _build_pattern_prescription_evidence(
        self, raw_items: Any
    ) -> List[Dict[str, Any]]:
        if not isinstance(raw_items, list):
            return []

        evidence: List[Dict[str, Any]] = []
        for item in raw_items[:3]:
            if not isinstance(item, dict):
                continue
            medicine = str(
                item.get("medicine") or item.get("medicine_name") or ""
            ).strip()
            if not medicine:
                continue
            evidence.append(
                {
                    "medicine_name": medicine,
                    "times_of_day": item.get("times_of_day") or item.get("timesOfDay") or [],
                    "before_after_meal": item.get("before_after_meal") or item.get("beforeAfterMeal"),
                    "frequency_note": str(
                        item.get("frequency_note") or item.get("frequencyNote") or ""
                    ).strip(),
                    "duration_days": item.get("duration_days")
                    or item.get("durationDays")
                    or item.get("duration"),
                    "instructions": str(item.get("instructions") or "").strip(),
                }
            )
        return evidence

    def _build_grounded_kb_evidence(
        self,
        hybrid_result: HybridResult,
    ) -> List[Dict[str, Any]]:
        evidence: List[Dict[str, Any]] = []
        for chunk in hybrid_result.chunks[:3]:
            evidence.append(
                {
                    "source": self._format_chunk_source(chunk),
                    "score": round(float(chunk.score), 3),
                    "excerpt": self._truncate_text(chunk.content, 280),
                }
            )
        return evidence

    def _build_grounded_case_evidence(
        self,
        similar_cases: List[CaseResult],
    ) -> List[Dict[str, Any]]:
        grounded_cases: List[Dict[str, Any]] = []
        for case in similar_cases[:2]:
            payload = case.payload or {}
            protocol_pattern = payload.get("protocol_pattern") or {}
            soap_template = protocol_pattern.get("soap_template") or {}
            grounded_cases.append(
                {
                    "score": round(float(case.final_score), 3),
                    "diagnosis": str(
                        payload.get("display_name_vi")
                        or payload.get("final_diagnosis_text")
                        or payload.get("canonical_code")
                        or "Chưa rõ"
                    ).strip(),
                    "chief_complaint": self._truncate_text(
                        str(
                            payload.get("chief_complaint")
                            or payload.get("clinical_notes")
                            or case.content
                        ),
                        180,
                    ),
                    "soap_assessment": self._truncate_text(
                        str(
                            soap_template.get("assessment")
                            or payload.get("final_diagnosis_text")
                            or ""
                        ),
                        180,
                    ),
                    "plan_recommendations": self._sanitize_text_list(
                        protocol_pattern.get("common_recommendations"),
                        max_items=3,
                    ),
                    "common_tests": self._extract_protocol_test_names(
                        protocol_pattern.get("common_tests")
                    ),
                    "common_prescriptions": self._build_pattern_prescription_evidence(
                        protocol_pattern.get("common_prescriptions")
                    ),
                    "exam_at": payload.get("exam_at"),
                }
            )
        return grounded_cases

    def _build_soap_grounding_bundle(
        self,
        *,
        request: StaffDiagnosisRequest,
        top_differentials: List[DiagnosisSuggestion],
        hybrid_result: HybridResult,
        similar_cases: List[CaseResult],
        protocol_decision: ProtocolDecision,
        vision_response: GeminiVisionDiagnosisResponse,
    ) -> SoapGroundingBundle:
        selected_label = (
            request.selected_diagnosis_label
            or protocol_decision.diagnosis_display_name
            or ""
        ).strip()

        return SoapGroundingBundle(
            subjective={
                "current_draft": request.soap_draft.subjective.strip(),
                "doctor_description": request.doctor_description.strip(),
                "symptoms": self._sanitize_text_list(request.symptoms, max_items=6),
            },
            objective={
                "current_draft": request.soap_draft.objective.strip(),
                "body_part": (request.body_part or "").strip(),
                "visual_findings": self._sanitize_text_list(
                    vision_response.visual_findings,
                    max_items=5,
                ),
                "image_descriptions": self._sanitize_text_list(
                    vision_response.image_descriptions,
                    max_items=3,
                    max_length=320,
                ),
            },
            assessment={
                "selected_diagnosis_code": request.selected_diagnosis_code
                or protocol_decision.diagnosis_code,
                "selected_diagnosis_label": selected_label,
                "top_differentials": [
                    {
                        "canonical_code": item.canonical_code,
                        "display_name_vi": item.display_name_vi,
                        "score_percent": item.score_percent,
                        "supporting_reasons": item.supporting_reasons[:3],
                    }
                    for item in top_differentials[:3]
                ],
                "kb_evidence": self._build_grounded_kb_evidence(hybrid_result),
                "case_memory_matches": self._build_grounded_case_evidence(
                    similar_cases
                ),
                "protocol_summary": protocol_decision.summary,
            },
            plan={
                "current_draft": request.soap_draft.plan.strip(),
                "selected_diagnosis_code": request.selected_diagnosis_code
                or protocol_decision.diagnosis_code,
                "selected_diagnosis_label": selected_label,
                "protocol_summary": protocol_decision.summary,
                "protocol_prescriptions": self._serialize_prescriptions_for_prompt(
                    protocol_decision.prescriptions
                ),
                "recommended_tests": self._sanitize_text_list(
                    protocol_decision.recommended_tests,
                    max_items=5,
                ),
                "recommended_actions": self._sanitize_text_list(
                    protocol_decision.recommended_actions,
                    max_items=5,
                    max_length=200,
                ),
                "missing_inputs": self._sanitize_text_list(
                    protocol_decision.missing_inputs,
                    max_items=6,
                ),
                "cautions": self._sanitize_text_list(
                    protocol_decision.cautions,
                    max_items=8,
                ),
            },
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
        force_medication: bool = False,
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
                    force_medication=force_medication,
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
                request.species.value,
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
        force_medication: bool = False,
    ) -> str:
        grounding_bundle = self._build_soap_grounding_bundle(
            request=request,
            top_differentials=top_differentials,
            hybrid_result=hybrid_result,
            similar_cases=similar_cases,
            protocol_decision=protocol_decision,
            vision_response=vision_response,
        )
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
                "selected_diagnosis_code": request.selected_diagnosis_code,
                "selected_diagnosis_label": request.selected_diagnosis_label,
            },
            "vision_findings": vision_response.visual_findings,
            "image_descriptions": vision_response.image_descriptions,
            "top_differentials": [
                {
                    "canonical_code": item.canonical_code,
                    "display_name_vi": item.display_name_vi,
                    "rank": item.rank,
                    "score_percent": item.score_percent,
                    "score_basis": item.score_basis,
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
            "prescriptions": self._serialize_prescriptions_for_prompt(
                protocol_decision.prescriptions
            ),
            "has_internal_protocol": bool(protocol_decision.prescriptions),
            "protocol_recommended_tests": self._sanitize_text_list(
                protocol_decision.recommended_tests, max_items=5
            ),
            "protocol_recommended_actions": self._sanitize_text_list(
                protocol_decision.recommended_actions, max_items=5, max_length=200
            ),
            "grounding_bundle": grounding_bundle.to_dict(),
            "requires_medication": force_medication,
        }
        return f"""Bạn là trợ lý AI nội bộ hỗ trợ staff/vet tổng hợp ca bệnh cho Petties.
    Ưu tiên dùng dữ liệu nội bộ đã cho. Nếu dữ liệu nội bộ chưa đủ, được phép dùng kiến thức thú y tổng quát để đề xuất chẩn đoán phân biệt theo triệu chứng hiện tại.
    Nếu dữ liệu ảnh rỗng thì không được bịa thêm mô tả ảnh.
Nếu Case Memory đã đủ mạnh thì ưu tiên tổng hợp từ Case Memory và Knowledge Base, không cần giả định rằng vision đã chạy.

QUY TẮC GROUNDED SOAP:
- `soap_suggestions.subjective_draft` chỉ được dùng dữ liệu từ `grounding_bundle.subjective`.
- `subjective_draft` KHÔNG liệt kê thông tin dị ứng; phần dị ứng để bác sĩ ghi riêng khi cần.
- `soap_suggestions.objective_draft` chỉ được dùng dữ liệu từ `grounding_bundle.objective`; không được bịa xét nghiệm, chỉ số sinh tồn, hay phát hiện hình ảnh không tồn tại.
- `objective_draft` KHÔNG được liệt kê cân nặng (kg); cân nặng được hiển thị/nhập ở trường chỉ số riêng.
- `soap_suggestions.assessment_draft` chỉ được dùng các chẩn đoán trong `top_differentials` hoặc chẩn đoán đã chọn; không được tạo ra diagnosis mới ngoài bundle.
- `soap_suggestions.plan_draft` chỉ nói về hành động lâm sàng tiếp theo: thăm khám, xét nghiệm, theo dõi, tái khám, dặn dò.
- `plan_draft` KHÔNG được nhắc tên thuốc, liều, tần suất, hoặc bất kỳ thông tin nào thuộc về đơn thuốc, vì đơn thuốc đã có phần `prescription_suggestions` riêng.
- Nếu dữ liệu chưa đủ cho plan, phải ghi rõ kiểu an toàn như `Cần bổ sung thêm dữ liệu trước khi chốt hướng xử trí`.
- Không nhắc tới từ khóa `KB`, `Knowledge Base`, `Case Memory`, `RAG`, hay `bundle` trong SOAP cuối cùng.

QUAN TRỌNG về đơn thuốc:
- Nếu has_internal_protocol=true: Giữ nguyên đơn thuốc học từ EMR confirmed pattern (không tự ý thay)
- Nếu has_internal_protocol=false (KHÔNG có trong Case Memory phù hợp):
  - BẮT BUỘC phải gợi ý ít nhất 1-2 loại thuốc phổ biến, phù hợp với triệu chứng/chẩn đoán
  - Dựa vào kiến thức thú y chung để suggest thuốc điều trị triệu chứng
  - Ghi rõ disclaimer là "Cần xác nhận từ bác sĩ" vì không có trong data nội bộ
- Mỗi phần tử trong `prescription_suggestions` BẮT BUỘC có `instructions` không rỗng để staff biết cách dùng thuốc.
- Nếu `requires_medication=true`: `prescription_suggestions` TUYỆT ĐỐI không được rỗng.

QUAN TRỌNG về safety:
- Được phép đề xuất `safety_suggestions` gồm `missing_inputs` và `cautions`
- Safety phải ngắn gọn, kiểm chứng được từ dữ liệu ca hiện tại, không bịa thêm dữ liệu
- Không được dùng safety để override selected diagnosis identity

QUAN TRỌNG về tên chẩn đoán:
- `display_name_vi` phải là TÊN BỆNH NGẮN GỌN, KHÔNG mô tả triệu chứng hay nguyên nhân
- ĐÚNG: "Viêm ruột cấp tính" hoặc "Viêm da do vi khuẩn"
- SAI: "Viêm ruột cấp tính, nghi do thay đổi thức ăn hoặc ăn phải thức ăn không phù hợp. Theo dõi thêm triệu chứng."
- Nếu chưa chắc chắn, dùng tên chung như "Rối loạn tiêu hóa" thay vì mô tả dài dòng

QUAN TRỌNG về differential:
- Nếu `top_differentials` đầu vào chỉ có mục generic như "Cần phân biệt thêm...", bạn ĐƯỢC PHÉP đề xuất tối đa 3 chẩn đoán phân biệt dựa trên triệu chứng hiện tại.
- Không bắt buộc 100% phải khớp bệnh trong KB/Case Memory ở tình huống này.
- Tuy nhiên vẫn phải giữ tính lâm sàng và nhất quán với triệu chứng chính; không đề xuất bệnh lệch cơ quan rõ rệt.

Viết hoàn toàn bằng tiếng Việt, ngắn gọn, lâm sàng, không thêm markdown. Chỉ trả về JSON hợp lệ.
Ưu tiên câu ngắn, trực tiếp, phù hợp để chèn vào EMR.

DỮ LIỆU:
{json.dumps(payload, ensure_ascii=False, indent=2)}

JSON:
{{
  "top_differentials": [
    {{
      "display_name_vi": "Viêm ruột cấp tính",
      "confidence_note": "Độ tự tin: 75%",
      "supporting_reasons": ["Triệu chứng phù hợp", "Có case tương tự trong KB"]
    }}
  ],
  "soap_suggestions": {{
    "subjective_draft": "...",
    "objective_draft": "...",
    "assessment_draft": "...",
    "plan_draft": "..."
  }},
  "safety_suggestions": {{
    "missing_inputs": ["...", "..."],
    "cautions": ["...", "..."]
  }},
  "suggested_questions": ["...", "...", "..."],
  "prescription_suggestions": [
    {{
      "medicine_name": "Tên thuốc",
      "times_of_day": ["sang", "trua", "chieu"],
      "before_after_meal": "AFTER_MEAL|BEFORE_MEAL|WITH_MEAL|NONE",
      "frequency_note": "Ghi chú tần suất (tuỳ chọn)",
      "duration_days": Số_ngày,
      "instructions": "Hướng dẫn sử dụng",
      "caution": "Lưu ý (nếu có)"
    }}
  ],
  "prescription_disclaimer": "Cần xác nhận từ bác sĩ|Đã kiểm chứng"
}}

RÀNG BUỘC CỰC KỲ QUAN TRỌNG về đơn thuốc:
- TUYỆT ĐỐI KHÔNG được trả về các field `dosage` hoặc `frequency` (đã bị loại bỏ khỏi schema).
- Nếu model suy luận ra liều/tần suất, hãy diễn đạt bằng `times_of_day`, `before_after_meal`, `frequency_note`, và `instructions`.
- `times_of_day` chỉ được dùng giá trị trong tập: `sang`, `trua`, `chieu`.
"""

    def _parse_llm_synthesis_response(
        self,
        content: str,
        fallback_differentials: List[DiagnosisSuggestion],
        species: str,
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
            mapper = get_disease_mapping_service()
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
                if len(display_name) > 60:
                    display_name = (
                        display_name[:60].rsplit(",", 1)[0].rsplit(".", 1)[0].strip()
                    )
                    if not display_name or len(display_name) < 3:
                        display_name = (
                            fallback.display_name_vi if fallback else "Chưa xác định"
                        )
                canonical_code = fallback.canonical_code if fallback else None
                if fallback is not None:
                    fallback_label = (fallback.display_name_vi or "").strip().lower()
                    fallback_is_generic = self._is_generic_fallback_differential(
                        fallback
                    )
                    if display_name.strip().lower() != fallback_label:
                        mapped = mapper.map_label(
                            raw_label=display_name,
                            source_type="kb",
                            species=species,
                        )
                        if not mapped.mapped:
                            mapped = mapper.find_canonical_in_text(
                                text=display_name,
                                preferred_source_types=["kb", "vision", "emr"],
                                species=species,
                            )
                        if mapped.mapped and mapped.canonical_code:
                            canonical_code = mapped.canonical_code
                            display_name = mapped.display_name_vi or display_name
                        else:
                            if fallback_is_generic:
                                canonical_code = None
                            else:
                                canonical_code = fallback.canonical_code
                                display_name = fallback.display_name_vi
                else:
                    mapped = mapper.map_label(
                        raw_label=display_name,
                        source_type="kb",
                        species=species,
                    )
                    if not mapped.mapped:
                        mapped = mapper.find_canonical_in_text(
                            text=display_name,
                            preferred_source_types=["kb", "vision", "emr"],
                            species=species,
                        )
                    if mapped.mapped and mapped.canonical_code:
                        canonical_code = mapped.canonical_code
                        display_name = mapped.display_name_vi or display_name
                reasons = item.get("supporting_reasons") or []
                if not isinstance(reasons, list):
                    reasons = []

                fallback_is_generic = (
                    self._is_generic_fallback_differential(fallback)
                    if fallback is not None
                    else False
                )
                use_llm_confidence = (
                    fallback_is_generic
                    and display_name.strip().lower()
                    != (fallback.display_name_vi or "").strip().lower()
                )

                normalized.append(
                    DiagnosisSuggestion(
                        canonical_code=canonical_code,
                        display_name_vi=display_name,
                        rank=fallback.rank if fallback else index + 1,
                        score_percent=(
                            0
                            if use_llm_confidence
                            else (fallback.score_percent if fallback else 0)
                        ),
                        score_basis=(
                            "llm_reference"
                            if use_llm_confidence
                            else (fallback.score_basis if fallback else "")
                        ),
                        confidence_note=(
                            "Độ tự tin (tham khảo): 0%"
                            if use_llm_confidence
                            else (
                                fallback.confidence_note
                                if fallback
                                else "Độ tự tin (tham khảo): 0%"
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

        safety = payload.get("safety_suggestions")
        if isinstance(safety, dict):
            result["safety_suggestions"] = {
                "missing_inputs": self._sanitize_text_list(
                    safety.get("missing_inputs"),
                    max_items=6,
                ),
                "cautions": self._sanitize_text_list(
                    safety.get("cautions"),
                    max_items=8,
                ),
            }

        suggested_questions = payload.get("suggested_questions")
        if isinstance(suggested_questions, list):
            result["suggested_questions"] = self._sanitize_text_list(
                suggested_questions,
                max_items=5,
            )

        prescriptions = payload.get("prescription_suggestions")
        if not prescriptions:
            prescriptions = payload.get("prescriptions")
        if isinstance(prescriptions, list) and prescriptions:
            parsed_rx: List[PrescriptionSuggestion] = []
            for rx in prescriptions:
                if not isinstance(rx, dict):
                    continue
                medicine = str(
                    rx.get("medicine_name")
                    or rx.get("medicineName")
                    or rx.get("medicine")
                    or ""
                ).strip()
                if not medicine:
                    continue
                raw_times = (
                    rx.get("times_of_day")
                    if rx.get("times_of_day") is not None
                    else rx.get("timesOfDay")
                )
                if isinstance(raw_times, str):
                    raw_times = [x.strip() for x in raw_times.split(",") if x.strip()]
                parsed_rx.append(
                    PrescriptionSuggestion(
                        medicine_name=medicine,
                        times_of_day=self._normalize_times_of_day(raw_times),
                        before_after_meal=(
                            str(
                                rx.get("before_after_meal")
                                or rx.get("beforeAfterMeal")
                                or ""
                            ).strip()
                            or None
                        ),
                        frequency_note=str(
                            rx.get("frequency_note") or rx.get("frequencyNote") or ""
                        ),
                        duration_days=rx.get("duration_days")
                        or rx.get("durationDays"),
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

    def _requires_medication(
        self,
        *,
        selected_primary: Optional[DiagnosisSuggestion],
        protocol_decision: ProtocolDecision,
    ) -> bool:
        if protocol_decision.prescriptions:
            return True
        if selected_primary is None:
            return False
        return not self._is_generic_fallback_differential(selected_primary)

    def _is_valid_prescription_payload_item(
        self,
        prescription: PrescriptionSuggestion,
    ) -> bool:
        if not str(prescription.medicine_name or "").strip():
            return False
        if not self._normalize_times_of_day(prescription.times_of_day):
            return False
        if not str(prescription.instructions or "").strip():
            return False
        return True

    def _validate_emr_payload_completeness(
        self,
        *,
        requires_medication: bool,
        prescription_suggestions: List[PrescriptionSuggestion],
        top_differentials: List[DiagnosisSuggestion],
        soap_suggestions: SoapSuggestions,
    ) -> tuple[bool, List[str]]:
        errors: List[str] = []
        if not top_differentials:
            errors.append("Thiếu chẩn đoán phân biệt.")
        if not (soap_suggestions.subjective_draft or "").strip():
            errors.append("Thiếu nội dung phần chủ quan.")
        if requires_medication:
            if not prescription_suggestions:
                errors.append("Thiếu đơn thuốc cho ca cần dùng thuốc.")
            else:
                invalid_count = sum(
                    1
                    for item in prescription_suggestions
                    if not self._is_valid_prescription_payload_item(item)
                )
                if invalid_count > 0:
                    errors.append("Đơn thuốc chưa đúng schema bắt buộc.")
        return len(errors) == 0, errors

    async def _retry_llm_until_medication_complete(
        self,
        *,
        request: StaffDiagnosisRequest,
        top_differentials: List[DiagnosisSuggestion],
        hybrid_result: HybridResult,
        similar_cases: List[CaseResult],
        protocol_decision: ProtocolDecision,
        vision_response: GeminiVisionDiagnosisResponse,
        initial_synthesis: Optional[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        synthesis = initial_synthesis
        if synthesis and synthesis.get("prescription_suggestions"):
            first_pass = self._ensure_prescription_usage_instructions(
                synthesis.get("prescription_suggestions") or []
            )
            if first_pass and all(
                self._is_valid_prescription_payload_item(item) for item in first_pass
            ):
                return synthesis
        for attempt in range(self._MAX_MEDICATION_RETRY):
            synthesis = await self._synthesize_with_llm(
                request=request,
                top_differentials=top_differentials,
                hybrid_result=hybrid_result,
                similar_cases=similar_cases,
                protocol_decision=protocol_decision,
                vision_response=vision_response,
                force_medication=True,
            )
            if synthesis and synthesis.get("prescription_suggestions"):
                retry_pass = self._ensure_prescription_usage_instructions(
                    synthesis.get("prescription_suggestions") or []
                )
                if not retry_pass or not all(
                    self._is_valid_prescription_payload_item(item)
                    for item in retry_pass
                ):
                    continue
                logger.info(
                    "Medication retry success at attempt {}",
                    attempt + 1,
                )
                return synthesis
        logger.warning("Medication retry exhausted without valid prescriptions")
        return synthesis

    def _normalize_times_of_day(self, raw_times: Any) -> List[str]:
        if not isinstance(raw_times, list):
            return []
        allowed = {"sang", "trua", "chieu"}
        normalized: List[str] = []
        seen: set[str] = set()
        for value in raw_times:
            slot = str(value or "").strip().lower()
            if slot not in allowed or slot in seen:
                continue
            seen.add(slot)
            normalized.append(slot)
        return normalized

    def _is_generic_fallback_differential(
        self,
        differential: Optional[DiagnosisSuggestion],
    ) -> bool:
        if differential is None:
            return False
        label = (differential.display_name_vi or "").strip().lower()
        return (
            differential.canonical_code is None
            and "cần phân biệt" in label
        )

    def _merge_safety_suggestions(
        self,
        *,
        protocol_decision: ProtocolDecision,
        llm_synthesis: Optional[Dict[str, Any]],
    ) -> ProtocolDecision:
        if not llm_synthesis:
            return protocol_decision

        safety = llm_synthesis.get("safety_suggestions")
        if not isinstance(safety, dict):
            return protocol_decision

        merged_missing = self._merge_text_lists(
            base_items=protocol_decision.missing_inputs,
            llm_items=safety.get("missing_inputs"),
            max_items=8,
        )
        merged_cautions = self._merge_text_lists(
            base_items=protocol_decision.cautions,
            llm_items=safety.get("cautions"),
            max_items=8,
        )

        return ProtocolDecision(
            diagnosis_code=protocol_decision.diagnosis_code,
            diagnosis_display_name=protocol_decision.diagnosis_display_name,
            summary=protocol_decision.summary,
            prescriptions=protocol_decision.prescriptions,
            recommended_tests=protocol_decision.recommended_tests,
            recommended_actions=protocol_decision.recommended_actions,
            missing_inputs=merged_missing,
            cautions=merged_cautions,
            protocol_applied=protocol_decision.protocol_applied,
        )

    def _merge_soap_suggestions_with_llm(
        self,
        *,
        base_soap: SoapSuggestions,
        llm_synthesis: Optional[Dict[str, Any]],
        selected_primary: Optional[DiagnosisSuggestion],
    ) -> SoapSuggestions:
        if not llm_synthesis:
            return base_soap

        llm_soap = llm_synthesis.get("soap_suggestions")
        if not isinstance(llm_soap, SoapSuggestions):
            return base_soap

        subjective = self._sanitize_draft_text(llm_soap.subjective_draft)
        objective = self._sanitize_draft_text(llm_soap.objective_draft)
        assessment = self._sanitize_draft_text(llm_soap.assessment_draft)
        plan = self._sanitize_draft_text(llm_soap.plan_draft)
        subjective = self._strip_allergy_mentions_from_subjective(subjective)
        objective = self._strip_weight_mentions_from_objective(objective)

        if selected_primary is not None:
            merged_plan = self._coerce_plan_for_selected_diagnosis(
                llm_plan=plan,
                selected_diagnosis_label=selected_primary.display_name_vi,
                fallback_plan=base_soap.plan_draft,
            )
            merged_assessment = base_soap.assessment_draft
        else:
            merged_plan = base_soap.plan_draft
            merged_assessment = assessment or base_soap.assessment_draft

        return SoapSuggestions(
            subjective_draft=subjective or base_soap.subjective_draft,
            objective_draft=objective or base_soap.objective_draft,
            assessment_draft=merged_assessment,
            plan_draft=merged_plan,
        )

    def _sanitize_text_list(
        self,
        items: Any,
        *,
        max_items: int,
        max_length: int = 240,
    ) -> List[str]:
        if not isinstance(items, list):
            return []
        result: List[str] = []
        seen: set[str] = set()
        for raw in items:
            text = " ".join(str(raw or "").split()).strip()
            if not text:
                continue
            text = text[:max_length].rstrip()
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            result.append(text)
            if len(result) >= max_items:
                break
        return result

    def _merge_text_lists(
        self,
        *,
        base_items: List[str],
        llm_items: Any,
        max_items: int,
    ) -> List[str]:
        base_clean = self._sanitize_text_list(base_items, max_items=max_items)
        llm_clean = self._sanitize_text_list(llm_items, max_items=max_items)
        merged: List[str] = []
        seen: set[str] = set()
        for item in base_clean + llm_clean:
            key = item.lower()
            if key in seen:
                continue
            seen.add(key)
            merged.append(item)
            if len(merged) >= max_items:
                break
        return merged

    def _sanitize_draft_text(self, value: str, max_length: int = 1500) -> str:
        lines = [" ".join(line.split()) for line in (value or "").splitlines()]
        text = "\n".join(line for line in lines if line).strip()
        return text[:max_length].rstrip()

    def _strip_allergy_mentions_from_subjective(self, text: str) -> str:
        if not text:
            return text
        cleaned = []
        for line in text.splitlines():
            line_l = line.lower()
            if "dị ứng" in line_l or "di ung" in line_l or "allerg" in line_l:
                continue
            cleaned.append(line)
        return "\n".join(cleaned).strip()

    def _strip_weight_mentions_from_objective(self, text: str) -> str:
        if not text:
            return text
        cleaned = []
        for line in text.splitlines():
            line_l = line.lower()
            if "cân nặng" in line_l or "can nang" in line_l or "kg" in line_l:
                continue
            cleaned.append(line)
        return "\n".join(cleaned).strip()

    def _build_top_differentials(
        self,
        *,
        request: StaffDiagnosisRequest,
        vision_response: GeminiVisionDiagnosisResponse,
        hybrid_result: HybridResult,
        similar_cases: List[CaseResult],
        evidence_mode: str,
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
        score_percents = self._normalize_percentages(
            [item.score for item in sorted_candidates]
        )
        score_basis = self._score_basis_from_mode(evidence_mode)

        result: List[DiagnosisSuggestion] = []
        for index, item in enumerate(sorted_candidates, start=1):
            percent = (
                score_percents[index - 1] if index - 1 < len(score_percents) else 0
            )
            result.append(
                DiagnosisSuggestion(
                    canonical_code=item.canonical_code,
                    display_name_vi=item.display_name_vi,
                    rank=index,
                    score_percent=percent,
                    score_basis=score_basis,
                    confidence_note=self._confidence_note(
                        score_percent=percent,
                        evidence_mode=evidence_mode,
                    ),
                    supporting_reasons=item.supporting_reasons
                    or [
                        "Chưa có đủ tín hiệu nội bộ để củng cố mạnh cho chẩn đoán này."
                    ],
                )
            )
        return result

    def _backfill_candidates_from_catalog(
        self,
        *,
        candidates: Dict[str, DifferentialCandidate],
        request: StaffDiagnosisRequest,
        minimum: int,
    ) -> None:
        if len(candidates) >= minimum:
            return

        mapper = get_disease_mapping_service()
        catalog_entries = sorted(
            mapper._catalog.values(),
            key=lambda entry: entry.display_name_vi,
        )
        species = (request.species.value or "all").lower()
        score_seed = 0.14

        for entry in catalog_entries:
            if len(candidates) >= minimum:
                break

            entry_species = (entry.species or "all").lower()
            if entry_species not in {"all", species}:
                continue

            display_name = (entry.display_name_vi or "").strip()
            if not display_name:
                continue

            key = (entry.canonical_code or display_name).lower()
            if key in candidates:
                continue

            candidates[key] = DifferentialCandidate(
                canonical_code=entry.canonical_code,
                display_name_vi=display_name,
                score=score_seed,
                supporting_reasons=[
                    "Được bổ sung từ danh mục bệnh chuẩn để đảm bảo bác sĩ có đủ Top 3 so sánh.",
                    "Mức ưu tiên thấp vì bằng chứng hiện tại còn hạn chế, cần đối chiếu lâm sàng thêm.",
                ],
            )
            score_seed = max(score_seed - 0.02, 0.06)

    def _merge_top_differentials_with_fallback(
        self,
        *,
        preferred: List[DiagnosisSuggestion],
        fallback: List[DiagnosisSuggestion],
        request: StaffDiagnosisRequest,
        evidence_mode: str,
    ) -> List[DiagnosisSuggestion]:
        merged: List[DiagnosisSuggestion] = []
        seen: set[str] = set()

        def append_item(
            item: DiagnosisSuggestion,
            *,
            extra_reason: Optional[str] = None,
        ) -> None:
            label = (item.display_name_vi or "").strip()
            if not label:
                return

            candidate_text = " ".join(
                [label]
                + self._sanitize_text_list(
                    item.supporting_reasons,
                    max_items=4,
                    max_length=220,
                )
            )
            if not self._is_evidence_focus_aligned(
                request=request,
                evidence_text=candidate_text,
            ):
                return

            key = (item.canonical_code or label).strip().lower()
            if key in seen:
                return
            seen.add(key)

            reasons = self._sanitize_text_list(
                item.supporting_reasons,
                max_items=4,
                max_length=220,
            )
            if extra_reason and extra_reason not in reasons:
                reasons.append(extra_reason)

            merged.append(
                DiagnosisSuggestion(
                    canonical_code=item.canonical_code,
                    display_name_vi=label,
                    rank=0,
                    score_percent=max(int(item.score_percent or 0), 0),
                    score_basis=item.score_basis,
                    confidence_note=item.confidence_note,
                    supporting_reasons=reasons,
                )
            )

        for item in preferred[:3]:
            append_item(item)

        for item in fallback:
            if len(merged) >= 3:
                break
            append_item(
                item,
                extra_reason="Giữ lại để đảm bảo bác sĩ có thêm lựa chọn đối chiếu lâm sàng.",
            )

        if not merged:
            return self._fallback_differentials(request)

        return self._rank_top_differentials(
            differentials=merged[:3],
            evidence_mode=evidence_mode,
        )

    def _rank_top_differentials(
        self,
        *,
        differentials: List[DiagnosisSuggestion],
        evidence_mode: str,
    ) -> List[DiagnosisSuggestion]:
        if not differentials:
            return []

        raw_scores: List[float] = []
        total_items = len(differentials)
        for index, item in enumerate(differentials):
            if item.score_percent and item.score_percent > 0:
                raw_scores.append(float(item.score_percent))
            else:
                raw_scores.append(float(max(total_items - index, 1)))

        normalized_scores = self._normalize_percentages(raw_scores)
        score_basis = self._score_basis_from_mode(evidence_mode)

        ranked: List[DiagnosisSuggestion] = []
        for index, item in enumerate(differentials[:3], start=1):
            percent = (
                normalized_scores[index - 1]
                if index - 1 < len(normalized_scores)
                else 0
            )
            reasons = self._sanitize_text_list(
                item.supporting_reasons,
                max_items=4,
                max_length=220,
            ) or [
                "Cần đối chiếu thêm khám lâm sàng để tăng độ chắc chắn cho hướng chẩn đoán này."
            ]

            ranked.append(
                DiagnosisSuggestion(
                    canonical_code=item.canonical_code,
                    display_name_vi=item.display_name_vi,
                    rank=index,
                    score_percent=percent,
                    score_basis=score_basis,
                    confidence_note=self._confidence_note(
                        score_percent=percent,
                        evidence_mode=evidence_mode,
                    ),
                    supporting_reasons=reasons,
                )
            )

        return ranked

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
        if any(self._is_confirmed_case_payload(case.payload) for case in similar_cases):
            reasons.append("Đã tìm thấy ca EMR xác nhận tương tự trong Case Memory.")
        return reasons

    def _is_confirmed_case_payload(self, payload: Any) -> bool:
        if not isinstance(payload, dict):
            return True
        return str(payload.get("mapping_status") or "").strip().lower() != "provisional"

    def _extract_request_focus_tags(self, request: StaffDiagnosisRequest) -> set[str]:
        parts: List[str] = []
        if request.body_part:
            parts.append(request.body_part)
        if request.doctor_description:
            parts.append(request.doctor_description)
        if request.symptoms:
            parts.extend(request.symptoms)

        return self._extract_focus_tags(" ".join(parts))

    def _extract_focus_tags(self, text: str) -> set[str]:
        normalized = (text or "").lower()
        if not normalized:
            return set()

        tags: set[str] = set()
        keyword_map: Dict[str, tuple[str, ...]] = {
            "eye": ("mắt", "mat", "ghèn", "ghem"),
            "nose": ("mũi", "mui", "sổ mũi", "so mui", "chảy mũi", "chay mui"),
            "ear": ("tai", "ráy tai", "ray tai", "otitis"),
            "skin": ("da", "lông", "long", "ngứa", "ngua", "mẩn", "mun", "mụn"),
            "gi": ("nôn", "non", "ói", "oi", "tiêu chảy", "tieu chay", "phân", "phan"),
            "resp": ("ho", "khò khè", "kho khe", "khó thở", "kho tho"),
        }

        for tag, keywords in keyword_map.items():
            if any(keyword in normalized for keyword in keywords):
                tags.add(tag)

        return tags

    def _is_evidence_focus_aligned(
        self,
        *,
        request: StaffDiagnosisRequest,
        evidence_text: str,
    ) -> bool:
        request_tags = self._extract_request_focus_tags(request)
        if not request_tags:
            return True

        evidence_tags = self._extract_focus_tags(evidence_text)
        if not evidence_tags:
            return True

        return bool(request_tags & evidence_tags)

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
        support_by_diagnosis: Dict[tuple[str, str], Dict[str, int]] = {}

        for case in similar_cases:
            payload = case.payload or {}
            canonical_code = str(payload.get("canonical_code") or "").strip().lower()
            species = str(payload.get("species") or "all").strip().lower()
            if not canonical_code:
                continue

            key = (canonical_code, species)
            bucket = support_by_diagnosis.setdefault(
                key,
                {
                    "diagnosis_support_count": 0,
                    "accepted_support_count": 0,
                    "edited_support_count": 0,
                    "rejected_support_count": 0,
                    "unknown_support_count": 0,
                },
            )
            bucket["diagnosis_support_count"] += 1
            # Runtime policy: all confirmed EMR are equal learning signals.
            bucket["accepted_support_count"] = bucket["diagnosis_support_count"]

        for case in similar_cases:
            payload = case.payload or {}
            protocol_pattern = payload.get("protocol_pattern")
            if not protocol_pattern:
                continue

            canonical_code = str(payload.get("canonical_code") or "").strip().lower()
            species = str(payload.get("species") or "all").strip().lower()
            support_metrics = support_by_diagnosis.get(
                (canonical_code, species),
                {
                    "diagnosis_support_count": 1,
                    "accepted_support_count": 1,
                    "edited_support_count": 0,
                    "rejected_support_count": 0,
                    "unknown_support_count": 0,
                },
            )
            support_score = float(support_metrics["diagnosis_support_count"])
            support_score = max(0.0, round(support_score, 3))

            pattern_entry = {
                "case_id": payload.get("case_id", ""),
                "score": case.final_score,
                "species": payload.get("species"),
                "canonical_code": payload.get("canonical_code"),
                "soap_template": protocol_pattern.get("soap_template"),
                "common_prescriptions": protocol_pattern.get(
                    "common_prescriptions", []
                ),
                "common_tests": protocol_pattern.get("common_tests", []),
                "common_recommendations": protocol_pattern.get(
                    "common_recommendations", []
                ),
                **support_metrics,
                "pattern_support_score": support_score,
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
                rank=1,
                score_percent=100,
                score_basis="llm_reference",
                confidence_note="Độ tự tin (tham khảo): 100%",
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
        primary_diagnosis: Optional[DiagnosisSuggestion],
        vision_response: GeminiVisionDiagnosisResponse,
        hybrid_result: HybridResult,
        similar_cases: List[CaseResult],
        protocol_decision: ProtocolDecision,
    ) -> SoapSuggestions:
        subjective_text = self._build_subjective_draft(request)

        objective_text = self._build_objective_draft(
            request=request,
            vision_response=vision_response,
        )

        if primary_diagnosis is None:
            return SoapSuggestions(
                subjective_draft=subjective_text,
                objective_draft=objective_text,
                assessment_draft="",
                plan_draft="",
            )

        top_label = primary_diagnosis.display_name_vi
        assessment_text = self._build_assessment_draft(
            top_label=top_label,
            top_differentials=top_differentials,
            vision_response=vision_response,
            hybrid_result=hybrid_result,
            similar_cases=similar_cases,
            protocol_decision=protocol_decision,
        )
        plan_text = self._build_plan_draft(
            top_label=top_label,
            request=request,
            protocol_decision=protocol_decision,
        )

        return SoapSuggestions(
            subjective_draft=subjective_text,
            objective_draft=objective_text,
            assessment_draft=assessment_text,
            plan_draft=plan_text,
        )

    def _build_subjective_draft(self, request: StaffDiagnosisRequest) -> str:
        if request.soap_draft.subjective.strip():
            return request.soap_draft.subjective.strip()

        parts: List[str] = []
        if request.doctor_description.strip():
            parts.append(request.doctor_description.strip())
        if request.symptoms:
            parts.append("Triệu chứng ghi nhận: " + ", ".join(request.symptoms[:6]))

        return " ".join(part for part in parts if part).strip()

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
        hybrid_result: HybridResult,
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

        evidence_parts: List[str] = []
        if hybrid_result.chunks:
            evidence_parts.append("đã đối chiếu kho tri thức nội bộ")
        if similar_cases:
            evidence_parts.append("có ca EMR xác nhận tương tự")
        if evidence_parts and parts:
            parts.append("Cơ sở hỗ trợ: " + " và ".join(evidence_parts) + ".")

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
        parts: List[str] = []

        normalized_label = (top_label or "").strip()
        if normalized_label and "chưa" not in normalized_label.lower():
            parts.append(
                f"Định hướng xử trí theo chẩn đoán đã chọn: {normalized_label}."
            )

        if protocol_decision.cautions:
            for caution in protocol_decision.cautions:
                if caution.strip() and caution not in " ".join(parts):
                    parts.append(f"Lưu ý: {caution}.")

        if protocol_decision.missing_inputs:
            for missing in protocol_decision.missing_inputs:
                if "cân nặng" in missing.lower():
                    parts.append("Cần bổ sung cân nặng để tính liều chính xác.")

        if not parts:
            parts.append(
                "Cần bổ sung thăm khám lâm sàng và đối chiếu thêm dữ liệu trước khi chốt hướng xử trí."
            )

        return "\n".join(parts)

    def _coerce_plan_for_selected_diagnosis(
        self,
        *,
        llm_plan: str,
        selected_diagnosis_label: str,
        fallback_plan: str,
    ) -> str:
        candidate = (llm_plan or "").strip()
        selected_label = (selected_diagnosis_label or "").strip()
        fallback = (fallback_plan or "").strip()

        if not selected_label:
            return candidate or fallback
        if not candidate:
            return fallback

        candidate_lower = candidate.lower()
        selected_lower = selected_label.lower()
        generic_markers = [
            "phác đồ đã được xác nhận",
            "xác định chính xác nguyên nhân",
            "theo dõi đáp ứng điều trị",
            "đối chiếu thêm dữ liệu",
        ]

        if selected_lower in candidate_lower:
            return candidate
        if any(marker in candidate_lower for marker in generic_markers):
            return (
                fallback
                or f"Định hướng điều trị theo chẩn đoán đã chọn: {selected_label}."
            )

        return (
            f"Định hướng điều trị theo chẩn đoán đã chọn: {selected_label}. {candidate}"
        )

    def _resolve_evidence_mode(
        self,
        *,
        hybrid_result: HybridResult,
        similar_cases: List[CaseResult],
        vision_response: GeminiVisionDiagnosisResponse,
    ) -> str:
        if hybrid_result.chunks or similar_cases:
            return "internal_grounded"
        if vision_response.top_conditions:
            return "vlm_fallback"
        return "llm_fallback"

    def _resolve_evidence_labels(self, evidence_mode: str) -> tuple[str, str]:
        if evidence_mode in {"internal_grounded", "vlm_fallback", "llm_fallback"}:
            return (
                "Gợi ý AI hỗ trợ nhập EMR",
                "Độ tự tin (%)",
            )
        return (
            "Gợi ý AI hỗ trợ nhập EMR",
            "Độ tự tin (%)",
        )

    def _score_basis_from_mode(self, evidence_mode: str) -> str:
        if evidence_mode == "internal_grounded":
            return "matching_internal"
        if evidence_mode == "vlm_fallback":
            return "vlm_confident"
        return "llm_reference"

    def _normalize_percentages(self, scores: List[float]) -> List[int]:
        if not scores:
            return []

        cleaned_scores = [max(0.0, float(score)) for score in scores]
        total = sum(cleaned_scores)
        if total <= 0:
            equal = 100 // len(cleaned_scores)
            result = [equal for _ in cleaned_scores]
            result[0] += 100 - sum(result)
            return result

        raw = [(score / total) * 100 for score in cleaned_scores]
        floors = [int(value) for value in raw]
        remaining = 100 - sum(floors)

        fractions = sorted(
            enumerate(raw),
            key=lambda item: item[1] - int(item[1]),
            reverse=True,
        )
        for index, _ in fractions[:remaining]:
            floors[index] += 1
        return floors

    def _confidence_note(self, *, score_percent: int, evidence_mode: str) -> str:
        if evidence_mode == "vlm_fallback":
            return f"Độ tự tin (VLM fallback): {score_percent}%"
        if evidence_mode == "llm_fallback":
            return f"Độ tự tin (tham khảo): {score_percent}%"
        return f"Độ tự tin: {score_percent}%"

    def _resolve_selected_diagnosis(
        self,
        *,
        request: StaffDiagnosisRequest,
        top_differentials: List[DiagnosisSuggestion],
    ) -> Optional[DiagnosisSuggestion]:
        if not top_differentials:
            return None

        selected_code = (request.selected_diagnosis_code or "").strip().lower()
        selected_label = (request.selected_diagnosis_label or "").strip().lower()
        if not selected_code and not selected_label:
            return None

        if selected_code and selected_label:
            for item in top_differentials:
                code = (item.canonical_code or "").strip().lower()
                label = (item.display_name_vi or "").strip().lower()
                if selected_code == code and selected_label == label:
                    return item

        for item in top_differentials:
            code = (item.canonical_code or "").strip().lower()
            label = (item.display_name_vi or "").strip().lower()
            if selected_code and selected_code == code and not selected_label:
                return item
            if selected_label and selected_label == label:
                return item

        if selected_label:
            mapper = get_disease_mapping_service()
            mapped = mapper.map_label(
                raw_label=request.selected_diagnosis_label or "",
                source_type="kb",
                species=request.species.value,
            )
            mapped_code = (mapped.canonical_code or "").strip().lower()
            if mapped_code:
                for item in top_differentials:
                    code = (item.canonical_code or "").strip().lower()
                    label = (item.display_name_vi or "").strip().lower()
                    if mapped_code == code and (
                        not selected_label or selected_label == label
                    ):
                        return item

        return None

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
