from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from loguru import logger

from app.api.schemas.internal_case_memory_schemas import (
    ConfirmedEmrSyncRequest,
    ConfirmedEmrSyncResponse,
)
from app.core.services.emr_case_memory_sync_service import (
    get_emr_case_memory_sync_service,
)

router = APIRouter(prefix="/internal/case-memory", tags=["Internal Case Memory"])


@router.post(
    "/emr-sync",
    response_model=ConfirmedEmrSyncResponse,
    summary="Dong bo mot EMR da xac nhan vao case memory",
)
async def sync_confirmed_emr_to_case_memory(
    request: ConfirmedEmrSyncRequest,
) -> ConfirmedEmrSyncResponse:
    try:
        result = await get_emr_case_memory_sync_service().sync_record(
            request.model_dump()
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error("Failed to sync confirmed EMR into case memory: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Khong the dong bo EMR vao case memory",
        ) from exc

    return ConfirmedEmrSyncResponse(
        message="Dong bo EMR vao case memory thanh cong",
        case_id=result.case_id,
        mapping_status=result.mapping_status,
        canonical_code=result.canonical_code,
        display_name_vi=result.display_name_vi,
        provisional_label=result.provisional_label,
    )
