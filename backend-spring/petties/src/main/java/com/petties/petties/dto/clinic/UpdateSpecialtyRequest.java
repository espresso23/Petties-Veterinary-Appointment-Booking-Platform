package com.petties.petties.dto.clinic;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateSpecialtyRequest {

    @NotBlank(message = "Chuyên môn không được để trống")
    private String specialty;
}
