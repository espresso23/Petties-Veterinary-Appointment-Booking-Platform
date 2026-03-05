package com.petties.petties.dto.booking;

import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * CheckoutRequest - DTO dùng chung cho:
 * - Chọn phương thức thanh toán (CASH/QR) cho booking thường
 * - Ghi đè phí SOS (overriddenSosFee) cho checkout SOS
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutRequest {

    @Pattern(regexp = "CASH|QR", message = "Phương thức thanh toán phải là CASH hoặc QR")
    private String paymentMethod;        // optional cho QR/CASH

    private BigDecimal overriddenSosFee; // optional cho SOS
}
