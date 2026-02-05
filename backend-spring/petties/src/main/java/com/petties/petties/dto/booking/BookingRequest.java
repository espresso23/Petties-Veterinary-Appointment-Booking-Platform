package com.petties.petties.dto.booking;

import com.fasterxml.jackson.annotation.JsonFormat;
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

    @NotNull(message = "Mã thú cưng không được để trống")
    private UUID petId;

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

    /**
     * List of service IDs to book
     */
    @NotNull(message = "Vui lòng chọn ít nhất một dịch vụ")
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
