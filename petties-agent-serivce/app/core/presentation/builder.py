"""
Presentation Layer Builder
Converts raw tool data into UISchemaV1.
"""

from typing import Any, Dict, List, Optional
import logging

from .ui_schema import (
    ActionType,
    ComponentType,
    LayoutType,
    UIAction,
    UIComponent,
    UISchemaV1,
)
from app.core.tools.contracts import get_error_title

logger = logging.getLogger(__name__)

INTENT_MAP: Dict[str, str] = {
    "get_user_pets": "show_pet_list",
    "get_my_clinics": "show_clinic_list",
    "search_clinics_nearby": "show_clinic_list",
    "get_clinic_services": "show_services",
    "generate_clinic_services": "show_clinic_service_suggestions",
    "list_clinic_services": "show_clinic_service_catalog",
    "update_service_info": "show_service_update_preview",
    "check_available_slots": "show_available_slots",
    "create_booking_for_user": "show_booking_summary",
    "get_patient_summary": "show_emr_summary",
    "check_vaccination_status": "show_vaccination_status",
    "web_search": "show_web_search_results",
    # Analytics tools
    "get_clinic_today_summary": "show_clinic_today_summary",
    "analyze_revenue_trends": "show_revenue_chart",
    "get_clinic_metrics": "show_clinic_metrics",
}

RESOURCE_FALLBACK_TOOL_MAP: Dict[str, str] = {
    "user_pets": "get_user_pets",
    "clinic_services": "get_clinic_services",
    "slot_availability": "check_available_slots",
}

BOOKING_SUMMARY_TOOLS = {
    "create_booking_for_user",
}

BOOKING_PAYLOAD_KEYS = {
    "id",
    "pet_id",
    "pet_name",
    "clinic_id",
    "clinic_name",
    "service_ids",
    "service_names",
    "booking_date",
    "start_time",
    "booking_type",
    "home_address",
    "home_lat",
    "home_long",
    "notes",
}


def _normalize_list(values: Any) -> List[str]:
    return [str(value).strip() for value in (values or []) if str(value).strip()]


