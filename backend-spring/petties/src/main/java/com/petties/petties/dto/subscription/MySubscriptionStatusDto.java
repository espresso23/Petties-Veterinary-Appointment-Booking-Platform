package com.petties.petties.dto.subscription;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MySubscriptionStatusDto {
    private String status;
    private String planName;
    private String userRole;
    private UUID clinicId;
    private String clinicName;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private boolean isPetOwner;
    private boolean isDevMode;
}