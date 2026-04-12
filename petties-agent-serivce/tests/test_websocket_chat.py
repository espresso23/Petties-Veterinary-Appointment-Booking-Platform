from pathlib import Path
import json
import sys
import types
import unittest
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

motor_module = types.ModuleType("motor")
motor_asyncio_module = types.ModuleType("motor.motor_asyncio")
motor_asyncio_module.AsyncIOMotorClient = object
motor_asyncio_module.AsyncIOMotorDatabase = object
sys.modules.setdefault("motor", motor_module)
sys.modules.setdefault("motor.motor_asyncio", motor_asyncio_module)

from app.api.middleware.auth import CurrentUser
from app.api.schemas.websocket_schemas import (
    AckMessage,
    AgentInfoMessage,
    ConnectedMessage,
    UISchemaMessage,
)
from app.api.websocket import chat as websocket_chat
from app.core.chat_context import BUSINESS_CHAT
from app.core.tool_runtime_context import ToolRuntimeContext


class FakeSessionContext:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeAgent:
    name = "petties_agent"
    agent_type = "single_agent"
    enabled_tools = ["pet_knowledge_search", "web_search"]

    async def stream(self, user_message, session_id, **kwargs):
        yield {"type": "final_answer", "content": "phan hoi test"}


class FakeStreamingAgent:
    async def stream(self, user_message, session_id, **kwargs):
        yield {"type": "final_answer", "content": "phan hoi test"}


class FakeThoughtStreamingAgent:
    async def stream(self, user_message, session_id, **kwargs):
        yield {
            "type": "react_step",
            "step": {
                "step_type": "thought",
                "content": "Thought: Tôi sẽ kiểm tra lịch trống trước khi đề xuất cho người dùng.",
            },
        }
        yield {"type": "final_answer", "content": "phan hoi test"}


class FakeUiSchemaAgent:
    async def stream(self, user_message, session_id, **kwargs):
        yield {
            "type": "react_step",
            "step": {
                "step_type": "observation",
                "tool_name": "get_user_pets",
                "tool_result": {
                    "success": True,
                    "data": {
                        "success": True,
                        "data": {
                            "pets": [
                                {
                                    "id": "pet-1",
                                    "name": "Mimi",
                                    "species": "CAT",
                                }
                            ]
                        },
                    },
                    "tool_name": "get_user_pets",
                },
            },
        }
        yield {"type": "final_answer", "content": "Minh tim thay thu cung cua ban."}


class FakeWebSocket:
    def __init__(self, query_params=None):
        self.query_params = query_params or {}
        self.client_state = websocket_chat.WebSocketState.CONNECTING
        self.close_code = None
        self.close_reason = None

    async def accept(self):
        self.client_state = websocket_chat.WebSocketState.CONNECTED

    async def close(self, code=None, reason=None):
        self.close_code = code
        self.close_reason = reason

    async def receive_text(self):
        raise websocket_chat.WebSocketDisconnect()