def _resolve_clinic_id(clinic: Dict[str, Any]) -> str:
    if not isinstance(clinic, dict):
        return ""
    for key in ("id", "clinic_id", "clinicId"):
        value = clinic.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _with_normalized_clinic_id(clinic: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(clinic or {})
    clinic_id = _resolve_clinic_id(normalized)
    if clinic_id:
        normalized["id"] = clinic_id
    return normalized


def _is_empty_result(data: Dict[str, Any]) -> bool:
    if not data:
        return True

    has_non_empty_signal = False
    for key in (
        "pets",
        "clinics",
        "services",
        "results",
        "images",
        "available_slots",
        "history",
        "upcoming",
        "recent_exams",
    ):
        if key in data and isinstance(data[key], list):
            if len(data[key]) > 0:
                has_non_empty_signal = True
            elif not has_non_empty_signal:
                continue

    if has_non_empty_signal:
        return False

    for key in (
        "pets",
        "clinics",
        "services",
        "results",
        "images",
        "available_slots",
        "history",
        "upcoming",
        "recent_exams",
    ):
        if key in data and isinstance(data[key], list):
            return len(data[key]) == 0

    return False


def _has_booking_payload_fields(payload: Any) -> bool:
    return isinstance(payload, dict) and any(
        key in payload for key in BOOKING_PAYLOAD_KEYS
    )


def _extract_booking_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(data, dict):
        return {}

    summary = data.get("summary") if isinstance(data.get("summary"), dict) else {}
    state = data.get("state") if isinstance(data.get("state"), dict) else {}

    candidates = [
        data.get("booking_preview"),
        data.get("booking"),
        data.get("draft"),
        state.get("draft") if isinstance(state, dict) else None,
        summary.get("draft") if isinstance(summary, dict) else None,
        data.get("collected_fields"),
    ]

    booking_payload: Dict[str, Any] = {}
    for candidate in candidates:
        if _has_booking_payload_fields(candidate):
            booking_payload.update(
                {
                    key: value
                    for key, value in candidate.items()
                    if value is not None and value != ""
                }
            )

    if not booking_payload and _has_booking_payload_fields(data):
        booking_payload = {
            key: value
            for key, value in data.items()
            if key in BOOKING_PAYLOAD_KEYS and value is not None and value != ""
        }

    return booking_payload


def _extract_missing_fields(data: Dict[str, Any]) -> List[str]:
    summary = data.get("summary") if isinstance(data.get("summary"), dict) else {}
    state = data.get("state") if isinstance(data.get("state"), dict) else {}

    for candidate in (
        data.get("missing_fields"),
        summary.get("missing_fields"),
        state.get("missing_fields"),
    ):
        if isinstance(candidate, list):
            return _normalize_list(candidate)

    return []


def _resolve_ready_to_create(data: Dict[str, Any], missing_fields: List[str]) -> bool:
    summary = data.get("summary") if isinstance(data.get("summary"), dict) else {}

    for candidate in (
        data.get("ready_to_create"),
        data.get("ready_for_review"),
        summary.get("ready_to_create"),
        summary.get("ready_for_review"),
    ):
        if isinstance(candidate, bool):
            return candidate

    return len(missing_fields) == 0


def _resolve_next_best_action(
    data: Dict[str, Any],
    missing_fields: List[str],
    ready_to_create: bool,
) -> str:
    next_best_action = str(data.get("next_best_action") or "").strip()
    if next_best_action:
        return next_best_action

    if missing_fields:
        return "fill_booking_form"

    if ready_to_create:
        return "confirm_booking"

    return "confirm_booking"


def _dedupe_services(services: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduped: List[Dict[str, Any]] = []
    seen_ids: set[str] = set()

    for service in services:
        service_id = str(service.get("id") or "").strip()
        if service_id and service_id in seen_ids:
            continue
        if service_id:
            seen_ids.add(service_id)
        deduped.append(service)

    return deduped


def _normalize_tool_result_for_presentation(
    tool_result: Dict[str, Any],
) -> tuple[str, bool, Dict[str, Any]]:
    raw_tool_name = str(tool_result.get("tool_name", "") or "")
    success = tool_result.get("success", True)
    data = (
        tool_result.get("data", tool_result)
        if success
        else tool_result.get("error", tool_result)
    )

    if raw_tool_name != "read_resource" or not isinstance(data, dict):
        return raw_tool_name, success, data if isinstance(data, dict) else {}

    resource_name = str(data.get("resource_name") or "").strip()
    effective_tool_name = RESOURCE_FALLBACK_TOOL_MAP.get(resource_name, "").strip()
    if not effective_tool_name:
        effective_tool_name = str(data.get("deprecated_tool") or "").strip() or raw_tool_name

    payload = data.get("payload")
    if isinstance(payload, dict):
        return effective_tool_name, success, payload

    return effective_tool_name, success, data


def resolve_intent(tool_name: str, result: Dict[str, Any]) -> str:
    data = result.get("data", {})

    if tool_name in BOOKING_SUMMARY_TOOLS and _extract_booking_payload(data):
        return "show_booking_summary"

    if not result.get("success", True):
        return "show_error"

    if tool_name == "generate_clinic_services":
        if (
            isinstance(data, dict)
            and bool(data.get("needs_clarification"))
            and isinstance(data.get("clinics"), list)
            and len(data.get("clinics") or []) > 0
        ):
            return "show_clinic_list"

    intent = INTENT_MAP.get(tool_name)
    if intent is None:
        return "show_text"

    if _is_empty_result(data):
        return "show_empty"

    return intent


def build_error_actions(error: Dict[str, Any]) -> List[UIAction]:
    if error.get("recoverable", True):
        retry_label = str(error.get("suggestion") or "").strip() or "Thử lại"
        return [
            UIAction(
                type=ActionType.RETRY_WITH_CHANGE,
                label=retry_label,
                payload={},
            ),
            UIAction(
                type=ActionType.CANCEL_FLOW,
                label="Hủy",
                payload={},
            ),
        ]

    return [
        UIAction(
            type=ActionType.DISMISS,
            label="Đóng",
            payload={},
        )
    ]


def build_error_card(error: Dict[str, Any]) -> UIComponent:
    return UIComponent(
        type=ComponentType.ERROR_CARD,
        id=f"err_{error.get('error_code', 'unknown')}",
        data={
            "error_code": error.get("error_code", "UNKNOWN_ERROR"),
            "title": error.get("title") or get_error_title(error.get("error_code")),
            "message": error.get("message", "Đã có lỗi xảy ra"),
            "recoverable": error.get("recoverable", True),
        },
        actions=build_error_actions(error),
    )


def _build_empty_state(intent: str, data: Dict[str, Any]) -> UIComponent:
    return UIComponent(
        type=ComponentType.EMPTY_STATE,
        id=f"empty_{intent}",
        data={
            "icon": "search_off",
            "title": "Không tìm thấy dữ liệu",
            "message": data.get("message") or "Vui lòng thử lại với thông tin khác.",
            "suggestion_action": {
                "type": ActionType.RETRY_WITH_CHANGE.value,
                "label": "Thử lại với thông tin khác",
            },
        },
        actions=[
            UIAction(
                type=ActionType.RETRY_WITH_CHANGE,
                label="Thử lại với thông tin khác",
                payload={"change_target": intent},
            )
        ],
    )


def _build_service_selection_components(data: Dict[str, Any]) -> List[UIComponent]:
    clinic_id = str(
        data.get("resolved_clinic_id") or data.get("clinic_id") or ""
    ).strip()
    resolved_clinic = data.get("resolved_clinic") if isinstance(data.get("resolved_clinic"), dict) else {}
    clinic_name = str(
        resolved_clinic.get("name")
        or data.get("clinic_name")
        or data.get("clinicName")
        or ""
    ).strip()
    pet_id = str(data.get("resolved_pet_id") or data.get("pet_id") or "").strip()
    services = data.get("services") or data.get("matched_services") or []
    ordered_services = _dedupe_services(
        [
            service
            for service in services
            if isinstance(service, dict) and str(service.get("id") or "").strip()
        ]
    )

    if not ordered_services:
        return []

    group_id = f"service_group_{clinic_id or 'default'}"
    components: List[UIComponent] = []

    for idx, service in enumerate(ordered_services):
        service_id = str(service.get("id") or idx)
        components.append(
            UIComponent(
                type=ComponentType.SERVICE_CHIP,
                id=f"svc_{service_id}",
                data={
                    **service,
                    "group_id": group_id,
                    "clinic_id": clinic_id,
                    **({"clinic_name": clinic_name} if clinic_name else {}),
                },
                actions=[
                    UIAction(
                        type=ActionType.SELECT_ITEM,
                        label="Chọn",
                        payload={
                            "item_id": service.get("id"),
                            "item_type": "service",
                            "group_id": group_id,
                            "clinic_id": clinic_id,
                            **({"clinic_name": clinic_name} if clinic_name else {}),
                            "service_name": service.get("name"),
                        },
                    )
                ],
            )
        )

    components.append(
        UIComponent(
            type=ComponentType.BUTTON,
            id=f"{group_id}_continue",
            data={
                "group_id": group_id,
                "label": "Tiếp tục",
                "variant": "primary",
            },
            actions=[
                UIAction(
                    type=ActionType.SELECT_SERVICES,
                    label="Tiếp tục",
                    payload={
                        "group_id": group_id,
                        "clinic_id": clinic_id,
                        **({"pet_id": pet_id} if pet_id else {}),
                    },
                )
            ],
        )
    )

    return components


def _build_service_create_confirm_action(service: Dict[str, Any]) -> UIAction:
    service_name = str(
        service.get("name") or service.get("display_name") or "Dịch vụ"
    ).strip()
    return UIAction(
        type=ActionType.OPEN_NATIVE_CONFIRM,
        label="Lưu dịch vụ",
        payload={
            "title": f"Lưu dịch vụ {service_name}",
            "message": f"Bạn có chắc muốn lưu dịch vụ '{service_name}' vào danh mục phòng khám không?",
            "confirm_label": "Lưu dịch vụ",
            "cancel_label": "Hủy",
            "confirm_action": {
                "type": ActionType.CONFIRM_SERVICE_CREATE.value,
                "label": "Lưu dịch vụ",
                "payload": {
                    "name": service.get("name"),
                    "description": service.get("description"),
                    "base_price": service.get("basePrice"),
                    "slots_required": service.get("slotsRequired"),
                    "duration_time": service.get("durationTime"),
                    "is_active": service.get("isActive", True),
                    "is_home_visit": service.get("isHomeVisit", False),
                    "service_category": service.get("serviceCategory"),
                    "pet_type": service.get("petType"),
                    "reminder_interval": service.get("reminderInterval"),
                    "reminder_unit": service.get("reminderUnit"),
                    "weight_prices": service.get("weightPrices") or [],
                    "vaccine_template_id": service.get("vaccineTemplateId"),
                    "dose_prices": service.get("dosePrices") or [],
                },
                "display_message": f"Xác nhận lưu dịch vụ {service_name}",
            },
        },
    )


def _build_service_update_confirm_action_from_suggestion(
    suggestion: Dict[str, Any],
) -> Optional[UIAction]:
    service_id = str(suggestion.get("service_id") or "").strip()
    proposed_updates = suggestion.get("proposed_updates") or {}
    if not service_id or not isinstance(proposed_updates, dict) or not proposed_updates:
        return None

    service_name = str(
        suggestion.get("service_name")
        or suggestion.get("display_name")
        or suggestion.get("name")
        or "dịch vụ"
    ).strip()

    update_payload: Dict[str, Any] = {
        "service_id": service_id,
        "service_name": service_name,
    }
    for field_key, value in proposed_updates.items():
        if value is None:
            continue
        update_payload[str(field_key)] = value

    change_count = len([k for k in update_payload.keys() if k not in {"service_id", "service_name"}])
    if change_count <= 0:
        return None

    return UIAction(
        type=ActionType.OPEN_NATIVE_CONFIRM,
        label="Áp dụng đề xuất",
        payload={
            "title": f"Cập nhật {service_name}",
            "message": (
                f"Bạn có chắc muốn áp dụng {change_count} thay đổi đề xuất cho '{service_name}' không?"
            ),
            "confirm_label": "Áp dụng",
            "cancel_label": "Hủy",
            "confirm_action": {
                "type": ActionType.CONFIRM_SERVICE_UPDATE.value,
                "label": "Áp dụng",
                "payload": update_payload,
                "display_message": f"Xác nhận áp dụng đề xuất cho dịch vụ {service_name}",
            },
        },
    )


def _build_service_suggestion_action(service: Dict[str, Any]) -> UIAction:
    recommended_action = str(service.get("recommended_action") or "").strip().lower()
    if recommended_action == "update":
        update_action = _build_service_update_confirm_action_from_suggestion(service)
        if update_action is not None:
            return update_action
    return _build_service_create_confirm_action(service)


def _build_service_batch_create_component(
    suggestions: List[Dict[str, Any]],
) -> Optional[UIComponent]:
    valid_suggestions = [
        item
        for item in suggestions
        if isinstance(item, dict)
        and item.get("name")
        and str(item.get("recommended_action") or "create").strip().lower()
        != "update"
    ]
    if not valid_suggestions:
        return None

    return UIComponent(
        type=ComponentType.BUTTON,
        id="clinic_service_batch_create",
        data={
            "label": f"Lưu tất cả ({len(valid_suggestions)})",
            "content": "Xác nhận lưu toàn bộ dịch vụ gợi ý",
            "variant": "primary",
        },
        actions=[
            UIAction(
                type=ActionType.OPEN_NATIVE_CONFIRM,
                label=f"Lưu tất cả ({len(valid_suggestions)})",
                payload={
                    "title": "Lưu toàn bộ dịch vụ gợi ý",
                    "message": f"Bạn có chắc muốn lưu {len(valid_suggestions)} dịch vụ gợi ý vào danh mục phòng khám không?",
                    "confirm_label": "Lưu tất cả",
                    "cancel_label": "Hủy",
                    "confirm_action": {
                        "type": ActionType.CONFIRM_SERVICE_BATCH_CREATE.value,
                        "label": "Lưu tất cả",
                        "payload": {"services": valid_suggestions},
                        "display_message": f"Xác nhận lưu {len(valid_suggestions)} dịch vụ gợi ý",
                    },
                },
            )
        ],
    )


def _build_service_update_confirm_action(data: Dict[str, Any]) -> UIAction:
    service_name = str(data.get("service_name") or "dịch vụ").strip()
    changes = data.get("changes") or {}
    return UIAction(
        type=ActionType.OPEN_NATIVE_CONFIRM,
        label="Xác nhận cập nhật",
        payload={
            "title": f"Cập nhật {service_name}",
            "message": f"Bạn có chắc muốn áp dụng thay đổi cho {service_name} không?",
            "confirm_label": "Áp dụng",
            "cancel_label": "Hủy",
            "confirm_action": {
                "type": ActionType.CONFIRM_SERVICE_UPDATE.value,
                "label": "Áp dụng",
                "payload": {
                    "service_id": data.get("service_id"),
                    "service_name": data.get("service_name"),
                    "name": (changes.get("name") or {}).get("new"),
                    "base_price": (changes.get("basePrice") or {}).get("new"),
                    "description": (changes.get("description") or {}).get("new"),
                    "is_active": (changes.get("isActive") or {}).get("new"),
                    "duration_time": (changes.get("durationTime") or {}).get("new"),
                    "slots_required": (changes.get("slotsRequired") or {}).get("new"),
                    "is_home_visit": (changes.get("isHomeVisit") or {}).get("new"),
                    "service_category": (changes.get("serviceCategory") or {}).get(
                        "new"
                    ),
                    "pet_type": (changes.get("petType") or {}).get("new"),
                    "reminder_interval": (changes.get("reminderInterval") or {}).get("new"),
                    "reminder_unit": (changes.get("reminderUnit") or {}).get("new"),
                    "weight_prices": (changes.get("weightPrices") or {}).get("new"),
                    "vaccine_template_id": (changes.get("vaccineTemplateId") or {}).get("new"),
                    "dose_prices": (changes.get("dosePrices") or {}).get("new"),
                },
                "display_message": f"Xác nhận cập nhật dịch vụ {service_name}",
            },
        },
    )


def _build_clinic_service_suggestion_components(
    data: Dict[str, Any],
) -> List[UIComponent]:
    suggestions = data.get("suggestions") or []
    components: List[UIComponent] = []

    batch_component = _build_service_batch_create_component(suggestions)
    if batch_component is not None:
        components.append(batch_component)

    for idx, suggestion in enumerate(suggestions):
        if not isinstance(suggestion, dict):
            continue
        service_id = str(
            suggestion.get("master_service_id") or suggestion.get("name") or idx
        )
        components.append(
            UIComponent(
                type=ComponentType.SERVICE_CARD,
                id=f"clinic_service_suggestion_{service_id}",
                data={
                    "name": suggestion.get("display_name") or suggestion.get("name"),
                    "description": suggestion.get("description")
                    or (
                        "Đề xuất cập nhật: "
                        + ", ".join(suggestion.get("change_summary") or [])
                        if suggestion.get("recommended_action") == "update"
                        else None
                    ),
                    "base_price": suggestion.get("basePrice"),
                    "duration_time": suggestion.get("durationTime"),
                    "slots_required": suggestion.get("slotsRequired"),
                    "service_category": suggestion.get("serviceCategory"),
                    "pet_type": suggestion.get("petType"),
                    "is_home_visit": suggestion.get("isHomeVisit"),
                    "weight_prices": suggestion.get("weightPrices") or [],
                    "dose_prices": suggestion.get("dosePrices") or [],
                    "service_id": suggestion.get("service_id"),
                    "recommended_action": suggestion.get("recommended_action") or "create",
                    "selected": False,
                },
                actions=[_build_service_suggestion_action(suggestion)],
            )
        )

    return components


def _build_clinic_service_catalog_components(data: Dict[str, Any]) -> List[UIComponent]:
    services = data.get("services") or []
    components: List[UIComponent] = []

    for idx, service in enumerate(services):
        if not isinstance(service, dict):
            continue
        service_id = str(service.get("service_id") or idx)
        components.append(
            UIComponent(
                type=ComponentType.SERVICE_CARD,
                id=f"clinic_service_{service_id}",
                data={
                    "name": service.get("name"),
                    "description": service.get("description"),
                    "base_price": service.get("base_price"),
                    "duration_time": service.get("duration_time"),
                    "slots_required": service.get("slots_required"),
                    "service_category": service.get("service_category"),
                    "pet_type": service.get("pet_type"),
                    "is_home_visit": service.get("is_home_visit"),
                    "weight_prices": service.get("weight_prices") or [],
                    "dose_prices": service.get("dose_prices") or [],
                    "selected": bool(service.get("is_active", True)),
                },
                actions=None,
            )
        )

    return components


def _build_service_update_preview_components(data: Dict[str, Any]) -> List[UIComponent]:
    changes = data.get("changes") or {}
    change_labels = [
        f"{change.get('label')}: {change.get('new_label', change.get('new'))}"
        for change in changes.values()
        if isinstance(change, dict)
    ]

    summary = "; ".join(change_labels) if change_labels else "Không có thay đổi hợp lệ"

    return [
        UIComponent(
            type=ComponentType.SERVICE_CARD,
            id=f"service_update_preview_{data.get('service_id') or 'unknown'}",
            data={
                "name": data.get("service_name") or "Dịch vụ",
                "description": summary,
                "base_price": (changes.get("basePrice") or {}).get("new"),
                "duration_time": (changes.get("durationTime") or {}).get("new"),
                "slots_required": (changes.get("slotsRequired") or {}).get("new"),
                "service_category": (changes.get("serviceCategory") or {}).get("new"),
                "pet_type": (changes.get("petType") or {}).get("new"),
                "is_home_visit": (changes.get("isHomeVisit") or {}).get("new"),
                "weight_prices": (changes.get("weightPrices") or {}).get("new"),
                "dose_prices": (changes.get("dosePrices") or {}).get("new"),
                "selected": True,
            },
            actions=[_build_service_update_confirm_action(data)],
        )
    ]


def _build_slot_components(data: Dict[str, Any]) -> List[UIComponent]:
    slots = data.get("available_slots") or data.get("recommended_slots") or []
    clinic_id = str(
        data.get("resolved_clinic_id") or data.get("clinic_id") or ""
    ).strip()
    booking_date = str(data.get("date") or "").strip()
    service_ids = _normalize_list(
        data.get("resolved_service_ids") or data.get("services")
    )
    service_names = _normalize_list(
        data.get("resolved_service_names") or data.get("services")
    )

    components: List[UIComponent] = []
    for idx, slot in enumerate(slots):
        if not isinstance(slot, dict):
            continue

        slot_id = slot.get("startTime") or slot.get("start_time") or idx
        start_time = str(slot.get("startTime") or slot.get("start_time") or "").strip()
        components.append(
            UIComponent(
                type=ComponentType.SLOT_BUTTON,
                id=f"slot_{slot_id}",
                data={
                    **slot,
                    "clinic_id": clinic_id,
                    "booking_date": booking_date,
                    "service_ids": service_ids,
                    "service_names": service_names,
                },
                actions=[
                    UIAction(
                        type=ActionType.SELECT_ITEM,
                        label="Chọn",
                        payload={
                            "item_id": slot_id,
                            "item_type": "slot",
                            "clinic_id": clinic_id,
                            "booking_date": booking_date,
                            "start_time": start_time,
                            "service_ids": service_ids,
                            "service_names": service_names,
                        },
                    )
                ],
            )
        )

    return components


def _build_booking_handoff_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    booking_payload = _extract_booking_payload(data)
    missing_fields = _extract_missing_fields(data)
    ready_to_create = _resolve_ready_to_create(data, missing_fields)
    next_best_action = _resolve_next_best_action(data, missing_fields, ready_to_create)

    return {
        "clinic_id": booking_payload.get("clinic_id"),
        "clinic_name": booking_payload.get("clinic_name"),
        "pet_id": booking_payload.get("pet_id"),
        "pet_name": booking_payload.get("pet_name"),
        "booking_type": booking_payload.get("booking_type"),
        "booking_date": booking_payload.get("booking_date"),
        "start_time": booking_payload.get("start_time"),
        "service_ids": _normalize_list(booking_payload.get("service_ids")),
        "service_names": _normalize_list(
            booking_payload.get("service_names") or data.get("services")
        ),
        "notes": booking_payload.get("notes"),
        "home_address": booking_payload.get("home_address"),
        "home_lat": booking_payload.get("home_lat"),
        "home_long": booking_payload.get("home_long"),
        "missing_fields": missing_fields,
        "ready_to_create": ready_to_create,
        "next_best_action": next_best_action,
    }


def _build_booking_summary_component(data: Dict[str, Any]) -> UIComponent:
    booking_payload = _extract_booking_payload(data)
    missing_fields = _extract_missing_fields(data)
    ready_to_create = _resolve_ready_to_create(data, missing_fields)
    next_best_action = _resolve_next_best_action(data, missing_fields, ready_to_create)
    needs_form_handoff = bool(missing_fields) or next_best_action == "fill_booking_form"

    actions: List[UIAction] = []

    if booking_payload.get("id"):
        actions = [
            UIAction(
                type=ActionType.OPEN_DETAIL,
                label="Xem chi tiết",
                payload={
                    "route": "booking_detail",
                    "id": booking_payload.get("id"),
                },
            )
        ]
    elif booking_payload:
        actions = [
            UIAction(
                type=ActionType.OPEN_NATIVE_CONFIRM,
                label="Mở form đặt lịch" if needs_form_handoff else "Mở màn xác nhận",
                payload=_build_booking_handoff_payload(data),
            ),
            UIAction(
                type=ActionType.RETRY_WITH_CHANGE,
                label="Chỉnh lại",
                payload={"change_target": "booking_details"},
            ),
            UIAction(
                type=ActionType.CANCEL_FLOW,
                label="Hủy",
                payload={},
            ),
        ]

    return UIComponent(
        type=ComponentType.BOOKING_SUMMARY,
        id=str(
            booking_payload.get("id")
            or data.get("multi_pet_summary", {}).get("clinic_name")
            or "booking_summary"
        ),
        data={
            **booking_payload,
            "bookings": data.get("bookings", []),
            "multi_pet_summary": data.get("multi_pet_summary"),
            "message": data.get("message"),
            "next_best_action": next_best_action,
            "ready_to_create": ready_to_create,
            "missing_fields": missing_fields,
            "service_names": _normalize_list(
                booking_payload.get("service_names") or data.get("services")
            ),
        },
        actions=actions or None,
    )


def _build_quick_booking_components(data: Dict[str, Any]) -> List[UIComponent]:
    """Build all-in-one quick booking UI: clinic + services + slots in one go."""
    components: List[UIComponent] = []

    clinics_with_slots = data.get("clinics_with_slots", [])
    has_results = data.get("has_results", False)

    if not has_results or not clinics_with_slots:
        missing_info = data.get("missing_info", [])
        message = data.get("message", "Không tìm được phòng khám phù hợp")
        components.append(
            UIComponent(
                type=ComponentType.EMPTY_STATE,
                id="quick_booking_empty",
                data={
                    "icon": "search_off",
                    "title": "Không tìm được lịch hẹn",
                    "message": message,
                    "missing_info": missing_info,
                    "suggestion": "Bạn thử điều chỉnh yêu cầu: ngày khác, dịch vụ khác, hoặc địa điểm khác xem sao?",
                },
                actions=[
                    UIAction(
                        type=ActionType.RETRY_WITH_CHANGE,
                        label="Thử yêu cầu khác",
                        payload={"intent": "quick_booking"},
                    )
                ],
            )
        )
        return components

    components.append(
        UIComponent(
            type=ComponentType.TEXT,
            id="quick_booking_header",
            data={
                "content": "Dưới đây là các lịch hẹn phù hợp với yêu cầu của bạn. Chọn phòng khám, dịch vụ và khung giờ bạn muốn:"
            },
        )
    )

    for idx, clinic_data in enumerate(clinics_with_slots):
        clinic = clinic_data.get("clinic", {})
        clinic = _with_normalized_clinic_id(clinic)
        clinic_id = _resolve_clinic_id(clinic)
        services = clinic_data.get("services", [])
        slots = clinic_data.get("slots", [])
        available_date = clinic_data.get("available_date")

        clinic_with_details = dict(clinic)
        clinic_with_details["services"] = services
        clinic_with_details["available_slots"] = slots
        clinic_with_details["available_date"] = available_date
        clinic_with_details["match_score"] = clinic_data.get("match_score", 0)

        components.append(
            UIComponent(
                type=ComponentType.CLINIC_CARD,
                id=f"quick_clinic_{clinic.get('id', idx)}",
                data=clinic_with_details,
                actions=[
                    UIAction(
                        type=ActionType.SELECT_ITEM,
                        label="Chọn phòng khám này",
                        payload={
                            "item_id": clinic_id,
                            "item_type": "clinic",
                            "source": "quick_booking",
                        },
                    )
                ],
            )
        )

        if services:
            for s_idx, service in enumerate(services):
                service_data = dict(service)
                service_data["clinic_id"] = clinic_id
                service_data["clinic_name"] = clinic.get("name")
                service_data["available_date"] = available_date
                service_data["available_slots"] = slots

                components.append(
                    UIComponent(
                        type=ComponentType.SERVICE_CHIP,
                        id=f"quick_service_{clinic.get('id')}_{service.get('id', s_idx)}",
                        data=service_data,
                        actions=[
                            UIAction(
                                type=ActionType.SELECT_SERVICES,
                                label="Chọn",
                                payload={
                                    "service_id": service.get("id"),
                                    "service_name": service.get("name"),
                                    "clinic_id": clinic_id,
                                    "clinic_name": clinic.get("name"),
                                    "available_date": available_date,
                                    "slots": slots,
                                    "source": "quick_booking",
                                },
                            )
                        ],
                    )
                )

        if slots:
            for s_idx, slot in enumerate(slots):
                slot_data = dict(slot)
                slot_data["clinic_id"] = clinic_id
                slot_data["clinic_name"] = clinic.get("name")
                slot_data["service_ids"] = [s.get("id") for s in services]
                slot_data["service_names"] = [s.get("name") for s in services]
                slot_data["available_date"] = available_date
                slot_data["source"] = "quick_booking"

                components.append(
                    UIComponent(
                        type=ComponentType.SLOT_BUTTON,
                        id=f"quick_slot_{clinic_id}_{slot.get('date')}_{s_idx}",
                        data=slot_data,
                        actions=[
                            UIAction(
                                type=ActionType.SELECT_ITEM,
                                label=f"{slot.get('startTime') or slot.get('time')} - {slot.get('endTime', '')}",
                                payload={
                                    "slot_date": slot.get("date"),
                                    "slot_time": slot.get("startTime")
                                    or slot.get("time"),
                                    "clinic_id": clinic_id,
                                    "clinic_name": clinic.get("name"),
                                    "service_ids": [s.get("id") for s in services],
                                    "service_names": [s.get("name") for s in services],
                                    "source": "quick_booking",
                                },
                            )
                        ],
                    )
                )

    components.append(
        UIComponent(
            type=ComponentType.BADGE,
            id="quick_booking_hint",
            data={
                "content": "Tip: Bạn có thể chọn phòng khám → dịch vụ → giờ trong 1 lần. Khi đã chọn đủ, hệ thống sẽ hiển thị nút xác nhận đặt lịch.",
            },
        )
    )

    return components


def _build_web_search_components(data: Dict[str, Any]) -> List[UIComponent]:
    results = data.get("results") or []
    images = data.get("images") or []
    query = str(data.get("query") or "").strip()
    answer = str(data.get("answer") or data.get("message") or "").strip()
    follow_up_questions = _normalize_list(
        data.get("follow_up_questions") or data.get("followUpQuestions")
    )

    normalized_results: List[Dict[str, Any]] = []
    for idx, item in enumerate(results):
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or item.get("name") or "Nguồn tham khảo").strip()
        snippet = str(item.get("snippet") or item.get("content") or "").strip()
        url = str(item.get("url") or item.get("source") or "").strip()
        source = str(item.get("source") or url).strip()
        normalized_results.append(
            {
                "rank": idx + 1,
                "title": title,
                "snippet": snippet,
                "url": url,
                "source": source,
                "score": item.get("score"),
            }
        )

    normalized_images: List[Dict[str, Any]] = []
    for item in images:
        if isinstance(item, str):
            url = item.strip()
            if not url:
                continue
            normalized_images.append(
                {
                    "url": url,
                    "title": "",
                    "description": "",
                }
            )
            continue

        if not isinstance(item, dict):
            continue

        url = str(item.get("url") or "").strip()
        if not url:
            continue

        normalized_images.append(
            {
                "url": url,
                "title": str(item.get("title") or "").strip(),
                "description": str(item.get("description") or "").strip(),
            }
        )

    normalized_images = normalized_images[:6]

    sources_used = data.get("sources_used")
    source_count = (
        int(sources_used)
        if isinstance(sources_used, int)
        else len(normalized_results)
    )

    summary_parts: List[str] = []
    if query:
        summary_parts.append(f"Chủ đề tìm kiếm: {query}")
    if source_count > 0:
        summary_parts.append(f"Đã tổng hợp từ {source_count} nguồn tham khảo.")
    if follow_up_questions:
        summary_parts.append("Bạn có thể chọn câu hỏi gợi ý để đào sâu thêm.")

    summary_content = "\n\n".join(part for part in summary_parts if part.strip())
    if not summary_content:
        summary_content = "Mình đã tìm thông tin từ web nhưng chưa đủ dữ liệu để tổng hợp rõ ràng."

    components: List[UIComponent] = [
        UIComponent(
            type=ComponentType.TEXT,
            id="web_search_summary",
            data={
                "content": summary_content,
                "query": query,
                "answer": answer,
                "follow_up_questions": follow_up_questions,
            },
        )
    ]

    for idx, result in enumerate(normalized_results):
        actions = None
        if result.get("url"):
            actions = [
                UIAction(
                    type=ActionType.OPEN_DETAIL,
                    label="Mở nguồn",
                    payload={"url": result.get("url")},
                )
            ]

        components.append(
            UIComponent(
                type=ComponentType.WEB_RESULT_CARD,
                id=f"web_result_{idx}",
                data=result,
                actions=actions,
            )
        )

    if normalized_images:
        components.append(
            UIComponent(
                type=ComponentType.IMAGE_GALLERY,
                id="web_search_images",
                data={
                    "title": "Hình ảnh minh họa",
                    "images": normalized_images,
                },
                actions=None,
            )
        )

    return components


def _build_components_for_intent(
    intent: str, tool_name: str, data: Dict[str, Any]
) -> List[UIComponent]:
    components: List[UIComponent] = []

    if intent == "show_pet_list":
        for idx, pet in enumerate(data.get("pets", [])):
            components.append(
                UIComponent(
                    type=ComponentType.PET_CARD,
                    id=f"pet_{pet.get('id', idx)}",
                    data=pet,
                    actions=[
                        UIAction(
                            type=ActionType.SELECT_ITEM,
                            label="Chọn",
                            payload={
                                "item_id": pet.get("id"),
                                "item_type": "pet",
                            },
                        )
                    ],
                )
            )

    elif intent == "show_clinic_list":
        matched_clinic = (
            data.get("matched_clinic")
            if isinstance(data.get("matched_clinic"), dict)
            else None
        )
        clinics_source = data.get("clinics", [])
        if matched_clinic and str(data.get("target_clinic_id") or "").strip():
            clinics_source = [matched_clinic]
        for idx, clinic in enumerate(clinics_source):
            if not isinstance(clinic, dict):
                continue
            clinic = _with_normalized_clinic_id(clinic)
            clinic_id = _resolve_clinic_id(clinic)
            actions = None
            if clinic_id and not (
                matched_clinic
                and str(data.get("target_clinic_id") or "").strip()
            ):
                actions = [
                    UIAction(
                        type=ActionType.SELECT_ITEM,
                        label="Chọn",
                        payload={
                            "item_id": clinic_id,
                            "item_type": "clinic",
                            "clinic_id": clinic_id,
                            "clinic_name": clinic.get("name"),
                        },
                    )
                ]
            components.append(
                UIComponent(
                    type=ComponentType.CLINIC_CARD,
                    id=f"clinic_{clinic.get('id', idx)}",
                    data=clinic,
                    actions=actions,
                )
            )

    elif intent == "show_services":
        components.extend(_build_service_selection_components(data))

    elif intent == "show_clinic_service_suggestions":
        components.extend(_build_clinic_service_suggestion_components(data))

    elif intent == "show_clinic_service_catalog":
        components.extend(_build_clinic_service_catalog_components(data))

    elif intent == "show_service_update_preview":
        components.extend(_build_service_update_preview_components(data))

    elif intent == "show_available_slots":
        components.extend(_build_slot_components(data))

    elif intent == "show_booking_summary":
        components.append(_build_booking_summary_component(data))

    elif intent == "show_vaccination_status":
        components.append(
            UIComponent(
                type=ComponentType.VACCINATION_CARD,
                id=str(data.get("pet_id", "vaccination_card")),
                data=data,
                actions=[],
            )
        )

    elif intent == "show_emr_summary":
        components.append(
            UIComponent(
                type=ComponentType.EMR_SUMMARY,
                id=str(data.get("pet_id", "emr_summary")),
                data=data,
                actions=[],
            )
        )

    elif intent == "show_quick_booking":
        components.extend(_build_quick_booking_components(data))

    elif intent == "show_web_search_results":
        components.extend(_build_web_search_components(data))

    elif intent == "show_text":
        content = (
            data.get("message")
            or data.get("content")
            or "Không có dữ liệu để hiển thị."
        )
        components.append(
            UIComponent(
                type=ComponentType.TEXT,
                id=f"text_{tool_name or 'fallback'}",
                data={"content": str(content)},
            )
        )

    return components


def _has_successful_service_context(tool_results: List[Dict[str, Any]]) -> bool:
    for tool_result in tool_results:
        tool_name, success, payload = _normalize_tool_result_for_presentation(
            tool_result
        )
        if tool_name != "get_clinic_services":
            continue
        if not success:
            continue
        services = payload.get("services")
        total_services = payload.get("total_services")
        if isinstance(services, list) and len(services) > 0:
            return True
        if isinstance(total_services, int) and total_services > 0:
            return True
    return False


def _should_skip_redundant_clinic_list(
    tool_name: str,
    data: Dict[str, Any],
    *,
    has_successful_service_context: bool,
) -> bool:
    if not has_successful_service_context:
        return False

    if tool_name not in {"get_my_clinics", "search_clinics_nearby"}:
        return False

    clinics = data.get("clinics")
    if not isinstance(clinics, list) or len(clinics) == 0:
        return False

    if bool(data.get("needs_clarification")):
        return False

    matched_clinic = data.get("matched_clinic")
    resolved_clinic = data.get("resolved_clinic")

    if isinstance(matched_clinic, dict):
        clinic_id = _resolve_clinic_id(matched_clinic)
        clinic_name = str(
            matched_clinic.get("name")
            or matched_clinic.get("clinic_name")
            or ""
        ).strip()
        if clinic_id and clinic_name:
            return True

    if isinstance(resolved_clinic, dict):
        clinic_id = _resolve_clinic_id(resolved_clinic)
        clinic_name = str(
            resolved_clinic.get("name")
            or resolved_clinic.get("clinic_name")
            or ""
        ).strip()
        if clinic_id and clinic_name:
            return True

    target_clinic_id = str(data.get("target_clinic_id") or "").strip()
    if not target_clinic_id:
        return False

    for clinic in clinics:
        if not isinstance(clinic, dict):
            continue
        clinic_id = _resolve_clinic_id(clinic)
        if clinic_id != target_clinic_id:
            continue
        clinic_name = str(
            clinic.get("name") or clinic.get("clinic_name") or ""
        ).strip()
        if clinic_name:
            return True

    return False


def _has_complete_booking_context(tool_results: List[Dict[str, Any]]) -> bool:
    """Check if we have enough info to show a booking summary (clinic + service + slot)."""
    has_clinic = False
    has_service = False
    has_slot = False
    has_booking_intent = False

    for tool_result in tool_results:
        tool_name, success, data = _normalize_tool_result_for_presentation(tool_result)
        if not success or not isinstance(data, dict):
            continue

        # Check for clinic resolution - handle multiple field patterns
        if tool_name == "search_clinics_nearby":
            matched = data.get("matched_clinic")
            if matched and isinstance(matched, dict):
                # Try multiple possible ID field names
                clinic_id = (
                    matched.get("id") or
                    matched.get("clinic_id") or
                    matched.get("clinicId")
                )
                if clinic_id:
                    has_clinic = True
                    has_booking_intent = True  # If we resolved a clinic, user had intent

            # Also check if clinics list has results
            if not has_clinic:
                clinics = data.get("clinics", [])
                if isinstance(clinics, list) and len(clinics) > 0:
                    has_clinic = True
                    has_booking_intent = True

        # Check for service resolution - handle multiple field patterns
        if tool_name == "get_clinic_services":
            services = data.get("services", [])
            resolved_ids = (
                data.get("resolved_service_ids") or
                data.get("service_ids") or
                []
            )
            if (isinstance(services, list) and len(services) > 0) or \
               (isinstance(resolved_ids, list) and len(resolved_ids) > 0):
                has_service = True

        # Check for slot resolution - handle multiple field patterns
        if tool_name == "check_available_slots":
            slots = (
                data.get("available_slots") or
                data.get("availableSlots") or
                []
            )
            recommended = (
                data.get("recommended_slots") or
                data.get("recommendedSlots") or
                []
            )
            if (isinstance(slots, list) and len(slots) > 0) or \
               (isinstance(recommended, list) and len(recommended) > 0):
                has_slot = True

    return has_clinic and has_service and has_slot and has_booking_intent


def _build_booking_context_from_tools(tool_results: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Build a booking context dict from tool results for summary card."""
    context: Dict[str, Any] = {}
    missing_fields = []

    for tool_result in tool_results:
        tool_name, success, data = _normalize_tool_result_for_presentation(tool_result)
        if not success or not isinstance(data, dict):
            continue

        if tool_name == "search_clinics_nearby":
            matched = data.get("matched_clinic")
            if matched and isinstance(matched, dict):
                # Try multiple possible field names
                context["clinic_id"] = (
                    matched.get("id") or
                    matched.get("clinic_id") or
                    matched.get("clinicId")
                )
                context["clinic_name"] = (
                    matched.get("name") or
                    matched.get("clinic_name") or
                    matched.get("clinicName")
                )

            # Fallback: check clinics list
            if not context.get("clinic_id"):
                clinics = data.get("clinics", [])
                if isinstance(clinics, list) and len(clinics) > 0:
                    first_clinic = clinics[0]
                    if isinstance(first_clinic, dict):
                        context["clinic_id"] = (
                            first_clinic.get("id") or
                            first_clinic.get("clinic_id")
                        )
                        context["clinic_name"] = (
                            first_clinic.get("name") or
                            first_clinic.get("clinic_name")
                        )

        if tool_name == "get_clinic_services":
            # Try multiple field patterns for service IDs
            resolved_ids = (
                data.get("resolved_service_ids") or
                data.get("service_ids") or
                []
            )
            # Try multiple field patterns for service names
            resolved_names = (
                data.get("resolved_service_names") or
                data.get("service_names") or
                []
            )
            if resolved_ids:
                context["service_ids"] = list(resolved_ids)
            if resolved_names:
                context["service_names"] = list(resolved_names)

        if tool_name == "check_available_slots":
            # Try multiple field patterns for date
            date = (
                data.get("resolved_date") or
                data.get("date") or
                data.get("booking_date") or
                data.get("bookingDate")
            )
            # Try multiple field patterns for time
            time = (
                data.get("resolved_time") or
                data.get("start_time") or
                data.get("startTime")
            )
            if date:
                context["booking_date"] = str(date)
            if time:
                context["start_time"] = str(time)

    # Check for missing fields
    if not context.get("clinic_id"):
        missing_fields.append("clinic_id")
    if not context.get("clinic_name"):
        missing_fields.append("clinic_name")
    if not context.get("service_ids") and not context.get("service_names"):
        missing_fields.append("service_ids")
    if not context.get("booking_date"):
        missing_fields.append("booking_date")
    if not context.get("start_time"):
        missing_fields.append("start_time")

    context["missing_fields"] = missing_fields
    context["ready_to_create"] = len(missing_fields) == 0
    context["next_best_action"] = "fill_booking_form" if missing_fields else "confirm_booking"

    return context if context else None


def _has_booking_summary_component(components: List[UIComponent]) -> bool:
    """Check if components already contain a booking summary."""
    for c in components:
        t = getattr(c, "type", None)
        if t is None:
            continue
        # Handle both enum and string cases
        t_str = t.value if hasattr(t, "value") else str(t)
        if "booking_summary" in t_str.lower():
            return True
    return False


def build_ui_schema(tool_results: List[Dict[str, Any]]) -> Optional[UISchemaV1]:
    """Builds a composite UISchemaV1 from tool results in one agent turn."""
    if not tool_results:
        return None

    all_components: List[UIComponent] = []
    is_composite = len(tool_results) > 1
    final_layout = LayoutType.LIST
    has_successful_service_context = _has_successful_service_context(tool_results)

    # Detect if we have enough booking context to show summary
    has_booking_context = _has_complete_booking_context(tool_results)

    for index, tool_result in enumerate(tool_results):
        tool_name, success, data = _normalize_tool_result_for_presentation(tool_result)

        if (
            success
            and isinstance(data, dict)
            and _should_skip_redundant_clinic_list(
                tool_name,
                data,
                has_successful_service_context=has_successful_service_context,
            )
        ):
            continue

        std_result: Dict[str, Any] = {"success": success, "data": data}
        if not success and isinstance(data, dict):
            std_result["error_code"] = data.get("error_code")
            std_result["message"] = data.get("message")
            std_result["recoverable"] = data.get("recoverable", True)
            std_result["suggestion"] = data.get("suggestion")

        intent = resolve_intent(tool_name, std_result)

        # In composite mode, only show header for intentional UI components
        if is_composite and intent not in ("show_text",):
            title_text = tool_name.replace("_", " ").title()
            if intent == "show_error":
                title_text = f"Lỗi: {title_text}"
            all_components.append(
                UIComponent(
                    type=ComponentType.TEXT,
                    id=f"header_{index}",
                    data={"content": title_text},
                )
            )

        if intent == "show_error":
            all_components.append(build_error_card(std_result))
            continue

        if intent == "show_empty":
            all_components.append(
                _build_empty_state(INTENT_MAP.get(tool_name, "unknown"), data)
            )
            continue

        components = _build_components_for_intent(intent, tool_name, data)
        all_components.extend(components)

        if not is_composite:
            if intent == "show_clinic_list":
                final_layout = (
                    LayoutType.CARD if len(components) == 1 else LayoutType.GRID
                )
            elif intent == "show_available_slots":
                final_layout = LayoutType.SLOT_GRID
            elif intent in (
                "show_clinic_service_suggestions",
                "show_clinic_service_catalog",
            ):
                final_layout = LayoutType.GRID
            elif intent in (
                "show_booking_summary",
                "show_emr_summary",
                "show_vaccination_status",
                "show_service_update_preview",
                "show_web_search_results",
            ):
                final_layout = LayoutType.CARD

    # If we have complete booking context but no booking_summary was generated, build one
    if has_booking_context and not _has_booking_summary_component(all_components):
        context_data = _build_booking_context_from_tools(tool_results)
        if context_data:
            all_components.append(_build_booking_summary_component(context_data))
            final_layout = LayoutType.CARD

    if not all_components:
        return None

    return UISchemaV1(
        version="1.0",
        layout=final_layout,
        components=all_components,
        metadata=None,
    )
