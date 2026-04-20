"""Audit log APIs (admin only)."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.middleware.auth import CurrentUser, get_admin_user
from app.services.audit_log_service import get_audit_log_service


router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


class AuditLogItem(BaseModel):
    event_id: str
    occurred_at: datetime
    service: str
    environment: str
    actor: Dict[str, Any]
    action: str
    resource: Dict[str, Any]
    result: Dict[str, Any]
    correlation: Dict[str, Any]
    metadata: Dict[str, Any] = {}
    changes: Dict[str, Any] = {}


class AuditLogListResponse(BaseModel):
    items: List[AuditLogItem]
    total: int
    page: int
    page_size: int


@router.get("", response_model=AuditLogListResponse, summary="List audit logs")
async def list_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    user_id: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    resource_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    request_id: Optional[str] = Query(default=None),
    from_time: Optional[datetime] = Query(default=None),
    to_time: Optional[datetime] = Query(default=None),
    _: CurrentUser = Depends(get_admin_user),
):
    service = get_audit_log_service()
    result = await service.list_events(
        page=page,
        page_size=page_size,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        status=status,
        request_id=request_id,
        from_time=from_time,
        to_time=to_time,
    )
    return AuditLogListResponse(**result)


@router.get("/{event_id}", response_model=AuditLogItem, summary="Get audit log detail")
async def get_audit_log_detail(
    event_id: str,
    _: CurrentUser = Depends(get_admin_user),
):
    service = get_audit_log_service()
    event = await service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Khong tim thay audit log")
    return AuditLogItem(**event)
