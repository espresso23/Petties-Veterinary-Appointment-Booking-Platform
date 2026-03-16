package com.petties.petties.model;

import com.petties.petties.model.enums.BalanceTransactionType;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity tracking balance của clinic
 * Tracking tổng số tiền clinic có thể rút
 */
@Entity
@Table(name = "clinic_balances", indexes = {
        @Index(name = "idx_clinic_balance_clinic", columnList = "clinic_id")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClinicBalance {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "clinic_balance_id", updatable = false, nullable = false)
    private UUID clinicBalanceId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", nullable = false, unique = true)
    private Clinic clinic;

    /** Balance hiện tại của clinic */
    @Column(name = "current_balance", nullable = false, precision = 19, scale = 2)
    private BigDecimal currentBalance;

    /** Tổng số tiền đã rút thành công */
    @Column(name = "total_withdrawn", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalWithdrawn;

    /** Tổng phí nền tảng đã trừ */
    @Column(name = "total_platform_fees", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalPlatformFees;

    /** Tổng phí giao dịch */
    @Column(name = "total_transaction_fees", nullable = false, precision = 19, scale = 2)
    private BigDecimal totalTransactionFees;

    /** Ghi chú */
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false, updatable = false)
    private LocalDateTime updatedAt;
}
