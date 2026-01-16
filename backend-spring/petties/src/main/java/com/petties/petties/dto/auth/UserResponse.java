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
    private String fullName;
    private String phone;
    private String avatar;
    private Role role;
    private UUID workingClinicId; // For CLINIC_MANAGER and VET
    private String workingClinicName; // Clinic name for display

    // VET-specific fields
    private String specialty; // VET_GENERAL, VET_SURGERY, VET_DENTAL, VET_DERMATOLOGY, GROOMER
    private java.math.BigDecimal ratingAvg; // Rating trung bình (1.0 - 5.0)
    private Integer ratingCount; // Số lượt đánh giá

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
