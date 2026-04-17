from pathlib import Path
import sys
from datetime import datetime, timedelta, timezone
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

from app.core.database.mongodb import (
    expire_chat_session_state_if_needed,
    is_chat_session_idle_expired,
)


class ChatbotPersistenceTests(unittest.IsolatedAsyncioTestCase):
    def test_idle_expiration_detects_stale_session(self):
        session = {
            "session_id": "session-1",
            "updated_at": datetime.now(timezone.utc) - timedelta(minutes=31),
            "booking_state": {"active": True, "status": "COLLECTING"},
        }

        self.assertTrue(is_chat_session_idle_expired(session, timeout_minutes=30))

    async def test_expire_chat_session_state_if_needed_clears_booking_state(self):
        session = {
            "session_id": "session-1",
            "updated_at": datetime.now(timezone.utc) - timedelta(minutes=31),
            "booking_state": {"active": True, "status": "COLLECTING"},
        }

        sessions_collection = AsyncMock()
        db = {"ai_chat_sessions": sessions_collection}

        with (
            patch(
                "app.core.database.mongodb.settings.MONGODB_CHAT_SESSIONS_COLLECTION",
                "ai_chat_sessions",
            ),
            patch(
                "app.core.database.mongodb.get_mongodb_database",
                AsyncMock(return_value=db),
            ),
        ):
            updated = await expire_chat_session_state_if_needed("session-1", session)

        self.assertIsNotNone(updated)
        self.assertIsNone(updated["booking_state"])
        sessions_collection.update_one.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
