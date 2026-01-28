package com.petties.petties.dto.booking;

import lombok.*;
import java.util.List;
import java.util.UUID;

/**
 * Response DTO for available vet for reassignment
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AvailableVetResponse {

    private UUID vetId;
    private String vetName;
    private String avatarUrl;
    private String specialty;

    private boolean available; // Has shift and slots available
    private int bookedCount; // Number of bookings on this day
    private List<String> availableSlots; // List of available slot times (HH:mm)

    private String unavailableReason; // If not available, reason why
}
