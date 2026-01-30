package com.petties.petties.dto.vaccination;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateVaccinationRequest {

    @NotNull(message = "Pet ID is required")
    private UUID petId;

    private UUID bookingId;

    private UUID vaccineTemplateId; // Optional: Link to master data

    @NotBlank(message = "Vaccine name is required")
    private String vaccineName;

    @NotNull(message = "Vaccination date is required")
    private LocalDate vaccinationDate;

    private LocalDate nextDueDate;

    private String doseSequence; // Values: "1", "2", "3", "BOOSTER", "AD_HOC"

    private String notes;
}
