package com.petties.petties.dto.service;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceResponse {
    
    private UUID serviceId;
    private UUID clinicId;
    private String name;
    private String basePrice;
    private Integer durationTime;
    private Integer slotsRequired;
    private Boolean isActive;
    private Boolean isHomeVisit;
    private String pricePerKm;
    private String serviceCategory;
    private String petType;
    private List<WeightPriceDto> weightPrices;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

