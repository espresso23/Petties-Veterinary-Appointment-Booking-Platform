package com.petties.petties.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * VaccineDosePrice - Giá vắc-xin theo mũi tiêm
 * 
 * Mỗi dịch vụ vắc-xin (ClinicService) có thể có nhiều mức giá
 * tùy theo số mũi tiêm (1, 2, 3, hoặc nhắc lại hằng năm).
 * Clinic Owner cấu hình giá, Staff chọn khi tiêm.
 */
@Entity
@Table(name = "vaccine_dose_prices", uniqueConstraints = @UniqueConstraint(columnNames = { "service_id",
        "dose_number" }))
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class VaccineDosePrice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id", nullable = false)
    private ClinicService service;

    /**
     * Số mũi tiêm: 1, 2, 3, 4 (4 = annual booster / nhắc lại hằng năm)
     */
    @Column(name = "dose_number", nullable = false)
    private Integer doseNumber;

    /**
     * Nhãn hiển thị: "Mũi 1", "Mũi 2", "Nhắc lại hằng năm"
     */
    @Column(name = "dose_label", length = 50)
    private String doseLabel;

    /**
     * Giá của mũi tiêm này
     */
    @Column(name = "price", nullable = false, precision = 19, scale = 2)
    private BigDecimal price;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
