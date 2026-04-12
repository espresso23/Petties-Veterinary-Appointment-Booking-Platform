package com.petties.petties.dto.subscription;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreateSubscriptionPlanRequestDto {
    @NotBlank(message = "Tên gói không được để trống")
    private String name;

    private String description;

    @NotNull(message = "Giá không được để trống")
    @PositiveOrZero(message = "Giá phải lớn hơn hoặc bằng 0")
    private BigDecimal price;

    @NotNull(message = "Thời hạn không được để trống")
    @Positive(message = "Thời hạn phải lớn hơn 0")
    private Integer durationDays;

    private String features;
}
