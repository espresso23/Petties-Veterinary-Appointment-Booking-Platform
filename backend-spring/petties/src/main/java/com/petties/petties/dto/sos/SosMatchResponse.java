package com.petties.petties.dto.sos;

import com.petties.petties.model.enums.BookingStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Response DTO for SOS Auto-Match feature
 * Contains booking info, status and matched clinic details
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SosMatchResponse {

    private UUID bookingId;

    private BookingStatus status;

    private String message;

    // Pet info (for resuming matching on mobile)
    private UUID petId;
    private String petName;

    // Clinic info (when matched)
    private UUID clinicId;
    private String clinicName;
    private String clinicPhone;
    private String clinicAddress;
    private Double distanceKm;
    private Integer estimatedMinutes;

    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;

    // WebSocket topic for real-time updates
    private String wsTopicUrl;
}
