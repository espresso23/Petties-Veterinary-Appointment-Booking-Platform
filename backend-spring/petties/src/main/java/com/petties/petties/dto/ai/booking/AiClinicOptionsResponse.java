package com.petties.petties.dto.ai.booking;

import com.petties.petties.model.OperatingHours;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiClinicOptionsResponse {
    private AiBookingContextResponse.ResolvedLocation queryLocation;
    private List<ClinicOption> clinics;
    private int totalFound;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ClinicOption {
        private UUID clinicId;
        private String clinicName;
        private String address;
        private Double distanceKm;
        private BigDecimal rating;
        private Integer totalReviews;
        private Boolean supportsHomeVisit;
        private BigDecimal estimatedPriceFrom;
        private Boolean hasSos;
        private String logoUrl;
        private String primaryImageUrl;
        private Map<String, OperatingHours> operatingHours;
        private String matchMode;
        private List<MatchedService> matchedServices;
        private String reasonMatched;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MatchedService {
        private UUID serviceId;
        private String name;
        private String category;
        private BigDecimal basePrice;
        private Integer durationMinutes;
        private Boolean homeVisit;
    }
}

