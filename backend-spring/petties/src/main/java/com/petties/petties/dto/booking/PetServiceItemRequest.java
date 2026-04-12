package com.petties.petties.dto.booking;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * One pet with its selected service IDs for multi-pet booking.
 * Used inside BookingRequest.items.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PetServiceItemRequest {

    @NotNull(message = "Mã thú cưng không được để trống")
    private UUID petId;

    @NotEmpty(message = "Vui lòng chọn ít nhất một dịch vụ cho thú cưng này")
    private List<UUID> serviceIds;
}
