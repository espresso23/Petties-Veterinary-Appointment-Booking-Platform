package com.petties.petties.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Vaccination Record - Sổ tiêm chủng (MongoDB)
 * 
 * Stores vaccination history for pets.
 * Query patterns: findByPetId, findByNextDueDateBetween (for reminders)
 */
@Document(collection = "vaccination_records")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VaccinationRecord {

    @Id
    private String id;

    @Indexed
    private UUID petId;

    private UUID bookingId;
    private UUID vetId;
    private UUID clinicId;

    // Denormalized for display
    private String clinicName;
    private String vetName;

    private String vaccineName;
    private String batchNumber;

    private LocalDate vaccinationDate;

    @Indexed
    private LocalDate nextDueDate;

    // Track reminder notification status
    private Boolean reminderSent;

    private String notes;

    @CreatedDate
    private LocalDateTime createdAt;
}
