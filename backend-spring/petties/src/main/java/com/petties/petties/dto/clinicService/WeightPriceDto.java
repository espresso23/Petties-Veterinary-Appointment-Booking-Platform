package com.petties.petties.dto.clinicService;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeightPriceDto {
    private BigDecimal minWeight;
    private BigDecimal maxWeight;
    private BigDecimal price;
}
