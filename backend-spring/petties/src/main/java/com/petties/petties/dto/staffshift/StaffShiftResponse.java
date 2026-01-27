package com.petties.petties.dto.staffshift;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Response DTO for StaffShift with slots
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffShiftResponse {
    private UUID shiftId;
    private UUID staffId;
    private String staffName;
    private String staffAvatar;
    private UUID clinicId;
    private LocalDate workDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private LocalTime breakStart;
    private LocalTime breakEnd;
    private Boolean isOvernight;

    // For overnight shifts displayed on the next day
    private Boolean isContinuation; // true if this is the "next day" portion of an overnight shift
    private LocalDate displayDate; // The date this entry is being shown on (may differ from workDate)

    private String notes;
    private LocalDateTime createdAt;

    // Slot statistics
    private int totalSlots;
    private int availableSlots;
    private int bookedSlots;
    private int blockedSlots;

    // Detailed slots (optional, for detail view)
    private List<SlotResponse> slots;
}
