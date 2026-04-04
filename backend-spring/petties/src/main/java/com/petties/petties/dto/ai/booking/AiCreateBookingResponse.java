package com.petties.petties.dto.ai.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO for AI booking creation.
 * Returns multiple bookings for multi-pet mode.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiCreateBookingResponse {

    /**
     * Single booking response (for single-pet mode or legacy).
     */
    private BookingResult booking;

    /**
     * Multiple bookings response (for multi-pet mode).
     * When non-null and non-empty, this takes precedence over single booking.
     */
    private List<BookingResult> bookings;

    /**
     * Summary for multi-pet booking.
     */
    private MultiPetSummary multiPetSummary;

    /**
     * Overall success status.
     */
    private boolean success;

    /**
     * Human-readable message.
     */
    private String message;

    /**
     * Individual booking result.
     */
    @lombok.Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BookingResult {
        private String bookingId;
        private String bookingCode;
        private String status;
        private String petName;
        private String clinicName;
        private String bookingDate;
        private String bookingTime;
        private boolean managerWillConfirm;
        private List<String> services;
    }

    /**
     * Summary for multi-pet booking.
     */
    @lombok.Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MultiPetSummary {
        private int totalBookings;
        private int successCount;
        private int failureCount;
        private String petNames;
        private String clinicName;
        private String bookingDate;
        private String bookingTime;
        private boolean managerWillConfirm;
    }
}
