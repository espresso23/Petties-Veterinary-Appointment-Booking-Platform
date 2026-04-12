package com.petties.petties.model;

import com.petties.petties.model.enums.ServiceCategory;
import com.petties.petties.model.enums.VoucherDiscountType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Voucher Entity - Voucher giảm giá do Admin tạo
 *
 * Relationships:
 * - OneToMany: ClinicVoucher (các clinic đã áp dụng)
 * - ManyToOne: User (createdBy - admin)
 */
@Entity
@Table(name = "vouchers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Voucher {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "voucher_id", updatable = false, nullable = false)
    private UUID voucherId;

    @Column(name = "code", nullable = false, unique = true, length = 50)
    private String code;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    // ========== DISCOUNT INFO ==========

    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type", nullable = false, length = 20)
    private VoucherDiscountType discountType;

    @Column(name = "discount_value", nullable = false, precision = 12, scale = 2)
    private BigDecimal discountValue;

    @Column(name = "max_discount_amount", precision = 12, scale = 2)
    private BigDecimal maxDiscountAmount; // Giới hạn giảm tối đa (chỉ dùng cho PERCENTAGE)

    // ========== CONDITIONS ==========

    @Column(name = "min_order_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal minOrderAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "applicable_category", length = 100)
    private ServiceCategory applicableCategory; // NULL = áp dụng cho tất cả dịch vụ

    // ========== USAGE LIMIT ==========

    @Column(name = "used_count", nullable = false)
    @Builder.Default
    private Integer usedCount = 0;

    @Column(name = "require_online_payment", nullable = false)
    @Builder.Default
    private Boolean requireOnlinePayment = false;

    @Column(name = "limit_one_per_user", nullable = false)
    @Builder.Default
    private Boolean limitOnePerUser = false;

    // ========== DATE ==========

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    // ========== STATUS ==========

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    // ========== AUDIT ==========

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // ========== RELATIONSHIPS ==========

    @OneToMany(mappedBy = "voucher", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ClinicVoucher> clinicVouchers = new ArrayList<>();

    // ========== HELPER METHODS ==========

    /**
     * Kiểm tra voucher có đang hợp lệ không (active + trong hạn + còn lượt dùng)
     */
    public boolean isValid() {
        LocalDate today = LocalDate.now();
        boolean withinDate = !today.isBefore(startDate) && !today.isAfter(endDate);
        return Boolean.TRUE.equals(isActive) && withinDate;
    }

    /**
     * Tính số tiền được giảm dựa trên tổng đơn
     */
    public BigDecimal calculateDiscount(BigDecimal orderAmount) {
        if (orderAmount.compareTo(minOrderAmount) < 0) {
            return BigDecimal.ZERO;
        }
        if (discountType == VoucherDiscountType.FIXED_AMOUNT) {
            return discountValue.min(orderAmount);
        }
        // PERCENTAGE
        BigDecimal discount = orderAmount.multiply(discountValue)
                .divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
        if (maxDiscountAmount != null) {
            discount = discount.min(maxDiscountAmount);
        }
        return discount;
    }
}
