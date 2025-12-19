package com.petties.petties.dto.service;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ServiceRequest {

    @NotBlank(message = "Tên dịch vụ không được để trống")
    @Size(max = 200, message = "Tên dịch vụ không được quá 200 ký tự")
    private String name;

    @NotBlank(message = "Giá cơ bản không được để trống")
    @Size(max = 50, message = "Giá cơ bản không được quá 50 ký tự")
    private String basePrice;

    @NotNull(message = "Thời gian thực hiện không được để trống")
    @Positive(message = "Thời gian thực hiện phải là số dương")
    private Integer durationTime;

    @NotNull(message = "Số slot yêu cầu không được để trống")
    @Positive(message = "Số slot yêu cầu phải là số dương")
    private Integer slotsRequired;

    private Boolean isActive = true;

    private Boolean isHomeVisit = false;

    @Size(max = 50, message = "Giá theo km không được quá 50 ký tự")
    private String pricePerKm;

    @Size(max = 100, message = "Loại dịch vụ không được quá 100 ký tự")
    private String serviceCategory;

    @Size(max = 100, message = "Loại thú nuôi không được quá 100 ký tự")
    private String petType;

    private List<WeightPriceDto> weightPrices;
}
