"""Diagnosis protocol service.

Purpose:
- Keep SOAP and prescription suggestions aligned to one primary diagnosis.
- Gate medication recommendations when clinical data is missing.
- Provide deterministic, doctor-facing safety notes without hardcoding drugs.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from app.core.services.disease_mapping_service import get_disease_mapping_service

from .schemas import (
    DiagnosisSuggestion,
    PrescriptionSuggestion,
    StaffDiagnosisRequest,
)


@dataclass
class ProtocolDecision:
    diagnosis_code: Optional[str]
    diagnosis_display_name: str
    summary: str = ""
    prescriptions: List[PrescriptionSuggestion] = field(default_factory=list)
    recommended_tests: List[str] = field(default_factory=list)
    recommended_actions: List[str] = field(default_factory=list)
    missing_inputs: List[str] = field(default_factory=list)
    cautions: List[str] = field(default_factory=list)
    protocol_applied: bool = False


class DiagnosisProtocolService:
    """Generate aligned safety decisions without hardcoded medications."""

    def build_decision(
        self,
        *,
        request: StaffDiagnosisRequest,
        primary_diagnosis: Optional[DiagnosisSuggestion],
    ) -> ProtocolDecision:
        if primary_diagnosis is None:
            return ProtocolDecision(
                diagnosis_code=None,
                diagnosis_display_name="Chưa xác định",
            )

        mapper = get_disease_mapping_service()
        mapping = mapper.map_label(
            raw_label=primary_diagnosis.display_name_vi,
            source_type="kb",
            species=request.species.value,
        )
        diagnosis_code = primary_diagnosis.canonical_code or mapping.canonical_code
        diagnosis_display_name = primary_diagnosis.display_name_vi

        return self._build_safety_decision(
            request=request,
            diagnosis_code=diagnosis_code,
            diagnosis_display_name=diagnosis_display_name,
        )

    def _build_safety_decision(
        self,
        *,
        request: StaffDiagnosisRequest,
        diagnosis_code: Optional[str],
        diagnosis_display_name: str,
    ) -> ProtocolDecision:
        missing_inputs: List[str] = []
        if request.weight_kg is None or request.weight_kg <= 0:
            missing_inputs.append("cân nặng")

        cautions = self._build_allergy_cautions(request)
        summary = (
            f"Định hướng an toàn cho '{diagnosis_display_name}': "
            "ưu tiên đối chiếu ca EMR đã xác nhận và hoàn thiện thăm khám."
        )

        if missing_inputs:
            summary += " Hiện còn thiếu dữ liệu để hoàn thiện gợi ý điều trị."

        return ProtocolDecision(
            diagnosis_code=diagnosis_code,
            diagnosis_display_name=diagnosis_display_name,
            summary=summary,
            prescriptions=[],
            recommended_tests=[],
            recommended_actions=[],
            missing_inputs=missing_inputs,
            cautions=cautions,
            protocol_applied=bool(diagnosis_code),
        )

    def _build_allergy_cautions(self, request: StaffDiagnosisRequest) -> List[str]:
        if not request.allergies:
            return []
        normalized_allergies = [
            item.strip()
            for item in request.allergies
            if item
            and item.strip()
            and item.strip().lower() not in {"không có", "khong co", "none", "n/a"}
        ]
        joined = ", ".join(normalized_allergies)
        if not joined:
            return []
        return [f"Cần đối chiếu đơn thuốc với tiền sử dị ứng đã ghi nhận: {joined}."]

    def apply_emr_patterns(
        self,
        protocol_decision: ProtocolDecision,
        emr_patterns: List[dict],
        request: StaffDiagnosisRequest,
    ) -> ProtocolDecision:
        """
        Áp dụng protocol patterns từ EMR confirmed vào protocol_decision hiện tại.

        Không hardcode - hoàn toàn học từ dữ liệu EMR thực tế.

        Logic:
        1. Lọc patterns cùng canonical_code với chẩn đoán hiện tại
        2. Trích xuất prescriptions, tests, recommendations thường gặp
        3. Điều chỉnh prescriptions theo cân nặng của bệnh nhân mới
        4. Cập nhật cautions nếu có allergy warnings
        """
        if not emr_patterns:
            return protocol_decision

        primary_code = protocol_decision.diagnosis_code
        request_species = (request.species.value or "").strip().lower()
        relevant_patterns = []
        for pattern in emr_patterns:
            pattern_code = str(pattern.get("canonical_code") or "").strip().lower()
            pattern_species = str(pattern.get("species") or "").strip().lower()
            if primary_code and pattern_code != str(primary_code).strip().lower():
                continue
            if (
                pattern_species
                and request_species
                and pattern_species != request_species
            ):
                continue
            relevant_patterns.append(pattern)

        if not relevant_patterns:
            protocol_decision.summary += (
                " (Chưa có ca EMR cùng chẩn đoán để tham chiếu protocol.)"
            )
            return protocol_decision

        merged_prescriptions: List[PrescriptionSuggestion] = []
        merged_tests: List[str] = []
        merged_recommendations: List[str] = []
        sample_count = len(relevant_patterns)

        for pattern in sorted(
            relevant_patterns,
            key=lambda item: self._pattern_priority_score(item),
            reverse=True,
        ):
            rx_list = pattern.get("common_prescriptions") or []
            support_suffix = (
                f", support={pattern.get('diagnosis_support_count', 0)}"
                f", accepted={pattern.get('accepted_support_count', 0)}"
            )
            for rx in rx_list:
                if isinstance(rx, dict) and rx.get("medicine"):
                    dosage = rx.get("dosage") or ""
                    adjusted_dosage = self._adjust_dosage_for_weight(
                        dosage, request.weight_kg
                    )

                    prescription = PrescriptionSuggestion(
                        medicine_name=rx.get("medicine", ""),
                        dosage=adjusted_dosage,
                        frequency=rx.get("frequency"),
                        duration_days=self._parse_duration(rx.get("duration")),
                        route=rx.get("route"),
                        source="emr_pattern",
                        source_detail=f"Học từ {pattern.get('case_id', 'EMR')} (n={sample_count}{support_suffix})",
                    )
                    merged_prescriptions.append(prescription)

            tests = pattern.get("common_tests") or []
            for test in tests:
                if isinstance(test, dict) and test.get("test"):
                    merged_tests.append(test.get("test", ""))

            recs = pattern.get("common_recommendations") or []
            if isinstance(recs, list):
                merged_recommendations.extend([r for r in recs if r])

        merged_prescriptions = self._deduplicate_prescriptions(merged_prescriptions)
        merged_tests = list(dict.fromkeys(merged_tests))[:5]
        merged_recommendations = list(dict.fromkeys(merged_recommendations))[:5]

        if merged_prescriptions:
            protocol_decision.prescriptions = merged_prescriptions

        if merged_tests:
            protocol_decision.recommended_tests = merged_tests

        if merged_recommendations:
            protocol_decision.recommended_actions = merged_recommendations

        summary_parts = [protocol_decision.summary] if protocol_decision.summary else []
        support_counts = [
            int(pattern.get("diagnosis_support_count") or 0)
            for pattern in relevant_patterns
        ]
        max_support = max(support_counts) if support_counts else 0
        summary_parts.append(
            f"Đã đối chiếu {sample_count} ca EMR đã xác nhận cùng chẩn đoán để học đơn thuốc và hướng xử trí (support={max_support})."
        )
        if merged_tests:
            summary_parts.append(
                f"Xét nghiệm thường gặp: {', '.join(merged_tests[:3])}"
            )
        if merged_recommendations:
            summary_parts.append(
                f"Hướng dẫn thường gặp: {', '.join(merged_recommendations[:2])}"
            )
        protocol_decision.summary = " ".join(summary_parts)

        return protocol_decision

    def _pattern_priority_score(self, pattern: dict) -> float:
        base_score = float(pattern.get("score") or 0.0)
        support_score = float(pattern.get("pattern_support_score") or 0.0)
        support_count = int(pattern.get("diagnosis_support_count") or 0)
        support_weight = 1.0 + min(max(support_score, 0.0), 10.0) / 20.0
        count_weight = 1.0 + min(max(support_count, 0), 20) / 100.0

        return base_score * support_weight * count_weight

    def _adjust_dosage_for_weight(
        self,
        original_dosage: str,
        patient_weight_kg: Optional[float],
    ) -> str:
        """
        Điều chỉnh liều thuốc theo cân nặng bệnh nhân.

        Ví dụ: "0.2mg/kg" → "2mg" (cho 10kg)
        """
        if not original_dosage or not patient_weight_kg:
            return original_dosage

        import re

        original_text = str(original_dosage).strip()
        match = re.search(r"(\d+(?:\.\d+)?)\s*mg/kg", original_text.lower())
        if not match:
            return original_text

        try:
            dose_per_kg = float(match.group(1))
        except (TypeError, ValueError):
            return original_text

        total_dose = dose_per_kg * patient_weight_kg
        return f"{total_dose:.1f}mg ({dose_per_kg}mg/kg x {patient_weight_kg}kg)"

    def _parse_duration(self, duration_value: Optional[object]) -> Optional[int]:
        """Parse duration string to days."""
        if duration_value is None or isinstance(duration_value, bool):
            return None

        if isinstance(duration_value, int):
            return duration_value if duration_value > 0 else None

        if isinstance(duration_value, float):
            return int(duration_value) if duration_value > 0 else None

        duration_str = str(duration_value).strip()
        if not duration_str:
            return None

        import re

        match = re.search(r"(\d+)", duration_str)
        if match:
            return int(match.group(1))
        return None

    def _deduplicate_prescriptions(
        self,
        prescriptions: List[PrescriptionSuggestion],
    ) -> List[PrescriptionSuggestion]:
        """Loại bỏ prescriptions trùng lặp (cùng medicine name)."""
        seen = set()
        result = []
        for rx in prescriptions:
            key = rx.medicine_name.lower().strip()
            if key and key not in seen:
                seen.add(key)
                result.append(rx)
        return result


_diagnosis_protocol_service: Optional[DiagnosisProtocolService] = None


def get_diagnosis_protocol_service() -> DiagnosisProtocolService:
    global _diagnosis_protocol_service
    if _diagnosis_protocol_service is None:
        _diagnosis_protocol_service = DiagnosisProtocolService()
    return _diagnosis_protocol_service
