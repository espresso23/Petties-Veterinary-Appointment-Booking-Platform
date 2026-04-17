"""
Diagnosis contracts for the staff diagnosis flow.

Shared between:
- API route for staff diagnosis
- Gemini vision adapter
- Staff diagnosis synthesis service
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class Species(str, Enum):
    DOG = "dog"
    CAT = "cat"
    OTHER = "other"


class Sex(str, Enum):
    MALE = "male"
    FEMALE = "female"
    UNKNOWN = "unknown"


class DiagnosisClinicalContext(BaseModel):
    symptoms: List[str] = Field(default_factory=list)
    duration: Optional[str] = None
    age_months: Optional[int] = None
    sex: Sex = Sex.UNKNOWN


class GeminiVisionDiagnosisRequest(BaseModel):
    request_id: str
    species: Species
    image_urls: List[str] = Field(default_factory=list, max_length=10)
    doctor_description: str = ""
    body_part: Optional[str] = None
    clinical_context: DiagnosisClinicalContext = Field(
        default_factory=DiagnosisClinicalContext
    )


class VisionTopCondition(BaseModel):
    raw_label: str
    canonical_code: Optional[str] = None
    display_name_vi: Optional[str] = None
    confidence_score: float = 0.0
    reason: str = ""
    unmapped_label: bool = False


class GeminiVisionDiagnosisResponse(BaseModel):
    request_id: str
    visual_findings: List[str] = Field(default_factory=list)
    image_descriptions: List[str] = Field(default_factory=list)
    top_conditions: List[VisionTopCondition] = Field(default_factory=list)
    needs_more_data: bool = False
    missing_information: List[str] = Field(default_factory=list)
    safety_notes: List[str] = Field(default_factory=list)


class DiagnosisSuggestion(BaseModel):
    canonical_code: Optional[str] = None
    display_name_vi: str
    rank: int = 0
    score_percent: int = 0
    score_basis: str = ""
    confidence_note: str = ""
    supporting_reasons: List[str] = Field(default_factory=list)
    # NEW: Taxonomy and reasoning fields
    taxonomy_system: str = Field(
        default="",
        description="Hệ cơ quan (e.g., 'HÔ HẤP', 'TIÊU HÓA')"
    )
    taxonomy_subsystem: str = Field(
        default="",
        description="Phân hệ (e.g., 'Hô hấp dưới', 'Dạ dày - Ruột')"
    )
    reasoning: str = Field(
        default="",
        description="Lý do AI đưa ra chẩn đoán này"
    )
    differential_diagnoses: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Các chẩn đoán phân biệt với probability"
    )


class PrescriptionSuggestion(BaseModel):
    medicine_name: str
    times_of_day: List[str] = Field(
        default_factory=list,
        description="Danh sách thời điểm dùng thuốc: sang|trua|chieu",
    )
    before_after_meal: Optional[str] = Field(
        default=None,
        description="BEFORE_MEAL|AFTER_MEAL|WITH_MEAL|NONE",
    )
    frequency_note: str = Field(
        default="",
        description="Ghi chú tần suất (ví dụ: 2 lần/ngày, cách nhau ~12 giờ)",
    )
    duration_days: Optional[int] = None
    instructions: str = ""
    caution: Optional[str] = None
    source: Optional[str] = None
    source_detail: Optional[str] = None

    # Legacy fields (deprecated). Keep for tolerant parsing, but never return to clients.
    dosage: str = Field(default="", exclude=True)
    frequency: str = Field(default="", exclude=True)


class SoapDraft(BaseModel):
    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""


class StaffDiagnosisRequest(BaseModel):
    request_id: Optional[str] = None
    previous_request_id: Optional[str] = None
    pet_id: Optional[str] = None
    booking_id: Optional[str] = None
    species: Species = Species.OTHER
    breed: Optional[str] = None
    age_months: Optional[int] = None
    weight_kg: Optional[float] = None
    sex: Sex = Sex.UNKNOWN
    allergies: List[str] = Field(default_factory=list)
    doctor_description: str = ""
    body_part: Optional[str] = None
    symptoms: List[str] = Field(default_factory=list)
    image_urls: List[str] = Field(default_factory=list, max_length=10)
    image_analysis_mode: str = Field(
        default="full",
        description="full = phân tích chẩn đoán + ảnh, describe_only = chỉ mô tả ảnh",
    )
    synthesis_mode: str = Field(
        default="full",
        description="full = chạy toàn bộ pipeline, selected_only = chỉ tổng hợp theo chẩn đoán đã chọn",
    )
    selected_diagnosis_code: Optional[str] = None
    selected_diagnosis_label: Optional[str] = None
    soap_draft: SoapDraft = Field(default_factory=SoapDraft)


class SoapSuggestions(BaseModel):
    subjective_draft: str = ""
    objective_draft: str = ""
    assessment_draft: str = ""
    plan_draft: str = ""


class DoctorDiagnosisSynthesisResponse(BaseModel):
    request_id: str
    evidence_mode: str = "internal_grounded"
    evidence_banner: str = "Đã đối chiếu dữ liệu nội bộ"
    score_label: str = "Độ tự tin (%)"
    top_differentials: List[DiagnosisSuggestion] = Field(default_factory=list)
    supporting_evidence_from_kb: List[str] = Field(default_factory=list)
    similar_confirmed_cases: List[str] = Field(default_factory=list)
    vision_findings: List[str] = Field(default_factory=list)
    image_descriptions: List[str] = Field(default_factory=list)
    image_analysis: List[dict] = Field(
        default_factory=list,
        description="Mảng mô tả AI cho từng ảnh theo thứ tự upload. VD: [{'url': '...', 'description': '...'}]",
    )
    suggested_questions: List[str] = Field(default_factory=list)
    soap_suggestions: SoapSuggestions = Field(default_factory=SoapSuggestions)
    prescription_suggestions: List[PrescriptionSuggestion] = Field(default_factory=list)
    payload_status: str = "ok"
    payload_warnings: List[str] = Field(default_factory=list)
    disclaimer: str = (
        "Đây là gợi ý hỗ trợ tham khảo từ dữ liệu nội bộ. "
        "Cần kết hợp thăm khám lâm sàng trước khi chốt chẩn đoán và đơn thuốc cho thú cưng."
    )
