package com.petties.petties.dto.ai.booking;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.petties.petties.model.enums.BookingType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
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
 * Request DTO for AI booking draft/preview.
 * Supports both single-pet (legacy) and multi-pet modes.
 * 
 * Multi-pet mode: When `items` is non-null and non-empty, the system creates
 * multiple bookings (one per pet) with the same clinic, date, time, and booking type.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiBookingDraftRequest {

    // ========== SHARED FIELDS (used in both modes) ==========
    
    @NotNull(message = "Ma phong kham khong duoc de trong")
    private UUID clinicId;

    @NotNull(message = "Ngay dat lich khong duoc de trong")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate bookingDate;

    @NotNull(message = "Gio bat dau khong duoc de trong")
    @JsonFormat(pattern = "HH:mm")
    private LocalTime startTime;

    private BookingType bookingType;
    private String notes;
    private String homeAddress;
    private BigDecimal homeLat;
    private BigDecimal homeLong;
    private BigDecimal distanceKm;

    // ========== SINGLE-PET MODE (legacy) ==========
    // Used when `items` is null or empty
    
    /**
     * Pet ID for single-pet mode. Ignored when items is provided.
     */
    private UUID petId;

    /**
     * Service IDs for single-pet mode. Applied to all pets when items is provided.
     */
    private List<UUID> serviceIds;

    // ========== MULTI-PET MODE ==========
    // When items is non-null and non-empty, single-pet fields are ignored
    
    /**
     * Multi-pet mode: list of pet + service combinations.
     * When non-null and non-empty, each item creates a separate booking.
     * serviceIds (single-pet) is ignored in this mode.
     */
    @Valid
    private List<AiPetItemRequest> items;

    /**
     * Common services applied to ALL pets in multi-pet mode.
     * These services are ADDED to each pet's own services.
     */
    private List<UUID> commonServiceIds;
}
