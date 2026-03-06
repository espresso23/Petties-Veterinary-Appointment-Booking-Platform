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
    private Double clinicLat;
    private Double clinicLng;
    private Double distanceKm;
    private Integer estimatedMinutes;

    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;

    // Staff info (when assigned)
    private UUID staffId;
    private String staffName;
    private String staffPhone;
    private String staffAvatarUrl;

    // WebSocket topic for real-time updates
    private String wsTopicUrl;

    // Matching progress info
    private Integer currentClinicIndex;
    private Integer totalClinicsInRange;
    private Long remainingSeconds;
}
