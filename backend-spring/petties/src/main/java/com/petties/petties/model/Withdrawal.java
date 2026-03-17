package com.petties.petties.model;

import com.petties.petties.model.enums.WithdrawalStatus;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity để tracking các lần rút tiền thực tế của clinic
 * Khi admin duyệt refund application, hệ thống sẽ tạo withdrawal record
 */
@Entity
@Table(name = "withdrawals", indexes = {
        @Index(name = "idx_withdrawal_clinic", columnList = "clinic_id"),
        @Index(name = "idx_withdrawal_status", columnList = "status"),
        @Index(name = "idx_withdrawal_created", columnList = "created_at")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Withdrawal {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "withdrawal_id", updatable = false, nullable = false)
    private UUID withdrawalId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", nullable = false)
    private Clinic clinic;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "refund_application_id", nullable = false)
    private RefundApplication refundApplication;

    /** Số tiền clinic yêu cầu rút */
    @Column(name = "requested_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal requestedAmount;

    /** Số tiền thực tế được chuyển (sau khi trừ các phí nếu có) */
    @Column(name = "transferred_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal transferredAmount;

    /** Phí nền tảng đã trừ (5%) */
    @Column(name = "platform_fee", nullable = false, precision = 19, scale = 2)
    private BigDecimal platformFee;

    /** Phí giao dịch (nếu có) */
    @Column(name = "transaction_fee", precision = 19, scale = 2)
    private BigDecimal transactionFee;

    /** Ghi chú cho admin */
    @Column(name = "admin_notes", columnDefinition = "TEXT")
    private String adminNotes;

    /** Thông tin chuyển tiền (transaction ID, reference...) */
    @Column(name = "transfer_reference", length = 255)
    private String transferReference;

    /** Trạng thái rút tiền */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private WithdrawalStatus status = WithdrawalStatus.PENDING;

    /** Admin đã duyệt withdrawal này */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private User approvedBy;

    /** Thời gian duyệt */
    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    /** Thời gian chuyển tiền thành công */
    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    /** Lý do thất bại/thu hồi */
    @Column(name = "failure_reason", columnDefinition = "TEXT")
    private String failureReason;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
