import pytest
from unittest.mock import patch
from app.core.services.disease_mapping_service import DiseaseCatalogEntry, DiseaseAliasEntry

# Mock data for ALL tests to maintain stability after removing defaults
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
    "otitis_or_ear_parasites": DiseaseCatalogEntry(
        canonical_code="otitis_or_ear_parasites",
        display_name_vi="Viêm tai ngoài hoặc bệnh tai ký sinh trùng",
    ),
}

TEST_ALIASES = [
    DiseaseAliasEntry("emr", "viem da do vi khuan", "viem da do vi khuan", "bacterial_dermatosis"),
    DiseaseAliasEntry("vision", "bacterial dermatitis", "bacterial dermatitis", "bacterial_dermatosis"),
    DiseaseAliasEntry("kb", "viem da vi khuan", "viem da vi khuan", "bacterial_dermatosis"),
    DiseaseAliasEntry("kb", "viêm da do vi khuẩn", "viêm da do vi khuẩn", "bacterial_dermatosis"),
    DiseaseAliasEntry("emr", "viem ket mac", "viem ket mac", "ocular_infection"),
    DiseaseAliasEntry("emr", "nhiem trung mat", "nhiem trung mat", "ocular_infection"),
    DiseaseAliasEntry("kb", "benh mat", "benh mat", "ocular_infection"),
    DiseaseAliasEntry("emr", "viem tai ngoai", "viem tai ngoai", "otitis_or_ear_parasites"),
    DiseaseAliasEntry("emr", "ghe tai", "ghe tai", "otitis_or_ear_parasites"),
    DiseaseAliasEntry("emr", "viem da", "viem da", "dermatosis_or_ectoparasites"),
]

@pytest.fixture(autouse=True)
def setup_test_disease_catalog():
    """Globally inject test disease catalog into DiseaseMappingService for all tests."""
    from app.core.services.disease_mapping_service import get_disease_mapping_service
    
    service = get_disease_mapping_service()
    # Override the empty defaults with our test data
    service._catalog = TEST_CATALOG.copy()
    service._alias_entries = TEST_ALIASES[:]
    service._aliases = {
        (e.source_type, e.normalized_alias, e.species): e.canonical_code
        for e in TEST_ALIASES
    }
    yield
    # No need to reset as it's a singleton and tests should be independent anyway
