"""
Diagnosis contracts for the staff diagnosis flow.

Shared between:
- API route for staff diagnosis
- Gemini vision adapter
- Staff diagnosis synthesis service
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

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
    confidence_note: str = ""
    supporting_reasons: List[str] = Field(default_factory=list)


class PrescriptionSuggestion(BaseModel):
    medicine_name: str
    dosage: str = ""
    frequency: str = ""
    duration_days: Optional[int] = None
    instructions: str = ""
    caution: Optional[str] = None
    route: Optional[str] = None
    source: Optional[str] = None
    source_detail: Optional[str] = None


class SoapDraft(BaseModel):
    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""


class StaffDiagnosisRequest(BaseModel):
    request_id: Optional[str] = None
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
    soap_draft: SoapDraft = Field(default_factory=SoapDraft)


class SoapSuggestions(BaseModel):
    subjective_draft: str = ""
    objective_draft: str = ""
    assessment_draft: str = ""
    plan_draft: str = ""


class DoctorDiagnosisSynthesisResponse(BaseModel):
    request_id: str
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
    disclaimer: str = (
        "Đây là gợi ý hỗ trợ tham khảo từ dữ liệu nội bộ. "
        "Cần kết hợp thăm khám lâm sàng trước khi chốt chẩn đoán và đơn thuốc cho thú cưng."
    )
