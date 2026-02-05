package com.petties.petties.dto.clinicService;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ClinicServiceUpdateRequest {

    @Size(max = 200, message = "Tên dịch vụ không được quá 200 ký tự")
    private String name;

    @Size(max = 1000, message = "Mô tả không được quá 1000 ký tự")
    private String description;

    @Min(value = 0, message = "Giá cơ bản không được nhỏ hơn 0")
    private BigDecimal basePrice;

    @Positive(message = "Thời gian thực hiện phải là số dương")
    private Integer durationTime;

    @Positive(message = "Số slot yêu cầu phải là số dương")
    private Integer slotsRequired;

    private Boolean isActive;

    private Boolean isHomeVisit;

    private com.petties.petties.model.enums.ServiceCategory serviceCategory;

    private Integer reminderInterval;

    private String reminderUnit;

    @Size(max = 100, message = "Loại thú nuôi không được quá 100 ký tự")
    private String petType;

    private List<WeightPriceDto> weightPrices;
}
