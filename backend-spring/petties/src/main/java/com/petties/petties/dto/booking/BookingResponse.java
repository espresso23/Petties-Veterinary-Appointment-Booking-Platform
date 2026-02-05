package com.petties.petties.dto.booking;

import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Response DTO for booking details
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingResponse {

    private UUID bookingId;
    private String bookingCode;
    private String emrId; // Linked EMR ID if exists

    // ========== PET INFO ==========
    private UUID petId;
    private String petName;
    private String petSpecies;
    private String petBreed;
    private String petAge;
    private String petPhotoUrl;
    private Double petWeight; // Weight in kg for price calculation display

    // ========== OWNER INFO ==========
    private UUID ownerId;
    private String ownerName;
    private String ownerPhone;
    private String ownerEmail;
    private String ownerAvatarUrl;
    private String ownerAddress; // Pet owner's registered address

    // ========== CLINIC INFO ==========
    private UUID clinicId;
    private String clinicName;
    private String clinicAddress;
    private String clinicPhone;

    // ========== STAFF INFO ==========
    private UUID assignedStaffId;
    private String assignedStaffName;
    private String assignedStaffSpecialty;
    private String assignedStaffAvatarUrl;

    // ========== PAYMENT INFO ==========
    private String paymentStatus; // PENDING, PAID, REFUNDED, FAILED
    private String paymentMethod; // CASH, QR, CARD

    // ========== BOOKING INFO ==========
    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate bookingDate;

    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "HH:mm:ss")
    private LocalTime bookingTime;

    private BookingType type;
    private BookingStatus status;
    private BigDecimal totalPrice;
    private String notes;

    // ========== SERVICES ==========
    private List<BookingServiceItemResponse> services;

    // ========== HOME VISIT INFO ==========
    private String homeAddress;
    private BigDecimal homeLat;
    private BigDecimal homeLong;
    private BigDecimal distanceKm;
    private BigDecimal distanceFee; // Home visit fee (pricePerKm × distanceKm) applied once

    // ========== TIMESTAMPS ==========
    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    /**
     * Nested DTO for booking service items
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BookingServiceItemResponse {
        private UUID bookingServiceId; // BookingServiceItem ID (junction table PK)
        private UUID serviceId; // ClinicService ID
        private String serviceName;
        private String serviceCategory;
        private BigDecimal price;
        private Integer slotsRequired;
        private Integer durationMinutes;

        // Pricing breakdown fields
        private BigDecimal basePrice; // Original service base price
        private BigDecimal weightPrice; // Price tier based on pet weight

        // Assigned staff info for this specific service
        private UUID assignedStaffId;
        private String assignedStaffName;
        private String assignedStaffAvatarUrl;
        private String assignedStaffSpecialty;

        // Scheduled time for this service
        @com.fasterxml.jackson.annotation.JsonFormat(pattern = "HH:mm:ss")
        private LocalTime scheduledStartTime;

        @com.fasterxml.jackson.annotation.JsonFormat(pattern = "HH:mm:ss")
        private LocalTime scheduledEndTime;

        private Boolean isAddOn;
    }
}
