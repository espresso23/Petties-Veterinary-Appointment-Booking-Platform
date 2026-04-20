from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Final
from urllib.parse import parse_qs, urlparse

from app.core.tool_runtime_context import get_tool_runtime_context


@dataclass(frozen=True)
class MCPResourceDefinition:
    uri_template: str
    name: str
    description: str
    backing_tool: str
    cache_ttl_seconds: int
    allowed_roles: List[str]
    phase: str
    deprecated_tool: Optional[str] = None


RESOURCE_DEFINITIONS: List[MCPResourceDefinition] = [
    MCPResourceDefinition(
        uri_template="petties://users/{userId}/pets",
        name="user_pets",
        description="Danh sách thú cưng của user hiện tại (read-only).",
        backing_tool="get_user_pets",
        cache_ttl_seconds=90,
        allowed_roles=["PET_OWNER", "ADMIN"],
        phase="phase0",
        deprecated_tool="get_user_pets",
    ),
    MCPResourceDefinition(
        uri_template="petties://pets/{petId}/health-summary",
        name="pet_health_summary",
        description="Tóm tắt sức khỏe thú cưng (read-only).",
        backing_tool="get_pet_health_summary",
        cache_ttl_seconds=120,
        allowed_roles=["PET_OWNER", "ADMIN"],
        phase="phase0",
        deprecated_tool="get_pet_health_summary",
    ),
    MCPResourceDefinition(
        uri_template="petties://patients/{patientId}/summary",
        name="patient_summary",
        description="Tóm tắt hồ sơ bệnh nhân thú cưng cho staff/clinic (read-only).",
        backing_tool="get_patient_summary",
        cache_ttl_seconds=120,
        allowed_roles=["STAFF", "CLINIC_MANAGER", "CLINIC_OWNER", "ADMIN"],
        phase="phase0",
        deprecated_tool="get_patient_summary",
    ),
    MCPResourceDefinition(
        uri_template="petties://patients/{patientId}/emr-history?limit=20",
        name="patient_emr_history",
        description="Lịch sử EMR của thú cưng (read-only).",
        backing_tool="get_emr_history",
        cache_ttl_seconds=90,
        allowed_roles=["STAFF", "CLINIC_MANAGER", "CLINIC_OWNER", "ADMIN"],
        phase="phase0",
        deprecated_tool="get_emr_history",
    ),
    MCPResourceDefinition(
        uri_template="petties://clinics/my",
        name="my_clinics",
        description="Danh sách phòng khám user hiện tại quản lý/làm việc (read-only).",
        backing_tool="get_my_clinics",
        cache_ttl_seconds=300,
        allowed_roles=["STAFF", "CLINIC_MANAGER", "CLINIC_OWNER", "ADMIN"],
        phase="phase0",
        deprecated_tool="get_my_clinics",
    ),
    MCPResourceDefinition(
        uri_template="petties://clinics/{clinicId}/services",
        name="clinic_services",
        description="Danh sách dịch vụ theo phòng khám (read-only).",
        backing_tool="list_clinic_services",
        cache_ttl_seconds=180,
        allowed_roles=["PET_OWNER", "CLINIC_MANAGER", "CLINIC_OWNER", "ADMIN"],
        phase="phase0",
        deprecated_tool="list_clinic_services",
    ),
    MCPResourceDefinition(
        uri_template="petties://clinics/{clinicId}/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD",
        name="clinic_metrics",
        description="Metrics hoạt động phòng khám theo khoảng thời gian (read-only).",
        backing_tool="get_clinic_metrics",
        cache_ttl_seconds=300,
        allowed_roles=["CLINIC_MANAGER", "CLINIC_OWNER", "ADMIN"],
        phase="phase1",
        deprecated_tool="get_clinic_metrics",
    ),
    MCPResourceDefinition(
        uri_template="petties://owner/stats-overview?period=MONTH",
        name="owner_stats_overview",
        description="Tổng quan thống kê nhiều phòng khám của owner (read-only).",
        backing_tool="get_owner_stats_overview",
        cache_ttl_seconds=300,
        allowed_roles=["CLINIC_OWNER", "ADMIN"],
        phase="phase1",
        deprecated_tool="get_owner_stats_overview",
    ),
    MCPResourceDefinition(
        uri_template="petties://staff/{staffId}/schedule?date=YYYY-MM-DD&days=1",
        name="staff_schedule",
        description="Lịch làm việc staff theo ngày/khoảng ngày (read-only).",
        backing_tool="get_staff_schedule",
        cache_ttl_seconds=120,
        allowed_roles=["CLINIC_MANAGER", "CLINIC_OWNER", "ADMIN"],
        phase="phase1",
        deprecated_tool="get_staff_schedule",
    ),
    MCPResourceDefinition(
        uri_template="petties://clinics/{clinicId}/slots?date=YYYY-MM-DD&staffName=",
        name="slot_availability",
        description="Tình trạng slot trống của phòng khám theo ngày (read-only).",
        backing_tool="get_slot_availability",
        cache_ttl_seconds=60,
        allowed_roles=["CLINIC_MANAGER", "CLINIC_OWNER", "ADMIN"],
        phase="phase1",
        deprecated_tool="get_slot_availability",
    ),
]

