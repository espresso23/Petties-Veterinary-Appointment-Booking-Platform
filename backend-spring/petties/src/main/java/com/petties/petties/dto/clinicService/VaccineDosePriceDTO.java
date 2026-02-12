package com.petties.petties.dto.clinicService;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * DTO for vaccine dose price
 * Represents the price of a specific dose for a vaccination service
 */
public record VaccineDosePriceDTO(
        UUID id,
        Integer doseNumber,
        String doseLabel,
        BigDecimal price,
        Boolean isActive) {
    /**
     * Create DTO from entity
     */
    public static VaccineDosePriceDTO fromEntity(com.petties.petties.model.VaccineDosePrice entity) {
        return new VaccineDosePriceDTO(
                entity.getId(),
                entity.getDoseNumber(),
                entity.getDoseLabel(),
                entity.getPrice(),
                entity.getIsActive());
    }
}
