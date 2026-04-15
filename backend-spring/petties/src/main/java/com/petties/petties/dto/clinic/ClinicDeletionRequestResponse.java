package com.petties.petties.dto.clinic;

import com.petties.petties.model.enums.ClinicDeletionRequestStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Builder
public class ClinicDeletionRequestResponse {
    private UUID requestId;
    private UUID clinicId;
    private String clinicName;
    private UUID ownerId;
    private String ownerName;
    private ClinicDeletionRequestStatus status;
    private String reason;
    private String adminNote;
    private UUID reviewedBy;
    private String reviewedByName;
    private LocalDateTime requestedAt;
    private LocalDateTime reviewedAt;
}
