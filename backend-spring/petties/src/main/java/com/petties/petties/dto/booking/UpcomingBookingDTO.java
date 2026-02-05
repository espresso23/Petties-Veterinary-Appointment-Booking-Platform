package com.petties.petties.dto.booking;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Simplified booking info for upcoming list display
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpcomingBookingDTO {
    private UUID bookingId;
    private String bookingCode;

    // Pet info
    private String petName;
    private String petSpecies;
    private String petPhotoUrl;

    // Owner info
    private String ownerName;
    private String ownerPhone;

    // Booking info
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate bookingDate;

    @JsonFormat(pattern = "HH:mm:ss")
    private LocalTime bookingTime;

    @JsonFormat(pattern = "HH:mm:ss")
    private LocalTime endTime; // Calculated from services duration
    private BookingType type;
    private BookingStatus status;
    private BigDecimal totalPrice;

    // Primary service name (first service or aggregated)
    private String primaryServiceName;
    private int servicesCount; // Total number of services in booking

    // Home visit address (null for IN_CLINIC)
    private String homeAddress;
}
