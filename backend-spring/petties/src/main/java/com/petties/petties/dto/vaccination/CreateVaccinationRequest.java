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

    @NotBlank(message = "Vaccine name is required")
    private String vaccineName;

    private String batchNumber;

    @NotNull(message = "Vaccination date is required")
    private LocalDate vaccinationDate;

    private LocalDate nextDueDate;

    private String notes;
}
