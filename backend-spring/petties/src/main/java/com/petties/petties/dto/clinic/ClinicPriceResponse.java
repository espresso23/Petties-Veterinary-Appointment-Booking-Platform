package com.petties.petties.dto.clinic;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClinicPriceResponse {
    private UUID clinicId;
    private BigDecimal pricePerKm;
}
