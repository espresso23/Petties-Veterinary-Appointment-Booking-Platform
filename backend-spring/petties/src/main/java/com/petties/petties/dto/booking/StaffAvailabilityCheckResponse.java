package com.petties.petties.dto.booking;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

/**
 * Response DTO for checking staff availability before confirming a booking
 * Used to warn the manager if some services don't have available staff
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffAvailabilityCheckResponse {

    /**
     * True if ALL services in the booking have available staff
     */
    private boolean allServicesHaveStaff;

    /**
     * Detailed availability for each service
     */
    private List<ServiceAvailability> services;

    /**
     * Alternative time slots for services without available staff
     * Suggests other dates/times when the required specialty is available
     */
    private List<AlternativeTimeSlot> alternativeTimeSlots;

    /**
     * Total price reduction if unavailable services are removed
     */
    private BigDecimal priceReductionIfRemoved;
}
