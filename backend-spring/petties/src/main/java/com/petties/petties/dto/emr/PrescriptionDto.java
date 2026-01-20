package com.petties.petties.dto.emr;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for Prescription item in EMR
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PrescriptionDto {
    private String medicineName;
    private String dosage;
    private String frequency;
    private Integer durationDays;
    private String instructions;
}
