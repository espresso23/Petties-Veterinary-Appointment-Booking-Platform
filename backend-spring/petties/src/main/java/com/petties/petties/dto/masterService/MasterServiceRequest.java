package com.petties.petties.dto.masterService;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MasterServiceRequest {

    @NotBlank(message = "Tên dịch vụ mẫu không được để trống")
    @Size(max = 200, message = "Tên dịch vụ không được quá 200 ký tự")
    private String name;

    @Size(max = 1000, message = "Mô tả không được quá 1000 ký tự")
    private String description;

    @NotNull(message = "Giá mặc định không được để trống")
    @Min(value = 0, message = "Giá mặc định không được nhỏ hơn 0")
    private BigDecimal defaultPrice;

    @NotNull(message = "Thời gian dự kiến không được để trống")
    @Positive(message = "Thời gian dự kiến phải là số dương")
    private Integer durationTime;

    @NotNull(message = "Số slot yêu cầu không được để trống")
    @Positive(message = "Số slot yêu cầu phải là số dương")
    private Integer slotsRequired;

    private Boolean isHomeVisit = false;

    @Min(value = 0, message = "Giá theo km không được nhỏ hơn 0")
    private BigDecimal defaultPricePerKm;

    @Size(max = 100, message = "Loại dịch vụ không được quá 100 ký tự")
    private String serviceCategory;

    @Size(max = 100, message = "Loại thú nuôi không được quá 100 ký tự")
    private String petType;

    @Size(max = 100, message = "Icon không được quá 100 ký tự")
    private String icon;
    private java.util.List<com.petties.petties.dto.clinicService.WeightPriceDto> weightPrices;
}
