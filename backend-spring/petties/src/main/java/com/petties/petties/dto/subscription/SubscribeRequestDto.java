package com.petties.petties.dto.subscription;

import com.petties.petties.model.enums.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubscribeRequestDto {
    @NotNull(message = "Plan ID không được để trống")
    private UUID planId;

    @NotNull(message = "Clinic ID không được để trống")
    private UUID clinicId;

    @NotNull(message = "Phương thức thanh toán không được để trống")
    private PaymentMethod paymentMethod;
}
