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
    "start_booking_session": "show_booking_summary",
    "get_booking_session": "show_booking_summary",
    "update_booking_draft": "show_booking_summary",
    "get_booking_draft_summary": "show_booking_summary",
    "resume_booking_session": "show_booking_summary",
    "get_patient_summary": "show_emr_summary",
    "check_vaccination_status": "show_vaccination_status",
    "quick_booking_search": "show_quick_booking",
}

BOOKING_SUMMARY_TOOLS = {
    "create_booking_for_user",
    "start_booking_session",
    "get_booking_session",
    "update_booking_draft",
    "get_booking_draft_summary",
    "resume_booking_session",
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


def _is_empty_result(data: Dict[str, Any]) -> bool:
    if not data:
        return True

    has_non_empty_signal = False
    for key in (
        "pets",
        "clinics",
        "services",
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


def resolve_intent(tool_name: str, result: Dict[str, Any]) -> str:
    data = result.get("data", {})

    if tool_name in BOOKING_SUMMARY_TOOLS and _extract_booking_payload(data):
        return "show_booking_summary"

    if not result.get("success", True):
        return "show_error"

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
    pet_id = str(data.get("resolved_pet_id") or data.get("pet_id") or "").strip()
    services = data.get("matched_services") or data.get("services") or []
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

    for idx, service in enumerate(ordered_services[:8]):
        service_id = str(service.get("id") or idx)
        components.append(
            UIComponent(
                type=ComponentType.SERVICE_CHIP,
                id=f"svc_{service_id}",
                data={
                    **service,
                    "group_id": group_id,
                    "clinic_id": clinic_id,
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
                },
                "display_message": f"Xác nhận lưu dịch vụ {service_name}",
            },
        },
    )


def _build_service_batch_create_component(
    suggestions: List[Dict[str, Any]],
) -> Optional[UIComponent]:
    valid_suggestions = [
        item for item in suggestions if isinstance(item, dict) and item.get("name")
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
                    "description": suggestion.get("description"),
                    "base_price": suggestion.get("basePrice"),
                    "duration_time": suggestion.get("durationTime"),
                    "service_category": suggestion.get("serviceCategory"),
                    "pet_type": suggestion.get("petType"),
                    "selected": False,
                },
                actions=[_build_service_create_confirm_action(suggestion)],
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
                    "service_category": service.get("service_category"),
                    "pet_type": service.get("pet_type"),
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
                "service_category": (changes.get("serviceCategory") or {}).get("new"),
                "pet_type": (changes.get("petType") or {}).get("new"),
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
                            "item_id": clinic.get("id"),
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
                service_data["clinic_id"] = clinic.get("id")
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
                                    "clinic_id": clinic.get("id"),
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
                slot_data["clinic_id"] = clinic.get("id")
                slot_data["clinic_name"] = clinic.get("name")
                slot_data["service_ids"] = [s.get("id") for s in services]
                slot_data["service_names"] = [s.get("name") for s in services]
                slot_data["available_date"] = available_date
                slot_data["source"] = "quick_booking"

                components.append(
                    UIComponent(
                        type=ComponentType.SLOT_BUTTON,
                        id=f"quick_slot_{clinic.get('id')}_{slot.get('date')}_{s_idx}",
                        data=slot_data,
                        actions=[
                            UIAction(
                                type=ActionType.SELECT_ITEM,
                                label=f"{slot.get('startTime') or slot.get('time')} - {slot.get('endTime', '')}",
                                payload={
                                    "slot_date": slot.get("date"),
                                    "slot_time": slot.get("startTime")
                                    or slot.get("time"),
                                    "clinic_id": clinic.get("id"),
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
        for idx, clinic in enumerate(data.get("clinics", [])):
            components.append(
                UIComponent(
                    type=ComponentType.CLINIC_CARD,
                    id=f"clinic_{clinic.get('id', idx)}",
                    data=clinic,
                    actions=[
                        UIAction(
                            type=ActionType.SELECT_ITEM,
                            label="Chọn",
                            payload={
                                "item_id": clinic.get("id"),
                                "item_type": "clinic",
                            },
                        )
                    ],
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


def build_ui_schema(tool_results: List[Dict[str, Any]]) -> Optional[UISchemaV1]:
    """Builds a composite UISchemaV1 from tool results in one agent turn."""
    if not tool_results:
        return None

    all_components: List[UIComponent] = []
    is_composite = len(tool_results) > 1
    final_layout = LayoutType.LIST

    for index, tool_result in enumerate(tool_results):
        tool_name = str(tool_result.get("tool_name", "") or "")
        success = tool_result.get("success", True)
        data = (
            tool_result.get("data", tool_result)
            if success
            else tool_result.get("error", tool_result)
        )

        std_result: Dict[str, Any] = {"success": success, "data": data}
        if not success and isinstance(data, dict):
            std_result["error_code"] = data.get("error_code")
            std_result["message"] = data.get("message")
            std_result["recoverable"] = data.get("recoverable", True)
            std_result["suggestion"] = data.get("suggestion")

        intent = resolve_intent(tool_name, std_result)

        if is_composite:
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
            ):
                final_layout = LayoutType.CARD

    if not all_components:
        return None

    return UISchemaV1(
        version="1.0",
        layout=final_layout,
        components=all_components,
        metadata=None,
    )
