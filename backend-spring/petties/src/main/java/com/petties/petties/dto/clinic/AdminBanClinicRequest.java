package com.petties.petties.dto.clinic;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Admin áp dụng hạn chế vĩnh viễn (strike) cho phòng khám đã duyệt.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminBanClinicRequest {

    @NotBlank(message = "Lý do hạn chế không được để trống")
    @Size(min = 10, max = 2000, message = "Lý do hạn chế phải từ 10 đến 2000 ký tự")
    private String reason;
}
