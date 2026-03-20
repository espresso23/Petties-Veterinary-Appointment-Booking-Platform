from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ConfirmedEmrSyncRequest(BaseModel):
    emr_id: str
    pet_id: str
    clinic_id: Optional[str] = None
    booking_id: Optional[str] = None
    doctor_id: Optional[str] = None
    species: Optional[str] = None
    breed: Optional[str] = None
    chief_complaint: Optional[str] = None
    symptoms: List[str] = Field(default_factory=list)
    physical_exam: List[str] = Field(default_factory=list)
    clinical_notes: Optional[str] = None
    final_diagnosis_text: str
    verified: bool = True
    exam_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    attachments: Dict[str, Any] = Field(default_factory=dict)


class ConfirmedEmrSyncResponse(BaseModel):
    success: bool = True
    message: str
    case_id: str
    mapping_status: str
    canonical_code: Optional[str] = None
    display_name_vi: Optional[str] = None
    provisional_label: Optional[str] = None
