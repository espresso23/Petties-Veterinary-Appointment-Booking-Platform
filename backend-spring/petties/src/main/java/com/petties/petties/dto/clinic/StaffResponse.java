package com.petties.petties.dto.clinic;

import com.petties.petties.model.enums.Role;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class StaffResponse {
    private UUID userId;
    private String fullName;
    private String username;
    private String email;
    private Role role;
    private String phone;
    private String avatar;
}
