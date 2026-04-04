package com.petties.petties.dto.voucher;

import com.petties.petties.model.Voucher;
import com.petties.petties.model.enums.ServiceCategory;
import com.petties.petties.model.enums.VoucherDiscountType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class VoucherResponse {

    private UUID voucherId;
    private String code;
    private String name;
    private String description;
    private VoucherDiscountType discountType;
    private BigDecimal discountValue;
    private BigDecimal maxDiscountAmount;
    private BigDecimal minOrderAmount;
    private ServiceCategory applicableCategory;
    private Integer usedCount;
    private LocalDate startDate;
    private LocalDate endDate;
    private Boolean isActive;
    private Boolean isValid; // Runtime check
    private Boolean requireOnlinePayment;
    private Boolean limitOnePerUser;
    private LocalDateTime createdAt;
    private String createdByName;

    public static VoucherResponse from(Voucher v) {
        VoucherResponse r = new VoucherResponse();
        r.voucherId = v.getVoucherId();
        r.code = v.getCode();
        r.name = v.getName();
        r.description = v.getDescription();
        r.discountType = v.getDiscountType();
        r.discountValue = v.getDiscountValue();
        r.maxDiscountAmount = v.getMaxDiscountAmount();
        r.minOrderAmount = v.getMinOrderAmount();
        r.applicableCategory = v.getApplicableCategory();
        r.usedCount = v.getUsedCount();
        r.startDate = v.getStartDate();
        r.endDate = v.getEndDate();
        r.isActive = v.getIsActive();
        r.isValid = v.isValid();
        r.requireOnlinePayment = v.getRequireOnlinePayment();
        r.limitOnePerUser = v.getLimitOnePerUser();
        r.createdAt = v.getCreatedAt();
        if (v.getCreatedBy() != null) {
            r.createdByName = v.getCreatedBy().getFullName();
        }
        return r;
    }

    // Getters
    public UUID getVoucherId() { return voucherId; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public VoucherDiscountType getDiscountType() { return discountType; }
    public BigDecimal getDiscountValue() { return discountValue; }
    public BigDecimal getMaxDiscountAmount() { return maxDiscountAmount; }
    public BigDecimal getMinOrderAmount() { return minOrderAmount; }
    public ServiceCategory getApplicableCategory() { return applicableCategory; }
    public Integer getUsedCount() { return usedCount; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public Boolean getIsActive() { return isActive; }
    public Boolean getIsValid() { return isValid; }
    public Boolean getRequireOnlinePayment() { return requireOnlinePayment; }
    public Boolean getLimitOnePerUser() { return limitOnePerUser; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public String getCreatedByName() { return createdByName; }
}
