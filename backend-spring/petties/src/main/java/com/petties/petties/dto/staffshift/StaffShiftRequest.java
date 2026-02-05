package com.petties.petties.dto.staffshift;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Request DTO for creating StaffShift(s)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StaffShiftRequest {

    @Min(value = 1, message = "Repeat weeks must be at least 1")
    @Max(value = 12, message = "Cannot schedule more than 12 weeks in advance")
    private Integer repeatWeeks = 1;

    @NotNull(message = "Staff ID is required")
    private UUID staffId;

    @NotNull(message = "Work dates are required")
    private List<LocalDate> workDates;

    @NotNull(message = "Start time is required")
    private LocalTime startTime;

    @NotNull(message = "End time is required")
    private LocalTime endTime;

    // Optional break time
    private LocalTime breakStart;
    private LocalTime breakEnd;

    // Overnight shift flag - if true, endTime is on the following day
    private Boolean isOvernight = false;

    // Force update - if true, delete existing shifts and create new ones
    private Boolean forceUpdate = false;

    // Optional notes
    private String notes;
}
