"""
Unit tests for the Presentation Layer Builder.
Ensures tool results are correctly mapped to UI Schema V1 components and actions.
"""

from app.core.presentation.builder import build_ui_schema, resolve_intent
from app.core.presentation.ui_schema import ActionType, ComponentType, LayoutType


def test_resolve_intent_mapping():
    assert (
        resolve_intent(
            "get_user_pets",
            {"success": True, "data": {"pets": [{"id": 1}]}},
        )
        == "show_pet_list"
    )
    assert (
        resolve_intent(
            "search_clinics_nearby",
            {"success": True, "data": {"clinics": [{"id": 1}]}},
        )
        == "show_clinic_list"
    )
    assert (
        resolve_intent(
            "check_available_slots",
            {
                "success": True,
                "data": {"available_slots": [{"startTime": "08:00"}]},
            },
        )
        == "show_available_slots"
    )
    assert (
        resolve_intent(
            "search_clinics_nearby",
            {"success": True, "data": {"clinics": []}},
        )
        == "show_empty"
    )
    assert (
        resolve_intent("any_tool", {"success": False, "error": {"message": "Fail"}})
        == "show_error"
    )
    assert (
        resolve_intent("unknown_utility_tool", {"success": True, "data": {}})
        == "show_text"
    )
    assert (
        resolve_intent(
            "generate_clinic_services",
            {"success": True, "data": {"suggestions": [{"name": "Khám tổng quát"}]}},
        )
        == "show_clinic_service_suggestions"
    )
    assert (
        resolve_intent(
            "list_clinic_services",
            {"success": True, "data": {"services": [{"service_id": "svc-1"}]}},
        )
        == "show_clinic_service_catalog"
    )
    assert (
        resolve_intent(
            "update_service_info",
            {
                "success": True,
                "data": {
                    "service_id": "svc-1",
                    "changes": {"basePrice": {"new": 100000}},
                },
            },
        )
        == "show_service_update_preview"
    )


