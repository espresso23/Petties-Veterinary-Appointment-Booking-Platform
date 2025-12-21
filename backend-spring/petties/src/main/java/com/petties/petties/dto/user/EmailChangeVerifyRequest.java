package com.petties.petties.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO cho request xac nhan thay doi email voi OTP.
 * User nhap email moi va ma OTP 6 so da nhan duoc qua email.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailChangeVerifyRequest {

    @NotBlank(message = "Email moi khong duoc de trong")
    @Email(message = "Email khong hop le")
    private String newEmail;

    @NotBlank(message = "Ma OTP khong duoc de trong")
    @Pattern(regexp = "^\\d{6}$", message = "Ma OTP phai co dung 6 chu so")
    private String otp;
}
