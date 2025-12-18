package com.petties.petties.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Request DTO cho endpoint forgot-password
 * Chỉ cần email để gửi OTP reset password
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForgotPasswordRequest {

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không đúng định dạng")
    private String email;
}
