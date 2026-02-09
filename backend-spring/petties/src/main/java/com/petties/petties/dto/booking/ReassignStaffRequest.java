package com.petties.petties.dto.booking;

import lombok.*;
import java.util.UUID;

/**
 * Request DTO for reassigning staff to a booking service
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReassignStaffRequest {

    private UUID bookingServiceItemId; // Specific service to reassign
    private UUID newStaffId; // New staff to assign
}
