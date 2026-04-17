import sys
from pathlib import Path
import unittest
from unittest.mock import patch, MagicMock, AsyncMock
import types

# Setup path to import app
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Mock motor/mongodb
motor_module = types.ModuleType("motor")
motor_asyncio_module = types.ModuleType("motor.motor_asyncio")
motor_asyncio_module.AsyncIOMotorClient = object
motor_asyncio_module.AsyncIOMotorDatabase = object
sys.modules.setdefault("motor", motor_module)
sys.modules.setdefault("motor.motor_asyncio", motor_asyncio_module)

from fastapi import HTTPException
from app.api.routes import agents as agents_routes
from app.api.routes import tools as tools_routes
from app.api.routes import chat as chat_routes # for feedback stats

class AgentsToolsUnitTests(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.mock_db = AsyncMock()
        self.admin_user = {"user_id": "admin", "role": "ADMIN", "is_admin": True}

    # --- USE CASE 2: Config Agent Parameter ---

    @patch("app.api.routes.agents.select")
    async def test_utc_id_02_01_update_agent_success(self, mock_select):
        """UTCID02-01 - Happy Path: Cập nhật cấu hình Agent thành công"""
        # Mock DB find agent
        mock_agent = MagicMock()
        mock_agent.id = 1
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_agent
        self.mock_db.execute.return_value = mock_result
        
        from app.api.routes.agents import UpdateAgentRequest
        request = UpdateAgentRequest(temperature=0.7, model="gpt-4")
        
        response = await agents_routes.update_agent(1, request, self.mock_db)
        
        self.assertEqual(mock_agent.temperature, 0.7)
        self.assertEqual(mock_agent.model, "gpt-4")
        self.mock_db.commit.assert_called_once()

    @patch("app.api.routes.agents.select")
    async def test_utc_id_02_02_update_agent_not_found(self, mock_select):
        """UTCID02-02 - Abnormal: Agent không tồn tại"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        self.mock_db.execute.return_value = mock_result
        
        from app.api.routes.agents import UpdateAgentRequest
        with self.assertRaises(HTTPException) as exc:
            await agents_routes.update_agent(999, UpdateAgentRequest(), self.mock_db)
        self.assertEqual(exc.exception.status_code, 404)

    # --- USE CASE 4: Turn On/Off Agent Tools ---

    @patch("app.api.routes.tools.get_db")
    async def test_utc_id_04_01_toggle_tool_success(self, mock_get_db):
        """UTCID04-01 - Happy Path: Bật/Tắt tool thành công"""
        mock_tool = MagicMock()
        mock_tool.id = 1
        mock_tool.enabled = False
        
        # Mock DB lookup
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_tool
        self.mock_db.execute.return_value = mock_result
        
        # Gọi API toggle
        response = await tools_routes.toggle_tool(1, enabled=True, db=self.mock_db)
        
        self.assertTrue(mock_tool.enabled)
        self.mock_db.commit.assert_called_once()

    # --- USE CASE 12: View aggregate feedback stats ---

    @patch("app.core.services.feedback_service.get_feedback_service")
    async def test_utc_id_12_01_get_stats_success(self, mock_get_service):
        """UTCID12-01 - Happy Path: Lấy thống kê feedback thành công"""
        mock_service = AsyncMock()
        mock_service.get_feedback_stats.return_value = {
            "total": 100,
            "positive_rate": 0.85,
            "by_type": {"thumbs_up": 85, "thumbs_down": 15}
        }
        mock_get_service.return_value = mock_service
        
        admin_user_obj = MagicMock()
        admin_user_obj.is_admin = True
        admin_user_obj.user_id = "admin"
        
        response = await chat_routes.get_feedback_stats(days=30, user=admin_user_obj)
        
        self.assertEqual(response.total, 100)
        self.assertEqual(response.positive_rate, 0.85)

if __name__ == "__main__":
    unittest.main()
