package com.petties.petties.dto.emr;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for EMR Image
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmrImageDto {
    private String url;
    private String description;
}
