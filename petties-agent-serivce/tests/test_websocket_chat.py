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
from app.core.tools.mcp_tools.booking_session_tools import (
    end_booking_session,
    start_booking_session_tool,
)


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


class FakeBookingJourneyAgent:
    name = "petties_agent"
    agent_type = "single_agent"
    enabled_tools = ["start_booking_session", "end_booking_session"]

    async def stream(self, user_message, session_id, **kwargs):
        normalized = str(user_message or "").lower()

        if (
            "khong dat" in normalized
            or "không đặt" in normalized
            or "huy" in normalized
        ):
            tool_result = await end_booking_session(reason="CANCELLED")
            yield {
                "type": "react_step",
                "step": {
                    "step_type": "action",
                    "content": "Called end_booking_session",
                    "tool_name": "end_booking_session",
                    "tool_params": {"reason": "CANCELLED"},
                    "tool_result": tool_result,
                },
            }
            yield {
                "type": "react_step",
                "step": {
                    "step_type": "observation",
                    "content": "booking session cancelled",
                    "tool_name": "end_booking_session",
                    "tool_params": {"reason": "CANCELLED"},
                    "tool_result": tool_result,
                },
            }
            yield {
                "type": "final_answer",
                "content": "Đã hủy flow đặt lịch theo yêu cầu của bạn.",
            }
            return

        if "dat lai" in normalized or "đặt lại" in normalized:
            tool_result = await start_booking_session_tool(
                initial_draft={
                    "pet_id": "pet-1",
                    "clinic_id": "clinic-1",
                    "booking_type": "IN_CLINIC",
                }
            )
            yield {
                "type": "react_step",
                "step": {
                    "step_type": "action",
                    "content": "Called start_booking_session",
                    "tool_name": "start_booking_session",
                    "tool_params": {
                        "initial_draft": {
                            "pet_id": "pet-1",
                            "clinic_id": "clinic-1",
                            "booking_type": "IN_CLINIC",
                        }
                    },
                    "tool_result": tool_result,
                },
            }
            yield {
                "type": "react_step",
                "step": {
                    "step_type": "observation",
                    "content": "booking session restarted",
                    "tool_name": "start_booking_session",
                    "tool_params": {},
                    "tool_result": tool_result,
                },
            }
            yield {
                "type": "final_answer",
                "content": "Mình đã khởi động lại flow đặt lịch.",
            }
            return

        if "dat lich" in normalized or "đặt lịch" in normalized:
            tool_result = await start_booking_session_tool(
                initial_draft={
                    "pet_id": "pet-1",
                    "clinic_id": "clinic-1",
                    "booking_type": "IN_CLINIC",
                }
            )
            yield {
                "type": "react_step",
                "step": {
                    "step_type": "action",
                    "content": "Called start_booking_session",
                    "tool_name": "start_booking_session",
                    "tool_params": {
                        "initial_draft": {
                            "pet_id": "pet-1",
                            "clinic_id": "clinic-1",
                            "booking_type": "IN_CLINIC",
                        }
                    },
                    "tool_result": tool_result,
                },
            }
            yield {
                "type": "react_step",
                "step": {
                    "step_type": "observation",
                    "content": "booking session started",
                    "tool_name": "start_booking_session",
                    "tool_params": {},
                    "tool_result": tool_result,
                },
            }
            yield {
                "type": "final_answer",
                "content": "Mình đã bắt đầu flow đặt lịch cho bạn.",
            }
            return

        yield {
            "type": "final_answer",
            "content": "Đây là phản hồi chat bình thường, chưa vào booking.",
        }


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

    async def test_handle_chat_message_end_to_end_booking_journey(self):
        sent_payloads = []
        chat_history_store = []
        session_store = {
            "session-journey": {
                "session_id": "session-journey",
                "user_id": "user-1",
                "context_type": BUSINESS_CHAT,
                "booking_state": None,
            }
        }

        async def fake_send_message(session_id, payload):
            sent_payloads.append(payload)
            return {"session_id": session_id, "payload": payload}

        async def fake_get_chat_session(session_id):
            return dict(session_store.get(session_id) or {})

        async def fake_expire(session_id, session_data, **kwargs):
            return session_data

        async def fake_touch_chat_session(session_id, data=None):
            base = session_store.setdefault(
                session_id,
                {
                    "session_id": session_id,
                    "user_id": "user-1",
                    "context_type": BUSINESS_CHAT,
                    "booking_state": None,
                },
            )
            if isinstance(data, dict):
                base.update(data)
            return base

        async def fake_save_chat_message(data):
            chat_history_store.append(data)
            return data

        async def fake_get_chat_history(session_id, limit=50):
            return chat_history_store[-limit:]

        async def fake_update_booking_state_in_db(session_id, booking_state):
            session_store.setdefault(
                session_id,
                {
                    "session_id": session_id,
                    "user_id": "user-1",
                    "context_type": BUSINESS_CHAT,
                },
            )["booking_state"] = booking_state
            return True

        async def fake_get_agent(**kwargs):
            return FakeBookingJourneyAgent()

        user = CurrentUser(user_id="user-1", role="PET_OWNER", is_admin=False)

        with (
            patch.object(websocket_chat.AgentFactory, "get_agent", fake_get_agent),
            patch.object(
                websocket_chat,
                "AsyncSessionLocal",
                lambda: FakeSessionContext(),
            ),
            patch.object(websocket_chat, "get_chat_session", fake_get_chat_session),
            patch.object(
                websocket_chat,
                "expire_chat_session_state_if_needed",
                fake_expire,
            ),
            patch.object(websocket_chat, "touch_chat_session", fake_touch_chat_session),
            patch.object(websocket_chat, "save_chat_message", fake_save_chat_message),
            patch.object(websocket_chat, "get_chat_history", fake_get_chat_history),
            patch.object(websocket_chat.manager, "send_message", fake_send_message),
            patch(
                "app.core.tools.mcp_tools.booking_session_tools.update_booking_state_in_db",
                new=AsyncMock(side_effect=fake_update_booking_state_in_db),
            ),
        ):
            checkpoint = 0

            await websocket_chat.handle_chat_message(
                websocket=None,
                session_id="session-journey",
                user=user,
                session_context=BUSINESS_CHAT,
                message=json.dumps(
                    {"message": "Cho mình hỏi giờ làm việc của phòng khám"}
                ),
                auth_token="jwt-token",
            )
            first_batch = sent_payloads[checkpoint:]
            checkpoint = len(sent_payloads)
            self.assertFalse(
                any(
                    payload.get("type") == "booking_state_update"
                    for payload in first_batch
                )
            )

            await websocket_chat.handle_chat_message(
                websocket=None,
                session_id="session-journey",
                user=user,
                session_context=BUSINESS_CHAT,
                message=json.dumps({"message": "Mình muốn đặt lịch khám cho bé Mimi"}),
                auth_token="jwt-token",
            )
            second_batch = sent_payloads[checkpoint:]
            checkpoint = len(sent_payloads)
            second_booking_update = next(
                payload
                for payload in second_batch
                if payload.get("type") == "booking_state_update"
            )
            self.assertTrue(second_booking_update["booking_state"]["active"])
            self.assertEqual(
                second_booking_update["booking_state"]["status"], "COLLECTING"
            )

            await websocket_chat.handle_chat_message(
                websocket=None,
                session_id="session-journey",
                user=user,
                session_context=BUSINESS_CHAT,
                message=json.dumps({"message": "Thôi mình không đặt nữa"}),
                auth_token="jwt-token",
            )
            third_batch = sent_payloads[checkpoint:]
            checkpoint = len(sent_payloads)
            third_booking_update = next(
                payload
                for payload in third_batch
                if payload.get("type") == "booking_state_update"
            )
            self.assertFalse(third_booking_update["booking_state"]["active"])
            self.assertEqual(
                third_booking_update["booking_state"]["status"], "CANCELLED"
            )

            await websocket_chat.handle_chat_message(
                websocket=None,
                session_id="session-journey",
                user=user,
                session_context=BUSINESS_CHAT,
                message=json.dumps({"message": "Ok đặt lại giúp mình vào cuối tuần"}),
                auth_token="jwt-token",
            )
            fourth_batch = sent_payloads[checkpoint:]
            fourth_booking_update = next(
                payload
                for payload in fourth_batch
                if payload.get("type") == "booking_state_update"
            )
            self.assertTrue(fourth_booking_update["booking_state"]["active"])
            self.assertEqual(
                fourth_booking_update["booking_state"]["status"],
                "COLLECTING",
            )

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
