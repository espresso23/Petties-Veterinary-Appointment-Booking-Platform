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
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from uuid import uuid4

from loguru import logger

from app.api.schemas.diagnosis_contracts import (
    DiagnosisClinicalContext,
    DiagnosisSuggestion,
    DoctorDiagnosisSynthesisResponse,
    GeminiVisionDiagnosisRequest,
    GeminiVisionDiagnosisResponse,
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

    async def analyze_case(
        self,
        request: StaffDiagnosisRequest,
    ) -> DoctorDiagnosisSynthesisResponse:
        request_id = request.request_id or str(uuid4())

        # Only refresh if cache is stale (TTL expired)
        service = get_disease_mapping_service()
        if service._should_refresh():
            await service.refresh_from_db()

        vision_response = GeminiVisionDiagnosisResponse(request_id=request_id)
        if request.image_urls:
            vision_response = await self._analyze_vision(request_id, request)

        retrieval_query = self._build_retrieval_query(request, vision_response)
        hybrid_result, similar_cases = await self._retrieve_internal_context(
            query=retrieval_query,
            request=request,
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

        if not (hybrid_result.chunks or similar_cases):
            protocol_decision.prescriptions = []
            protocol_decision.summary = (
                "Chưa có đủ bằng chứng nội bộ từ Knowledge Base hoặc Case Memory để kích hoạt protocol điều trị. "
                + protocol_decision.summary
            ).strip()

        image_analysis = self._build_image_analysis(request.image_urls, vision_response)

        return DoctorDiagnosisSynthesisResponse(
            request_id=request_id,
            top_differentials=top_differentials,
            supporting_evidence_from_kb=self._format_hybrid_evidence(hybrid_result),
            similar_confirmed_cases=self._format_similar_cases(similar_cases),
            vision_findings=vision_response.visual_findings,
            image_descriptions=vision_response.image_descriptions,
            image_analysis=image_analysis,
            suggested_questions=self._build_follow_up_questions(
                request, protocol_decision
            ),
            soap_suggestions=self._build_soap_suggestions(
                request=request,
                top_differentials=top_differentials,
                vision_response=vision_response,
                hybrid_result=hybrid_result,
                similar_cases=similar_cases,
                protocol_decision=protocol_decision,
            ),
            prescription_suggestions=protocol_decision.prescriptions,
            disclaimer="Gợi ý từ tài liệu nội bộ. Bác sĩ cần xác nhận lại chẩn đoán.",
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
        return await get_gemini_vision_adapter().analyze(vision_request)

    async def _retrieve_internal_context(
        self,
        *,
        query: str,
        request: StaffDiagnosisRequest,
    ) -> tuple[HybridResult, List[CaseResult]]:
        hybrid_task = self._query_hybrid_rag(query=query, request=request)
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
                prefix = (
                    "Case EMR provisional" if is_provisional else "Case EMR xác nhận"
                )
                candidate.add_reason(
                    f"{prefix} ở {species} có biểu hiện gần giống: {complaint}."
                )
            elif complaint:
                prefix = (
                    "Case EMR provisional" if is_provisional else "Case EMR xác nhận"
                )
                candidate.add_reason(f"{prefix} có biểu hiện gần giống: {complaint}.")

            final_diagnosis = payload.get("final_diagnosis_text")
            if final_diagnosis:
                if is_provisional:
                    candidate.add_reason(
                        f"Ca tương tự đang mang nhãn provisional: {final_diagnosis}."
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
                line += ". Trạng thái mapping: provisional"
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
            top_lower = top_label.lower()
            if "mắt" in top_lower:
                lines.append("1. Vệ sinh mắt bằng NaCl 0.9%.")
                lines.append("2. Nhỏ mắt kháng sinh theo chỉ định.")
                lines.append("3. Tái khám 3-5 ngày.")
            elif "tai" in top_lower:
                lines.append("1. Vệ sinh tai bằng dung dịch chuyên dụng.")
                lines.append("2. Nhỏ thuốc tai theo chỉ định.")
                lines.append("3. Tái khám 5-7 ngày.")
            elif "da" in top_lower or "ghẻ" in top_lower:
                lines.append("1. Tắm/làm sạch vùng tổn thương.")
                lines.append("2. Bôi/thuốc theo chỉ định.")
                lines.append("3. Tái khám 7 ngày.")
            else:
                lines.append("1. Theo dõi triệu chứng.")
                lines.append("2. Tái khám theo diễn tiến.")

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