# Booking MCP tools dùng tên khác backing_tool trong registry; redirect read_resource tra cứu theo tên tool gọi ra.
_BOOKING_TOOL_ALIASES: Final[Dict[str, str]] = {
    "get_clinic_services": "list_clinic_services",
}

_RESOURCE_BY_NAME = {item.name: item for item in RESOURCE_DEFINITIONS}
_RESOURCE_BY_BACKING_TOOL = {item.backing_tool: item for item in RESOURCE_DEFINITIONS}


def list_resource_definitions() -> List[MCPResourceDefinition]:
    return RESOURCE_DEFINITIONS[:]


def get_resource_by_name(name: str) -> Optional[MCPResourceDefinition]:
    return _RESOURCE_BY_NAME.get(str(name or "").strip())


def get_resource_by_backing_tool(tool_name: str) -> Optional[MCPResourceDefinition]:
    raw = str(tool_name or "").strip()
    if not raw:
        return None
    resolved = _BOOKING_TOOL_ALIASES.get(raw, raw)
    return _RESOURCE_BY_BACKING_TOOL.get(resolved)


def get_allowed_resources_for_role(role: Optional[str]) -> List[str]:
    normalized_role = str(role or "").strip().upper()
    if not normalized_role:
        return []
    return [
        item.name
        for item in RESOURCE_DEFINITIONS
        if normalized_role in {r.upper() for r in item.allowed_roles}
    ]


def _resource_metadata(item: MCPResourceDefinition) -> Dict[str, Any]:
    return {
        "name": item.name,
        "uri_template": item.uri_template,
        "description": item.description,
        "backing_tool": item.backing_tool,
        "cache_ttl_seconds": item.cache_ttl_seconds,
        "allowed_roles": item.allowed_roles,
        "phase": item.phase,
        "deprecated_tool": item.deprecated_tool,
        "deprecated": bool(item.deprecated_tool),
    }


def list_resources_metadata() -> List[Dict[str, Any]]:
    return [_resource_metadata(item) for item in RESOURCE_DEFINITIONS]


def _extract_path_segments(uri: str) -> List[str]:
    parsed = urlparse(uri)
    path = parsed.path.strip("/")
    if not path:
        return []
    return [segment for segment in path.split("/") if segment]


