package com.petties.petties.dto.booking;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Request DTO for getting available time slots
 * Used by Pet Owners during booking wizard (Step 2: Time Selection)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AvailableSlotsRequest {

    @NotNull(message = "Clinic ID is required")
    private UUID clinicId;

    @NotNull(message = "Date is required")
    private LocalDate date;

    @NotNull(message = "At least one service is required")
    private List<UUID> serviceIds;
}
