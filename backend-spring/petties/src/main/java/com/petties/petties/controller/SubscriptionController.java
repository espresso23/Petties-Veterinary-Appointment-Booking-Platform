package com.petties.petties.controller;

import com.petties.petties.dto.subscription.CreateSubscriptionPlanRequestDto;
import com.petties.petties.dto.subscription.SubscriptionPlanResponseDto;
import com.petties.petties.service.SubscriptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/subscriptions/plans")
@RequiredArgsConstructor
@Slf4j
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    /**
     * Admin: Get all plans
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<SubscriptionPlanResponseDto>> getAllPlans() {
        return ResponseEntity.ok(subscriptionService.getAllPlans());
    }

    /**
     * All: Get active plans (for Clinic Owners to subscribe)
     */
    @GetMapping("/active")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<SubscriptionPlanResponseDto>> getActivePlans() {
        return ResponseEntity.ok(subscriptionService.getActivePlans());
    }

    /**
     * All: Get plan details
     */
    @GetMapping("/{planId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<SubscriptionPlanResponseDto> getPlanById(@PathVariable UUID planId) {
        return ResponseEntity.ok(subscriptionService.getPlanById(planId));
    }

    /**
     * Admin: Create a new plan
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SubscriptionPlanResponseDto> createPlan(
            @Valid @RequestBody CreateSubscriptionPlanRequestDto request) {
        log.info("Admin creating new subscription plan: {}", request.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(subscriptionService.createPlan(request));
    }

    /**
     * Admin: Update an existing plan
     */
    @PutMapping("/{planId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SubscriptionPlanResponseDto> updatePlan(
            @PathVariable UUID planId,
            @Valid @RequestBody CreateSubscriptionPlanRequestDto request) {
        log.info("Admin updating subscription plan: {}", planId);
        return ResponseEntity.ok(subscriptionService.updatePlan(planId, request));
    }

    /**
     * Admin: Deactivate a plan (Soft delete)
     */
    @PatchMapping("/{planId}/deactivate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deactivatePlan(@PathVariable UUID planId) {
        log.info("Admin deactivating subscription plan: {}", planId);
        subscriptionService.deactivatePlan(planId);
        return ResponseEntity.noContent().build();
    }
}
