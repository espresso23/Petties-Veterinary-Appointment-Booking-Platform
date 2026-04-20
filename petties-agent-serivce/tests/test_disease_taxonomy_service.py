"""
Tests for Disease Taxonomy Service

Tests taxonomy classification, loading, and integration with disease mapping.
"""

import pytest
from app.core.services.disease_taxonomy_service import (
    DiseaseTaxonomyService,
    get_disease_taxonomy_service,
    TaxonomyClassification,
)


class TestDiseaseTaxonomyService:
    """Test taxonomy service functionality."""

    @pytest.fixture
    def service(self):
        """Get taxonomy service instance."""
        return get_disease_taxonomy_service()

    def test_taxonomy_loads_successfully(self, service):
        """Test taxonomy loads from JSON without errors."""
        stats = service.get_taxonomy_stats()
        assert stats["total_diseases"] >= 50
        assert stats["total_systems"] >= 10

    def test_taxonomy_has_expected_systems(self, service):
        """Test taxonomy contains expected body systems."""
        stats = service.get_taxonomy_stats()
        systems = stats.get("systems", {})

        # Check key systems exist
        assert any("Hô Hấp" in k or "HO_HAP" in k for k in systems.keys())
        assert any("Tiêu Hóa" in k or "TIEU_HOA" in k for k in systems.keys())
        assert any("Tiết Niệu" in k or "TIEU_NIEU" in k for k in systems.keys())

    def test_get_disease_info_returns_correct_data(self, service):
        """Test getting disease info from taxonomy."""
        # Test with known disease from taxonomy
        disease = service.get_disease_info("pneumonia")
        assert disease is not None
        assert "viêm phổi" in disease.display_name_vi.lower()
        assert "dog" in disease.species
        assert "cat" in disease.species

    def test_list_diseases_with_species_filter(self, service):
        """Test listing diseases filtered by species."""
        dog_diseases = service.list_diseases(species="dog")
        cat_diseases = service.list_diseases(species="cat")

        assert len(dog_diseases) > 0
        assert len(cat_diseases) > 0

        # Some diseases apply to both
        all_diseases = service.list_diseases()
        assert len(all_diseases) >= len(dog_diseases)
        assert len(all_diseases) >= len(cat_diseases)

    def test_taxonomy_includes_leptospirosis(self, service):
        """Test that leptospirosis is in taxonomy (critical for self-learning)."""
        disease = service.get_disease_info("leptospirosis")
        assert disease is not None
        assert "lepto" in disease.aliases or "xoắn khuẩn" in disease.aliases

    def test_taxonomy_includes_cardiomyopathy(self, service):
        """Test that cardiomyopathy is in taxonomy."""
        dcm = service.get_disease_info("dilated_cardiomyopathy")
        assert dcm is not None
        assert "DCM" in dcm.aliases

        hcm = service.get_disease_info("hypertrophic_cardiomyopathy")
        assert hcm is not None
        assert "HCM" in hcm.aliases

    def test_taxonomy_stats_returns_complete_data(self, service):
        """Test taxonomy stats returns all expected fields."""
        stats = service.get_taxonomy_stats()

        assert "total_diseases" in stats
        assert "total_systems" in stats
        assert "systems" in stats
        assert "species_count" in stats
        assert stats["total_diseases"] >= 50
        assert stats["species_count"]["dog"] > 0
        assert stats["species_count"]["cat"] > 0


class TestDiseaseMappingThreshold:
    """Test that disease mapping has reduced confidence threshold."""

    def test_create_new_confidence_reduced(self):
        """Test CREATE_NEW_CONFIDENCE threshold is 0.85 (not 0.94)."""
        from app.core.services.disease_mapping_service import DiseaseMappingService

        assert DiseaseMappingService.CREATE_NEW_CONFIDENCE == 0.85


class TestTaxonomyIntegration:
    """Integration tests for taxonomy with disease mapping."""

    def test_map_label_accepts_taxonomy_hint(self):
        """Test map_label method accepts taxonomy_hint parameter."""
        from app.core.services.disease_mapping_service import DiseaseMappingService

        mapper = DiseaseMappingService()

        # Should not raise error with taxonomy_hint
        result = mapper.map_label(
            raw_label="viêm phổi",
            source_type="test",
            species="dog",
            taxonomy_hint="pneumonia",
        )
        # Result may or may not be mapped, but should not error
        assert result is not None

    def test_taxonomy_service_singleton(self):
        """Test taxonomy service singleton works correctly."""
        service1 = get_disease_taxonomy_service()
        service2 = get_disease_taxonomy_service()

        assert service1 is service2  # Same instance
