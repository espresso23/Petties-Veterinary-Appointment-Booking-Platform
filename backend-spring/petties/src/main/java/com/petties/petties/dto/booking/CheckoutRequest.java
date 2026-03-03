package com.petties.petties.dto.booking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for checkout - selecting payment method
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutRequest {

    @NotBlank(message = "Vui lòng chọn phương thức thanh toán")
    @Pattern(regexp = "CASH|QR", message = "Phương thức thanh toán phải là CASH hoặc QR")
    private String paymentMethod;
}
