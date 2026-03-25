"""Staff diagnosis routes."""

from fastapi import APIRouter, Depends, HTTPException

from app.api.middleware.auth import CurrentUser, get_current_user
from app.api.schemas.diagnosis_contracts import (
    DoctorDiagnosisSynthesisResponse,
    StaffDiagnosisRequest,
)
from app.core.services.staff_diagnosis_service import get_staff_diagnosis_service

router = APIRouter(prefix="/staff-diagnosis", tags=["Staff Diagnosis"])


@router.post("/analyze", response_model=DoctorDiagnosisSynthesisResponse)
async def analyze_staff_case(
    payload: StaffDiagnosisRequest,
    user: CurrentUser = Depends(get_current_user),
) -> DoctorDiagnosisSynthesisResponse:
    """Analyze a staff diagnosis case from EMR or sidebar context."""
    role = (user.role or "").upper()
    if role not in {"STAFF", "ADMIN"}:
        raise HTTPException(
            status_code=403,
            detail="Chỉ STAFF hoặc ADMIN mới được dùng chức năng chẩn đoán này.",
        )

    service = get_staff_diagnosis_service()
    return await service.analyze_case(payload)
