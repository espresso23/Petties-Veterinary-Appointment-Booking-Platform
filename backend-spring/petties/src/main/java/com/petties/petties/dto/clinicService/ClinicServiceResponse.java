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
    private String description;
    private BigDecimal basePrice;
    private Integer durationTime;
    private Integer slotsRequired;
    private Boolean isActive;
    private Boolean isHomeVisit;
    private BigDecimal pricePerKm;
    private com.petties.petties.model.enums.ServiceCategory serviceCategory;
    private String petType;
    private Integer reminderInterval;
    private String reminderUnit;
    private List<WeightPriceDto> weightPrices;

    // Vaccine-specific fields
    private UUID vaccineTemplateId;
    private List<VaccineDosePriceDTO> dosePrices;

    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;
}
