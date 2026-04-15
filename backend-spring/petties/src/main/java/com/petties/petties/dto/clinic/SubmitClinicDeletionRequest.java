package com.petties.petties.dto.clinic;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SubmitClinicDeletionRequest {

    @NotBlank(message = "Lý do không được để trống")
    @Size(min = 10, max = 2000, message = "Lý do phải từ 10 đến 2000 ký tự")
    private String reason;
}
