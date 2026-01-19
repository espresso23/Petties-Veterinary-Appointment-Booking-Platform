package com.petties.petties.dto.booking;

import com.petties.petties.model.enums.BookingType;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Request DTO for creating a new booking
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingRequest {

    @NotNull(message = "Pet ID is required")
    private UUID petId;

    @NotNull(message = "Clinic ID is required")
    private UUID clinicId;

    @NotNull(message = "Booking date is required")
    private LocalDate bookingDate;

    @NotNull(message = "Booking time is required")
    private LocalTime bookingTime;

    @NotNull(message = "Booking type is required")
    private BookingType type;

    /**
     * List of service IDs to book
     */
    @NotNull(message = "At least one service is required")
    private List<UUID> serviceIds;

    /**
     * For Home Visit / SOS bookings
     */
    private String homeAddress;
    private BigDecimal homeLat;
    private BigDecimal homeLong;

    /**
     * Distance in kilometers for home visit fee calculation
     */
    private BigDecimal distanceKm;

    /**
     * Optional notes from pet owner
     */
    private String notes;
}
