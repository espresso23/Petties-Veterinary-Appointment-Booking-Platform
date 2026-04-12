package com.petties.petties.dto.voucher;

import com.petties.petties.model.enums.ServiceCategory;
import com.petties.petties.model.enums.VoucherDiscountType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public class VoucherUpdateRequest {

    @NotBlank(message = "Tên voucher không được để trống")
    @Size(max = 255, message = "Tên voucher không được dài quá 255 ký tự")
    private String name;

    private String description;

    @NotNull(message = "Loại giảm giá không được để trống")
    private VoucherDiscountType discountType;

    @NotNull(message = "Giá trị giảm không được để trống")
    @Min(value = 0, message = "Giá trị giảm phải lớn hơn hoặc bằng 0")
    private BigDecimal discountValue;

    private BigDecimal maxDiscountAmount;

    private BigDecimal minOrderAmount;

    private ServiceCategory applicableCategory; // null = áp dụng tất cả

    @NotNull(message = "Ngày bắt đầu không được để trống")
    private LocalDate startDate;

    @NotNull(message = "Ngày kết thúc không được để trống")
    private LocalDate endDate;

    private Boolean requireOnlinePayment;

    private Boolean limitOnePerUser;

    // Getters and Setters
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public VoucherDiscountType getDiscountType() { return discountType; }
    public void setDiscountType(VoucherDiscountType discountType) { this.discountType = discountType; }
    public BigDecimal getDiscountValue() { return discountValue; }
    public void setDiscountValue(BigDecimal discountValue) { this.discountValue = discountValue; }
    public BigDecimal getMaxDiscountAmount() { return maxDiscountAmount; }
    public void setMaxDiscountAmount(BigDecimal maxDiscountAmount) { this.maxDiscountAmount = maxDiscountAmount; }
    public BigDecimal getMinOrderAmount() { return minOrderAmount; }
    public void setMinOrderAmount(BigDecimal minOrderAmount) { this.minOrderAmount = minOrderAmount; }
    public ServiceCategory getApplicableCategory() { return applicableCategory; }
    public void setApplicableCategory(ServiceCategory applicableCategory) { this.applicableCategory = applicableCategory; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public Boolean getRequireOnlinePayment() { return requireOnlinePayment; }
    public void setRequireOnlinePayment(Boolean requireOnlinePayment) { this.requireOnlinePayment = requireOnlinePayment; }
    public Boolean getLimitOnePerUser() { return limitOnePerUser; }
    public void setLimitOnePerUser(Boolean limitOnePerUser) { this.limitOnePerUser = limitOnePerUser; }
}