class WebSocketChatTests(unittest.IsolatedAsyncioTestCase):
    async def test_extract_latest_location_from_history_uses_previous_metadata(self):
        history = [
            {
                "role": "user",
                "content": "Tim phong kham gan toi",
                "metadata": {
                    "location": {
                        "lat": 15.9575,
                        "lng": 108.2575,
                        "address": "Ngu Hanh Son, Da Nang",
                    }
                },
            },
            {
                "role": "user",
                "content": "Toi muon chon kham tong quat",
                "metadata": {},
            },
        ]

        location = websocket_chat._extract_latest_location_from_history(history)

        self.assertEqual(location["lat"], 15.9575)
        self.assertEqual(location["lng"], 108.2575)
        self.assertEqual(location["address"], "Ngu Hanh Son, Da Nang")

    async def test_augment_content_with_metadata_embeds_compact_ui_action_json(self):
        content = "Toi chon phong kham Benh Vien Thu Y PetCare."
        metadata = {
            "ui_action": {
                "type": "select_clinic",
                "clinic_id": "clinic-1",
                "clinic_name": "Benh Vien Thu Y PetCare",
                "clinic_address": "FPT Complex Da Nang",
            }
        }

        enriched = websocket_chat._augment_content_with_metadata(content, metadata)

        self.assertIn(content, enriched)
        self.assertIn('"ui_action"', enriched)
        self.assertIn('"type":"select_clinic"', enriched)
        self.assertIn('"clinic_id":"clinic-1"', enriched)

    async def test_augment_content_with_metadata_embeds_structured_booking_update(self):
        metadata = {
            "ui_action": {
                "type": "change_time",
                "clinic_id": "clinic-1",
                "booking_date": "2026-03-21",
                "start_time": "09:00",
                "service_ids": ["svc-1"],
            }
        }

        enriched = websocket_chat._augment_content_with_metadata("", metadata)

        self.assertIn('"ui_action"', enriched)
        self.assertIn('"type":"change_time"', enriched)
        self.assertIn('"booking_date":"2026-03-21"', enriched)
        self.assertIn('"service_ids":["svc-1"]', enriched)

    async def test_normalize_ui_action_payload_rejects_unknown_field(self):
        payload = websocket_chat._normalize_ui_action_payload(
            {
                "type": "select_clinic",
                "clinic_id": "clinic-1",
                "unexpected": "x",
            }
        )

        self.assertIsNone(payload)

    async def test_parse_raw_message_reports_invalid_ui_action(self):
        parsed = websocket_chat._parse_raw_message(
            json.dumps(
                {
                    "message": "Chọn phòng khám",
                    "ui_action": {
                        "type": "select_slot",
                        "booking_date": "invalid-date",
                    },
                }
            ),
            agent_id=None,
            provider_override=None,
            model_override=None,
            images=None,
        )

        self.assertIsNone(parsed.ui_action)
        self.assertIn("booking_date", parsed.ui_action_error)

    async def test_parse_raw_message_extracts_context_data(self):
        parsed = websocket_chat._parse_raw_message(
            json.dumps(
                {
                    "message": "Gợi ý dịch vụ cho phòng khám hiện tại",
                    "context_data": {
                        "clinic_id": "clinic-active-1",
                        "route_path": "/clinic-owner/dashboard",
                        "quick_action": "owner_services",
                    },
                }
            ),
            agent_id=None,
            provider_override=None,
            model_override=None,
            images=None,
        )

        self.assertEqual(parsed.context_data.get("clinic_id"), "clinic-active-1")
        self.assertEqual(
            parsed.context_data.get("route_path"), "/clinic-owner/dashboard"
        )
        self.assertEqual(parsed.context_data.get("quick_action"), "owner_services")

    async def test_parse_raw_message_accepts_select_item_payload(self):
        parsed = websocket_chat._parse_raw_message(
            json.dumps(
                {
                    "message": "Chọn phòng khám",
                    "ui_action": {
                        "type": "select_item",
                        "item_id": "clinic-1",
                        "item_type": "clinic",
                        "source": "quick_booking",
                    },
                }
            ),
            agent_id=None,
            provider_override=None,
            model_override=None,
            images=None,
        )

        self.assertIsNone(parsed.ui_action_error)
        self.assertIsNotNone(parsed.ui_action)
        self.assertEqual(parsed.ui_action.get("type"), "select_item")
        self.assertEqual(parsed.ui_action.get("item_id"), "clinic-1")
        self.assertEqual(parsed.ui_action.get("item_type"), "clinic")

    async def test_parse_raw_message_synthesizes_message_for_empty_select_item(self):
        parsed = websocket_chat._parse_raw_message(
            json.dumps(
                {
                    "message": "",
                    "ui_action": {
                        "type": "select_item",
                        "item_id": "clinic-1",
                        "item_type": "clinic",
                        "clinic_name": "Pet Care Da Nang",
                    },
                }
            ),
            agent_id=None,
            provider_override=None,
            model_override=None,
            images=None,
        )

        self.assertIsNone(parsed.ui_action_error)
        self.assertIn("Tôi chọn phòng khám", parsed.user_message)
        self.assertIn("Pet Care Da Nang", parsed.user_message)

    async def test_resolve_runtime_clinic_id_prefers_select_item_ui_action(self):
        user = CurrentUser(
            user_id="owner-1",
            role="CLINIC_OWNER",
            clinic_id="clinic-from-user",
            is_admin=False,
        )

        resolved = websocket_chat._resolve_runtime_clinic_id_for_request(
            user,
            {"clinic_id": "clinic-from-context"},
            {
                "type": "select_item",
                "item_id": "clinic-selected",
                "item_type": "clinic",
            },
        )

        self.assertEqual(resolved, "clinic-selected")

    async def test_parse_raw_message_accepts_confirm_service_update_with_extended_fields(self):
        parsed = websocket_chat._parse_raw_message(
            json.dumps(
                {
                    "message": "Xác nhận cập nhật dịch vụ",
                    "ui_action": {
                        "type": "confirm_service_update",
                        "service_id": "svc-1",
                        "base_price": 250000,
                        "reminder_interval": 6,
                        "reminder_unit": "MONTH",
                        "weight_prices": [
                            {"min_weight": 0, "max_weight": 10, "price": 250000}
                        ],
                        "dose_prices": [
                            {"dose_number": 1, "dose_label": "Mũi 1", "price": 120000}
                        ],
                    },
                }
            ),
            agent_id=None,
            provider_override=None,
            model_override=None,
            images=None,
        )

        self.assertIsNone(parsed.ui_action_error)
        self.assertIsNotNone(parsed.ui_action)
        self.assertEqual(parsed.ui_action.get("type"), "confirm_service_update")
        self.assertEqual(parsed.ui_action.get("service_id"), "svc-1")
        self.assertEqual(parsed.ui_action.get("reminder_interval"), 6)
        self.assertEqual(parsed.ui_action.get("reminder_unit"), "MONTH")
        self.assertEqual(len(parsed.ui_action.get("weight_prices") or []), 1)
        self.assertEqual(len(parsed.ui_action.get("dose_prices") or []), 1)

    async def test_parse_raw_message_accepts_confirm_service_create(self):
        parsed = websocket_chat._parse_raw_message(
            json.dumps(
                {
                    "message": "Xác nhận tạo dịch vụ",
                    "ui_action": {
                        "type": "confirm_service_create",
                        "name": "Khám tổng quát",
                        "base_price": 150000,
                        "slots_required": 1,
                        "duration_time": 30,
                        "service_category": "HEALTHCARE",
                        "pet_type": "DOG",
                        "description": "Khám sức khỏe định kỳ",
                    },
                }
            ),
            agent_id=None,
            provider_override=None,
            model_override=None,
            images=None,
        )

        self.assertIsNone(parsed.ui_action_error)
        self.assertIsNotNone(parsed.ui_action)
        self.assertEqual(parsed.ui_action.get("type"), "confirm_service_create")
        self.assertEqual(parsed.ui_action.get("name"), "Khám tổng quát")

    async def test_parse_raw_message_accepts_confirm_service_batch_create(self):
        parsed = websocket_chat._parse_raw_message(
            json.dumps(
                {
                    "message": "Xác nhận tạo nhiều dịch vụ",
                    "ui_action": {
                        "type": "confirm_service_batch_create",
                        "services": [
                            {
                                "name": "Khám tổng quát",
                                "base_price": 150000,
                                "slots_required": 1,
                                "duration_time": 30,
                                "service_category": "HEALTHCARE",
                                "pet_type": "DOG",
                            },
                            {
                                "name": "Tiêm phòng",
                                "base_price": 120000,
                                "slots_required": 1,
                                "duration_time": 15,
                                "service_category": "VACCINATION",
                                "pet_type": "CAT",
                            },
                        ],
                    },
                }
            ),
            agent_id=None,
            provider_override=None,
            model_override=None,
            images=None,
        )

        self.assertIsNone(parsed.ui_action_error)
        self.assertIsNotNone(parsed.ui_action)
        self.assertEqual(parsed.ui_action.get("type"), "confirm_service_batch_create")
        self.assertEqual(len(parsed.ui_action.get("services") or []), 2)

    async def test_handle_chat_message_passes_role_and_context_to_factory(self):
        captured = {}

        async def fake_get_agent(**kwargs):
            captured.update(kwargs)
            return FakeAgent()

        async def fake_save_chat_message(data):
            return data

        async def fake_touch_chat_session(session_id, data=None):
            return {"session_id": session_id, "data": data}

        async def fake_send_message(session_id, payload):
            return {"session_id": session_id, "payload": payload}

        user = CurrentUser(user_id="user-1", role="PET_OWNER", is_admin=False)

        with (
            patch.object(websocket_chat.AgentFactory, "get_agent", fake_get_agent),
            patch.object(
                websocket_chat, "AsyncSessionLocal", lambda: FakeSessionContext()
            ),
            patch.object(websocket_chat, "save_chat_message", fake_save_chat_message),
            patch.object(websocket_chat, "touch_chat_session", fake_touch_chat_session),
            patch.object(websocket_chat.manager, "send_message", fake_send_message),
        ):
            await websocket_chat.handle_chat_message(
                websocket=None,
                session_id="session-1",
                user=user,
                session_context=BUSINESS_CHAT,
                message=json.dumps({"message": "Xin chao"}),
                auth_token="jwt-token",
            )

        self.assertEqual(captured["user_role"], "PET_OWNER")
        self.assertEqual(captured["context_type"], BUSINESS_CHAT)

    async def test_handle_chat_message_propagates_auth_token_to_runtime_context(self):
        captured_context = {}

        async def fake_get_agent(**kwargs):
            return FakeAgent()

        async def fake_save_chat_message(data):
            return data

        async def fake_touch_chat_session(session_id, data=None):
            return {"session_id": session_id, "data": data}

        async def fake_send_message(session_id, payload):
            return {"session_id": session_id, "payload": payload}

        def fake_set_tool_runtime_context(context):
            captured_context["value"] = context
            return "runtime-token"

        def fake_reset_tool_runtime_context(token):
            return None

        user = CurrentUser(user_id="user-1", role="PET_OWNER", is_admin=False)

        with (
            patch.object(websocket_chat.AgentFactory, "get_agent", fake_get_agent),
            patch.object(
                websocket_chat, "AsyncSessionLocal", lambda: FakeSessionContext()
            ),
            patch.object(websocket_chat, "save_chat_message", fake_save_chat_message),
            patch.object(websocket_chat, "touch_chat_session", fake_touch_chat_session),
            patch.object(
                websocket_chat,
                "set_tool_runtime_context",
                fake_set_tool_runtime_context,
            ),
            patch.object(
                websocket_chat,
                "reset_tool_runtime_context",
                fake_reset_tool_runtime_context,
            ),
            patch.object(websocket_chat.manager, "send_message", fake_send_message),
        ):
            await websocket_chat.handle_chat_message(
                websocket=None,
                session_id="session-1",
                user=user,
                session_context=BUSINESS_CHAT,
                message=json.dumps({"message": "Xin chao"}),
                auth_token="jwt-token",
            )

        self.assertEqual(captured_context["value"].auth_token, "jwt-token")
        self.assertEqual(captured_context["value"].user_id, "user-1")
        self.assertEqual(captured_context["value"].context_type, BUSINESS_CHAT)

    async def test_handle_chat_message_rejects_invalid_ui_action_before_save(self):
        sent_payloads = []

        async def fake_send_message(session_id, payload):
            sent_payloads.append(payload)
            return {"session_id": session_id, "payload": payload}

        async def fake_touch_chat_session(session_id, data=None):
            return {"session_id": session_id, "data": data}

        save_mock = AsyncMock(return_value=True)
        user = CurrentUser(user_id="user-1", role="PET_OWNER", is_admin=False)

        with (
            patch.object(websocket_chat, "save_chat_message", save_mock),
            patch.object(websocket_chat, "touch_chat_session", fake_touch_chat_session),
            patch.object(websocket_chat.manager, "send_message", fake_send_message),
        ):
            await websocket_chat.handle_chat_message(
                websocket=None,
                session_id="session-1",
                user=user,
                session_context=BUSINESS_CHAT,
                message=json.dumps(
                    {
                        "message": "Chọn lịch",
                        "ui_action": {
                            "type": "select_slot",
                            "booking_date": "2026/03/30",
                            "start_time": "09:00",
                        },
                    }
                ),
                auth_token="jwt-token",
            )

        save_mock.assert_not_awaited()
        error_payload = next(
            payload for payload in sent_payloads if payload.get("type") == "error"
        )
        self.assertEqual(error_payload["error_code"], "INVALID_UI_ACTION")

    async def test_websocket_close_reasons_are_stable_constants(self):
        self.assertEqual(websocket_chat.WS_REASON_AUTH_REQUIRED, "CHAT_AUTH_REQUIRED")
        self.assertEqual(websocket_chat.WS_REASON_INVALID_AUTH, "CHAT_INVALID_AUTH")
        self.assertEqual(
            websocket_chat.WS_REASON_SESSION_FORBIDDEN,
            "CHAT_SESSION_FORBIDDEN",
        )
        self.assertEqual(
            websocket_chat.WS_REASON_PLAYGROUND_FORBIDDEN,
            "CHAT_PLAYGROUND_FORBIDDEN",
        )

    async def test_map_react_step_to_message_includes_normalized_react_step(self):
        payload = websocket_chat.map_react_step_to_message(
            {
                "step_type": "thought",
                "content": "Toi se tim phong kham gan ban",
                "tool_name": "search_clinics_nearby",
                "tool_params": {"radius_km": 5},
            },
            0,
        )

        self.assertEqual(payload["type"], "thinking")
        self.assertEqual(payload["step_index"], 0)
        self.assertIn("react_step", payload)
        self.assertEqual(payload["react_step"]["step_type"], "thought")
        self.assertEqual(
            payload["react_step"]["tool_name"],
            "search_clinics_nearby",
        )

    async def test_stream_and_collect_emits_booking_state_update(self):
        sent_payloads = []

        async def fake_send_message(session_id, payload):
            sent_payloads.append(payload)
            return {"session_id": session_id, "payload": payload}

        runtime_context = ToolRuntimeContext(
            user_id="user-1",
            role="PET_OWNER",
            session_id="session-1",
            booking_state={
                "active": True,
                "status": "COLLECTING",
                "draft": {"pet_id": "pet-1"},
            },
        )

        with (
            patch.object(websocket_chat.manager, "send_message", fake_send_message),
            patch.object(
                websocket_chat, "get_tool_runtime_context", lambda: runtime_context
            ),
        ):
            (
                full_response,
                react_trace,
                step_index,
                persisted_ui_schema,
            ) = await websocket_chat._stream_and_collect(
                FakeStreamingAgent(),
                "Dat lich cho Mimi",
                "session-1",
                images=None,
                location=None,
                chat_history=[],
                user_role="PET_OWNER",
            )

        self.assertEqual(full_response, "phan hoi test")
        self.assertEqual(react_trace, [])
        self.assertEqual(step_index, 0)
        self.assertTrue(
            any(
                payload.get("type") == "booking_state_update"
                for payload in sent_payloads
            )
        )
        booking_update = next(
            payload
            for payload in sent_payloads
            if payload.get("type") == "booking_state_update"
        )
        self.assertEqual(booking_update["stage"], "COLLECTING")

    async def test_stream_and_collect_uses_client_safe_thinking_stream(self):
        sent_payloads = []

        async def fake_send_message(session_id, payload):
            sent_payloads.append(payload)
            return {"session_id": session_id, "payload": payload}

        with patch.object(websocket_chat.manager, "send_message", fake_send_message):
            await websocket_chat._stream_and_collect(
                FakeThoughtStreamingAgent(),
                "Dat lich cho Mimi",
                "session-1",
                images=None,
                location=None,
                chat_history=[],
                user_role="PET_OWNER",
            )

        thinking_payload = next(
            payload
            for payload in sent_payloads
            if payload.get("type") == "thinking_stream"
        )
        self.assertNotIn("Thought:", thinking_payload["content"])
        self.assertNotIn("🧠", thinking_payload["content"])
        self.assertTrue(thinking_payload["content"].startswith("Đang suy luận:"))
        self.assertEqual(thinking_payload["step_index"], 0)

    async def test_stream_and_collect_emits_ui_schema_when_tool_result_available(self):
        sent_payloads = []

        async def fake_send_message(session_id, payload):
            sent_payloads.append(payload)
            return {"session_id": session_id, "payload": payload}

        with patch.object(websocket_chat.manager, "send_message", fake_send_message):
            (
                _,
                _,
                _,
                persisted_ui_schema,
            ) = await websocket_chat._stream_and_collect(
                FakeUiSchemaAgent(),
                "Dat lich cho Mimi",
                "session-1",
                images=None,
                location=None,
                chat_history=[],
                user_role="PET_OWNER",
            )

        self.assertIsNotNone(persisted_ui_schema)
        ui_schema_payload = next(
            payload for payload in sent_payloads if payload.get("type") == "ui_schema"
        )
        self.assertIn("ui_schema", ui_schema_payload)
        self.assertIsInstance(ui_schema_payload["ui_schema"].get("components"), list)

    def test_map_react_step_to_message_formats_action_as_reasoning(self):
        payload = websocket_chat.map_react_step_to_message(
            {
                "step_type": "action",
                "tool_name": "pet_knowledge_search",
                "tool_params": {"query": "Chó bị nôn mửa thì nên làm gì?"},
                "content": "Called pet_knowledge_search",
            },
            1,
        )

        self.assertEqual(payload["type"], "tool_call")
        self.assertIn("Đang suy luận:", payload["content"])
        self.assertIn("tổng hợp", payload["content"])

    def test_map_react_step_to_message_formats_observation_as_reasoning(self):
        payload = websocket_chat.map_react_step_to_message(
            {
                "step_type": "observation",
                "tool_name": "web_search",
                "tool_result": {"success": True},
                "content": "Tìm thấy 3 kết quả liên quan đến cách xử lý chó bị nôn.",
            },
            2,
        )

        self.assertEqual(payload["type"], "tool_result")
        self.assertIn("Đang suy luận:", payload["content"])
        self.assertIn("đang rút ý chính", payload["content"])

    def test_map_react_step_to_message_observation_hides_structured_json_payload(self):
        payload = websocket_chat.map_react_step_to_message(
            {
                "step_type": "observation",
                "tool_name": "get_my_clinics",
                "content": (
                    "Đã truy xuất danh sách phòng khám. "
                    '{"matched_clinic":{"clinicId":"clinic-1","name":"Petties"}}'
                ),
            },
            3,
        )

        self.assertEqual(payload["type"], "tool_result")
        self.assertIn("Đang suy luận:", payload["content"])
        self.assertNotIn("clinicId", payload["content"])
        self.assertNotIn("{", payload["content"])

    def test_sanitize_assistant_response_removes_markdown_bold_and_normalizes_bullets(
        self,
    ):
        text = (
            "Dưới đây là những việc bạn có thể làm ngay:\n\n"
            "**Bạn nên làm gì ngay bây giờ:**\n\n"
            "1.  **Ngừng cho ăn uống:** Tạm thời không cho ăn.\n"
            "*   Chó nôn liên tục, không ngừng hoặc nôn ra máu."
        )

        sanitized = websocket_chat.sanitize_assistant_response(
            text,
            user_message="chó bị nôn mửa thì nên làm gì",
            has_prior_assistant_message=True,
        )

        self.assertNotIn("**", sanitized)
        self.assertIn("Bạn nên làm gì ngay bây giờ:", sanitized)
        self.assertIn("1. Ngừng cho ăn uống:", sanitized)
        self.assertIn("- Chó nôn liên tục, không ngừng hoặc nôn ra máu.", sanitized)

    def test_sanitize_assistant_response_splits_inline_lists_to_multiline(self):
        text = (
            "### Kế hoạch xử lý\n"
            "Bạn có thể làm theo 1. Theo dõi nhiệt độ 2. Bù nước đúng cách 3. Đưa bé đi khám nếu nặng\n"
            "Lưu ý quan trọng - Không tự ý dùng thuốc người - Chuẩn bị video triệu chứng"
        )

        sanitized = websocket_chat.sanitize_assistant_response(
            text,
            user_message="cho toi huong dan",
            has_prior_assistant_message=True,
        )

        self.assertNotIn("###", sanitized)
        self.assertIn("Kế hoạch xử lý", sanitized)
        self.assertIn("1. Theo dõi nhiệt độ", sanitized)
        self.assertIn("2. Bù nước đúng cách", sanitized)
        self.assertIn("3. Đưa bé đi khám nếu nặng", sanitized)
        self.assertIn("- Không tự ý dùng thuốc người", sanitized)
        self.assertIn("- Chuẩn bị video triệu chứng", sanitized)

    async def test_websocket_connect_emits_history_and_booking_state_hydration(self):
        sent_payloads = []

        async def fake_send_message(session_id, payload):
            sent_payloads.append(payload)
            return {"session_id": session_id, "payload": payload}

        async def fake_get_chat_session(session_id):
            return {
                "session_id": session_id,
                "user_id": "user-1",
                "context_type": websocket_chat.BUSINESS_CHAT,
                "booking_state": {
                    "active": True,
                    "status": "COLLECTING",
                    "draft": {"clinic_id": "clinic-1", "pet_id": "pet-1"},
                },
            }

        async def fake_get_chat_history(session_id, limit=50):
            return [
                {
                    "message_id": "m1",
                    "role": "user",
                    "content": "Dat lich cho Mimi",
                    "timestamp": "2026-03-27T10:00:00+00:00",
                    "react_trace": [],
                }
            ]

        websocket = FakeWebSocket(query_params={"token": "jwt-token"})
        user = CurrentUser(user_id="user-1", role="PET_OWNER", is_admin=False)

        with (
            patch.object(
                websocket_chat, "decode_jwt_token", AsyncMock(return_value=user)
            ),
            patch.object(websocket_chat, "get_chat_session", fake_get_chat_session),
            patch.object(websocket_chat, "get_chat_history", fake_get_chat_history),
            patch.object(
                websocket_chat,
                "verify_subscription_logic",
                AsyncMock(return_value=True),
            ),
            patch.object(
                websocket_chat.manager, "connect", AsyncMock(return_value=None)
            ),
            patch.object(websocket_chat.manager, "disconnect", lambda session_id: None),
            patch.object(websocket_chat.manager, "send_message", fake_send_message),
            patch.object(
                websocket_chat, "AsyncSessionLocal", lambda: FakeSessionContext()
            ),
        ):
            await websocket_chat.websocket_chat_endpoint(
                websocket, session_id="session-1"
            )

        connected = next(
            payload for payload in sent_payloads if payload.get("type") == "connected"
        )
        history = next(
            payload for payload in sent_payloads if payload.get("type") == "history"
        )
        booking_update = next(
            payload
            for payload in sent_payloads
            if payload.get("type") == "booking_state_update"
        )

        self.assertEqual(connected["booking_state"]["draft"]["clinic_id"], "clinic-1")
        self.assertEqual(history["booking_state"]["draft"]["pet_id"], "pet-1")
        self.assertEqual(booking_update["booking_state"]["status"], "COLLECTING")
        self.assertEqual(booking_update["stage"], "COLLECTING")

    async def test_websocket_connect_expires_stale_booking_state_before_restore(self):
        sent_payloads = []

        async def fake_send_message(session_id, payload):
            sent_payloads.append(payload)
            return {"session_id": session_id, "payload": payload}

        async def fake_get_chat_session(session_id):
            return {
                "session_id": session_id,
                "user_id": "user-1",
                "context_type": websocket_chat.BUSINESS_CHAT,
                "updated_at": "2026-03-29T00:00:00+00:00",
                "booking_state": {
                    "active": True,
                    "status": "COLLECTING",
                    "draft": {"clinic_id": "clinic-1"},
                },
            }

        async def fake_expire(session_id, session_data, **kwargs):
            expired = dict(session_data)
            expired["booking_state"] = None
            return expired

        websocket = FakeWebSocket(query_params={"token": "jwt-token"})
        user = CurrentUser(user_id="user-1", role="PET_OWNER", is_admin=False)

        with (
            patch.object(
                websocket_chat, "decode_jwt_token", AsyncMock(return_value=user)
            ),
            patch.object(websocket_chat, "get_chat_session", fake_get_chat_session),
            patch.object(
                websocket_chat, "get_chat_history", AsyncMock(return_value=[])
            ),
            patch.object(
                websocket_chat, "expire_chat_session_state_if_needed", fake_expire
            ),
            patch.object(
                websocket_chat,
                "verify_subscription_logic",
                AsyncMock(return_value=True),
            ),
            patch.object(
                websocket_chat.manager, "connect", AsyncMock(return_value=None)
            ),
            patch.object(websocket_chat.manager, "disconnect", lambda session_id: None),
            patch.object(websocket_chat.manager, "send_message", fake_send_message),
            patch.object(
                websocket_chat, "AsyncSessionLocal", lambda: FakeSessionContext()
            ),
        ):
            await websocket_chat.websocket_chat_endpoint(
                websocket, session_id="session-1"
            )

        connected = next(
            payload for payload in sent_payloads if payload.get("type") == "connected"
        )
        self.assertIsNone(connected["booking_state"])
        self.assertFalse(
            any(
                payload.get("type") == "booking_state_update"
                for payload in sent_payloads
            )
        )

    @unittest.skip("Booking session tools removed in simplified booking flow")
    async def test_handle_chat_message_end_to_end_booking_journey(self):
        pass

    async def test_websocket_schema_models_accept_runtime_payload_shapes(self):
        ConnectedMessage(
            session_id="session-1",
            user="tester",
            context_type="BUSINESS_CHAT",
            booking_state={"active": True},
        )
        AckMessage(
            message="Đã nhận yêu cầu.",
            agent_id=1,
            provider="openrouter",
            model="google/gemini-2.5-flash",
        )
        AgentInfoMessage(
            agent_name="petties_agent",
            agent_type="single_agent",
            provider="openrouter",
            model="google/gemini-2.5-flash",
            allowed_tools=["search_clinics_nearby"],
        )
        UISchemaMessage(
            ui_schema={"version": "1.0", "layout": "list", "components": []},
            stage="COLLECTING",
            booking_state={"active": True},
        )


if __name__ == "__main__":
    unittest.main()
