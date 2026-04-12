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
     * Optional: Manual staff assignment (if provided, skip auto-assign)
     */
    private UUID assignedStaffId;

    /**
     * Optional: Manager notes
     */
    private String managerNotes;

    /**
     * Allow partial confirmation: Confirm booking even if some services don't have available staff
     * Manager can manually assign staff later
     */
    private Boolean allowPartial;

    /**
     * Remove unavailable services: Confirm booking but remove services without available staff
     * Price will be recalculated accordingly
     */
    private Boolean removeUnavailableServices;

    /**
     * Optional: Selected staff ID from the dropdown (manual selection by manager)
     * If provided, this staff will be assigned to ALL services instead of auto-assign
     * Takes precedence over assignedStaffId (same behavior, but named for UI clarity)
     */
    private UUID selectedStaffId;

    // ========== DEPRECATED - keeping for backward compatibility ==========

    /**
     * @deprecated Use assignedStaffId instead. Kept for backward compatibility.
     */
    @Deprecated
    public UUID getAssignedStaffIdLegacy() {
        return assignedStaffId;
    }

    /**
     * @deprecated Use selectedStaffId instead. Kept for backward compatibility.
     */
    @Deprecated
    public UUID getSelectedStaffIdLegacy() {
        return selectedStaffId;
    }
}
