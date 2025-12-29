package com.petties.petties.dto.clinicService;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClinicServiceResponse {

    private UUID serviceId;
    private UUID clinicId;
    private UUID masterServiceId; // NEW: ID của master service (null nếu custom)
    private Boolean isCustom; // NEW: true = custom, false = inherited
    private String name;
    private BigDecimal basePrice;
    private Integer durationTime;
    private Integer slotsRequired;
    private Boolean isActive;
    private Boolean isHomeVisit;
    private BigDecimal pricePerKm;
    private String serviceCategory;
    private String petType;
    private List<WeightPriceDto> weightPrices;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
