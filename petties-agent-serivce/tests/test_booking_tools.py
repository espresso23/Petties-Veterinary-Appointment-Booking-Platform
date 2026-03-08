from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.tool_runtime_context import ToolRuntimeContext, reset_tool_runtime_context, set_tool_runtime_context
from app.core.tools.mcp_tools.booking_tools import create_booking_for_user, get_user_pets


class BookingToolsTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_user_pets_uses_runtime_context(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(user_id="user-1", role="PET_OWNER", auth_token="jwt-token")
        )

        client = AsyncMock()
        client.get_my_pets.return_value = [
            {
                "id": "pet-1",
                "name": "Mimi",
                "species": "CAT",
                "breed": "Anh long ngan",
                "dateOfBirth": "2023-03-01",
                "weight": 3.2,
                "imageUrl": "https://example.com/mimi.png",
            }
        ]

        try:
            with patch("app.core.tools.mcp_tools.booking_tools.get_backend_client", return_value=client):
                result = await get_user_pets()
        finally:
            reset_tool_runtime_context(runtime_token)

        self.assertEqual(result["user_id"], "user-1")
        self.assertEqual(result["total_pets"], 1)
        self.assertEqual(result["pets"][0]["name"], "Mimi")

    async def test_create_booking_requires_confirmation(self):
        runtime_token = set_tool_runtime_context(
            ToolRuntimeContext(user_id="user-1", role="PET_OWNER", auth_token="jwt-token")
        )

        try:
            result = await create_booking_for_user(
                pet_id="pet-1",
                clinic_id="clinic-1",
                booking_date="2026-03-12",
                start_time="09:00",
                service_ids=["service-1"],
                confirmed=False,
            )
        finally:
            reset_tool_runtime_context(runtime_token)

        self.assertFalse(result["success"])
        self.assertIn("Chưa có xác nhận", result["message"])


if __name__ == "__main__":
    unittest.main()