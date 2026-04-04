package com.petties.petties.dto.subscription;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubscriptionPlanResponseDto {
    private UUID planId;
    private String name;
    private String description;
    private BigDecimal price;
    private Integer durationDays;
    private String features;
    private Boolean isActive;
    private Long totalPurchases;
}
