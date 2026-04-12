package com.petties.petties.dto.booking;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Request DTO for adding a service to an active booking
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AddServiceRequest {
    @NotNull(message = "Mã dịch vụ không được để trống")
    private UUID serviceId;
}
