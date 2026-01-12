package com.petties.petties.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * EMR Record - Electronic Medical Record (MongoDB)
 * 
 * Stores SOAP notes with embedded images and prescriptions.
 * Query patterns: findByPetId, findByBookingId
 */
@Document(collection = "emr_records")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmrRecord {

    @Id
    private String id;

    @Indexed
    private UUID petId;

    @Indexed
    private UUID bookingId;

    private UUID vetId;
    private UUID clinicId;

    // Denormalized for display
    private String clinicName;
    private String vetName;

    // ========== SOAP NOTES ==========
    private String subjective; // S - Triệu chứng do chủ nuôi mô tả
    private String objective; // O - Quan sát lâm sàng
    private String assessment; // A - Chẩn đoán bệnh
    private String plan; // P - Phác đồ điều trị
    private String notes; // Ghi chú thêm

    // ========== VITALS ==========
    private BigDecimal weightKg;
    private BigDecimal temperatureC;

    // ========== EMBEDDED COLLECTIONS ==========
    @Builder.Default
    private List<com.petties.petties.model.EmrImage> images = List.of();

    @Builder.Default
    private List<com.petties.petties.model.Prescription> prescriptions = List.of();

    private LocalDateTime examinationDate;

    @CreatedDate
    private LocalDateTime createdAt;
}
