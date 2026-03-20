from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.services.emr_case_memory_sync_service import EmrCaseMemorySyncService


class EmrCaseMemorySyncServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_sync_record_rejects_invalid_payload(self):
        service = EmrCaseMemorySyncService()

        with self.assertRaises(ValueError):
            await service.sync_record({"emr_id": "emr-1"})

    async def test_sync_record_upserts_case_memory_when_mapped(self):
        service = EmrCaseMemorySyncService()
        emr = {
            "emr_id": "emr-10",
            "pet_id": "pet-10",
            "clinic_id": "clinic-1",
            "final_diagnosis_text": "Viem da do vi khuan",
            "species": "dog",
            "symptoms": ["itching"],
            "attachments": {"image_urls": ["https://image.test/1.jpg"]},
            "verified": True,
        }

        mock_case_memory = MagicMock()
        mock_case_memory.upsert_case = AsyncMock(return_value="emr:emr-10")

        with patch(
            "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
            new=AsyncMock(return_value=True),
        ), patch(
            "app.core.services.emr_case_memory_sync_service.get_case_memory_service",
            return_value=mock_case_memory,
        ):
            result = await service.sync_record(emr)

        self.assertEqual(result.case_id, "emr:emr-10")
        self.assertEqual(result.mapping_status, "mapped")
        mock_case_memory.upsert_case.assert_awaited_once()

    async def test_sync_record_ingests_provisional_case_and_records_review_item(self):
        service = EmrCaseMemorySyncService()
        emr = {
            "emr_id": "emr-11",
            "pet_id": "pet-11",
            "final_diagnosis_text": "Benh hiem chua map",
            "species": "cat",
            "verified": True,
        }

        mock_case_memory = MagicMock()
        mock_case_memory.upsert_case = AsyncMock(return_value="emr:emr-11")

        with patch(
            "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
            new=AsyncMock(return_value=True),
        ), patch(
            "app.core.services.disease_mapping_service.DiseaseMappingService.record_unmapped_label",
            new=AsyncMock(return_value=True),
        ) as review_mock, patch(
            "app.core.services.emr_case_memory_sync_service.get_case_memory_service",
            return_value=mock_case_memory,
        ):
            result = await service.sync_record(emr)

        self.assertEqual(result.mapping_status, "provisional")
        self.assertEqual(result.provisional_label, "Benh hiem chua map")
        review_mock.assert_awaited_once()
        mock_case_memory.upsert_case.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
