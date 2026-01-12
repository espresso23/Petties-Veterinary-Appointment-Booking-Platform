package com.petties.petties.dto.fcm;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for registering FCM token
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FcmTokenRequest {

    @NotBlank(message = "FCM token không được để trống")
    private String fcmToken;
}
