package com.petties.petties.dto.clinic;

import com.petties.petties.model.enums.StaffSpecialty;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

/**
 * Public Staff Response - cho Pet Owner xem danh sách staff của clinic
 * Không bao gồm thông tin nhạy cảm như email, phone
 */
@Data
@Builder
public class PublicStaffResponse {
    private UUID userId;
    private String fullName;
    private String avatar;
    private StaffSpecialty specialty;
    private String specialtyLabel; // Vietnamese label
    private com.petties.petties.model.enums.Role role;
}
