package com.petties.petties.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;
import java.util.List;

/**
 * Response DTO for available time slots
 * Returns list of time slots where booking can be made
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AvailableSlotsResponse {

    /**
     * List of available start times (30-minute intervals)
     * Example: [08:00, 08:30, 09:00, 14:00, 14:30]
     */
    private List<LocalTime> availableSlots;

    /**
     * Total number of available slots
     */
    private int totalSlots;

    /**
     * Debug info (optional, for development)
     * Shows why slots are unavailable
     */
    private String debugInfo;
}
