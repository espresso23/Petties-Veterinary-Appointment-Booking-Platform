package com.petties.petties.dto.booking;

import lombok.*;
import java.util.UUID;

/**
 * Request DTO for reassigning vet to a booking service
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReassignVetRequest {

    private UUID bookingServiceItemId; // Specific service to reassign
    private UUID newVetId; // New vet to assign
}
