"""Regression tests cho PetHealthSummaryLLMService."""

from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch
import types

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Stub heavy dependencies
motor_module = types.ModuleType("motor")
motor_asyncio_module = types.ModuleType("motor.motor_asyncio")
motor_asyncio_module.AsyncIOMotorClient = object
motor_asyncio_module.AsyncIOMotorDatabase = object
sys.modules.setdefault("motor", motor_module)
sys.modules.setdefault("motor.motor_asyncio", motor_asyncio_module)

from app.core.services.pet_health_summary_llm_service import PetHealthSummaryLLMService


class _FakeDbContext:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, exc_type, exc, tb):
        return False


class TestPetHealthSummaryLLMService(unittest.IsolatedAsyncioTestCase):
    def tearDown(self):
        PetHealthSummaryLLMService._instance = None

    async def test_synthesize_summary_uses_db_backed_llm_client(self):
        fake_client = types.SimpleNamespace(
            generate=AsyncMock(
                return_value=types.SimpleNamespace(
                    content='{"latest_emr_summary": {"diagnosis": "On dinh"}, "health_warnings": [], "medication_reminders": [], "suggested_actions": [], "ai_insights": null}'
                )
            )
        )

        with patch(
            "app.core.services.pet_health_summary_llm_service.AsyncSessionLocal",
            return_value=_FakeDbContext(),
        ), patch(
            "app.core.services.pet_health_summary_llm_service.get_llm_client_from_db",
            AsyncMock(return_value=fake_client),
        ), patch(
            "app.core.services.pet_health_summary_llm_service.get_llm_client"
        ) as env_client:
            service = PetHealthSummaryLLMService()
            result = await service.synthesize_summary(
                pet_info={"name": "Milu"},
                emr_records=[{"assessment": "Khoe", "plan": "Theo doi"}],
                user_name="Tan",
            )

        self.assertEqual(result["latest_emr_summary"]["diagnosis"], "On dinh")
        self.assertIs(service._llm_client, fake_client)
        env_client.assert_not_called()

    async def test_synthesize_summary_falls_back_when_no_llm_config_available(self):
        with patch(
            "app.core.services.pet_health_summary_llm_service.AsyncSessionLocal",
            return_value=_FakeDbContext(),
        ), patch(
            "app.core.services.pet_health_summary_llm_service.get_llm_client_from_db",
            AsyncMock(side_effect=ValueError("db key missing")),
        ), patch(
            "app.core.services.pet_health_summary_llm_service.get_llm_client",
            side_effect=ValueError("env key missing"),
        ):
            service = PetHealthSummaryLLMService()
            result = await service.synthesize_summary(
                pet_info={"name": "Milu"},
                emr_records=[
                    {
                        "assessment": "Can tai kham",
                        "plan": "Theo doi them",
                        "exam_date": "2026-03-20T08:00:00",
                        "clinic_name": "PetCare",
                    }
                ],
                user_name="Tan",
            )

        self.assertEqual(result["latest_emr_summary"]["exam_date"], "2026-03-20T08:00:00")
        self.assertEqual(result["latest_emr_summary"]["clinic_name"], "PetCare")
        self.assertEqual(result["suggested_actions"][0]["type"], "FOLLOW_UP")


if __name__ == "__main__":
    unittest.main()
