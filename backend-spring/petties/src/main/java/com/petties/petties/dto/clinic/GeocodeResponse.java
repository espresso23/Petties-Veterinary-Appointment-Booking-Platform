package com.petties.petties.dto.clinic;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * DTO for geocoding response
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GeocodeResponse {

    private BigDecimal latitude;
    private BigDecimal longitude;
    private String formattedAddress;
}

