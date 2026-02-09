package com.petties.petties.dto.tracking;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * DTO for real-time location updates from Staff during SOS/Home Visit bookings.
 * Staff sends this payload every 5-10 seconds while traveling to the customer.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LocationUpdateRequest {

    @NotNull(message = "Booking ID is required")
    private UUID bookingId;

    @NotNull(message = "Latitude is required")
    private BigDecimal latitude;

    @NotNull(message = "Longitude is required")
    private BigDecimal longitude;

    /**
     * Current speed in km/h (optional, for ETA calculation)
     */
    private Double currentSpeed;

    /**
     * Timestamp when the location was captured on the device
     */
    private Instant timestamp;
}
