"""Staff diagnosis routes."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api.middleware.auth import CurrentUser, get_current_user, security

from .context_service import get_staff_diagnosis_context_service
from .schemas import (
    DoctorDiagnosisSynthesisResponse,
    StaffDiagnosisRequest,
)
from .staff_diagnosis_service import get_staff_diagnosis_service

router = APIRouter(prefix="/staff-diagnosis", tags=["Staff Diagnosis"])


@router.post("/analyze", response_model=DoctorDiagnosisSynthesisResponse)
async def analyze_staff_case(
    payload: StaffDiagnosisRequest,
    user: CurrentUser = Depends(get_current_user),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> DoctorDiagnosisSynthesisResponse:
    """Analyze a staff diagnosis case from EMR or sidebar context."""
    role = (user.role or "").upper()
    if role not in {"STAFF", "ADMIN"}:
        raise HTTPException(
            status_code=403,
            detail="Chỉ STAFF hoặc ADMIN mới được dùng chức năng chẩn đoán này.",
        )

    auth_token = credentials.credentials if credentials else None
    hydrated_payload = await get_staff_diagnosis_context_service().resolve_request(
        request=payload,
        user=user,
        auth_token=auth_token,
    )

    service = get_staff_diagnosis_service()
    return await service.analyze_case(hydrated_payload)
