package com.petties.petties.dto.booking;

import lombok.*;
import java.util.List;
import java.util.UUID;

/**
 * DTO for staff dropdown options when confirming a booking
 * Used to display available staff for manual selection by Clinic Manager
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffOptionDTO {

    /**
     * Staff's user ID
     */
    private UUID staffId;

    /**
     * Staff's full name
     */
    private String fullName;

    /**
     * Staff's avatar URL
     */
    private String avatarUrl;

    /**
     * Staff's specialty (enum name: STAFF_GENERAL, STAFF_SURGERY, etc.)
     */
    private String specialty;

    /**
     * Staff's specialty in Vietnamese (e.g., "Nhân viên thú y tổng quát")
     */
    private String specialtyLabel;

    /**
     * True if this staff is the suggested staff from check-staff-availability
     * The suggested staff is auto-determined by the system based on:
     * - Matching specialty with service requirements
     * - Available slots at booking time
     * - Load balancing (least bookings on that date)
     */
    private boolean isSuggested;

    /**
     * Number of bookings this staff has on the booking date
     * Helps manager make informed decision based on workload
     */
    private int bookingCount;

    /**
     * True if staff has available slots for at least one service in the booking
     */
    private boolean hasAvailableSlots;

    /**
     * List of BookingServiceItem IDs that this staff is available for
     */
    private List<UUID> availableServiceItemIds;

    /**
     * If not available, reason why (e.g., "Không có ca làm việc", "Không đủ slot trống")
     */
    private String unavailableReason;
}
