from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.services.disease_mapping_service import DiseaseMappingService


class DiseaseMappingServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_refresh_from_db_replaces_snapshot(self):
        service = DiseaseMappingService()
        catalog = {
            "ocular_infection": service.get_catalog_entry("ocular_infection"),
        }
        aliases = [
            type(
                "AliasEntry",
                (),
                {
                    "source_type": "kb",
                    "alias_text": "viêm kết mạc",
                    "normalized_alias": "viem ket mac",
                    "canonical_code": "ocular_infection",
                    "species": "all",
                },
            )()
        ]

        with patch.object(
            service,
            "_fetch_active_rows",
            new=AsyncMock(return_value=(catalog, aliases)),
        ):
            ok = await service.refresh_from_db(force=True)

        self.assertTrue(ok)
        mapped = service.map_label(
            raw_label="viem ket mac",
            source_type="kb",
            species="dog",
        )
        self.assertTrue(mapped.mapped)
        self.assertEqual(mapped.canonical_code, "ocular_infection")

    def test_map_label_prefers_species_specific_alias_when_available(self):
        service = DiseaseMappingService()
        service._aliases[("emr", "otitis", "dog")] = "otitis_or_ear_parasites"

        mapped = service.map_label(raw_label="otitis", source_type="emr", species="dog")

        self.assertTrue(mapped.mapped)
        self.assertEqual(mapped.canonical_code, "otitis_or_ear_parasites")

    async def test_record_unmapped_label_calls_review_queue_writer(self):
        service = DiseaseMappingService()

        with patch.object(service, "_upsert_review_item", new=AsyncMock()) as upsert_mock:
            ok = await service.record_unmapped_label(
                raw_label="bệnh lạ chưa map",
                source_type="emr",
                species="cat",
                sample_payload={"emr_id": "1"},
            )

        self.assertTrue(ok)
        upsert_mock.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
