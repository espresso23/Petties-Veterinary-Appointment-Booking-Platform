from pathlib import Path
import sys
from datetime import datetime, timezone
import unittest
from unittest.mock import patch
import types

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

motor_module = types.ModuleType("motor")
motor_asyncio_module = types.ModuleType("motor.motor_asyncio")
motor_asyncio_module.AsyncIOMotorClient = object
motor_asyncio_module.AsyncIOMotorDatabase = object
sys.modules.setdefault("motor", motor_module)
sys.modules.setdefault("motor.motor_asyncio", motor_asyncio_module)

from fastapi import HTTPException

from app.api.middleware.auth import CurrentUser
from app.api.routes import chat as chat_routes
from app.api.routes.chat import CreateSessionRequest, create_session
from app.core.chat_context import BUSINESS_CHAT, PLAYGROUND_TEST


class ChatRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_create_session_persists_mongo_document(self):
        captured = {}

        async def fake_save_chat_session(data):
            captured.update(data)
            return data["session_id"]

        user = CurrentUser(user_id="user-1", role="PET_OWNER", is_admin=False)

        with patch.object(chat_routes, "save_chat_session", fake_save_chat_session):
            response = await create_session(CreateSessionRequest(), user)

        self.assertTrue(response.success)
        self.assertEqual(response.context_type, BUSINESS_CHAT)
        self.assertEqual(captured["user_id"], "user-1")
        self.assertEqual(captured["user_role"], "PET_OWNER")
        self.assertEqual(captured["context_type"], BUSINESS_CHAT)

    async def test_create_session_blocks_non_admin_playground(self):
        async def fake_save_chat_session(data):
            return data["session_id"]

        user = CurrentUser(user_id="user-2", role="PET_OWNER", is_admin=False)

        with patch.object(chat_routes, "save_chat_session", fake_save_chat_session):
            with self.assertRaises(HTTPException) as exc_info:
                await create_session(CreateSessionRequest(context_type=PLAYGROUND_TEST), user)

        self.assertEqual(exc_info.exception.status_code, 403)

    def test_validate_session_access_rejects_wrong_owner(self):
        session = {
            "session_id": "session-1",
            "user_id": "owner-a",
            "context_type": BUSINESS_CHAT,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        user = CurrentUser(user_id="owner-b", role="PET_OWNER", is_admin=False)

        with self.assertRaises(HTTPException) as exc_info:
            chat_routes._validate_session_access(session, user)

        self.assertEqual(exc_info.exception.status_code, 403)

    def test_validate_session_access_rejects_deleted_session(self):
        session = {
            "session_id": "session-2",
            "user_id": "owner-a",
            "context_type": BUSINESS_CHAT,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "deleted": True,
        }
        user = CurrentUser(user_id="owner-a", role="PET_OWNER", is_admin=False)

        with self.assertRaises(HTTPException) as exc_info:
            chat_routes._validate_session_access(session, user)

        self.assertEqual(exc_info.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
