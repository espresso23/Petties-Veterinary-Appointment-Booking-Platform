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
    private UUID staffId;
    private UUID clinicId;

    // Display info
    private String clinicName;
    private String staffName;

    private String vaccineName;
    private String batchNumber;

    private LocalDate vaccinationDate;
    private LocalDate nextDueDate;

    private String notes;
    private LocalDateTime createdAt;

    // Status helpers
    private String status; // 'Valid', 'Expiring Soon', 'Overdue'
}
