package com.petties.petties.dto.booking;

import lombok.*;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * DTO for alternative time slot suggestion
 * When a service doesn't have an available staff, suggest other dates/times
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlternativeTimeSlot {

    /**
     * Required specialty enum name (e.g., "VET_DENTAL")
     */
    private String specialty;

    /**
     * Required specialty Vietnamese label (e.g., "Bác sĩ nha khoa thú y")
     */
    private String specialtyLabel;

    /**
     * Alternative date
     */
    private LocalDate date;

    /**
     * Available time slots on this date (e.g., ["08:00", "09:00", "10:30"])
     */
    private List<String> availableTimes;

    /**
     * Staff name available on this date
     */
    private String staffName;

    /**
     * Staff ID available on this date
     */
    private UUID staffId;
}
