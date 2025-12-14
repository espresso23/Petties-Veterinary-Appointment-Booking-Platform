package com.petties.petties.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Response DTO khi gửi OTP thành công
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SendOtpResponse {

    private String message;
    private String email;
    private int expiryMinutes;
    private int resendCooldownSeconds;
}
