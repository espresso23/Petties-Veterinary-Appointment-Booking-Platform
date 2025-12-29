package com.petties.petties.dto.clinic;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * DTO for distance calculation response
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DistanceResponse {

    private Double distance; // in kilometers
    @Builder.Default
    private String unit = "km";
    private Integer duration; // in minutes (optional, if using Distance Matrix API)
    @Builder.Default
    private String durationUnit = "minutes";
}

