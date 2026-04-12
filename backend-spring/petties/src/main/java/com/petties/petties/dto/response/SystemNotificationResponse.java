package com.petties.petties.dto.response;

import com.petties.petties.model.SystemNotification;
import com.petties.petties.model.enums.NotificationType;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class SystemNotificationResponse {
    private UUID id;
    private String title;
    private String message;
    private NotificationType type;
    private String targetAudience;
    private int targetCount;
    private String createdBy; // Admin email or name
    private LocalDateTime createdAt;
    
    public static SystemNotificationResponse fromEntity(SystemNotification entity) {
        String createdByDisplay = "Hệ thống";
        if (entity.getCreatedBy() != null) {
            if (entity.getCreatedBy().getEmail() != null && !entity.getCreatedBy().getEmail().isBlank()) {
                createdByDisplay = entity.getCreatedBy().getEmail();
            } else if (entity.getCreatedBy().getUsername() != null && !entity.getCreatedBy().getUsername().isBlank()) {
                createdByDisplay = entity.getCreatedBy().getUsername();
            }
        }

        return SystemNotificationResponse.builder()
                .id(entity.getId())
                .title(entity.getTitle())
                .message(entity.getMessage())
                .type(entity.getType())
                .targetAudience(entity.getTargetAudience())
                .targetCount(entity.getTargetCount())
                .createdBy(createdByDisplay)
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
