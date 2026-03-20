package com.petties.petties.dto.ai.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSlotOptionsResponse {
    private List<UUID> resolvedServiceIds;
    private List<String> resolvedServiceNames;
    private List<SlotOption> recommendedSlots;
    private List<SlotOption> alternatives;
    private boolean exactMatch;
    private boolean managerConfirmationRequired;
    private int totalAvailable;
    private String message;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SlotOption {
        private String startTime;
        private String endTime;
        private Integer durationMinutes;
        private boolean exactRequested;
    }
}
