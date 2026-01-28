package com.petties.petties.dto.booking;

import lombok.*;
import java.util.UUID;

/**
 * DTO for vet dropdown options when confirming a booking
 * Used to display available vets for manual selection by Clinic Manager
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VetOptionDTO {

    /**
     * Vet's user ID
     */
    private UUID vetId;

    /**
     * Vet's full name
     */
    private String fullName;

    /**
     * Vet's avatar URL
     */
    private String avatarUrl;

    /**
     * Vet's specialty (enum name: VET_GENERAL, VET_SURGERY, etc.)
     */
    private String specialty;

    /**
     * Vet's specialty in Vietnamese (e.g., "Bác sĩ thú y tổng quát")
     */
    private String specialtyLabel;

    /**
     * True if this vet is the suggested vet from check-vet-availability
     * The suggested vet is auto-determined by the system based on:
     * - Matching specialty with service requirements
     * - Available slots at booking time
     * - Load balancing (least bookings on that date)
     */
    private boolean isSuggested;

    /**
     * Number of bookings this vet has on the booking date
     * Helps manager make informed decision based on workload
     */
    private int bookingCount;

    /**
     * True if vet has available slots at the booking time
     */
    private boolean hasAvailableSlots;

    /**
     * If not available, reason why (e.g., "Không có ca làm việc", "Không đủ slot trống")
     */
    private String unavailableReason;
}
