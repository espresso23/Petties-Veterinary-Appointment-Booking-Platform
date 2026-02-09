package com.petties.petties.dto.tracking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * DTO for broadcasting Staff location to Pet Owner.
 * Contains enriched data including ETA if available.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LocationUpdateResponse {

    private UUID bookingId;

    private BigDecimal latitude;

    private BigDecimal longitude;

    /**
     * Estimated Time of Arrival in minutes (optional)
     */
    private Integer etaMinutes;

    /**
     * Distance remaining in km (optional)
     */
    private Double distanceKm;

    /**
     * When the location was last updated
     */
    private Instant lastUpdated;

    /**
     * Status message for UI display
     */
    private String statusMessage;
}
