package com.petties.petties.dto.voucher;

import com.petties.petties.model.ClinicVoucher;
import com.petties.petties.model.enums.ServiceCategory;
import com.petties.petties.model.enums.VoucherDiscountType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class ClinicVoucherResponse {

    private UUID clinicVoucherId;
    private UUID voucherId;
    private String code;
    private String name;
    private String description;
    private VoucherDiscountType discountType;
    private BigDecimal discountValue;
    private BigDecimal maxDiscountAmount;
    private BigDecimal minOrderAmount;
    private ServiceCategory applicableCategory;
    private Boolean requireOnlinePayment;
    private Boolean limitOnePerUser;
    private Integer usedCount;
    private LocalDate startDate;
    private LocalDate endDate;
    private Boolean voucherActive;
    private Boolean isVoucherValid; // Runtime check
    private Boolean isEnabled; // Toggle by admin
    private LocalDateTime appliedAt;
    private String appliedByName;
    // Discount amount for display (optional, populated when order amount known)
    private BigDecimal discountAmount;

    public static ClinicVoucherResponse from(ClinicVoucher cv) {
        ClinicVoucherResponse r = new ClinicVoucherResponse();
        r.clinicVoucherId = cv.getClinicVoucherId();
        var v = cv.getVoucher();
        r.voucherId = v.getVoucherId();
        r.code = v.getCode();
        r.name = v.getName();
        r.description = v.getDescription();
        r.discountType = v.getDiscountType();
        r.discountValue = v.getDiscountValue();
        r.maxDiscountAmount = v.getMaxDiscountAmount();
        r.minOrderAmount = v.getMinOrderAmount();
        r.applicableCategory = v.getApplicableCategory();
        r.requireOnlinePayment = v.getRequireOnlinePayment();
        r.limitOnePerUser = v.getLimitOnePerUser();
        r.usedCount = v.getUsedCount();
        r.startDate = v.getStartDate();
        r.endDate = v.getEndDate();
        r.voucherActive = v.getIsActive();
        r.isVoucherValid = v.isValid();
        r.isEnabled = cv.getIsEnabled();
        r.appliedAt = cv.getAppliedAt();
        if (cv.getAppliedBy() != null) {
            r.appliedByName = cv.getAppliedBy().getFullName();
        }
        return r;
    }

    public static ClinicVoucherResponse fromWithDiscount(ClinicVoucher cv, BigDecimal orderAmount) {
        ClinicVoucherResponse r = from(cv);
        r.discountAmount = cv.getVoucher().calculateDiscount(orderAmount);
        return r;
    }

    // Getters
    public UUID getClinicVoucherId() { return clinicVoucherId; }
    public UUID getVoucherId() { return voucherId; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public VoucherDiscountType getDiscountType() { return discountType; }
    public BigDecimal getDiscountValue() { return discountValue; }
    public BigDecimal getMaxDiscountAmount() { return maxDiscountAmount; }
    public BigDecimal getMinOrderAmount() { return minOrderAmount; }
    public ServiceCategory getApplicableCategory() { return applicableCategory; }
    public Boolean getRequireOnlinePayment() { return requireOnlinePayment; }
    public Boolean getLimitOnePerUser() { return limitOnePerUser; }
    public Integer getUsedCount() { return usedCount; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public Boolean getVoucherActive() { return voucherActive; }
    public Boolean getIsVoucherValid() { return isVoucherValid; }
    public Boolean getIsEnabled() { return isEnabled; }
    public LocalDateTime getAppliedAt() { return appliedAt; }
    public String getAppliedByName() { return appliedByName; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
}
