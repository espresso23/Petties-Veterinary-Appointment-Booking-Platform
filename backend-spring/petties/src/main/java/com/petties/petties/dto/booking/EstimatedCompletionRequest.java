package com.petties.petties.dto.booking;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.petties.petties.model.enums.BookingType;

/**
 * Request DTO for calculating estimated completion time
 * Supports multi-pet format similar to BookingRequest
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EstimatedCompletionRequest {

    /** Start date and time of the booking */
    @NotNull(message = "Thời gian bắt đầu không được để trống")
    private LocalDateTime startDateTime;

    /** Booking type (IN_CLINIC, HOME_VISIT, etc.) */
    @NotNull(message = "Loại đặt lịch không được để trống")
    private BookingType type;

    /**
     * Multi-pet mode: each item = one pet + list of service IDs
     * Format: pets: [{ petId, petWeight, serviceIds: [...] }]
     */
    @NotEmpty(message = "Vui lòng chọn ít nhất một thú cưng với dịch vụ")
    @Valid
    private List<PetEstimation> pets;

    /**
     * Pet with its weight and selected services
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PetEstimation {
        /** Pet ID (optional - for future pet info lookup) */
        private UUID petId;

        /** Pet weight in kg - for duration/price adjustments */
        private Double petWeight;

        /** List of service IDs for this pet */
        @NotEmpty(message = "Vui lòng chọn ít nhất một dịch vụ")
        private List<UUID> serviceIds;
    }
}
