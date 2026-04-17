from pathlib import Path
import sys
import types
import unittest
from uuid import UUID
from unittest.mock import AsyncMock, MagicMock

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.rag.case_memory import CaseMemoryService


class CaseMemoryServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_upsert_case_skips_dedup_when_case_id_is_provided(self):
        service = CaseMemoryService()
        service.initialize = AsyncMock(return_value=None)
        service._embed_model = object()
        service._qdrant_client = MagicMock()
        service._embed_text = AsyncMock(return_value=[0.1, 0.2, 0.3])

        case_id = await service.upsert_case(
            text_to_embed="clinical text",
            payload={"species": "dog"},
            case_id="emr:123",
        )

        self.assertEqual(case_id, "emr:123")
        self.assertFalse(service._qdrant_client.query_points.called)
        self.assertTrue(service._qdrant_client.upsert.called)
        point = service._qdrant_client.upsert.call_args.kwargs["points"][0]
        self.assertIsInstance(UUID(str(point.id)), UUID)
        self.assertEqual(point.payload["case_id"], "emr:123")

    async def test_list_cases_returns_runtime_projection_only(self):
        service = CaseMemoryService()
        service.initialize = AsyncMock(return_value=None)
        service._qdrant_client = MagicMock()
        point = types.SimpleNamespace(
            id="point-1",
            payload={
                "case_id": "emr:case-1",
                "text_content": "Dog dermatitis confirmed case",
                "species": "dog",
                "chief_complaint": "Da do, ngua nhieu",
                "display_name_vi": "Viem da do vi khuan",
                "final_diagnosis_text": "Viem da do vi khuan",
                "canonical_code": "bacterial_dermatosis",
                "mapping_status": "mapped",
                "exam_at": "2026-04-02T10:00:00",
                "clinic_id": "clinic-1",
                "soap": {"assessment": "legacy"},
            },
        )
        service._qdrant_client.scroll.return_value = ([point], None)
        service._qdrant_client.get_collection.return_value = types.SimpleNamespace(
            points_count=1
        )

        result = await service.list_cases(page=1, page_size=10)

        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["case_id"], "emr:case-1")
        self.assertNotIn("clinic_id", result["items"][0])
        self.assertNotIn("soap", result["items"][0])
        self.assertNotIn("text_content", result["items"][0])

    async def test_get_case_returns_runtime_detail_projection_only(self):
        service = CaseMemoryService()
        service.initialize = AsyncMock(return_value=None)
        service._qdrant_client = MagicMock()
        point = types.SimpleNamespace(
            id="point-1",
            payload={
                "case_id": "emr:case-2",
                "text_content": "Dog dermatitis confirmed case",
                "species": "dog",
                "chief_complaint": "Da do, ngua nhieu",
                "clinical_notes": "Ton thuong da co mu nhe",
                "display_name_vi": "Viem da do vi khuan",
                "final_diagnosis_text": "Viem da do vi khuan",
                "canonical_code": "bacterial_dermatosis",
                "mapping_status": "mapped",
                "exam_at": "2026-04-02T10:00:00",
                "protocol_pattern": {
                    "soap_template": {"assessment": "Viem da do vi khuan"},
                    "common_recommendations": ["Lam sach vung ton thuong"],
                },
                "prescriptions": [{"medicine_name": "Cephalexin"}],
                "image_urls": ["https://image.test/1.jpg"],
            },
        )
        service._qdrant_client.retrieve.return_value = [point]

        result = await service.get_case("emr:case-2")

        self.assertEqual(result["case_id"], "emr:case-2")
        self.assertIn("text_content", result)
        self.assertIn("protocol_pattern", result)
        self.assertNotIn("prescriptions", result)
        self.assertNotIn("image_urls", result)
        self.assertNotIn("quality_gate", result)


if __name__ == "__main__":
    unittest.main()
