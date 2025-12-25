package com.petties.petties.dto.masterService;

import jakarta.validation.constraints.Min;
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
public class MasterServiceUpdateRequest {

    @Size(max = 200, message = "Tên dịch vụ không được quá 200 ký tự")
    private String name;

    @Size(max = 1000, message = "Mô tả không được quá 1000 ký tự")
    private String description;

    @Min(value = 0, message = "Giá mặc định không được nhỏ hơn 0")
    private BigDecimal defaultPrice;

    @Positive(message = "Thời gian dự kiến phải là số dương")
    private Integer durationTime;

    @Positive(message = "Số slot yêu cầu phải là số dương")
    private Integer slotsRequired;

    private Boolean isHomeVisit;

    @Min(value = 0, message = "Giá theo km không được nhỏ hơn 0")
    private BigDecimal defaultPricePerKm;

    @Size(max = 100, message = "Loại dịch vụ không được quá 100 ký tự")
    private String serviceCategory;

    @Size(max = 100, message = "Loại thú nuôi không được quá 100 ký tự")
    private String petType;

    @Size(max = 100, message = "Icon không được quá 100 ký tự")
    private String icon;
}
