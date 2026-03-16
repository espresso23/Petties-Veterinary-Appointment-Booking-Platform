package com.petties.petties.model;

import com.petties.petties.model.enums.RefundApplicationStatus;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Đơn hoàn tiền: Clinic nộp đơn để rút phần doanh thu sau khi trừ 5% phí nền
 * tảng.
 * Admin duyệt (APPROVED/REJECTED).
 */
@Entity
@Table(name = "refund_applications", indexes = {
        @Index(name = "idx_refund_app_clinic", columnList = "clinic_id"),
        @Index(name = "idx_refund_app_status", columnList = "status"),
        @Index(name = "idx_refund_app_created", columnList = "created_at")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "refund_application_id", updatable = false, nullable = false)
    private UUID refundApplicationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", nullable = false)
    private Clinic clinic;

    /** Tháng/năm đơn (ví dụ 2026-03) */
    @Column(name = "period_year_month", nullable = false, length = 7)
    private String periodYearMonth;

    /** Doanh thu tháng này (VND) */
    @Column(name = "month_revenue", nullable = false, precision = 19, scale = 2)
    private BigDecimal monthRevenue;

    /** Phần trăm web khấu trừ (mặc định 5) */
    @Column(name = "web_deduction_percent", nullable = false)
    @Builder.Default
    private Integer webDeductionPercent = 5;

    /** Số tiền web khấu trừ (VND) */
    @Column(name = "web_deduction_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal webDeductionAmount;

    /** Doanh thu từ QR (VND) */
    @Column(name = "qr_revenue", nullable = false, precision = 19, scale = 2)
    private BigDecimal qrRevenue;

    /** Doanh thu từ Tiền mặt (VND) */
    @Column(name = "cash_revenue", nullable = false, precision = 19, scale = 2)
    private BigDecimal cashRevenue;

    /** Số tiền yêu cầu rút (Amount After Deduction) */
    @Column(name = "requested_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal requestedAmount;

    /** Số tiền nhận được (Sau khi cân đối QR - (5% Cash + 5% QR)) */
    @Column(name = "amount_after_deduction", nullable = false, precision = 19, scale = 2)
    private BigDecimal amountAfterDeduction;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private RefundApplicationStatus status = RefundApplicationStatus.PENDING;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
