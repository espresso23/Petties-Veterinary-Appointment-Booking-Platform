from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.services.disease_mapping_service import (
    CanonicalizationDecision,
    DiseaseCatalogEntry,
    DiseaseMappingService,
    DiseaseAliasEntry,
)

# Mock data for tests since defaults were removed
TEST_CATALOG = {
    "ocular_infection": DiseaseCatalogEntry(
        canonical_code="ocular_infection",
        display_name_vi="Viêm kết mạc hoặc nhiễm trùng mắt",
    ),
    "bacterial_dermatosis": DiseaseCatalogEntry(
        canonical_code="bacterial_dermatosis",
        display_name_vi="Viêm da do vi khuẩn",
    ),
    "dermatosis_or_ectoparasites": DiseaseCatalogEntry(
        canonical_code="dermatosis_or_ectoparasites",
        display_name_vi="Viêm da hoặc bệnh da ký sinh trùng",
    ),
}

TEST_ALIASES = [
    DiseaseAliasEntry("emr", "viem ket mac", "viem ket mac", "ocular_infection"),
    DiseaseAliasEntry("vision", "bacterial dermatitis", "bacterial dermatitis", "bacterial_dermatosis"),
    DiseaseAliasEntry("emr", "viem da", "viem da", "dermatosis_or_ectoparasites"),
]


class DiseaseMappingServiceTests(unittest.IsolatedAsyncioTestCase):
    def _get_test_service(self) -> DiseaseMappingService:
        service = DiseaseMappingService()
        service._catalog = TEST_CATALOG.copy()
        service._alias_entries = TEST_ALIASES[:]
        service._aliases = {
            (e.source_type, e.normalized_alias, e.species): e.canonical_code
            for e in TEST_ALIASES
        }
        return service

    async def test_refresh_from_db_replaces_snapshot(self):
        service = self._get_test_service()
        catalog = {
            "ocular_infection": service._catalog["ocular_infection"],
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
        service = self._get_test_service()
        service._aliases[("emr", "otitis", "dog")] = "otitis_or_ear_parasites"

        mapped = service.map_label(raw_label="otitis", source_type="emr", species="dog")

        self.assertTrue(mapped.mapped)
        self.assertEqual(mapped.canonical_code, "otitis_or_ear_parasites")

    async def test_resolve_label_skips_llm_when_exact_alias_exists(self):
        service = self._get_test_service()

        with patch.object(
            service,
            "_resolve_with_llm",
            new=AsyncMock(),
        ) as llm_mock:
            result = await service.resolve_label(
                raw_label="viem ket mac",
                source_type="emr",
                species="cat",
            )

        self.assertTrue(result.mapped)
        self.assertEqual(result.canonical_code, "ocular_infection")
        llm_mock.assert_not_awaited()

    async def test_resolve_label_maps_existing_canonical_and_learns_alias(self):
        service = self._get_test_service()

        with (
            patch.object(
                service,
                "_resolve_with_llm",
                new=AsyncMock(
                    return_value=CanonicalizationDecision(
                        action="map_existing",
                        canonical_code="bacterial_dermatosis",
                        display_name_vi="Viêm da do vi khuẩn",
                        alias_text="pyoderma nong",
                        confidence=0.95,
                    )
                ),
            ),
            patch.object(
                service,
                "_upsert_alias",
                new=AsyncMock(return_value=True),
            ) as alias_mock,
        ):
            result = await service.resolve_label(
                raw_label="pyoderma nong",
                source_type="emr",
                species="dog",
            )

        self.assertTrue(result.mapped)
        self.assertEqual(result.canonical_code, "bacterial_dermatosis")
        alias_mock.assert_awaited_once()

    async def test_resolve_label_creates_new_canonical_when_confidence_is_high(self):
        service = self._get_test_service()

        async def fake_create(**kwargs):
            service._catalog["superficial_pyoderma"] = DiseaseCatalogEntry(
                canonical_code="superficial_pyoderma",
                display_name_vi="Viêm da mủ nông",
                species="all",
            )
            return True

        with (
            patch.object(
                service,
                "_resolve_with_llm",
                new=AsyncMock(
                    return_value=CanonicalizationDecision(
                        action="create_new",
                        canonical_code="superficial_pyoderma",
                        display_name_vi="Viêm da mủ nông",
                        alias_text="viem da mu nong",
                        confidence=0.97,
                    )
                ),
            ),
            patch.object(
                service,
                "_create_canonical_and_alias",
                new=AsyncMock(side_effect=fake_create),
            ) as create_mock,
        ):
            result = await service.resolve_label(
                raw_label="viem da mu nong",
                source_type="emr",
                species="dog",
            )

        self.assertTrue(result.mapped)
        self.assertEqual(result.canonical_code, "superficial_pyoderma")
        create_mock.assert_awaited_once()

    async def test_resolve_label_keeps_provisional_when_llm_confidence_is_low(self):
        service = self._get_test_service()

        with (
            patch.object(
                service,
                "_resolve_with_llm",
                new=AsyncMock(
                    return_value=CanonicalizationDecision(
                        action="map_existing",
                        canonical_code="bacterial_dermatosis",
                        display_name_vi="Viêm da do vi khuẩn",
                        alias_text="benh la",
                        confidence=0.41,
                    )
                ),
            ),
            patch.object(
                service,
                "record_unmapped_label",
                new=AsyncMock(),
            ) as record_mock,
        ):
            result = await service.resolve_label(
                raw_label="benh la",
                source_type="emr",
                species="dog",
            )

        self.assertFalse(result.mapped)
        self.assertIsNone(result.canonical_code)
        record_mock.assert_awaited_once()

    def test_find_canonical_in_text_finds_alias_in_free_text(self):
        service = self._get_test_service()

        result = service.find_canonical_in_text(
            text="Con chó bị viêm da và ngứa",
            species="dog",
        )

        self.assertTrue(result.mapped)
        self.assertEqual(result.canonical_code, "dermatosis_or_ectoparasites")

    def test_find_canonical_in_text_returns_unmapped_for_no_match(self):
        service = self._get_test_service()

        result = service.find_canonical_in_text(
            text="Con mèo bị bệnh lạ không có trong catalog",
            species="cat",
        )

        self.assertFalse(result.mapped)
        self.assertIsNone(result.canonical_code)

    def test_map_many_batch_mapping(self):
        service = self._get_test_service()

        results = service.map_many(
            labels=["viem da", "viem ket mac", "benh khong ton tai"],
            source_type="emr",
        )

        self.assertEqual(len(results), 3)
        self.assertTrue(results[0].mapped)
        self.assertEqual(results[0].canonical_code, "dermatosis_or_ectoparasites")
        self.assertTrue(results[1].mapped)
        self.assertEqual(results[1].canonical_code, "ocular_infection")
        self.assertFalse(results[2].mapped)

    def test_find_canonical_in_text_prefers_specific_species(self):
        service = self._get_test_service()
        service._alias_entries.append(
            type(
                "AliasEntry",
                (),
                {
                    "source_type": "emr",
                    "alias_text": "viem da cho",
                    "normalized_alias": "viem da cho",
                    "canonical_code": "canine_dermatosis",
                    "species": "dog",
                },
            )()
        )

        result = service.find_canonical_in_text(
            text="Con chó bị viem da cho",
            preferred_source_types=["emr"],
            species="dog",
        )

        self.assertTrue(result.mapped)
        self.assertEqual(result.canonical_code, "canine_dermatosis")


if __name__ == "__main__":
    unittest.main()
