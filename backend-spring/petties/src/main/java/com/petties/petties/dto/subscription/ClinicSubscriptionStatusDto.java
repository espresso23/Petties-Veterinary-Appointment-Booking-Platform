package com.petties.petties.dto.subscription;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClinicSubscriptionStatusDto {
    private UserSubscriptionResponseDto active;
    private UserSubscriptionResponseDto pending;
}