def test_build_ui_schema_single_clinic():
    tool_results = [
        {
            "tool_name": "search_clinics_nearby",
            "success": True,
            "data": {
                "clinics": [
                    {
                        "id": "c1",
                        "name": "Petties Clinic A",
                        "address": "123 District 1",
                    }
                ]
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    assert schema.version == "1.0"
    assert len(schema.components) == 1

    comp = schema.components[0]
    assert comp.type == ComponentType.CLINIC_CARD
    assert comp.data["id"] == "c1"
    assert comp.data["name"] == "Petties Clinic A"
    assert len(comp.actions) == 1
    assert comp.actions[0].type == ActionType.SELECT_ITEM
    assert comp.actions[0].payload["item_id"] == "c1"
    assert comp.actions[0].payload["item_type"] == "clinic"


def test_build_ui_schema_service_group_supports_multi_select():
    tool_results = [
        {
            "tool_name": "get_clinic_services",
            "success": True,
            "data": {
                "clinic_id": "clinic-1",
                "services": [
                    {"id": "svc-1", "name": "Khám tổng quát cho chó"},
                    {"id": "svc-2", "name": "Tiêm phòng"},
                ],
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    assert [component.type for component in schema.components] == [
        ComponentType.SERVICE_CHIP,
        ComponentType.SERVICE_CHIP,
        ComponentType.BUTTON,
    ]
    group_ids = {
        schema.components[0].data["group_id"],
        schema.components[1].data["group_id"],
        schema.components[2].data["group_id"],
    }
    assert len(group_ids) == 1
    assert schema.components[2].actions[0].type == ActionType.SELECT_SERVICES
    assert schema.components[2].actions[0].payload["clinic_id"] == "clinic-1"
    assert schema.components[0].actions[0].label == "Chọn"
    assert schema.components[2].actions[0].label == "Tiếp tục"


def test_build_ui_schema_available_slots_include_booking_context():
    tool_results = [
        {
            "tool_name": "check_available_slots",
            "success": True,
            "data": {
                "resolved_clinic_id": "clinic-1",
                "date": "2026-03-27",
                "resolved_service_ids": ["svc-1"],
                "resolved_service_names": ["Khám tổng quát cho chó"],
                "available_slots": [{"start_time": "09:00"}],
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    assert schema.layout == LayoutType.SLOT_GRID
    slot = schema.components[0]
    assert slot.type == ComponentType.SLOT_BUTTON
    assert slot.actions[0].payload["clinic_id"] == "clinic-1"
    assert slot.actions[0].payload["booking_date"] == "2026-03-27"
    assert slot.actions[0].payload["service_ids"] == ["svc-1"]


def test_build_ui_schema_error_state():
    tool_results = [
        {
            "tool_name": "create_booking_for_user",
            "success": False,
            "error": {
                "error_code": "CLINIC_UNAVAILABLE",
                "message": "Phòng khám hiện không hoạt động vào giờ này.",
                "recoverable": True,
                "suggestion": "Chọn giờ khác",
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    assert len(schema.components) == 1
    assert schema.components[0].type == ComponentType.ERROR_CARD
    assert schema.components[0].data["error_code"] == "CLINIC_UNAVAILABLE"
    actions = schema.components[0].actions
    action_types = [action.type for action in actions]
    assert ActionType.RETRY_WITH_CHANGE in action_types
    assert ActionType.CANCEL_FLOW in action_types


def test_build_ui_schema_error_state_fallback_retry_label_when_suggestion_null():
    tool_results = [
        {
            "tool_name": "create_booking_for_user",
            "success": False,
            "error": {
                "error_code": "UNKNOWN",
                "message": "Đã có lỗi xảy ra",
                "recoverable": True,
                "suggestion": None,
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    actions = schema.components[0].actions
    assert actions is not None
    assert actions[0].type == ActionType.RETRY_WITH_CHANGE
    assert actions[0].label == "Thử lại"


def test_build_ui_schema_error_state_uses_business_title():
    tool_results = [
        {
            "tool_name": "create_booking_for_user",
            "success": False,
            "error": {
                "error_code": "CONFIRMATION_REQUIRED",
                "message": "Cần xác nhận lại trước khi tạo booking.",
                "recoverable": True,
                "suggestion": "Xác nhận lại booking",
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    assert schema.components[0].data["title"] == "Cần xác nhận lại booking"


def test_build_ui_schema_empty_state_has_retry_action_and_suggestion_action():
    tool_results = [
        {
            "tool_name": "search_clinics_nearby",
            "success": True,
            "data": {"clinics": [], "message": "Không tìm thấy phòng khám phù hợp."},
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    component = schema.components[0]
    assert component.type == ComponentType.EMPTY_STATE
    assert component.data["suggestion_action"]["type"] == "retry_with_change"
    assert component.actions is not None
    assert component.actions[0].type == ActionType.RETRY_WITH_CHANGE


def test_build_ui_schema_not_empty_when_one_list_has_data():
    tool_results = [
        {
            "tool_name": "check_vaccination_status",
            "success": True,
            "data": {
                "pet_id": "pet-1",
                "history": [{"name": "Dại"}],
                "upcoming": [],
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    assert schema.components[0].type == ComponentType.VACCINATION_CARD


def test_booking_preview_maps_to_native_confirm_not_chat_confirm():
    tool_results = [
        {
            "tool_name": "create_booking_for_user",
            "success": True,
            "data": {
                "success": False,
                "next_best_action": "confirm_booking",
                "booking_preview": {
                    "clinic_id": "c1",
                    "clinic_name": "Petties Clinic",
                    "pet_id": "p1",
                    "booking_date": "2026-03-25",
                    "start_time": "09:00",
                    "service_ids": ["svc-1"],
                    "booking_type": "IN_CLINIC",
                },
                "services": ["Khám tổng quát cho chó"],
                "message": "Mình đã có đủ dữ liệu cơ bản.",
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    summary = schema.components[0]
    assert summary.type == ComponentType.BOOKING_SUMMARY
    assert summary.actions is not None
    assert summary.actions[0].type == ActionType.OPEN_NATIVE_CONFIRM
    assert summary.actions[0].label == "Mở màn xác nhận"
    assert summary.actions[0].payload["clinic_id"] == "c1"
    assert summary.actions[0].payload["service_ids"] == ["svc-1"]
    assert summary.data["service_names"] == ["Khám tổng quát cho chó"]


def test_generate_clinic_services_builds_service_cards_with_native_confirm():
    tool_results = [
        {
            "tool_name": "generate_clinic_services",
            "success": True,
            "data": {
                "suggestions": [
                    {
                        "name": "Khám tổng quát",
                        "description": "Khám sức khỏe định kỳ",
                        "basePrice": 150000,
                        "slotsRequired": 1,
                        "durationTime": 30,
                        "serviceCategory": "HEALTHCARE",
                        "petType": "DOG",
                    }
                ]
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    assert schema.layout == LayoutType.GRID
    assert schema.components[0].type == ComponentType.BUTTON
    assert (
        schema.components[0].actions[0].payload["confirm_action"]["type"]
        == ActionType.CONFIRM_SERVICE_BATCH_CREATE.value
    )
    component = schema.components[1]
    assert component.type == ComponentType.SERVICE_CARD
    assert component.data["name"] == "Khám tổng quát"
    assert component.actions is not None
    assert component.actions[0].type == ActionType.OPEN_NATIVE_CONFIRM
    confirm_action = component.actions[0].payload["confirm_action"]
    assert confirm_action["type"] == ActionType.CONFIRM_SERVICE_CREATE.value
    assert confirm_action["payload"]["base_price"] == 150000
    assert confirm_action["payload"]["slots_required"] == 1


def test_update_service_info_builds_confirmable_preview_card():
    tool_results = [
        {
            "tool_name": "update_service_info",
            "success": True,
            "data": {
                "service_id": "svc-1",
                "service_name": "Tiêm phòng",
                "changes": {
                    "basePrice": {"new": 220000, "label": "Giá (VND)"},
                    "isActive": {
                        "new": True,
                        "label": "Trạng thái",
                        "new_label": "Hoạt động",
                    },
                },
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    assert schema.layout == LayoutType.CARD
    component = schema.components[0]
    assert component.type == ComponentType.SERVICE_CARD
    assert "Giá (VND): 220000" in component.data["description"]
    assert component.actions is not None
    assert component.actions[0].type == ActionType.OPEN_NATIVE_CONFIRM
    confirm_action = component.actions[0].payload["confirm_action"]
    assert confirm_action["type"] == ActionType.CONFIRM_SERVICE_UPDATE.value
    assert confirm_action["payload"]["service_id"] == "svc-1"


def test_booking_session_draft_maps_to_summary_with_form_handoff():
    tool_results = [
        {
            "tool_name": "update_booking_draft",
            "success": True,
            "data": {
                "message": "Đã cập nhật booking draft.",
                "state": {
                    "draft": {
                        "clinic_id": "clinic-1",
                        "clinic_name": "Petties Clinic",
                        "pet_id": "pet-1",
                        "booking_date": "2026-04-04",
                        "service_ids": ["svc-1"],
                        "service_names": ["Khám tổng quát"],
                        "booking_type": "IN_CLINIC",
                    }
                },
                "missing_fields": ["start_time"],
                "next_best_action": "fill_booking_form",
                "ready_for_review": False,
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    assert schema.layout == LayoutType.CARD
    summary = schema.components[0]
    assert summary.type == ComponentType.BOOKING_SUMMARY
    assert summary.actions is not None
    assert summary.actions[0].type == ActionType.OPEN_NATIVE_CONFIRM
    assert summary.actions[0].label == "Mở form đặt lịch"
    assert summary.actions[0].payload["next_best_action"] == "fill_booking_form"
    assert summary.actions[0].payload["missing_fields"] == ["start_time"]
    assert summary.data["missing_fields"] == ["start_time"]
    assert summary.data["ready_to_create"] is False
