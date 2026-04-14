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
            "generate_clinic_services",
            {
                "success": True,
                "data": {
                    "needs_clarification": True,
                    "clinics": [{"id": "clinic-1", "name": "Petties Hà Nội"}],
                },
            },
        )
        == "show_clinic_list"
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


def test_build_ui_schema_clinic_card_uses_clinic_id_fallback_for_actions():
    tool_results = [
        {
            "tool_name": "get_my_clinics",
            "success": True,
            "data": {
                "clinics": [
                    {
                        "clinicId": "clinic-legacy-1",
                        "name": "Petties Clinic Legacy",
                        "address": "123 District 1",
                    }
                ]
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    assert len(schema.components) == 1
    comp = schema.components[0]
    assert comp.type == ComponentType.CLINIC_CARD
    assert comp.data["id"] == "clinic-legacy-1"
    assert comp.actions is not None
    assert comp.actions[0].payload["item_id"] == "clinic-legacy-1"
    assert comp.actions[0].payload["item_type"] == "clinic"


def test_build_ui_schema_matched_clinic_avoids_redundant_manual_selection_action():
    tool_results = [
        {
            "tool_name": "get_my_clinics",
            "success": True,
            "data": {
                "clinics": [
                    {
                        "clinicId": "clinic-1",
                        "name": "Petties Clinic",
                        "address": "Q1",
                    },
                    {
                        "clinicId": "clinic-2",
                        "name": "Clinic B",
                        "address": "Q2",
                    },
                ],
                "matched_clinic": {
                    "clinicId": "clinic-1",
                    "name": "Petties Clinic",
                    "address": "Q1",
                },
                "target_clinic_id": "clinic-1",
                "needs_clarification": False,
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    assert len(schema.components) == 1
    comp = schema.components[0]
    assert comp.type == ComponentType.CLINIC_CARD
    assert comp.data["id"] == "clinic-1"
    assert comp.actions is None


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


def test_build_ui_schema_service_group_keeps_service_details_for_copilot():
    tool_results = [
        {
            "tool_name": "get_clinic_services",
            "success": True,
            "data": {
                "clinic_id": "clinic-1",
                "services": [
                    {
                        "id": "svc-1",
                        "name": "Tắm chó",
                        "service_category": "GROOMING",
                        "pet_type": "DOG",
                        "base_price": 120000,
                        "duration_minutes": 45,
                        "slots_required": 2,
                        "is_home_visit": False,
                        "weight_prices": [
                            {"min_weight": 0, "max_weight": 10, "price": 120000}
                        ],
                    }
                ],
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    first_service_chip = schema.components[0]
    assert first_service_chip.type == ComponentType.SERVICE_CHIP
    assert first_service_chip.data["service_category"] == "GROOMING"
    assert first_service_chip.data["pet_type"] == "DOG"
    assert first_service_chip.data["base_price"] == 120000
    assert first_service_chip.data["duration_minutes"] == 45
    assert first_service_chip.data["slots_required"] == 2
    assert first_service_chip.data["is_home_visit"] is False
    assert first_service_chip.data["weight_prices"][0]["price"] == 120000


def test_build_ui_schema_service_group_prefers_full_services_over_matched_subset():
    tool_results = [
        {
            "tool_name": "get_clinic_services",
            "success": True,
            "data": {
                "clinic_id": "clinic-1",
                "matched_services": [
                    {"id": "svc-1", "name": "Tắm chó"},
                ],
                "services": [
                    {"id": "svc-1", "name": "Tắm chó"},
                    {"id": "svc-2", "name": "Cắt móng"},
                    {"id": "svc-3", "name": "Vệ sinh tai"},
                ],
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    service_chips = [
        component
        for component in schema.components
        if component.type == ComponentType.SERVICE_CHIP
    ]
    assert len(service_chips) == 3
    assert {chip.data["name"] for chip in service_chips} == {
        "Tắm chó",
        "Cắt móng",
        "Vệ sinh tai",
    }


def test_build_ui_schema_service_group_uses_canonical_display_name_from_backend():
    tool_results = [
        {
            "tool_name": "get_clinic_services",
            "success": True,
            "data": {
                "clinic_id": "clinic-1",
                "services": [
                    {
                        "id": "svc-1",
                        "name": "Tắm",
                        "display_name": "Tắm chó",
                        "pet_type": "DOG",
                    }
                ],
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    service_chip = next(
        component
        for component in schema.components
        if component.type == ComponentType.SERVICE_CHIP
    )
    assert service_chip.data["name"] == "Tắm chó"
    assert service_chip.actions is not None
    assert service_chip.actions[0].payload["service_name"] == "Tắm chó"


def test_build_ui_schema_service_group_includes_resolved_clinic_name_from_db():
    tool_results = [
        {
            "tool_name": "get_clinic_services",
            "success": True,
            "data": {
                "clinic_id": "clinic-petcare-1",
                "resolved_clinic_id": "clinic-petcare-1",
                "resolved_clinic": {
                    "id": "clinic-petcare-1",
                    "name": "Phòng khám thú y Petcare",
                },
                "services": [
                    {"id": "svc-1", "name": "Tắm chó"},
                ],
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    service_chip = next(
        component
        for component in schema.components
        if component.type == ComponentType.SERVICE_CHIP
    )
    assert service_chip.data["clinic_id"] == "clinic-petcare-1"
    assert service_chip.data["clinic_name"] == "Phòng khám thú y Petcare"
    assert service_chip.actions[0].payload["clinic_name"] == "Phòng khám thú y Petcare"


def test_build_ui_schema_unwraps_read_resource_to_booking_service_intent():
    tool_results = [
        {
            "tool_name": "read_resource",
            "success": True,
            "data": {
                "resource_name": "clinic_services",
                "deprecated_tool": "list_clinic_services",
                "payload": {
                    "clinic_id": "clinic-1",
                    "services": [
                        {"id": "svc-1", "name": "Tắm chó"},
                        {"id": "svc-2", "name": "Khám tổng quát"},
                    ],
                },
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    component_types = [component.type for component in schema.components]
    assert ComponentType.SERVICE_CHIP in component_types
    assert all(
        not (
            component.type == ComponentType.TEXT
            and component.data.get("content") == "Read Resource"
        )
        for component in schema.components
    )


def test_build_ui_schema_unwraps_read_resource_slot_availability_to_booking_slots():
    tool_results = [
        {
            "tool_name": "read_resource",
            "success": True,
            "data": {
                "resource_name": "slot_availability",
                "deprecated_tool": "get_slot_availability",
                "payload": {
                    "resolved_clinic_id": "clinic-1",
                    "date": "2026-04-15",
                    "available_slots": [{"start_time": "09:00"}],
                },
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    assert schema.layout == LayoutType.SLOT_GRID
    slot = schema.components[0]
    assert slot.type == ComponentType.SLOT_BUTTON
    assert slot.actions[0].payload["clinic_id"] == "clinic-1"
    assert slot.actions[0].payload["booking_date"] == "2026-04-15"


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


def test_build_ui_schema_skips_redundant_clinic_list_when_service_already_resolved():
    tool_results = [
        {
            "tool_name": "get_clinic_services",
            "success": True,
            "data": {
                "resolved_clinic_id": "clinic-1",
                "services": [{"id": "svc-1", "name": "Khám tổng quát"}],
                "total_services": 1,
            },
        },
        {
            "tool_name": "get_my_clinics",
            "success": True,
            "data": {
                "clinics": [
                    {"id": "clinic-1", "name": "Petties Clinic", "address": "Q1"}
                ],
                "matched_clinic": {"id": "clinic-1", "name": "Petties Clinic"},
                "needs_clarification": False,
                "target_clinic_id": "clinic-1",
            },
        },
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    component_types = [component.type for component in schema.components]
    assert ComponentType.CLINIC_CARD not in component_types
    assert ComponentType.SERVICE_CHIP in component_types


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


def test_generate_clinic_services_update_recommendation_maps_to_service_update_confirm():
    tool_results = [
        {
            "tool_name": "generate_clinic_services",
            "success": True,
            "data": {
                "suggestions": [
                    {
                        "service_id": "svc-1",
                        "service_name": "Khám tổng quát",
                        "name": "Khám tổng quát",
                        "display_name": "Khám tổng quát",
                        "description": "Đề xuất cập nhật",
                        "basePrice": 180000,
                        "slotsRequired": 2,
                        "durationTime": 35,
                        "serviceCategory": "HEALTHCARE",
                        "petType": "DOG",
                        "recommended_action": "update",
                        "proposed_updates": {
                            "base_price": 180000,
                            "duration_time": 35,
                            "slots_required": 2,
                        },
                    }
                ]
            },
        }
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    component = schema.components[0]
    assert component.type == ComponentType.SERVICE_CARD
    assert component.actions is not None
    confirm_action = component.actions[0].payload["confirm_action"]
    assert confirm_action["type"] == ActionType.CONFIRM_SERVICE_UPDATE.value
    assert confirm_action["payload"]["service_id"] == "svc-1"
    assert confirm_action["payload"]["base_price"] == 180000


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


def test_booking_summary_maps_to_form_handoff():
    tool_results = [
        {
            "tool_name": "create_booking_for_user",
            "success": True,
            "data": {
                "message": "Đã tạo bản tóm tắt booking.",
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


def test_build_ui_schema_skips_redundant_clinic_list_when_slot_check_errors_but_context_exists():
    tool_results = [
        {
            "tool_name": "search_clinics_nearby",
            "success": True,
            "data": {
                "clinics": [
                    {
                        "id": "clinic-1",
                        "name": "Bệnh viện thú y PetCare",
                        "address": "Đà Nẵng",
                    }
                ],
                "matched_clinic": {
                    "id": "clinic-1",
                    "name": "Bệnh viện thú y PetCare",
                },
                "target_clinic_id": "clinic-1",
                "needs_clarification": False,
            },
        },
        {
            "tool_name": "get_clinic_services",
            "success": True,
            "data": {
                "resolved_clinic_id": "clinic-1",
                "resolved_service_ids": ["svc-1"],
                "resolved_service_names": ["Vắc-xin 5 bệnh (Chó)"],
                "services": [
                    {
                        "id": "svc-1",
                        "name": "Vắc-xin 5 bệnh (Chó)",
                    }
                ],
            },
        },
        {
            "tool_name": "check_available_slots",
            "success": False,
            "error": {
                "error_code": "INTERNAL_ERROR",
                "message": "Không thể kiểm tra slot lúc này",
                "recoverable": True,
                "date": "2026-04-14",
                "resolved_clinic_id": "clinic-1",
                "resolved_service_ids": ["svc-1"],
                "resolved_service_names": ["Vắc-xin 5 bệnh (Chó)"],
            },
        },
    ]

    schema = build_ui_schema(tool_results)

    assert schema is not None
    component_types = [component.type for component in schema.components]
    assert ComponentType.CLINIC_CARD not in component_types
    assert ComponentType.BOOKING_SUMMARY in component_types
