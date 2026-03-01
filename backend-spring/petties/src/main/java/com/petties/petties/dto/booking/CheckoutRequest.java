package com.petties.petties.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

/**
 * Request DTO for checking out a booking (especially for SOS with fee override)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutRequest {
    private BigDecimal overriddenSosFee;
}
