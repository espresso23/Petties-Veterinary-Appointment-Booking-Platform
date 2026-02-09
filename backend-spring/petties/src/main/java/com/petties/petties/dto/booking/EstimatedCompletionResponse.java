package com.petties.petties.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Response DTO for estimated completion time
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EstimatedCompletionResponse {

    /** Start time of the booking */
    private LocalDateTime startTime;

    /** Estimated end time */
    private LocalDateTime estimatedEndTime;

    /** Total duration in minutes */
    private Integer totalDurationMinutes;

    /** Total number of slots required */
    private Integer totalSlotsRequired;

    /** Breakdown by pet */
    private List<PetDuration> pets;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PetDuration {
        private String petId;
        private Double petWeight;
        private Integer totalDurationMinutes;
        private List<ServiceDuration> services;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceDuration {
        private String serviceId;
        private String serviceName;
        private Integer durationMinutes;
        private Integer slotsRequired;
        private LocalDateTime estimatedStartTime;
        private LocalDateTime estimatedEndTime;
    }
}
