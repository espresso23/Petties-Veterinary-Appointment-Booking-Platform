package com.petties.petties.dto.request;

import com.petties.petties.model.enums.NotificationType;
import com.petties.petties.model.enums.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class AdminNotificationRequest {
    @NotBlank(message = "Tiêu đề không được để trống")
    private String title;

    @NotBlank(message = "Nội dung không được để trống")
    private String message;

    @NotNull(message = "Loại thông báo không được để trống")
    private NotificationType type;

    @NotBlank(message = "Đối tượng nhận không được để trống")
    private String targetAudience; // ALL, ROLE, SPECIFIC_USERS

    private List<Role> targetRoles;
    
    private List<UUID> targetUserIds;
}
