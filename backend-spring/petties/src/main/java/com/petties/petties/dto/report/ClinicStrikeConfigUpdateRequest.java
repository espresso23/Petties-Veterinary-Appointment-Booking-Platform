package com.petties.petties.dto.report;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClinicStrikeConfigUpdateRequest {

    @NotBlank(message = "Config key không được để trống")
    private String configKey;

    @NotNull(message = "Config value không được để trống")
    private String configValue;
}
