package com.petties.petties.dto.user;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * DTO cho request cập nhật profile
 * Phone is optional - only validate format if provided
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateProfileRequest {

    @Size(min = 2, max = 100, message = "Họ tên phải từ 2-100 ký tự")
    private String fullName;

    // Phone is OPTIONAL - allow null, blank, or valid format
    // Pattern only validates if phone has value (empty string passes through)
    @Pattern(regexp = "^$|^0\\d{9,10}$", message = "Số điện thoại không hợp lệ (10-11 số, bắt đầu bằng 0)")
    private String phone;
}
