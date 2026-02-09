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
 * Pet info with its selected service IDs for proxy booking.
 * In proxy booking, we create a new pet for the recipient.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProxyPetServiceItem {

    /**
     * Pet information for creating a new pet.
     */
    @Valid
    @NotNull(message = "Thông tin thú cưng không được để trống")
    private ProxyPetInfo pet;

    /**
     * List of service IDs for this pet.
     */
    @NotEmpty(message = "Vui lòng chọn ít nhất một dịch vụ cho thú cưng này")
    private List<UUID> serviceIds;
}