def resolve_resource_request(
    resource_uri: str,
    fallback_params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    uri = str(resource_uri or "").strip()
    if not uri.startswith("petties://"):
        raise ValueError("Resource URI không hợp lệ. Vui lòng dùng schema petties://")

    parsed = urlparse(uri)
    host = str(parsed.netloc or "").strip().lower()
    segments = _extract_path_segments(uri)
    query = {k: (v[0] if v else None) for k, v in parse_qs(parsed.query).items()}
    params = dict(fallback_params or {})
    params.update({k: v for k, v in query.items() if v not in (None, "")})

    ctx = get_tool_runtime_context()
    role = str(getattr(ctx, "role", "") or "").strip().upper()
    user_id = str(getattr(ctx, "user_id", "") or "").strip()
    clinic_id = str(getattr(ctx, "clinic_id", "") or "").strip()

    def _build_result(name: str, tool_name: str, tool_params: Dict[str, Any]) -> Dict[str, Any]:
        resource = get_resource_by_name(name)
        if resource is None:
            raise ValueError(f"Resource `{name}` chưa được định nghĩa.")
        allowed = {item.upper() for item in resource.allowed_roles}
        if not role:
            raise PermissionError(
                "Thiếu vai trò người dùng trong ngữ cảnh runtime; không thể xác thực quyền truy cập resource."
            )
        if role not in allowed:
            raise PermissionError(
                f"Role `{role}` không có quyền truy cập resource `{resource.name}`."
            )
        return {
            "resource": resource,
            "resource_name": resource.name,
            "tool_name": tool_name,
            "tool_params": tool_params,
            "cache_ttl_seconds": resource.cache_ttl_seconds,
            "telemetry": {
                "resource_uri": uri,
                "resource_name": resource.name,
                "backing_tool": tool_name,
                "deprecated_tool": resource.deprecated_tool,
                "requested_at": datetime.now(timezone.utc).isoformat(),
                "role": role,
            },
        }

    if host == "users" and len(segments) == 2 and segments[1].lower() == "pets":
        requested_user_id = segments[0]
        final_user_id = requested_user_id if requested_user_id != "{userId}" else user_id
        return _build_result("user_pets", "get_user_pets", {"user_id": final_user_id})

    if host == "pets" and len(segments) == 2 and segments[1].lower() == "health-summary":
        pet_id = segments[0]
        return _build_result("pet_health_summary", "get_pet_health_summary", {"pet_id": pet_id})

    if host == "patients" and len(segments) == 2 and segments[1].lower() == "summary":
        patient_id = segments[0]
        return _build_result("patient_summary", "get_patient_summary", {"pet_id": patient_id})

    if host == "patients" and len(segments) == 2 and segments[1].lower() == "emr-history":
        patient_id = segments[0]
        limit = int(params.get("limit") or 20)
        return _build_result(
            "patient_emr_history",
            "get_emr_history",
            {"pet_id": patient_id, "limit": max(1, min(limit, 100))},
        )

    if host == "clinics" and len(segments) == 1 and segments[0].lower() == "my":
        return _build_result("my_clinics", "get_my_clinics", {})

    if host == "clinics" and len(segments) == 2 and segments[1].lower() == "services":
        active_clinic_id = segments[0] if segments[0] != "{clinicId}" else clinic_id
        return _build_result(
            "clinic_services",
            "list_clinic_services",
            {"target_clinic_id": active_clinic_id},
        )

    if host == "clinics" and len(segments) == 2 and segments[1].lower() == "metrics":
        active_clinic_id = segments[0] if segments[0] != "{clinicId}" else clinic_id
        return _build_result(
            "clinic_metrics",
            "get_clinic_metrics",
            {"clinic_name_hint": None, "clinic_id": active_clinic_id},
        )

    if host == "owner" and len(segments) == 1 and segments[0].lower() == "stats-overview":
        return _build_result(
            "owner_stats_overview",
            "get_owner_stats_overview",
            {"period": str(params.get("period") or "MONTH").upper()},
        )

    if host == "staff" and len(segments) == 2 and segments[1].lower() == "schedule":
        staff_id = segments[0]
        return _build_result(
            "staff_schedule",
            "get_staff_schedule",
            {
                "date": params.get("date"),
                "days": int(params.get("days") or 1),
                "user_id": staff_id,
            },
        )

    if host == "clinics" and len(segments) == 2 and segments[1].lower() == "slots":
        active_clinic_id = segments[0] if segments[0] != "{clinicId}" else clinic_id
        return _build_result(
            "slot_availability",
            "get_slot_availability",
            {
                "clinic_id": active_clinic_id,
                "date": params.get("date"),
                "staff_name": params.get("staffName"),
            },
        )

    raise ValueError(f"Resource URI chưa được hỗ trợ: {uri}")
