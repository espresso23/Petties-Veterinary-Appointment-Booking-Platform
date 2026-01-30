package com.petties.petties.dto.vaccination;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VaccinationResponse {

    private String id;
    private UUID petId;
    private UUID bookingId;
    private UUID vetId;
    private UUID clinicId;

    // Display info
    private String clinicName;
    private String vetName;

    private String vaccineName;
    private UUID vaccineTemplateId;
    private Integer doseNumber;
    private UUID seriesId;
    private Integer totalDoses;
    // Removed batchNumber

    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate vaccinationDate;

    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate nextDueDate;

    private String notes;

    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    // Status helpers
    private String status; // 'Valid', 'Expiring Soon', 'Overdue'
}
