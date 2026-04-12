package com.petties.petties.util;

import com.petties.petties.model.enums.PetSpecies;
import com.petties.petties.model.enums.TargetSpecies;

/**
 * Utility class for species-related validations
 * Used to check vaccine compatibility with pet species
 */
public final class SpeciesUtils {

    private SpeciesUtils() {
        // Utility class - prevent instantiation
    }

    /**
     * Check if a vaccine is compatible with a pet species
     *
     * @param vaccineTarget the target species of the vaccine (DOG, CAT, BOTH)
     * @param petSpecies    the species of the pet
     * @return true if the vaccine is compatible with the pet species
     */
    public static boolean isVaccineCompatible(TargetSpecies vaccineTarget, PetSpecies petSpecies) {
        if (vaccineTarget == null || petSpecies == null) {
            return false;
        }

        // BOTH vaccines are compatible with all species
        if (vaccineTarget == TargetSpecies.BOTH) {
            return true;
        }

        // Only DOG and CAT have specific vaccines
        if (petSpecies == PetSpecies.DOG) {
            return vaccineTarget == TargetSpecies.DOG;
        }
        if (petSpecies == PetSpecies.CAT) {
            return vaccineTarget == TargetSpecies.CAT;
        }

        // Other species (BIRD, RABBIT, HAMSTER, FISH, OTHER)
        // → only BOTH vaccines allowed, but we already checked BOTH above
        return false;
    }

    /**
     * Get Vietnamese display name for PetSpecies
     *
     * @param species the pet species enum
     * @return Vietnamese name for the species
     */
    public static String getVietnameseName(PetSpecies species) {
        if (species == null) {
            return "Không xác định";
        }
        return switch (species) {
            case DOG -> "Chó";
            case CAT -> "Mèo";
            case BIRD -> "Chim";
            case RABBIT -> "Thỏ";
            case HAMSTER -> "Hamster";
            case FISH -> "Cá";
            case OTHER -> "Khác";
        };
    }

    /**
     * Get Vietnamese display name for TargetSpecies
     *
     * @param targetSpecies the target species enum
     * @return Vietnamese name for the target species
     */
    public static String getVietnameseName(TargetSpecies targetSpecies) {
        if (targetSpecies == null) {
            return "Không xác định";
        }
        return switch (targetSpecies) {
            case DOG -> "chó";
            case CAT -> "mèo";
            case BOTH -> "chó và mèo";
        };
    }
}
