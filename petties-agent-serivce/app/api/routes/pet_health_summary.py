"""Pet Health Summary routes."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.api.middleware.auth import CurrentUser, get_current_user
from app.core.services.pet_health_summary_llm_service import (
    get_pet_health_summary_llm_service,
)

router = APIRouter(prefix="/pet-health-summary", tags=["Pet Health Summary"])


class PetInfoInput(BaseModel):
    pet_id: str
    name: str
    species: Optional[str] = None
    breed: Optional[str] = None
    age_months: Optional[int] = None
    weight_kg: Optional[float] = None


class EmrRecordInput(BaseModel):
    exam_date: Optional[str] = None
    clinic_name: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    subjective: Optional[str] = None
    objective: Optional[str] = None
    prescriptions: Optional[List[Dict[str, Any]]] = None


class PetHealthSummaryRequest(BaseModel):
    pet_info: PetInfoInput
    emr_records: List[EmrRecordInput] = []


class PetHealthSummaryResponse(BaseModel):
    latest_emr_summary: Optional[Dict[str, Any]] = None
    health_warnings: List[Dict[str, Any]] = []
    medication_reminders: List[Dict[str, Any]] = []
    suggested_actions: List[Dict[str, Any]] = []
    ai_insights: Optional[Dict[str, Any]] = None
    disclaimer: str = "Thông tin chỉ mang tính tham khảo. Vui lòng consult bác sĩ để được tư vấn chính xác."


@router.post("/synthesize", response_model=PetHealthSummaryResponse)
async def synthesize_pet_health_summary(
    payload: PetHealthSummaryRequest,
    user: CurrentUser = Depends(get_current_user),
) -> PetHealthSummaryResponse:
    """
    Tổng hợp thông tin sức khỏe pet bằng LLM (Gemini).

    Args:
        payload: pet_info và emr_records

    Returns:
        AI-generated health summary
    """
    role = (user.role or "").upper()
    if role not in {"PET_OWNER", "STAFF", "ADMIN", "CLINIC_MANAGER", "CLINIC_OWNER"}:
        raise HTTPException(
            status_code=403,
            detail="Bạn không có quyền sử dụng tính năng này.",
        )

    service = get_pet_health_summary_llm_service()

    pet_info_dict = payload.pet_info.model_dump()
    emr_records_list = [emr.model_dump() for emr in payload.emr_records]

    result = await service.synthesize_summary(
        pet_info=pet_info_dict,
        emr_records=emr_records_list,
        user_name=user.full_name or "",
        user_role=role,
    )

    return PetHealthSummaryResponse(**result)
