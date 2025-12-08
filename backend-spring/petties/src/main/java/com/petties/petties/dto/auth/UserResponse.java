package com.petties.petties.dto.auth;

import com.petties.petties.model.enums.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResponse {
    
    private UUID userId;
    private String username;
    private String email;
    private String phone;
    private String avatar;
    private Role role;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

