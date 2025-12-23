package com.petties.petties.dto.clinicService;

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
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ClinicServiceRequest {

    @NotBlank(message = "Tên dịch vụ không được để trống")
    @Size(max = 200, message = "Tên dịch vụ không được quá 200 ký tự")
    private String name;

    @NotNull(message = "Giá cơ bản không được để trống")
    @Min(value = 0, message = "Giá cơ bản không được nhỏ hơn 0")
    private BigDecimal basePrice;

    private Integer durationTime; // Optional: can be sent by FE or calculated by BE

    @NotNull(message = "Số slot yêu cầu không được để trống")
    @Positive(message = "Số slot yêu cầu phải là số dương")
    private Integer slotsRequired;

    private Boolean isActive = true;

    private Boolean isHomeVisit = false;

    @Min(value = 0, message = "Giá theo km không được nhỏ hơn 0")
    private BigDecimal pricePerKm;

    @Size(max = 100, message = "Loại dịch vụ không được quá 100 ký tự")
    private String serviceCategory;

    @Size(max = 100, message = "Loại thú nuôi không được quá 100 ký tự")
    private String petType;

    private List<WeightPriceDto> weightPrices;
}
