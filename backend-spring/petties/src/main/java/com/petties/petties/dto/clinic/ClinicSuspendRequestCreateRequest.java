package com.petties.petties.dto.clinic;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClinicSuspendRequestCreateRequest {

    @NotNull(message = "Phòng khám không được để trống")
    private UUID clinicId;

    @NotBlank(message = "Lý do tạm ngưng không được để trống")
    @Size(min = 10, max = 2000, message = "Lý do tạm ngưng phải từ 10 đến 2000 ký tự")
    private String reason;
}