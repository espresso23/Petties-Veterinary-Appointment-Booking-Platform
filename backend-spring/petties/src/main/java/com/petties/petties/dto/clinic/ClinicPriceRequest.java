package com.petties.petties.dto.clinic;

import jakarta.validation.constraints.DecimalMin;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ClinicPriceRequest {
    // Use DecimalMin for BigDecimal. Allow null to let controller/service handle removals.
    @DecimalMin(value = "0", inclusive = true)
    private BigDecimal pricePerKm;
}
