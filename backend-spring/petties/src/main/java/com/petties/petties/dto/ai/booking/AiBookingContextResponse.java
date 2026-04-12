package com.petties.petties.dto.ai.booking;

import com.petties.petties.model.enums.BookingType;
import com.petties.petties.model.enums.PetSpecies;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiBookingContextResponse {
    private ResolvedPet resolvedPet;
    private BookingType resolvedBookingType;
    private ResolvedLocation resolvedLocation;
    private String resolvedServiceHint;
    private String resolvedClinicHint;
    private String resolvedDateHint;
    private String resolvedTimeHint;
    private List<String> missingFields;
    private boolean readyForClinicSearch;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ResolvedPet {
        private UUID petId;
        private String name;
        private PetSpecies species;
        private Double weightKg;
        private Integer ageYears;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ResolvedLocation {
        private BigDecimal latitude;
        private BigDecimal longitude;
        private String address;
    }
}
