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

    // ====== New schema fields (preferred) ======
    /**
     * Danh sách thời điểm uống trong ngày: sang, trua, chieu
     */
    private java.util.List<String> timesOfDay;

    /**
     * Thời điểm so với bữa ăn: BEFORE_MEAL, AFTER_MEAL, WITH_MEAL, NONE
     */
    private String beforeAfterMeal;

    /**
     * Ghi chú tần suất dạng text tự do (ví dụ: 2 lần/ngày, mỗi 8 giờ)
     */
    private String frequencyNote;

    private Integer durationDays;

    /**
     * Hướng dẫn sử dụng chi tiết: trước/sau ăn, uống với gì, theo dõi gì, v.v.
     */
    private String instructions;

    // ====== Legacy fields for backward-compat only (đọc nhưng không hiển thị trực tiếp) ======
    private String dosage;
    private String frequency;
}
