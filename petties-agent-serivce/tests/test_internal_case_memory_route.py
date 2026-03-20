from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.api.routes.internal_case_memory import router
from app.core.services.emr_case_memory_sync_service import EmrCaseMemorySyncResult


class InternalCaseMemoryRouteTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router, prefix="/api/v1")
        self.client = TestClient(app)

    def test_sync_endpoint_rejects_invalid_internal_key(self):
        payload = {
            "emr_id": "emr-1",
            "pet_id": "pet-1",
            "final_diagnosis_text": "Viem da do vi khuan",
            "verified": True,
        }

        with patch(
            "app.api.routes.internal_case_memory.settings.AI_INTERNAL_SYNC_KEY",
            "shared-key",
        ):
            response = self.client.post(
                "/api/v1/internal/case-memory/emr-sync",
                json=payload,
                headers={"X-Internal-AI-Key": "wrong-key"},
            )

        self.assertEqual(response.status_code, 401)

    def test_sync_endpoint_returns_sync_result(self):
        payload = {
            "emr_id": "emr-1",
            "pet_id": "pet-1",
            "final_diagnosis_text": "Viem da do vi khuan",
            "verified": True,
        }

        fake_service = type(
            "FakeSyncService",
            (),
            {
                "sync_record": AsyncMock(
                    return_value=EmrCaseMemorySyncResult(
                        case_id="emr:emr-1",
                        mapping_status="mapped",
                        canonical_code="bacterial_dermatosis",
                        display_name_vi="Viem da do vi khuan",
                        provisional_label=None,
                    )
                )
            },
        )()

        with patch(
            "app.api.routes.internal_case_memory.settings.AI_INTERNAL_SYNC_KEY",
            "shared-key",
        ), patch(
            "app.api.routes.internal_case_memory.get_emr_case_memory_sync_service",
            return_value=fake_service,
        ):
            response = self.client.post(
                "/api/v1/internal/case-memory/emr-sync",
                json=payload,
                headers={"X-Internal-AI-Key": "shared-key"},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["case_id"], "emr:emr-1")
        self.assertEqual(body["mapping_status"], "mapped")


if __name__ == "__main__":
    unittest.main()
