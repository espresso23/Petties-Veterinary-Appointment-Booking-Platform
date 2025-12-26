package com.petties.petties.dto.notification;

import com.petties.petties.model.enums.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO for notification response
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationResponse {

    private UUID notificationId;
    private UUID clinicId;
    private String clinicName;
    private NotificationType type;
    private String message;
    private String reason;
    private Boolean read;
    private LocalDateTime createdAt;
}

