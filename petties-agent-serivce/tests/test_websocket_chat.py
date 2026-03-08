from pathlib import Path
import json
import sys
import types
import unittest
from unittest.mock import patch

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
from app.api.websocket import chat as websocket_chat
from app.core.chat_context import BUSINESS_CHAT


class FakeSessionContext:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeAgent:
    name = "petties_agent"
    agent_type = "single_agent"
    enabled_tools = ["pet_care_qa", "symptom_search"]

    async def stream(self, user_message, session_id):
        yield {"type": "final_answer", "content": "phan hoi test"}


class WebSocketChatTests(unittest.IsolatedAsyncioTestCase):
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

        with patch.object(websocket_chat.AgentFactory, "get_agent", fake_get_agent), \
             patch.object(websocket_chat, "AsyncSessionLocal", lambda: FakeSessionContext()), \
             patch.object(websocket_chat, "save_chat_message", fake_save_chat_message), \
             patch.object(websocket_chat, "touch_chat_session", fake_touch_chat_session), \
             patch.object(websocket_chat.manager, "send_message", fake_send_message):
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


if __name__ == "__main__":
    unittest.main()