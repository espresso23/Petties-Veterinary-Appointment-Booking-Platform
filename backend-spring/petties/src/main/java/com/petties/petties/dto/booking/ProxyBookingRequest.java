package com.petties.petties.dto.booking;

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
 * Request DTO for creating a proxy booking (đặt hộ).
 * Used when a logged-in user books on behalf of someone else.
 * Supports multi-pet with multi-service like the regular BookingRequest.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProxyBookingRequest {

    // ========== RECIPIENT INFO (REQUIRED) ==========

    /**
     * Information about the person for whom the booking is made.
     */
    @Valid
    @NotNull(message = "Thông tin người được đặt hộ không được để trống")
    private ProxyRecipientInfo recipient;

    // ========== PETS + SERVICES (REQUIRED) ==========

    /**
     * List of pets with their services.
     * Each item contains pet info (to create) + list of service IDs.
     * Supports multiple pets with different services.
     */
    @Valid
    @NotEmpty(message = "Vui lòng thêm ít nhất một thú cưng với dịch vụ")
    private List<ProxyPetServiceItem> items;

    // ========== BOOKING INFO ==========

    @NotNull(message = "Mã phòng khám không được để trống")
    private UUID clinicId;

    @NotNull(message = "Ngày đặt lịch không được để trống")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate bookingDate;

    @NotNull(message = "Giờ đặt lịch không được để trống")
    @JsonFormat(pattern = "HH:mm")
    private LocalTime bookingTime;

    @NotNull(message = "Loại lịch hẹn không được để trống")
    private BookingType type;

    // ========== HOME VISIT INFO (OPTIONAL) ==========

    private String homeAddress;
    private BigDecimal homeLat;
    private BigDecimal homeLong;
    private BigDecimal distanceKm;

    // ========== NOTES ==========

    private String notes;
}
