package com.petties.petties.dto.clinic;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * DTO cho request reject clinic
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RejectClinicRequest {

    @NotBlank(message = "Lý do từ chối không được để trống")
    @Size(max = 1000, message = "Lý do từ chối không được quá 1000 ký tự")
    private String reason;
}

