package com.petties.petties.dto.emr;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Response DTO for EMR Record
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmrResponse {

    private String id;
    private UUID petId;
    private UUID bookingId;
    private String bookingCode;
    private UUID vetId;
    private UUID clinicId;

    // Denormalized for display
    private String clinicName;
    private String vetName;
    private String petName;
    private String petSpecies;
    private String petBreed;
    private String ownerName;

    // ========== SOAP NOTES ==========
    private String subjective;
    private String objective;
    private String assessment;
    private String plan;
    private String notes;

    // ========== VITALS ==========
    private BigDecimal weightKg;
    private BigDecimal temperatureC;
    private Integer heartRate;
    private Integer bcs;

    // ========== EMBEDDED COLLECTIONS ==========
    private List<PrescriptionDto> prescriptions;
    private List<EmrImageDto> images;

    private LocalDateTime examinationDate;
    private LocalDateTime reExaminationDate;
    private LocalDateTime createdAt;

    /**
     * EMR is locked (read-only) if created more than 24 hours ago
     */
    private boolean isLocked;
}
