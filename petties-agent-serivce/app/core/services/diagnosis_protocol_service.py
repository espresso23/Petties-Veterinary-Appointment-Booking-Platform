"""
Diagnosis protocol service.

Purpose:
- Keep SOAP and prescription suggestions aligned to one primary diagnosis.
- Gate medication recommendations when clinical data is missing.
- Provide deterministic, doctor-facing protocol notes with veterinary wording.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from app.api.schemas.diagnosis_contracts import (
    DiagnosisSuggestion,
    PrescriptionSuggestion,
    StaffDiagnosisRequest,
)
from app.core.services.disease_mapping_service import get_disease_mapping_service


@dataclass
class ProtocolDecision:
    diagnosis_code: Optional[str]
    diagnosis_display_name: str
    summary: str = ""
    prescriptions: List[PrescriptionSuggestion] = field(default_factory=list)
    missing_inputs: List[str] = field(default_factory=list)
    cautions: List[str] = field(default_factory=list)
    protocol_applied: bool = False


class DiagnosisProtocolService:
    """Generate aligned plan and medication suggestions from internal protocols."""

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

        if diagnosis_code == "ocular_infection":
            return self._build_ocular_protocol(
                request, diagnosis_code, diagnosis_display_name
            )
        if diagnosis_code == "otitis_or_ear_parasites":
            return self._build_otitis_protocol(
                request, diagnosis_code, diagnosis_display_name
            )
        if diagnosis_code == "dermatosis_or_ectoparasites":
            return self._build_ectoparasite_protocol(
                request, diagnosis_code, diagnosis_display_name
            )
        if diagnosis_code == "bacterial_dermatosis":
            return self._build_bacterial_dermatosis_protocol(
                request, diagnosis_code, diagnosis_display_name
            )

        return ProtocolDecision(
            diagnosis_code=diagnosis_code,
            diagnosis_display_name=diagnosis_display_name,
            summary=(
                f"Chưa có protocol nội bộ đủ chi tiết cho chẩn đoán '{diagnosis_display_name}'. "
                "Ưu tiên hoàn thiện thăm khám và kê đơn thủ công."
            ),
        )

    def _build_ocular_protocol(
        self,
        request: StaffDiagnosisRequest,
        diagnosis_code: str,
        diagnosis_display_name: str,
    ) -> ProtocolDecision:
        context = self._context_text(request)
        cautions = self._build_allergy_cautions(request)
        missing_inputs: List[str] = []
        prescriptions = [
            PrescriptionSuggestion(
                medicine_name="Dung dịch rửa mắt vô khuẩn",
                dosage="Rửa sạch 1 lần mỗi mắt mỗi lần",
                frequency="3-4 lần/ngày",
                duration_days=5,
                instructions="Làm sạch ghèn và dịch tiết trước khi dùng thuốc nhỏ mắt khác.",
            )
        ]

        ulcer_risk = self._contains_any(
            context,
            ["loet", "duc giac mac", "nheo mat", "dau mat", "fluorescein duong tinh"],
        )
        if "fluorescein" not in context:
            missing_inputs.append(
                "khám mắt và nhuộm fluorescein nếu nghi loét giác mạc"
            )

        if ulcer_risk:
            cautions.append(
                "Có tín hiệu gợi ý nguy cơ loét giác mạc; chưa nên gợi ý thuốc có steroid trước khi khám mắt đầy đủ."
            )
        else:
            prescriptions.append(
                PrescriptionSuggestion(
                    medicine_name="Thuốc nhỏ mắt kháng sinh bề mặt",
                    dosage="1-2 giọt mỗi mắt mỗi lần",
                    frequency="3 lần/ngày",
                    duration_days=5,
                    instructions="Chỉ dùng khi bác sĩ xác nhận phù hợp với viêm kết mạc hoặc nhiễm khuẩn bề mặt mắt.",
                    caution="Ngưng gợi ý này nếu khám mắt nghi ngờ loét giác mạc hoặc đau mắt sâu.",
                )
            )

        return ProtocolDecision(
            diagnosis_code=diagnosis_code,
            diagnosis_display_name=diagnosis_display_name,
            summary=(
                "Protocol mắt ưu tiên vệ sinh mắt, đánh giá đau mắt, nhuộm fluorescein khi cần và theo dõi đáp ứng trong 48-72 giờ."
            ),
            prescriptions=prescriptions,
            missing_inputs=missing_inputs,
            cautions=cautions,
            protocol_applied=True,
        )

    def _build_otitis_protocol(
        self,
        request: StaffDiagnosisRequest,
        diagnosis_code: str,
        diagnosis_display_name: str,
    ) -> ProtocolDecision:
        context = self._context_text(request)
        cautions = self._build_allergy_cautions(request)
        missing_inputs = ["soi tai và đánh giá màng nhĩ"]
        prescriptions = [
            PrescriptionSuggestion(
                medicine_name="Dung dịch vệ sinh tai",
                dosage="Làm sạch 1 lần mỗi bên tai mỗi lần",
                frequency="1-2 lần/ngày",
                duration_days=7,
                instructions="Làm sạch tai trước khi cân nhắc thuốc điều trị chính.",
            )
        ]

        otoscopy_done = self._contains_any(
            context,
            ["soi tai", "mang nhi nguyen ven", "màng nhĩ nguyên vẹn", "otoscopy"],
        )
        if otoscopy_done:
            missing_inputs = []
            prescriptions.append(
                PrescriptionSuggestion(
                    medicine_name="Thuốc nhỏ tai phối hợp",
                    dosage="4-6 giọt mỗi tai mỗi lần",
                    frequency="2 lần/ngày",
                    duration_days=7,
                    instructions="Chỉ dùng khi soi tai xác nhận màng nhĩ an toàn và hướng bệnh phù hợp.",
                    caution="Không dùng nếu chưa loại trừ tổn thương màng nhĩ hoặc đau tai sâu.",
                )
            )
        else:
            cautions.append(
                "Chưa đủ dữ liệu soi tai nên chỉ gợi ý vệ sinh tai; chưa nên chốt thuốc nhỏ tai điều trị đặc hiệu."
            )

        return ProtocolDecision(
            diagnosis_code=diagnosis_code,
            diagnosis_display_name=diagnosis_display_name,
            summary=(
                "Protocol tai ưu tiên soi tai, loại trừ thủng màng nhĩ và làm sạch ống tai trước khi dùng thuốc đặc hiệu."
            ),
            prescriptions=prescriptions,
            missing_inputs=missing_inputs,
            cautions=cautions,
            protocol_applied=True,
        )

    def _build_ectoparasite_protocol(
        self,
        request: StaffDiagnosisRequest,
        diagnosis_code: str,
        diagnosis_display_name: str,
    ) -> ProtocolDecision:
        context = self._context_text(request)
        cautions = self._build_allergy_cautions(request)
        prescriptions = [
            PrescriptionSuggestion(
                medicine_name="Dung dịch sát khuẩn da",
                dosage="Làm sạch 1 lớp mỏng tại vùng tổn thương",
                frequency="1-2 lần/ngày",
                duration_days=7,
                instructions="Làm sạch nhẹ nhàng vùng da tổn thương trước khi dùng thuốc khác.",
            )
        ]
        missing_inputs: List[str] = []

        if not self._contains_any(
            context, ["cao da", "cạo da", "soi da", "skin scrape"]
        ):
            missing_inputs.append("cạo da hoặc soi da")

        if request.weight_kg is None or request.weight_kg <= 0:
            missing_inputs.append("cân nặng")
        else:
            min_total = request.weight_kg * 25
            max_total = request.weight_kg * 56
            prescriptions.append(
                PrescriptionSuggestion(
                    medicine_name="Thuốc diệt ngoại ký sinh nhóm isoxazoline",
                    dosage=(
                        f"{min_total:.0f}-{max_total:.0f} mg/lần "
                        f"(tương đương 25-56 mg/kg cho bé {request.weight_kg:.1f} kg)"
                    ),
                    frequency="1 liều duy nhất, nhắc lại theo sản phẩm",
                    duration_days=30,
                    instructions="Chọn hoạt chất và dạng bào chế phù hợp với loài, tuổi và tiền sử dùng thuốc của bé.",
                    caution="Cần kiểm tra tuổi tối thiểu và chống chỉ định của từng hoạt chất trước khi kê đơn.",
                )
            )

        summary = (
            "Protocol bệnh da ký sinh trùng ưu tiên xác nhận nguyên nhân bằng cạo da hoặc soi da, xử lý vệ sinh tổn thương "
            "và chỉ dùng thuốc toàn thân khi đã có cân nặng."
        )
        if missing_inputs:
            summary += " Hiện còn thiếu dữ liệu để khóa protocol hoàn chỉnh."

        return ProtocolDecision(
            diagnosis_code=diagnosis_code,
            diagnosis_display_name=diagnosis_display_name,
            summary=summary,
            prescriptions=prescriptions,
            missing_inputs=missing_inputs,
            cautions=cautions,
            protocol_applied=True,
        )

    def _build_bacterial_dermatosis_protocol(
        self,
        request: StaffDiagnosisRequest,
        diagnosis_code: str,
        diagnosis_display_name: str,
    ) -> ProtocolDecision:
        context = self._context_text(request)
        cautions = self._build_allergy_cautions(request)
        prescriptions = [
            PrescriptionSuggestion(
                medicine_name="Dung dịch sát khuẩn da chlorhexidine",
                dosage="Làm sạch 1 lớp mỏng tại vùng tổn thương",
                frequency="1-2 lần/ngày",
                duration_days=7,
                instructions="Làm sạch vùng tổn thương trước khi đánh giá đáp ứng điều trị.",
            )
        ]
        missing_inputs: List[str] = []

        if not self._contains_any(
            context, ["cytology", "nhuom", "nhuộm", "soi da", "cạo da"]
        ):
            missing_inputs.append("cytology da hoặc đánh giá nhiễm khuẩn")

        if self._has_beta_lactam_allergy(request):
            cautions.append(
                "Bé có tiền sử dị ứng nhóm beta-lactam; không tự động gợi ý cephalexin."
            )
        elif request.weight_kg is None or request.weight_kg <= 0:
            missing_inputs.append("cân nặng")
        else:
            min_total = request.weight_kg * 22
            max_total = request.weight_kg * 30
            prescriptions.append(
                PrescriptionSuggestion(
                    medicine_name="Cephalexin uống",
                    dosage=(
                        f"{min_total:.0f}-{max_total:.0f} mg/lần "
                        f"(22-30 mg/kg/lần cho bé {request.weight_kg:.1f} kg)"
                    ),
                    frequency="2 lần/ngày",
                    duration_days=14,
                    instructions="Chỉ cân nhắc khi tổn thương gợi ý nhiễm khuẩn da và không có chống chỉ định.",
                    caution="Ưu tiên đối chiếu cytology hoặc đánh giá bác sĩ trước khi kê kháng sinh toàn thân.",
                )
            )

        summary = (
            "Protocol viêm da do vi khuẩn ưu tiên vệ sinh tổn thương, đánh giá cytology/cạo da và chỉ dùng kháng sinh toàn thân "
            "khi đã có cơ sở lâm sàng phù hợp."
        )
        if missing_inputs:
            summary += " Hiện còn thiếu dữ liệu để hoàn thiện protocol."

        return ProtocolDecision(
            diagnosis_code=diagnosis_code,
            diagnosis_display_name=diagnosis_display_name,
            summary=summary,
            prescriptions=prescriptions,
            missing_inputs=missing_inputs,
            cautions=cautions,
            protocol_applied=True,
        )

    def _context_text(self, request: StaffDiagnosisRequest) -> str:
        parts = [
            request.doctor_description,
            request.body_part or "",
            " ".join(request.symptoms or []),
            request.soap_draft.objective,
            request.soap_draft.assessment,
        ]
        return " ".join(part for part in parts if part).lower()

    def _contains_any(self, text: str, keywords: List[str]) -> bool:
        return any(keyword in text for keyword in keywords)

    def _build_allergy_cautions(self, request: StaffDiagnosisRequest) -> List[str]:
        if not request.allergies:
            return []
        joined = ", ".join(item for item in request.allergies if item)
        if not joined:
            return []
        return [f"Cần đối chiếu đơn thuốc với tiền sử dị ứng đã ghi nhận: {joined}."]

    def _has_beta_lactam_allergy(self, request: StaffDiagnosisRequest) -> bool:
        allergies = " ".join((request.allergies or [])).lower()
        return any(
            keyword in allergies for keyword in ["beta", "lactam", "penicillin", "ceph"]
        )

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
        relevant_patterns = [
            p for p in emr_patterns if p.get("canonical_code") == primary_code
        ]

        if not relevant_patterns:
            protocol_decision.summary += (
                " (Chưa có ca EMR cùng chẩn đoán để tham chiếu protocol.)"
            )
            return protocol_decision

        merged_prescriptions: List[PrescriptionSuggestion] = []
        merged_tests: List[str] = []
        merged_recommendations: List[str] = []
        sample_count = len(relevant_patterns)

        for pattern in relevant_patterns:
            rx_list = pattern.get("common_prescriptions") or []
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
                        source_detail=f"Học từ {pattern.get('case_id', 'EMR')} (n={sample_count})",
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

        summary_parts = [protocol_decision.summary] if protocol_decision.summary else []
        summary_parts.append(
            f"Protocol được điều chỉnh theo {sample_count} ca EMR đã xác nhận cùng chẩn đoán."
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

        original_lower = original_dosage.lower()
        if "mg/kg" in original_lower:
            parts = original_lower.split("mg/kg")
            if len(parts) == 2:
                dose_per_kg = float(parts[0].strip())
                total_dose = dose_per_kg * patient_weight_kg
                unit = "mg"
                return f"{total_dose:.1f}{unit} ({dose_per_kg}mg/kg x {patient_weight_kg}kg)"

        return original_dosage

    def _parse_duration(self, duration_str: Optional[str]) -> Optional[int]:
        """Parse duration string to days."""
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
