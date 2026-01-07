package com.petties.petties.dto.vetshift;

import com.petties.petties.model.enums.SlotStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;
import java.util.UUID;

/**
 * Response DTO for a single Slot
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SlotResponse {
    private UUID slotId;
    private LocalTime startTime;
    private LocalTime endTime;
    private SlotStatus status;

    // Booking info (populated when status is BOOKED)
    private UUID bookingId;
    private String petName;
    private String petOwnerName;
    private String serviceName;
}
