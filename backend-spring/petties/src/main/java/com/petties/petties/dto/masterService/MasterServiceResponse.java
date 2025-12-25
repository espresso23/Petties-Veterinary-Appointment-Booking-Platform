package com.petties.petties.dto.masterService;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MasterServiceResponse {

    private UUID masterServiceId;
    private String name;
    private String description;
    private BigDecimal defaultPrice;
    private Integer durationTime;
    private Integer slotsRequired;
    private Boolean isHomeVisit;
    private BigDecimal defaultPricePerKm;
    private String serviceCategory;
    private String petType;
    private String icon;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
