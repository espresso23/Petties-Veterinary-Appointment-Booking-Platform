package com.petties.petties.dto.booking;

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
    private UUID serviceId;
}
