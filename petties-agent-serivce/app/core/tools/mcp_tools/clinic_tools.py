from typing import Optional, Dict, Any, List, Tuple
import unicodedata
import json
from loguru import logger
from app.core.tools.contracts import build_tool_error_response
from app.core.tools.fastmcp_app import mcp_server
from app.core.tools.auth_deps import _require_auth_token
from app.core.tool_runtime_context import get_tool_runtime_context
from app.services.backend_client import (
    SpringBackendClient as BackendClient,
    get_backend_client,
    BackendClientError,
)


def _normalize_text(value: Optional[str]) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    normalized = unicodedata.normalize("NFD", text)
    without_accents = "".join(
        ch for ch in normalized if unicodedata.category(ch) != "Mn"
    )
    return "".join(without_accents.split())


def _pick_value(source: Dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in source and source.get(key) is not None:
            return source.get(key)
    return None


def _resolve_runtime_clinic_id(explicit_clinic_id: Optional[str]) -> Optional[str]:
    if explicit_clinic_id and str(explicit_clinic_id).strip():
        return str(explicit_clinic_id).strip()
    runtime_ctx = get_tool_runtime_context()
    if runtime_ctx and runtime_ctx.clinic_id:
        return str(runtime_ctx.clinic_id).strip()
    return None


def _to_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y", "on"}:
        return True
    if text in {"0", "false", "no", "n", "off"}:
        return False
    return None


def _to_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _extract_list_payload(response: Any) -> List[Dict[str, Any]]:
    if isinstance(response, list):
        return [item for item in response if isinstance(item, dict)]
    if isinstance(response, dict):
        raw = response.get("content")
        if raw is None:
            raw = response.get("data")
        if raw is None:
            raw = response.get("services")
        if isinstance(raw, list):
            return [item for item in raw if isinstance(item, dict)]
    return []


def _canonicalize_for_compare(value: Any) -> Any:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    if isinstance(value, list):
        return [_canonicalize_for_compare(item) for item in value if item is not None]
    if isinstance(value, dict):
        return {
            str(key): _canonicalize_for_compare(item)
            for key, item in sorted(value.items(), key=lambda kv: str(kv[0]))
            if item is not None
        }
    return str(value)


def _values_equal(left: Any, right: Any) -> bool:
    left_normalized = _canonicalize_for_compare(left)
    right_normalized = _canonicalize_for_compare(right)
    if isinstance(left_normalized, (int, float)) and isinstance(
        right_normalized, (int, float)
    ):
        return abs(float(left_normalized) - float(right_normalized)) < 1e-9
    return left_normalized == right_normalized


def _score_create_suggestion(
    mapped_master: Dict[str, Any],
    existing_services: List[Dict[str, Any]],
) -> int:
    """Ưu tiên đề xuất dịch vụ mới theo khoảng trống danh mục hiện có."""
    if not existing_services:
        return 1

    existing_categories = {
        str(item.get("service_category") or "").strip().upper()
        for item in existing_services
        if str(item.get("service_category") or "").strip()
    }
    existing_pet_types = {
        str(item.get("pet_type") or "").strip().upper()
        for item in existing_services
        if str(item.get("pet_type") or "").strip()
    }

    category = str(mapped_master.get("serviceCategory") or "").strip().upper()
    pet_type = str(mapped_master.get("petType") or "").strip().upper()

    score = 1
    if category and category not in existing_categories:
        score += 3
    if pet_type and pet_type not in existing_pet_types:
        score += 2
    if mapped_master.get("isHomeVisit"):
        score += 1
    return score


def _match_existing_service(
    existing_services: List[Dict[str, Any]],
    mapped_master: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    master_service_id = str(mapped_master.get("master_service_id") or "").strip()
    if master_service_id:
        for existing in existing_services:
            existing_master_id = str(existing.get("master_service_id") or "").strip()
            if existing_master_id and existing_master_id == master_service_id:
                return existing

    mapped_name = _normalize_text(str(mapped_master.get("name") or ""))
    if mapped_name:
        for existing in existing_services:
            existing_name = _normalize_text(str(existing.get("name") or ""))
            if existing_name and existing_name == mapped_name:
                return existing
    return None


def _build_proposed_updates(
    existing: Dict[str, Any],
    mapped_master: Dict[str, Any],
) -> Dict[str, Any]:
    comparisons: List[Tuple[str, Any, Any]] = [
        ("description", existing.get("description"), mapped_master.get("description")),
        ("base_price", existing.get("base_price"), mapped_master.get("basePrice")),
        (
            "duration_time",
            existing.get("duration_time"),
            mapped_master.get("durationTime"),
        ),
        (
            "slots_required",
            existing.get("slots_required"),
            mapped_master.get("slotsRequired"),
        ),
        (
            "is_home_visit",
            existing.get("is_home_visit"),
            mapped_master.get("isHomeVisit"),
        ),
        (
            "service_category",
            existing.get("service_category"),
            mapped_master.get("serviceCategory"),
        ),
        ("pet_type", existing.get("pet_type"), mapped_master.get("petType")),
        (
            "reminder_interval",
            existing.get("reminder_interval"),
            mapped_master.get("reminderInterval"),
        ),
        (
            "reminder_unit",
            existing.get("reminder_unit"),
            mapped_master.get("reminderUnit"),
        ),
        (
            "weight_prices",
            existing.get("weight_prices") or [],
            mapped_master.get("weightPrices") or [],
        ),
        (
            "dose_prices",
            existing.get("dose_prices") or [],
            mapped_master.get("dosePrices") or [],
        ),
        (
            "vaccine_template_id",
            existing.get("vaccine_template_id"),
            mapped_master.get("vaccineTemplateId"),
        ),
    ]

    proposed_updates: Dict[str, Any] = {}
    for field_name, current_value, suggested_value in comparisons:
        if suggested_value is None:
            continue
        if field_name in {"weight_prices", "dose_prices"} and not suggested_value:
            continue
        if not _values_equal(current_value, suggested_value):
            proposed_updates[field_name] = suggested_value
    return proposed_updates


def _normalize_service_record(item: Dict[str, Any]) -> Dict[str, Any]:
    service_id = _pick_value(item, "service_id", "serviceId", "id")
    base_price = _pick_value(item, "base_price", "basePrice", "defaultPrice")
    duration_time = _pick_value(
        item,
        "duration_time",
        "duration_minutes",
        "durationTime",
        "durationMinutes",
    )
    slots_required = _pick_value(item, "slots_required", "slotsRequired")
    is_active = _pick_value(item, "is_active", "isActive")
    is_home_visit = _pick_value(item, "is_home_visit", "isHomeVisit")
    service_category = _pick_value(
        item, "service_category", "serviceCategory", "category"
    )
    pet_type = _pick_value(item, "pet_type", "petType")
    reminder_interval = _pick_value(item, "reminder_interval", "reminderInterval")
    reminder_unit = _pick_value(item, "reminder_unit", "reminderUnit")
    weight_prices = _pick_value(item, "weight_prices", "weightPrices") or []
    dose_prices = _pick_value(item, "dose_prices", "dosePrices") or []

    active_bool = _to_bool(is_active)
    home_visit_bool = _to_bool(is_home_visit)

    return {
        "service_id": str(service_id).strip() if service_id is not None else "",
        "master_service_id": _pick_value(item, "master_service_id", "masterServiceId"),
        "name": _pick_value(item, "name", "service_name"),
        "description": _pick_value(item, "description"),
        "base_price": base_price,
        "duration_time": duration_time,
        "slots_required": slots_required,
        "is_active": True if active_bool is None else active_bool,
        "is_home_visit": False if home_visit_bool is None else home_visit_bool,
        "service_category": service_category,
        "pet_type": pet_type,
        "reminder_interval": reminder_interval,
        "reminder_unit": reminder_unit,
        "weight_prices": _to_list(weight_prices),
        "vaccine_template_id": _pick_value(
            item, "vaccine_template_id", "vaccineTemplateId"
        ),
        "dose_prices": _to_list(dose_prices),
        "display_status": "Hoạt động"
        if (True if active_bool is None else active_bool)
        else "Không hoạt động",
    }


def _service_sort_key(item: Dict[str, Any], sort_by: str) -> Any:
    mode = str(sort_by or "name").strip().lower()
    if mode in {"price", "base_price", "baseprice"}:
        return item.get("base_price") or 0
    if mode in {"duration", "duration_time", "duration_minutes"}:
        return item.get("duration_time") or 0
    return str(item.get("name") or "").lower()


FIELD_SPECS: Dict[str, Dict[str, str]] = {
    "name": {"api": "name", "label": "Tên dịch vụ"},
    "description": {"api": "description", "label": "Mô tả"},
    "base_price": {"api": "basePrice", "label": "Giá (VND)"},
    "duration_minutes": {"api": "durationTime", "label": "Thời lượng (phút)"},
    "slots_required": {"api": "slotsRequired", "label": "Số slot"},
    "is_active": {"api": "isActive", "label": "Trạng thái"},
    "is_home_visit": {"api": "isHomeVisit", "label": "Khám tại nhà"},
    "service_category": {"api": "serviceCategory", "label": "Nhóm dịch vụ"},
    "pet_type": {"api": "petType", "label": "Loài thú cưng"},
    "reminder_interval": {"api": "reminderInterval", "label": "Chu kỳ nhắc lại"},
    "reminder_unit": {"api": "reminderUnit", "label": "Đơn vị nhắc lại"},
    "weight_prices": {"api": "weightPrices", "label": "Giá theo cân nặng"},
    "vaccine_template_id": {"api": "vaccineTemplateId", "label": "Mẫu vaccine"},
    "dose_prices": {"api": "dosePrices", "label": "Giá theo mũi tiêm"},
}

ALIASES_TO_FIELD: Dict[str, str] = {
    "name": "name",
    "description": "description",
    "base_price": "base_price",
    "baseprice": "base_price",
    "duration_minutes": "duration_minutes",
    "duration_time": "duration_minutes",
    "slots_required": "slots_required",
    "is_active": "is_active",
    "is_home_visit": "is_home_visit",
    "service_category": "service_category",
    "pet_type": "pet_type",
    "reminder_interval": "reminder_interval",
    "reminder_unit": "reminder_unit",
    "weight_prices": "weight_prices",
    "vaccine_template_id": "vaccine_template_id",
    "dose_prices": "dose_prices",
    "basePrice": "base_price",
    "durationTime": "duration_minutes",
    "slotsRequired": "slots_required",
    "isActive": "is_active",
    "isHomeVisit": "is_home_visit",
    "serviceCategory": "service_category",
    "petType": "pet_type",
    "reminderInterval": "reminder_interval",
    "reminderUnit": "reminder_unit",
    "weightPrices": "weight_prices",
    "vaccineTemplateId": "vaccine_template_id",
    "dosePrices": "dose_prices",
}


def _extract_update_payload(
    *,
    updates: Optional[Dict[str, Any]] = None,
    name: Optional[str] = None,
    service_name: Optional[str] = None,
    description: Optional[str] = None,
    base_price: Optional[float] = None,
    duration_minutes: Optional[int] = None,
    slots_required: Optional[int] = None,
    is_active: Optional[bool] = None,
    is_home_visit: Optional[bool] = None,
    service_category: Optional[str] = None,
    pet_type: Optional[str] = None,
    reminder_interval: Optional[int] = None,
    reminder_unit: Optional[str] = None,
    weight_prices: Optional[List[Dict[str, Any]]] = None,
    vaccine_template_id: Optional[str] = None,
    dose_prices: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {}

    for raw_key, value in (updates or {}).items():
        normalized_field = ALIASES_TO_FIELD.get(str(raw_key), "")
        if not normalized_field:
            continue
        api_key = FIELD_SPECS[normalized_field]["api"]
        payload[api_key] = value

    explicit_values = {
        "name": name,
        "description": description,
        "basePrice": base_price,
        "durationTime": duration_minutes,
        "slotsRequired": slots_required,
        "isActive": is_active,
        "isHomeVisit": is_home_visit,
        "serviceCategory": service_category,
        "petType": pet_type,
        "reminderInterval": reminder_interval,
        "reminderUnit": reminder_unit,
        "weightPrices": weight_prices,
        "vaccineTemplateId": vaccine_template_id,
        "dosePrices": dose_prices,
    }
    for key, value in explicit_values.items():
        if value is not None:
            payload[key] = value

    return payload


def _build_changes_preview(payload: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    api_to_field = {spec["api"]: field for field, spec in FIELD_SPECS.items()}
    changes: Dict[str, Dict[str, Any]] = {}

    for api_key, new_value in payload.items():
        normalized_field = api_to_field.get(api_key)
        if not normalized_field:
            continue
        label = FIELD_SPECS[normalized_field]["label"]
        entry: Dict[str, Any] = {"label": label, "new": new_value}
        if normalized_field == "is_active":
            entry["new_label"] = "Hoạt động" if bool(new_value) else "Không hoạt động"
        elif normalized_field == "is_home_visit":
            entry["new_label"] = "Có" if bool(new_value) else "Không"
        changes[api_key] = entry

    return changes


@mcp_server.tool()
async def list_clinic_services(
    is_home_visit: Optional[bool] = None,
    is_active: Optional[bool] = None,
    sort_by: Optional[str] = "name",
    order: Optional[str] = "asc",
    pet_types: Optional[List[str]] = None,
    service_scope: Optional[List[str]] = None,
    clinic_name_hint: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    target_clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Xem danh sách dịch vụ của phòng khám với dữ liệu đầy đủ.
    Hỗ trợ filter/sort và chuẩn hóa field cho UI renderer."""
    token = _require_auth_token()
    client = get_backend_client()

    active_clinic_id = _resolve_runtime_clinic_id(target_clinic_id)
    if clinic_name_hint and not active_clinic_id:
        try:
            resp = await get_my_clinics(clinic_name_hint=clinic_name_hint)
            if resp.get("success") and resp.get("target_clinic_id"):
                active_clinic_id = resp["target_clinic_id"]
        except Exception:
            logger.exception("Không thể resolve clinic từ clinic_name_hint")

    try:
        response = await client.get_my_clinic_services(
            token,
            clinic_id=active_clinic_id,
            is_home_visit=is_home_visit,
            is_active=is_active,
        )
    except BackendClientError as exc:
        return build_tool_error_response(
            error_code="BACKEND_ERROR",
            message=str(exc),
            recoverable=True,
        )

    if isinstance(response, dict) and "data" in response:
        data = response["data"]
    elif isinstance(response, dict) and "content" in response:
        data = response["content"]
    else:
        data = response

    services_raw = data if isinstance(data, list) else []
    normalized_services = [
        _normalize_service_record(service)
        for service in services_raw
        if isinstance(service, dict)
    ]

    pet_type_filters = {
        str(item).upper() for item in (pet_types or []) if str(item).strip()
    }
    category_filters = {
        str(item).upper() for item in (service_scope or []) if str(item).strip()
    }
    if pet_type_filters:
        normalized_services = [
            item
            for item in normalized_services
            if str(item.get("pet_type") or "").upper() in pet_type_filters
        ]
    if category_filters:
        normalized_services = [
            item
            for item in normalized_services
            if str(item.get("service_category") or "").upper() in category_filters
        ]

    reverse_sort = str(order or "asc").strip().lower() == "desc"
    normalized_services.sort(
        key=lambda item: _service_sort_key(item, str(sort_by or "name")),
        reverse=reverse_sort,
    )

    active_count = sum(1 for item in normalized_services if item.get("is_active"))
    inactive_count = len(normalized_services) - active_count
    home_visit_count = sum(
        1 for item in normalized_services if item.get("is_home_visit")
    )

    return {
        "success": True,
        "data": {
            "services": normalized_services,
            "total": len(normalized_services),
            "summary": {
                "active_services": active_count,
                "inactive_services": inactive_count,
                "home_visit_services": home_visit_count,
            },
            "target_clinic_id": active_clinic_id,
            "sort_by": sort_by,
            "order": "desc" if reverse_sort else "asc",
        },
        "ui_card": "clinic_service_list_card",
    }


@mcp_server.tool()
async def update_service_info(
    service_id: str,
    updates: Optional[Dict[str, Any]] = None,
    name: Optional[str] = None,
    service_name: Optional[str] = None,
    description: Optional[str] = None,
    base_price: Optional[float] = None,
    duration_minutes: Optional[int] = None,
    slots_required: Optional[int] = None,
    is_active: Optional[bool] = None,
    is_home_visit: Optional[bool] = None,
    service_category: Optional[str] = None,
    pet_type: Optional[str] = None,
    reminder_interval: Optional[int] = None,
    reminder_unit: Optional[str] = None,
    weight_prices: Optional[List[Dict[str, Any]]] = None,
    vaccine_template_id: Optional[str] = None,
    dose_prices: Optional[List[Dict[str, Any]]] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    target_clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Tạo preview cập nhật dịch vụ với nhiều trường trong một lần xác nhận."""
    payload = _extract_update_payload(
        updates=updates,
        name=name,
        service_name=service_name,
        description=description,
        base_price=base_price,
        duration_minutes=duration_minutes,
        slots_required=slots_required,
        is_active=is_active,
        is_home_visit=is_home_visit,
        service_category=service_category,
        pet_type=pet_type,
        reminder_interval=reminder_interval,
        reminder_unit=reminder_unit,
        weight_prices=weight_prices,
        vaccine_template_id=vaccine_template_id,
        dose_prices=dose_prices,
    )
    if not payload:
        return build_tool_error_response(
            error_code="INVALID_INPUT",
            message="Bạn chưa cung cấp trường nào để cập nhật dịch vụ.",
            recoverable=True,
            suggestion="Hãy cung cấp ít nhất một trường như giá, mô tả hoặc trạng thái.",
        )

    changes = _build_changes_preview(payload)
    return {
        "success": True,
        "data": {
            "service_id": service_id,
            "service_name": service_name,
            "changes": changes,
            "pending_updates": payload,
            "requires_confirmation": True,
            "action_type": "preview",
            "message": "Đã chuẩn bị bản xem trước. Vui lòng xác nhận để áp dụng thay đổi.",
        },
        "metadata": {
            "is_write_preview": True,
            "target_clinic_id": _resolve_runtime_clinic_id(target_clinic_id),
        },
        "ui_card": "service_update_preview_card",
    }


@mcp_server.tool()
async def create_clinic_service(
    service_data: Optional[Dict[str, Any]] = None,
    name: Optional[str] = None,
    description: Optional[str] = None,
    base_price: Optional[float] = None,
    slots_required: Optional[int] = None,
    duration_minutes: Optional[int] = None,
    is_active: Optional[bool] = True,
    is_home_visit: Optional[bool] = False,
    service_category: Optional[str] = None,
    pet_type: Optional[str] = None,
    reminder_interval: Optional[int] = None,
    reminder_unit: Optional[str] = None,
    weight_prices: Optional[List[Dict[str, Any]]] = None,
    vaccine_template_id: Optional[str] = None,
    dose_prices: Optional[List[Dict[str, Any]]] = None,
    target_clinic_id: Optional[str] = None,
    return_created: bool = True,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Tạo dịch vụ mới cho phòng khám.
    Hỗ trợ cả `service_data` (dict) và tham số rời để tương thích nhiều luồng gọi."""
    token = _require_auth_token()

    source = dict(service_data or {})
    source_name = _pick_value(source, "name")
    source_description = _pick_value(source, "description")
    source_base_price = _pick_value(source, "basePrice", "base_price")
    source_slots_required = _pick_value(source, "slotsRequired", "slots_required")
    source_duration = _pick_value(
        source, "durationTime", "duration_minutes", "durationMinutes"
    )
    source_is_active = _pick_value(source, "isActive", "is_active")
    source_is_home_visit = _pick_value(source, "isHomeVisit", "is_home_visit")
    source_service_category = _pick_value(source, "serviceCategory", "service_category")
    source_pet_type = _pick_value(source, "petType", "pet_type")
    source_reminder_interval = _pick_value(
        source, "reminderInterval", "reminder_interval"
    )
    source_reminder_unit = _pick_value(source, "reminderUnit", "reminder_unit")
    source_weight_prices = _pick_value(source, "weightPrices", "weight_prices")
    source_vaccine_template_id = _pick_value(
        source, "vaccineTemplateId", "vaccine_template_id"
    )
    source_dose_prices = _pick_value(source, "dosePrices", "dose_prices")

    final_name = name if name is not None else source_name
    final_description = description if description is not None else source_description
    final_base_price = base_price if base_price is not None else source_base_price
    final_slots_required = (
        slots_required if slots_required is not None else source_slots_required
    )
    final_duration = (
        duration_minutes if duration_minutes is not None else source_duration
    )
    final_is_active = is_active if is_active is not None else source_is_active
    final_is_home_visit = (
        is_home_visit if is_home_visit is not None else source_is_home_visit
    )
    final_service_category = (
        service_category if service_category is not None else source_service_category
    )
    final_pet_type = pet_type if pet_type is not None else source_pet_type
    final_reminder_interval = (
        reminder_interval if reminder_interval is not None else source_reminder_interval
    )
    final_reminder_unit = (
        reminder_unit if reminder_unit is not None else source_reminder_unit
    )
    final_weight_prices = (
        weight_prices if weight_prices is not None else source_weight_prices
    )
    final_vaccine_template_id = (
        vaccine_template_id
        if vaccine_template_id is not None
        else source_vaccine_template_id
    )
    final_dose_prices = dose_prices if dose_prices is not None else source_dose_prices

    if not final_name or final_base_price is None or final_slots_required is None:
        return build_tool_error_response(
            error_code="INVALID_INPUT",
            message="Thiếu thông tin bắt buộc để tạo dịch vụ (tên, giá, số slot).",
            recoverable=True,
            suggestion="Hãy cung cấp name, base_price và slots_required.",
        )

    client = get_backend_client()
    resolved_clinic_id = (
        str(target_clinic_id).strip()
        if target_clinic_id is not None and str(target_clinic_id).strip()
        else None
    )
    payload = {
        "name": final_name,
        "description": final_description,
        "basePrice": final_base_price,
        "slotsRequired": final_slots_required,
        "durationTime": final_duration,
        "isActive": True if final_is_active is None else bool(final_is_active),
        "isHomeVisit": False
        if final_is_home_visit is None
        else bool(final_is_home_visit),
        "serviceCategory": final_service_category,
        "petType": final_pet_type,
        "reminderInterval": final_reminder_interval,
        "reminderUnit": final_reminder_unit,
    }
    if final_weight_prices is not None:
        payload["weightPrices"] = final_weight_prices
    if final_vaccine_template_id is not None:
        payload["vaccineTemplateId"] = final_vaccine_template_id
    if final_dose_prices is not None:
        payload["dosePrices"] = final_dose_prices
    if resolved_clinic_id:
        payload["clinicId"] = resolved_clinic_id

    create_fn = getattr(client, "create_clinic_service", None)
    if callable(create_fn):
        response = await create_fn(token, payload)
    else:
        response = await client.create_service(token, payload)

    service_id = _pick_value(
        response if isinstance(response, dict) else {}, "serviceId", "id"
    )
    return {
        "success": True,
        "data": {
            "created": True,
            "service_id": str(service_id).strip() if service_id else None,
            "service": response if return_created else None,
            "target_clinic_id": resolved_clinic_id,
        },
        "ui_card": "service_detail_card",
        "message": "Đã tạo dịch vụ thành công.",
    }


@mcp_server.tool()
async def inherit_service_from_template(
    master_service_id: str,
    target_clinic_id: Optional[str] = None,
    custom_price: Optional[float] = None,
    custom_price_per_km: Optional[float] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Kế thừa dịch vụ từ danh mục mẫu (Master Service) cho phòng khám cụ thể."""
    token = _require_auth_token()
    client = BackendClient()
    response = await client.inherit_from_master_service(
        token,
        master_service_id,
        clinic_id=target_clinic_id,
        price=custom_price,
        price_per_km=custom_price_per_km,
    )
    return {
        "success": True,
        "service": response,
        "ui_card": "service_detail_card",
        "message": f"Đã thêm dịch vụ {response.get('name')} vào phòng khám.",
    }


@mcp_server.tool()
async def get_my_clinics(
    clinic_name_hint: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Lấy danh sách các phòng khám mà người dùng hiện tại quản lý.
    Nếu có clinic_name_hint, tool sẽ cố gắng tìm ID chính xác dựa trên tên user cung cấp.
    Quan trọng để lấy target_clinic_id khi Owner có nhiều clinic."""
    token = _require_auth_token()
    client = BackendClient()
    try:
        response = await client.get_my_clinics(token)
    except BackendClientError as exc:
        return build_tool_error_response(
            error_code="BACKEND_ERROR", message=str(exc), recoverable=True
        )
    clinics = (
        response
        if isinstance(response, list)
        else response.get("content") or response.get("data") or []
    )
    if not clinics:
        return build_tool_error_response(
            error_code="NO_CLINIC_FOUND",
            message="Không tìm thấy phòng khám nào bạn quản lý.",
            recoverable=True,
            suggestion="Vui lòng kiểm tra lại quyền truy cập hoặc liên hệ quản trị viên.",
        )

    normalized_clinics: List[Dict[str, Any]] = []
    for clinic in clinics:
        if not isinstance(clinic, dict):
            continue
        normalized = dict(clinic)
        clinic_id = _pick_value(clinic, "id", "clinicId")
        if clinic_id is not None:
            normalized["id"] = str(clinic_id)
            normalized["clinicId"] = str(clinic_id)
        normalized_clinics.append(normalized)

    # Optional logic to resolve ID from name
    matched_clinic = None
    if clinic_name_hint:
        hint = _normalize_text(clinic_name_hint)
        logger.info(
            f"  ├─ Resolving clinic hint: '{clinic_name_hint}' (normalized: '{hint}')"
        )
        for c in normalized_clinics:
            raw_name = str(c.get("name") or "")
            name = _normalize_text(raw_name)
            if hint == name or hint in name or name in hint:
                matched_clinic = c
                logger.info(
                    f"  ├─ Matched clinic: '{raw_name}' ({c.get('id') or c.get('clinicId')})"
                )
                break

        if not matched_clinic:
            logger.warning(f"  ├─ No clinic matched for hint: '{clinic_name_hint}'")

    message = None
    if matched_clinic:
        message = f"Đã tìm thấy phòng khám '{matched_clinic.get('name')}' khớp với thông tin bạn cung cấp."

    needs_clarification = (
        bool(clinic_name_hint)
        and matched_clinic is None
        and len(normalized_clinics) > 1
    )
    target_clinic_id = (
        str(_pick_value(matched_clinic, "id", "clinicId"))
        if matched_clinic
        else (
            str(_pick_value(normalized_clinics[0], "id", "clinicId"))
            if len(normalized_clinics) == 1
            else None
        )
    )

    return {
        "success": True,
        "clinics": normalized_clinics,
        "matched_clinic": matched_clinic,
        "target_clinic_id": target_clinic_id,
        "needs_clarification": needs_clarification,
        "total": len(normalized_clinics),
        "message": message,
        "ui_card": "clinic_list_card",
    }


@mcp_server.tool()
async def generate_clinic_services(
    pet_types: Optional[List[str]] = None,
    service_scope: Optional[List[str]] = None,
    target_clinic_id: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Gợi ý thay đổi thông minh cho dịch vụ clinic.
    Nếu clinic đã có dịch vụ, ưu tiên đề xuất cập nhật dịch vụ hiện có (không sửa master).
    Nếu clinic chưa có dịch vụ, fallback gợi ý tạo mới từ master catalog."""
    token = _require_auth_token()
    client = get_backend_client()
    response = await client.get_master_services(token)
    services = response if isinstance(response, list) else response.get("data", [])
    resolved_clinic_id = _resolve_runtime_clinic_id(target_clinic_id)

    existing_services: List[Dict[str, Any]] = []
    try:
        existing_response = await client.get_my_clinic_services(
            token,
            clinic_id=resolved_clinic_id,
        )
        existing_services = [
            _normalize_service_record(item)
            for item in _extract_list_payload(existing_response)
        ]
    except Exception as exc:
        logger.warning(f"Không thể lấy dịch vụ hiện có của clinic để so sánh: {exc}")
        existing_services = []

    pet_type_filters = {
        str(item).upper() for item in (pet_types or []) if str(item).strip()
    }
    category_filters = {
        str(item).upper() for item in (service_scope or []) if str(item).strip()
    }

    update_suggestions: List[Dict[str, Any]] = []
    create_suggestions: List[Dict[str, Any]] = []
    for service in services if isinstance(services, list) else []:
        if not isinstance(service, dict):
            continue

        mapped = {
            "master_service_id": _pick_value(
                service,
                "master_service_id",
                "masterServiceId",
                "id",
            ),
            "name": _pick_value(service, "name"),
            "display_name": _pick_value(service, "name"),
            "description": _pick_value(service, "description"),
            "basePrice": _pick_value(service, "basePrice", "defaultPrice"),
            "durationTime": _pick_value(service, "durationTime", "duration_minutes"),
            "slotsRequired": _pick_value(service, "slotsRequired"),
            "isActive": True,
            "isHomeVisit": bool(_pick_value(service, "isHomeVisit") or False),
            "serviceCategory": _pick_value(service, "serviceCategory", "category"),
            "petType": _pick_value(service, "petType"),
            "reminderInterval": _pick_value(service, "reminderInterval"),
            "reminderUnit": _pick_value(service, "reminderUnit"),
            "weightPrices": _to_list(
                _pick_value(service, "weightPrices", "weight_prices")
            ),
            "dosePrices": _to_list(_pick_value(service, "dosePrices", "dose_prices")),
            "vaccineTemplateId": _pick_value(
                service, "vaccineTemplateId", "vaccine_template_id"
            ),
        }

        mapped_pet_type = str(mapped.get("petType") or "").upper()
        mapped_category = str(mapped.get("serviceCategory") or "").upper()

        if pet_type_filters and mapped_pet_type not in pet_type_filters:
            continue
        if category_filters and mapped_category not in category_filters:
            continue

        if existing_services:
            matched_existing = _match_existing_service(existing_services, mapped)
            if matched_existing:
                proposed_updates = _build_proposed_updates(matched_existing, mapped)
                if proposed_updates:
                    change_summary = [
                        FIELD_SPECS[ALIASES_TO_FIELD[key]]["label"]
                        for key in proposed_updates.keys()
                        if key in ALIASES_TO_FIELD
                    ]
                    update_suggestion = {
                        **mapped,
                        "recommended_action": "update",
                        "service_id": matched_existing.get("service_id"),
                        "service_name": matched_existing.get("name"),
                        "current_values": {
                            "base_price": matched_existing.get("base_price"),
                            "duration_time": matched_existing.get("duration_time"),
                            "slots_required": matched_existing.get("slots_required"),
                            "is_home_visit": matched_existing.get("is_home_visit"),
                            "service_category": matched_existing.get(
                                "service_category"
                            ),
                            "pet_type": matched_existing.get("pet_type"),
                        },
                        "proposed_updates": proposed_updates,
                        "change_summary": change_summary,
                    }
                    update_suggestion["display_name"] = (
                        matched_existing.get("name")
                        or mapped.get("display_name")
                        or mapped.get("name")
                    )
                    update_suggestion["description"] = mapped.get(
                        "description"
                    ) or matched_existing.get("description")
                    update_suggestions.append(update_suggestion)
                continue

        mapped["recommended_action"] = "create"
        mapped["priority_score"] = _score_create_suggestion(mapped, existing_services)
        create_suggestions.append(mapped)

    if existing_services and update_suggestions:
        update_suggestions.sort(
            key=lambda item: len(item.get("proposed_updates") or {}),
            reverse=True,
        )

    if create_suggestions:
        create_suggestions.sort(
            key=lambda item: (
                int(item.get("priority_score") or 0),
                str(item.get("display_name") or item.get("name") or "").lower(),
            ),
            reverse=True,
        )

    suggestions: List[Dict[str, Any]] = [
        *create_suggestions,
        *update_suggestions,
    ]
    if len(suggestions) > 12:
        suggestions = suggestions[:12]

    for item in suggestions:
        item.pop("priority_score", None)

    update_suggestions_count = sum(
        1
        for item in suggestions
        if str(item.get("recommended_action") or "").strip().lower() == "update"
    )
    create_suggestions_count = sum(
        1
        for item in suggestions
        if str(item.get("recommended_action") or "").strip().lower() != "update"
    )

    message = (
        "Đã chuẩn bị danh mục dịch vụ gợi ý với đầy đủ thông tin để bạn chọn nhanh."
    )
    recommendation_mode = "create"
    if existing_services:
        recommendation_mode = "mixed"
        if update_suggestions_count > 0 and create_suggestions_count == 0:
            recommendation_mode = "update_existing_only"
        elif update_suggestions_count == 0 and create_suggestions_count > 0:
            recommendation_mode = "create"

        if suggestions:
            message = (
                "Đã phân tích danh mục dịch vụ hiện có và đề xuất linh hoạt: "
                "ưu tiên dịch vụ mới để mở rộng danh mục, đồng thời gợi ý cập nhật các dịch vụ cần tối ưu."
            )
        else:
            message = (
                "Dịch vụ hiện có của phòng khám đã khá đồng bộ với chuẩn hệ thống. "
                "Hiện chưa có đề xuất cập nhật cần thiết."
            )

    return {
        "success": True,
        "data": {
            "suggestions": suggestions,
            "total_suggestions": len(suggestions),
            "target_clinic_id": resolved_clinic_id,
            "pet_types": sorted(list(pet_type_filters)) if pet_type_filters else [],
            "service_scope": sorted(list(category_filters)) if category_filters else [],
            "recommendation_mode": recommendation_mode,
            "update_suggestions": update_suggestions_count,
            "create_suggestions": create_suggestions_count,
        },
        "ui_card": "clinic_service_suggestion_card",
        "message": message,
    }


@mcp_server.tool()
async def execute_update_service_confirmed(
    service_id: str,
    updates: Optional[Dict[str, Any]] = None,
    name: Optional[str] = None,
    service_name: Optional[str] = None,
    description: Optional[str] = None,
    base_price: Optional[float] = None,
    duration_minutes: Optional[int] = None,
    slots_required: Optional[int] = None,
    is_active: Optional[bool] = None,
    is_home_visit: Optional[bool] = None,
    service_category: Optional[str] = None,
    pet_type: Optional[str] = None,
    reminder_interval: Optional[int] = None,
    reminder_unit: Optional[str] = None,
    weight_prices: Optional[List[Dict[str, Any]]] = None,
    vaccine_template_id: Optional[str] = None,
    dose_prices: Optional[List[Dict[str, Any]]] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Áp dụng cập nhật dịch vụ sau khi người dùng đã xác nhận (HITL)."""
    token = _require_auth_token()

    payload = _extract_update_payload(
        updates=updates,
        name=name,
        service_name=service_name,
        description=description,
        base_price=base_price,
        duration_minutes=duration_minutes,
        slots_required=slots_required,
        is_active=is_active,
        is_home_visit=is_home_visit,
        service_category=service_category,
        pet_type=pet_type,
        reminder_interval=reminder_interval,
        reminder_unit=reminder_unit,
        weight_prices=weight_prices,
        vaccine_template_id=vaccine_template_id,
        dose_prices=dose_prices,
    )
    if not payload:
        return build_tool_error_response(
            error_code="INVALID_INPUT",
            message="Không có thay đổi hợp lệ để cập nhật dịch vụ.",
            recoverable=True,
            suggestion="Hãy cung cấp ít nhất một trường cần cập nhật.",
        )

    client = get_backend_client()
    update_fn = getattr(client, "update_clinic_service", None)
    if callable(update_fn):
        response = await update_fn(token, service_id, payload)
    else:
        response = await client.update_service_info(token, service_id, payload)

    return {
        "success": True,
        "data": {
            "service_id": service_id,
            "service": response,
            "updated_fields": sorted(list(payload.keys())),
        },
        "ui_card": "service_detail_card",
        "message": "Đã cập nhật dịch vụ thành công.",
    }
