package com.petties.petties.service;

import com.petties.petties.dto.subscription.CreateSubscriptionPlanRequestDto;
import com.petties.petties.dto.subscription.SubscriptionPlanResponseDto;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.SubscriptionPlan;
import com.petties.petties.repository.SubscriptionPlanRepository;
import com.petties.petties.repository.UserSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SubscriptionService {

    private final SubscriptionPlanRepository planRepository;
    private final UserSubscriptionRepository userSubscriptionRepository;

    @Transactional(readOnly = true)
    public List<SubscriptionPlanResponseDto> getAllPlans() {
        return planRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SubscriptionPlanResponseDto> getActivePlans() {
        return planRepository.findByIsActiveTrue().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SubscriptionPlanResponseDto getPlanById(UUID planId) {
        SubscriptionPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy gói hội viên"));
        return mapToResponse(plan);
    }

    @Transactional
    public SubscriptionPlanResponseDto createPlan(CreateSubscriptionPlanRequestDto request) {
        SubscriptionPlan plan = SubscriptionPlan.builder()
                .name(request.getName())
                .description(request.getDescription())
                .price(request.getPrice())
                .durationDays(request.getDurationDays())
                .features(request.getFeatures())
                .isActive(true)
                .build();

        SubscriptionPlan saved = planRepository.save(plan);
        log.info("Created new subscription plan: {}", saved.getName());
        return mapToResponse(saved);
    }

    @Transactional
    public SubscriptionPlanResponseDto updatePlan(UUID planId, CreateSubscriptionPlanRequestDto request) {
        SubscriptionPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy gói hội viên"));

        plan.setName(request.getName());
        plan.setDescription(request.getDescription());
        plan.setPrice(request.getPrice());
        plan.setDurationDays(request.getDurationDays());
        plan.setFeatures(request.getFeatures());

        SubscriptionPlan saved = planRepository.save(plan);
        log.info("Updated subscription plan: {}", saved.getName());
        return mapToResponse(saved);
    }

    @Transactional
    public void deactivatePlan(UUID planId) {
        SubscriptionPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy gói hội viên"));
        plan.setIsActive(false);
        planRepository.save(plan);
        log.info("Deactivated subscription plan: {}", plan.getName());
    }

    private SubscriptionPlanResponseDto mapToResponse(SubscriptionPlan plan) {
        long purchases = userSubscriptionRepository.countByPlanPlanId(plan.getPlanId());
        return SubscriptionPlanResponseDto.builder()
                .planId(plan.getPlanId())
                .name(plan.getName())
                .description(plan.getDescription())
                .price(plan.getPrice())
                .durationDays(plan.getDurationDays())
                .features(plan.getFeatures())
                .isActive(plan.getIsActive())
                .totalPurchases(purchases)
                .build();
    }
}
