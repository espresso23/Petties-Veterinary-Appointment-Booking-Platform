package com.petties.petties.dto.clinic;

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
public class ClinicSuspendRequestResponse {

    private UUID clinicSuspendRequestId;
    private UUID clinicId;
    private String clinicName;
    private String clinicStatus;
    private UUID requestedById;
    private String requestedByName;
    private String reason;
    private String requestType;
    private String status;
    private String adminNote;
    private UUID reviewedById;
    private String reviewedByName;
    private LocalDateTime reviewedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}