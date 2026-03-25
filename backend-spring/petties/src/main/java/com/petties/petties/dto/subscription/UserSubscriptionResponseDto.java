package com.petties.petties.dto.subscription;

import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.model.enums.UserSubscriptionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSubscriptionResponseDto {
    private UUID subscriptionId;
    private UUID clinicId;
    private String clinicName;
    private SubscriptionPlanResponseDto plan;
    private UserSubscriptionStatus status;
    private PaymentMethod paymentMethod;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private Boolean cancelAtPeriodEnd;
    private String qrUrl;
    private String paymentDescription;
}
