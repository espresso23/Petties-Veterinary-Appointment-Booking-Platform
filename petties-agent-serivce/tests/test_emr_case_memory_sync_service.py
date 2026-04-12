from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.services.disease_mapping_service import DiseaseMappingResult
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
            "physical_exam": ["Da do", "Co mu"],
            "clinical_notes": "Benh nhan co ton thuong da lan toa",
            "soap": {
                "subjective": "Ngua 3 ngay",
                "objective": "Da do va co mu",
                "assessment": "Viem da do vi khuan",
                "plan": "Ve sinh va theo doi",
                "notes": "Tai kham neu khong do",
            },
            "vitals": {
                "weight_kg": 12.0,
                "temperature_c": 38.6,
                "heart_rate": 110,
                "bcs": 5,
            },
            "prescriptions": [
                {
                    "medicine_name": "Cephalexin",
                    "times_of_day": ["sang", "trua", "chieu"],
                    "before_after_meal": "AFTER_MEAL",
                    "frequency_note": "2 lần/ngày",
                    "duration_days": 14,
                    "instructions": "Uong sau an",
                }
            ],
            "attachments": {"image_urls": ["https://image.test/1.jpg"]},
            "verified": True,
        }

        mock_case_memory = MagicMock()
        mock_case_memory.upsert_case = AsyncMock(return_value="emr:emr-10")

        with (
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "app.core.services.emr_case_memory_sync_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
        ):
            result = await service.sync_record(emr)

        self.assertEqual(result.case_id, "emr:emr-10")
        self.assertEqual(result.mapping_status, "mapped")
        mock_case_memory.upsert_case.assert_awaited_once()
        upsert_kwargs = mock_case_memory.upsert_case.await_args.kwargs
        payload = upsert_kwargs["payload"]
        self.assertEqual(payload["species"], "dog")
        self.assertEqual(payload["canonical_code"], "bacterial_dermatosis")
        self.assertEqual(
            payload["protocol_pattern"]["common_prescriptions"][0]["medicine"],
            "Cephalexin",
        )
        self.assertEqual(
            payload["protocol_pattern"]["common_prescriptions"][0]["times_of_day"],
            ["sang", "trua", "chieu"],
        )
        self.assertEqual(
            payload["protocol_pattern"]["common_prescriptions"][0]["before_after_meal"],
            "AFTER_MEAL",
        )
        self.assertEqual(
            payload["protocol_pattern"]["common_prescriptions"][0]["frequency_note"],
            "2 lần/ngày",
        )
        self.assertNotIn(
            "dosage", payload["protocol_pattern"]["common_prescriptions"][0]
        )
        self.assertNotIn(
            "frequency", payload["protocol_pattern"]["common_prescriptions"][0]
        )
        self.assertNotIn("common_tests", payload["protocol_pattern"])
        self.assertEqual(
            payload["protocol_pattern"]["common_recommendations"],
            ["Ve sinh va theo doi", "Tai kham neu khong do"],
        )
        self.assertEqual(
            payload["protocol_pattern"]["soap_template"]["assessment"],
            "Viem da do vi khuan",
        )
        self.assertNotIn("ai_diagnosis_context", payload)
        self.assertNotIn("soap", payload)
        self.assertIn("vitals", payload)
        self.assertEqual(payload["vitals"]["weight_kg"], 12.0)
        self.assertEqual(payload["emr_id"], "emr-10")
        self.assertEqual(payload["pet_id"], "pet-10")
        self.assertEqual(payload["clinic_id"], "clinic-1")
        self.assertEqual(payload["symptoms"], ["itching"])
        self.assertNotIn("prescriptions", payload)

    async def test_sync_record_accepts_legacy_camel_case_ai_context(self):
        service = EmrCaseMemorySyncService()
        emr = {
            "emr_id": "emr-12",
            "pet_id": "pet-12",
            "clinic_id": "clinic-1",
            "final_diagnosis_text": "Viem da do vi khuan",
            "species": "dog",
            "soap": {
                "subjective": "Ngua 3 ngay",
                "objective": "Da do va co mu",
                "assessment": "Viem da do vi khuan",
                "plan": "Ve sinh vung ton thuong\nTai kham sau 7 ngay",
                "notes": "Theo doi phan ung thuoc",
            },
            "prescriptions": [
                {
                    "medicine_name": "Cephalexin",
                    "times_of_day": ["sang", "trua", "chieu"],
                    "before_after_meal": "AFTER_MEAL",
                    "frequency_note": "2 lần/ngày",
                    "duration_days": 14,
                    "instructions": "Uong sau an",
                }
            ],
            "verified": True,
        }

        mock_case_memory = MagicMock()
        mock_case_memory.upsert_case = AsyncMock(return_value="emr:emr-12")

        with (
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "app.core.services.emr_case_memory_sync_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
        ):
            result = await service.sync_record(emr)

        self.assertEqual(result.case_id, "emr:emr-12")
        payload = mock_case_memory.upsert_case.await_args.kwargs["payload"]
        self.assertEqual(
            payload["protocol_pattern"]["common_recommendations"],
            [
                "Ve sinh vung ton thuong",
                "Tai kham sau 7 ngay",
                "Theo doi phan ung thuoc",
            ],
        )

    async def test_sync_record_extracts_common_tests_from_plan_and_notes(self):
        service = EmrCaseMemorySyncService()
        emr = {
            "emr_id": "emr-13",
            "pet_id": "pet-13",
            "final_diagnosis_text": "Viem da do vi khuan",
            "species": "dog",
            "soap": {
                "assessment": "Viem da do vi khuan",
                "plan": "Xet nghiem Cytology da\nTheo doi dap ung 72 gio",
                "notes": "Can sieu am neu xuat hien khoi duoi da",
            },
            "verified": True,
        }

        mock_case_memory = MagicMock()
        mock_case_memory.upsert_case = AsyncMock(return_value="emr:emr-13")

        with (
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "app.core.services.emr_case_memory_sync_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
        ):
            await service.sync_record(emr)

        payload = mock_case_memory.upsert_case.await_args.kwargs["payload"]
        self.assertEqual(
            payload["protocol_pattern"]["common_tests"],
            [
                {"test": "Xet nghiem Cytology da"},
                {"test": "Can sieu am neu xuat hien khoi duoi da"},
            ],
        )

    async def test_sync_record_ingests_provisional_case_without_review_queue_dependency(
        self,
    ):
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

        with (
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.resolve_label",
                new=AsyncMock(
                    return_value=DiseaseMappingResult(
                        raw_label="Benh hiem chua map",
                        canonical_code=None,
                        display_name_vi=None,
                        mapped=False,
                        source_type="emr",
                    )
                ),
            ) as resolve_mock,
            patch(
                "app.core.services.emr_case_memory_sync_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
        ):
            result = await service.sync_record(emr)

        self.assertEqual(result.mapping_status, "provisional")
        self.assertEqual(result.provisional_label, "Benh hiem chua map")
        resolve_mock.assert_awaited_once()
        mock_case_memory.upsert_case.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
