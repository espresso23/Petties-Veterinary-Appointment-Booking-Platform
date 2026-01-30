package com.petties.petties.dto.emr;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Request DTO for creating a new EMR Record (SOAP notes)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateEmrRequest {

    @NotNull(message = "Pet ID is required")
    private UUID petId;

    private UUID bookingId;

    // ========== SOAP NOTES ==========
    private String subjective; // S - Triệu chứng từ chủ nuôi

    private String objective; // O - Quan sát lâm sàng

    @NotBlank(message = "Assessment/Diagnosis is required")
    private String assessment; // A - Chẩn đoán (bắt buộc)

    @NotBlank(message = "Treatment plan is required")
    private String plan; // P - Kế hoạch điều trị (bắt buộc)

    private String notes; // Ghi chú thêm

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
}
