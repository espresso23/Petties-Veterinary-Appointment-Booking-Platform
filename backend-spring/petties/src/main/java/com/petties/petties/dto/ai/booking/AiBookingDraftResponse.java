package com.petties.petties.dto.ai.booking;

import com.petties.petties.model.enums.BookingType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Response DTO for AI booking draft/preview.
 * Supports both single-pet (legacy) and multi-pet modes.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiBookingDraftResponse {

    /**
     * Single booking summary (for single-pet mode or legacy).
     */
    private BookingSummary bookingSummary;

    /**
     * Multiple booking summaries (for multi-pet mode).
     * When non-null and non-empty, this takes precedence over single summary.
     */
    private List<BookingSummary> bookingSummaries;

    /**
     * Overall summary for multi-pet booking.
     */
    private MultiPetSummary multiPetSummary;

    /**
     * Draft payload for confirmation.
     */
    private Map<String, Object> draftPayload;

    /**
     * Whether the draft is ready for confirmation.
     */
    private boolean readyToConfirm;

    /**
     * Individual booking summary.
     */
    @lombok.Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BookingSummary {
        private String petName;
        private String petId;
        private String clinicName;
        private String clinicId;
        private List<String> services;
        private List<String> serviceIds;
        private String bookingDate;
        private String startTime;
        private String endTime;
        private BookingType bookingType;
        private BigDecimal estimatedTotal;
        private BigDecimal serviceTotal;
        private BigDecimal distanceFee;
        private BigDecimal sosFee;
        private String homeAddress;
        private boolean managerWillConfirm;
        private String note;
    }

    /**
     * Summary for multi-pet booking.
     */
    @lombok.Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MultiPetSummary {
        private int totalPets;
        private int totalServices;
        private String petNames;
        private String clinicName;
        private String bookingDate;
        private String startTime;
        private BookingType bookingType;
        private BigDecimal estimatedTotal;
        private BigDecimal serviceTotal;
        private String homeAddress;
        private boolean managerWillConfirm;
    }
}
