package com.petties.petties.dto.sos;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * DTO for clinic confirmation/decline of SOS request
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SosConfirmRequest {

    private UUID bookingId;

    private boolean accepted;

    private String declineReason;

    // Staff to be assigned (optional - if manager wants to pre-assign)
    private UUID assignedStaffId;
}
