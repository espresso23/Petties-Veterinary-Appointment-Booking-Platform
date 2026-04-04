package com.petties.petties.dto.response;

import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Builder
public class AdminUserSummaryResponse {
    private UUID userId;
    private String username;
    private String fullName;
    private String email;
    private Role role;
    private LocalDateTime createdAt;

    public static AdminUserSummaryResponse fromEntity(User user) {
        return AdminUserSummaryResponse.builder()
                .userId(user.getUserId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
