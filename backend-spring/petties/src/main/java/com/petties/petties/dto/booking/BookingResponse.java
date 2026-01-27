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

    // ========== VET INFO ==========
    private UUID assignedVetId;
    private String assignedVetName;
    private String assignedVetSpecialty;
    private String assignedVetAvatarUrl;

    // ========== PAYMENT INFO ==========
    private String paymentStatus; // PENDING, PAID, REFUNDED, FAILED
    private String paymentMethod; // CASH, QR, CARD

    // ========== BOOKING INFO ==========
    private LocalDate bookingDate;
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

        // Assigned vet info for this specific service
        private UUID assignedVetId;
        private String assignedVetName;
        private String assignedVetAvatarUrl;
        private String assignedVetSpecialty;

        // Scheduled time for this service
        private LocalTime scheduledStartTime;
        private LocalTime scheduledEndTime;
    }
}
