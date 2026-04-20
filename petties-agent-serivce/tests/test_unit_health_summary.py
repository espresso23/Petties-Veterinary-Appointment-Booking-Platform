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
from app.api.routes import pet_health_summary as summary_routes

class HealthSummaryUnitTests(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.user = MagicMock()
        self.user.role = "PET_OWNER"
        self.user.full_name = "John Doe"
        
        self.pet_info = {
            "pet_id": "pet-1",
            "name": "Lu",
            "species": "Dog",
            "breed": "Poodle",
            "gender": "Male",
            "weight": 5.5
        }
        self.emr_record = {
            "record_id": "emr-1",
            "date": "2024-03-20",
            "chief_complaint": "Itching",
            "diagnosis": "Allergy"
        }

    # --- USE CASE 10 & 11: Summarize patient info & EMR ---

    @patch("app.api.routes.pet_health_summary.get_pet_health_summary_llm_service")
    async def test_utc_id_10_01_synthesize_success(self, mock_get_service):
        """UTCID10-01 - Happy Path: Tổng hợp EMR thành công"""
        mock_service = AsyncMock()
        mock_service.synthesize_summary.return_value = {
            "latest_emr_summary": {"summary": "Healthy"},
            "health_warnings": [],
            "medication_reminders": [],
            "suggested_actions": [],
            "ai_insights": {}
        }
        mock_get_service.return_value = mock_service
        
        from app.api.routes.pet_health_summary import PetHealthSummaryRequest
        payload = PetHealthSummaryRequest(
            pet_info=self.pet_info,
            emr_records=[self.emr_record]
        )
        
        response = await summary_routes.synthesize_pet_health_summary(payload, self.user)
        
        self.assertIn("Tham khảo", response.disclaimer)
        mock_service.synthesize_summary.assert_called_once()

    async def test_utc_id_10_02_synthesize_invalid_role(self):
        """UTCID10-02 - Abnormal: Role không được phép truy cập"""
        self.user.role = "GUEST"
        
        from app.api.routes.pet_health_summary import PetHealthSummaryRequest
        payload = PetHealthSummaryRequest(pet_info=self.pet_info, emr_records=[])
        
        with self.assertRaises(HTTPException) as exc:
            await summary_routes.synthesize_pet_health_summary(payload, self.user)
        self.assertEqual(exc.exception.status_code, 403)

    @patch("app.api.routes.pet_health_summary.get_pet_health_summary_llm_service")
    async def test_utc_id_11_01_synthesize_empty_emr(self, mock_get_service):
        """UTCID11-01 - Boundary: Tổng hợp khi không có record EMR nào"""
        mock_service = AsyncMock()
        mock_service.synthesize_summary.return_value = {
            "latest_emr_summary": None,
            "health_warnings": [],
            "medication_reminders": [],
            "suggested_actions": [],
            "ai_insights": None
        }
        mock_get_service.return_value = mock_service
        
        from app.api.routes.pet_health_summary import PetHealthSummaryRequest
        payload = PetHealthSummaryRequest(pet_info=self.pet_info, emr_records=[])
        
        response = await summary_routes.synthesize_pet_health_summary(payload, self.user)
        self.assertIsNone(response.latest_emr_summary)

if __name__ == "__main__":
    unittest.main()
