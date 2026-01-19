package com.petties.petties.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Request DTO for confirming a booking (Manager action)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingConfirmRequest {

    /**
     * Optional: Manual vet assignment (if provided, skip auto-assign)
     */
    private UUID assignedVetId;

    /**
     * Optional: Manager notes
     */
    private String managerNotes;

    /**
     * Allow partial confirmation: Confirm booking even if some services don't have available vets
     * Manager can manually assign vets later
     */
    private Boolean allowPartial;

    /**
     * Remove unavailable services: Confirm booking but remove services without available vets
     * Price will be recalculated accordingly
     */
    private Boolean removeUnavailableServices;

    /**
     * Optional: Selected vet ID from the dropdown (manual selection by manager)
     * If provided, this vet will be assigned to ALL services instead of auto-assign
     * Takes precedence over assignedVetId (same behavior, but named for UI clarity)
     */
    private UUID selectedVetId;
}
