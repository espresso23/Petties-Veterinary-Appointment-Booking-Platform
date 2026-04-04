package com.petties.petties.dto.pet;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PetHealthSummaryResponse {

    private PetInfoDto petInfo;
    private LatestEmrDto latestEmr;
    private List<HealthWarningDto> healthWarnings;
    private List<MedicationReminderDto> medicationReminders;
    private List<SuggestedActionDto> suggestedActions;
    private AiInsightsDto aiInsights;
    private String disclaimer;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PetInfoDto {
        private String petId;
        private String name;
        private String species;
        private String breed;
        private Integer ageMonths;
        private Double weightKg;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LatestEmrDto {
        private LocalDate examDate;
        private String clinicName;
        private String diagnosis;
        private String treatment;
        private String subjective;
        private String objective;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HealthWarningDto {
        private String type;
        private String message;
        private String severity;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MedicationReminderDto {
        private String medication;
        private String dosage;
        private String frequency;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SuggestedActionDto {
        private String type;
        private String label;
        private String reason;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AiInsightsDto {
        private String summary;
        private String trends;
        private String advice;
        private List<String> intakeNotes;
    }
}
