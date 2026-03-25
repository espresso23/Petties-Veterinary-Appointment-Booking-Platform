from pathlib import Path
import sys
import types
import unittest
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.api.schemas.diagnosis_contracts import (
    DiagnosisClinicalContext,
    GeminiVisionDiagnosisRequest,
    Species,
)
from app.core.vision.gemini_vision_adapter import GeminiVisionAdapter


class _FakeDbContext:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, exc_type, exc, tb):
        return False


class GeminiVisionAdapterTests(unittest.IsolatedAsyncioTestCase):
    async def test_analyze_falls_back_to_env_llm_client_when_db_settings_fail(self):
        adapter = GeminiVisionAdapter()
        fake_client = types.SimpleNamespace(
            generate=AsyncMock(
                return_value=types.SimpleNamespace(
                    content="""
                    {
                      "visual_findings": ["Mắt đỏ, có ghèn vàng."],
                      "image_descriptions": ["Mắt trái đỏ và có mủ."],
                      "top_conditions": [
                        {
                          "raw_label": "conjunctivitis",
                          "confidence_score": 0.81,
                          "reason": "Red eye with purulent discharge."
                        }
                      ],
                      "needs_more_data": false,
                      "missing_information": [],
                      "safety_notes": []
                    }
                    """
                )
            )
        )
        request = GeminiVisionDiagnosisRequest(
            request_id="req-1",
            species=Species.DOG,
            image_urls=["https://example.com/eye.jpg"],
            doctor_description="Mắt trái đỏ, có mủ.",
            clinical_context=DiagnosisClinicalContext(symptoms=["đỏ mắt", "mắt có mủ"]),
        )

        with patch(
            "app.core.vision.gemini_vision_adapter.AsyncSessionLocal",
            return_value=_FakeDbContext(),
        ), patch(
            "app.core.vision.gemini_vision_adapter.get_llm_client_from_db",
            AsyncMock(side_effect=ValueError("db config missing")),
        ), patch(
            "app.core.vision.gemini_vision_adapter.get_llm_client",
            return_value=fake_client,
        ):
            response = await adapter.analyze(request)

        fake_client.generate.assert_awaited_once()
        self.assertEqual(
            response.top_conditions[0].display_name_vi,
            "Viêm kết mạc hoặc nhiễm trùng mắt",
        )
        self.assertEqual(response.image_descriptions[0], "Mắt trái đỏ và có mủ.")


if __name__ == "__main__":
    unittest.main()
