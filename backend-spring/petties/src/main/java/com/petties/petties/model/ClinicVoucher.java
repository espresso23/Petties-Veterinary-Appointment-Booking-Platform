package com.petties.petties.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * ClinicVoucher Entity - Liên kết Voucher với Clinic
 *
 * Clinic Manager áp dụng voucher cho clinic của mình.
 * Admin có thể bật/tắt (is_enabled).
 */
@Entity
@Table(name = "clinic_vouchers",
        uniqueConstraints = @UniqueConstraint(columnNames = {"voucher_id", "clinic_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClinicVoucher {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "clinic_voucher_id", updatable = false, nullable = false)
    private UUID clinicVoucherId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "voucher_id", nullable = false)
    private Voucher voucher;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinic_id", nullable = false)
    private Clinic clinic;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "applied_by")
    private User appliedBy; // Clinic Manager đã apply

    @Column(name = "is_enabled", nullable = false)
    @Builder.Default
    private Boolean isEnabled = true; // Admin có thể toggle

    @CreationTimestamp
    @Column(name = "applied_at", nullable = false, updatable = false)
    private LocalDateTime appliedAt;
}
