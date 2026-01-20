package com.petties.petties.dto.booking;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

/**
 * Response DTO for checking vet availability before confirming a booking
 * Used to warn the manager if some services don't have available vets
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VetAvailabilityCheckResponse {

    /**
     * True if ALL services in the booking have available vets
     */
    private boolean allServicesHaveVets;

    /**
     * Detailed availability for each service
     */
    private List<ServiceAvailability> services;

    /**
     * Alternative time slots for services without available vets
     * Suggests other dates/times when the required specialty is available
     */
    private List<AlternativeTimeSlot> alternativeTimeSlots;

    /**
     * Total price reduction if unavailable services are removed
     */
    private BigDecimal priceReductionIfRemoved;
}
