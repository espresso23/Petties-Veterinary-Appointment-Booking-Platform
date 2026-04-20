"""
PETTIES AGENT SERVICE - Audit Log Service

Purpose:
    - Luu audit logs vao MongoDB
    - Truy van audit logs theo bo loc co ban
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import uuid

import logging

from app.config.settings import settings
from app.core.database.mongodb import get_mongodb_database

logger = logging.getLogger(__name__)


class AuditLogService:
    """Simple audit log service backed by MongoDB."""

    async def _get_collection(self):
        db = await get_mongodb_database()
        return db[settings.MONGODB_AUDIT_LOGS_COLLECTION]

    def _build_expire_at(self, occurred_at: datetime) -> datetime:
        retention_days = max(1, int(settings.AUDIT_LOG_RETENTION_DAYS))
        return occurred_at + timedelta(days=retention_days)

    async def write_event(
        self,
        *,
        service: str,
        environment: str,
        actor: Dict[str, Any],
        action: str,
        resource: Dict[str, Any],
        result: Dict[str, Any],
        correlation: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
        changes: Optional[Dict[str, Any]] = None,
        occurred_at: Optional[datetime] = None,
    ) -> str:
        now = occurred_at or datetime.now(timezone.utc)
        event_id = str(uuid.uuid4())

        payload = {
            "event_id": event_id,
            "occurred_at": now,
            "service": service,
            "environment": environment,
            "actor": actor or {},
            "action": action,
            "resource": resource or {},
            "result": result or {},
            "correlation": correlation or {},
            "metadata": metadata or {},
            "changes": changes or {},
            "expire_at": self._build_expire_at(now),
        }

        collection = await self._get_collection()
        await collection.insert_one(payload)
        return event_id

    async def get_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        collection = await self._get_collection()
        return await collection.find_one({"event_id": event_id}, {"_id": 0})

    async def list_events(
        self,
        *,
        page: int = 1,
        page_size: int = 50,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        status: Optional[str] = None,
        request_id: Optional[str] = None,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        collection = await self._get_collection()

        filters: Dict[str, Any] = {}
        if user_id:
            filters["actor.user_id"] = user_id
        if action:
            filters["action"] = action
        if resource_type:
            filters["resource.type"] = resource_type
        if status:
            filters["result.status"] = status
        if request_id:
            filters["correlation.request_id"] = request_id

        time_range: Dict[str, Any] = {}
        if from_time:
            time_range["$gte"] = from_time
        if to_time:
            time_range["$lte"] = to_time
        if time_range:
            filters["occurred_at"] = time_range

        safe_page = max(1, page)
        safe_page_size = min(max(1, page_size), 200)
        skip = (safe_page - 1) * safe_page_size

        cursor = (
            collection.find(filters, {"_id": 0})
            .sort("occurred_at", -1)
            .skip(skip)
            .limit(safe_page_size)
        )
        items: List[Dict[str, Any]] = await cursor.to_list(length=safe_page_size)
        total = await collection.count_documents(filters)

        return {
            "items": items,
            "total": total,
            "page": safe_page,
            "page_size": safe_page_size,
        }


_audit_log_service: Optional[AuditLogService] = None


def get_audit_log_service() -> AuditLogService:
    global _audit_log_service
    if _audit_log_service is None:
        _audit_log_service = AuditLogService()
    return _audit_log_service
