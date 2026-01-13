package com.petties.petties.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Prescription - Đơn thuốc trong bệnh án
 * 
 * Embedded document trong EmrRecord (MongoDB)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Prescription {
    private String medicineName;
    private String dosage;
    private String frequency;
    private Integer durationDays;
    private String instructions;
}
