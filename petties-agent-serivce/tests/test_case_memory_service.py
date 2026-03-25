from pathlib import Path
import sys
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
            payload={"source_type": "confirmed_emr"},
            case_id="emr:123",
        )

        self.assertEqual(case_id, "emr:123")
        self.assertFalse(service._qdrant_client.query_points.called)
        self.assertTrue(service._qdrant_client.upsert.called)
        point = service._qdrant_client.upsert.call_args.kwargs["points"][0]
        self.assertIsInstance(UUID(str(point.id)), UUID)
        self.assertEqual(point.payload["case_id"], "emr:123")


if __name__ == "__main__":
    unittest.main()
