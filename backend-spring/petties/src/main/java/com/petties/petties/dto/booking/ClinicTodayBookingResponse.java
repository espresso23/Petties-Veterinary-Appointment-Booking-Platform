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
 * Response DTO for Staff Shared Visibility - Clinic Today Bookings
 * Extends BookingResponse with isMyAssignment flag for staff context
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClinicTodayBookingResponse {

    private UUID bookingId;
    private String bookingCode;
    private String emrId;

    // ========== SHARED VISIBILITY FLAG ==========
    /**
     * True if current staff is assigned to ANY service in this booking
     * Used to highlight "my" bookings in the shared clinic view
     */
    private Boolean isMyAssignment;

    // ========== PET INFO ==========
    private UUID petId;
    private String petName;
    private String petSpecies;
    private String petBreed;
    private String petAge;
    private String petPhotoUrl;
    private Double petWeight;

    // ========== OWNER INFO ==========
    private UUID ownerId;
    private String ownerName;
    private String ownerPhone;
    private String ownerEmail;
    private String ownerAvatarUrl;
    private String ownerAddress;

    // ========== CLINIC INFO ==========
    private UUID clinicId;
    private String clinicName;
    private String clinicAddress;
    private String clinicPhone;

    // ========== STAFF INFO (Primary assigned staff) ==========
    private UUID assignedStaffId;
    private String assignedStaffName;
    private String assignedStaffSpecialty;
    private String assignedStaffAvatarUrl;

    // ========== PAYMENT INFO ==========
    private String paymentStatus;
    private String paymentMethod;

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
    private BigDecimal distanceFee;

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
        private UUID bookingServiceId;
        private UUID serviceId;
        private String serviceName;
        private String serviceCategory;
        private BigDecimal price;
        private Integer slotsRequired;
        private Integer durationMinutes;

        private BigDecimal basePrice;
        private BigDecimal weightPrice;

        private UUID assignedStaffId;
        private String assignedStaffName;
        private String assignedStaffAvatarUrl;
        private String assignedStaffSpecialty;

        @com.fasterxml.jackson.annotation.JsonFormat(pattern = "HH:mm:ss")
        private LocalTime scheduledStartTime;

        @com.fasterxml.jackson.annotation.JsonFormat(pattern = "HH:mm:ss")
        private LocalTime scheduledEndTime;

        private Boolean isAddOn;
    }
}
