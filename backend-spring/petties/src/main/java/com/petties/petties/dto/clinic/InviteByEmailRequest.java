package com.petties.petties.dto.clinic;

import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.StaffSpecialty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Request DTO for inviting staff by email
 * FullName will be auto-filled when user logs in via Google OAuth
 */
@Data
public class InviteByEmailRequest {

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không hợp lệ")
    private String email;

    @NotNull(message = "Vai trò không được để trống")
    private Role role;

    private StaffSpecialty specialty;
}
