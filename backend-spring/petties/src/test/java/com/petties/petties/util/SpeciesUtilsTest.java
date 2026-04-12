package com.petties.petties.util;

import com.petties.petties.model.enums.PetSpecies;
import com.petties.petties.model.enums.TargetSpecies;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for SpeciesUtils utility class
 */
@DisplayName("SpeciesUtils Tests")
class SpeciesUtilsTest {

    @Nested
    @DisplayName("isVaccineCompatible Tests")
    class IsVaccineCompatibleTests {

        @Test
        @DisplayName("Vaccine BOTH should be compatible with all species")
        void vaccineTarget_BOTH_shouldBeCompatibleWithAllSpecies() {
            for (PetSpecies species : PetSpecies.values()) {
                assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.BOTH, species))
                        .as("BOTH vaccine should be compatible with %s", species)
                        .isTrue();
            }
        }

        @Test
        @DisplayName("DOG vaccine should only be compatible with DOG")
        void dogVaccine_shouldOnlyBeCompatibleWithDog() {
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.DOG, PetSpecies.DOG))
                    .isTrue();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.DOG, PetSpecies.CAT))
                    .isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.DOG, PetSpecies.BIRD))
                    .isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.DOG, PetSpecies.RABBIT))
                    .isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.DOG, PetSpecies.HAMSTER))
                    .isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.DOG, PetSpecies.FISH))
                    .isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.DOG, PetSpecies.OTHER))
                    .isFalse();
        }

        @Test
        @DisplayName("CAT vaccine should only be compatible with CAT")
        void catVaccine_shouldOnlyBeCompatibleWithCat() {
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.CAT, PetSpecies.CAT))
                    .isTrue();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.CAT, PetSpecies.DOG))
                    .isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.CAT, PetSpecies.BIRD))
                    .isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.CAT, PetSpecies.RABBIT))
                    .isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.CAT, PetSpecies.HAMSTER))
                    .isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.CAT, PetSpecies.FISH))
                    .isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.CAT, PetSpecies.OTHER))
                    .isFalse();
        }

        @ParameterizedTest
        @EnumSource(value = PetSpecies.class, names = {"BIRD", "RABBIT", "HAMSTER", "FISH", "OTHER"})
        @DisplayName("Other species (BIRD, RABBIT, etc.) should not be compatible with DOG or CAT vaccines")
        void otherSpecies_shouldNotBeCompatibleWithDogOrCatVaccines(PetSpecies species) {
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.DOG, species))
                    .as("%s should not be compatible with DOG vaccine", species)
                    .isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.CAT, species))
                    .as("%s should not be compatible with CAT vaccine", species)
                    .isFalse();
            // But should be compatible with BOTH
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.BOTH, species))
                    .as("%s should be compatible with BOTH vaccine", species)
                    .isTrue();
        }

        @Test
        @DisplayName("Null vaccine target should return false")
        void nullVaccineTarget_shouldReturnFalse() {
            assertThat(SpeciesUtils.isVaccineCompatible(null, PetSpecies.DOG)).isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(null, PetSpecies.CAT)).isFalse();
        }

        @Test
        @DisplayName("Null pet species should return false")
        void nullPetSpecies_shouldReturnFalse() {
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.DOG, null)).isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.CAT, null)).isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.BOTH, null)).isFalse();
        }

        @Test
        @DisplayName("Both null should return false")
        void bothNull_shouldReturnFalse() {
            assertThat(SpeciesUtils.isVaccineCompatible(null, null)).isFalse();
        }
    }

    @Nested
    @DisplayName("getVietnameseName (PetSpecies) Tests")
    class GetVietnameseNamePetSpeciesTests {

        @ParameterizedTest
        @CsvSource({
                "DOG, Chó",
                "CAT, Mèo",
                "BIRD, Chim",
                "RABBIT, Thỏ",
                "HAMSTER, Hamster",
                "FISH, Cá",
                "OTHER, Khác"
        })
        @DisplayName("Should return correct Vietnamese name for each species")
        void shouldReturnCorrectVietnameseName(PetSpecies species, String expectedName) {
            assertThat(SpeciesUtils.getVietnameseName(species)).isEqualTo(expectedName);
        }

        @Test
        @DisplayName("Null species should return 'Không xác định'")
        void nullSpecies_shouldReturnUnknown() {
            assertThat(SpeciesUtils.getVietnameseName((PetSpecies) null)).isEqualTo("Không xác định");
        }
    }

    @Nested
    @DisplayName("getVietnameseName (TargetSpecies) Tests")
    class GetVietnameseNameTargetSpeciesTests {

        @ParameterizedTest
        @CsvSource({
                "DOG, chó",
                "CAT, mèo",
                "BOTH, chó và mèo"
        })
        @DisplayName("Should return correct Vietnamese name for each target species")
        void shouldReturnCorrectVietnameseName(TargetSpecies targetSpecies, String expectedName) {
            assertThat(SpeciesUtils.getVietnameseName(targetSpecies)).isEqualTo(expectedName);
        }

        @Test
        @DisplayName("Null target species should return 'Không xác định'")
        void nullTargetSpecies_shouldReturnUnknown() {
            assertThat(SpeciesUtils.getVietnameseName((TargetSpecies) null)).isEqualTo("Không xác định");
        }
    }

    @Nested
    @DisplayName("Real-world Scenarios")
    class RealWorldScenarios {

        @Test
        @DisplayName("Scenario: Pet owner with DOG tries to book CAT vaccine - should fail")
        void dogOwner_bookingCatVaccine_shouldFail() {
            // Given
            PetSpecies petSpecies = PetSpecies.DOG;
            TargetSpecies vaccineTarget = TargetSpecies.CAT;

            // When
            boolean isCompatible = SpeciesUtils.isVaccineCompatible(vaccineTarget, petSpecies);

            // Then
            assertThat(isCompatible).isFalse();
        }

        @Test
        @DisplayName("Scenario: Pet owner with CAT tries to book rabies vaccine (BOTH) - should succeed")
        void catOwner_bookingRabiesVaccine_shouldSucceed() {
            // Given
            PetSpecies petSpecies = PetSpecies.CAT;
            TargetSpecies vaccineTarget = TargetSpecies.BOTH; // Rabies is typically for both

            // When
            boolean isCompatible = SpeciesUtils.isVaccineCompatible(vaccineTarget, petSpecies);

            // Then
            assertThat(isCompatible).isTrue();
        }

        @Test
        @DisplayName("Scenario: Pet owner with BIRD tries any specific vaccine - should fail for DOG/CAT vaccines")
        void birdOwner_bookingDogOrCatVaccine_shouldFail() {
            // Given
            PetSpecies petSpecies = PetSpecies.BIRD;

            // When/Then
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.DOG, petSpecies)).isFalse();
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.CAT, petSpecies)).isFalse();
            // But general vaccine should work
            assertThat(SpeciesUtils.isVaccineCompatible(TargetSpecies.BOTH, petSpecies)).isTrue();
        }
    }
}
