package com.petties.petties.service;

import com.petties.petties.dto.subscription.CreateSubscriptionPlanRequestDto;
import com.petties.petties.dto.subscription.SubscriptionPlanResponseDto;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.SubscriptionPlan;
import com.petties.petties.repository.SubscriptionPlanRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for SubscriptionService (Plan Management logic)
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SubscriptionService (Plan Management) Unit Tests")
class SubscriptionServiceUnitTest {

    @Mock
    private SubscriptionPlanRepository planRepository;

    @Mock
    private com.petties.petties.repository.UserSubscriptionRepository userSubscriptionRepository;

    @InjectMocks
    private SubscriptionService subscriptionService;

    // ==================== READ TESTS ====================

    @Test
    @DisplayName("TC-SERV-PLAN-001: Get all plans - Success")
    void getAllPlans_Success() {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setPlanId(UUID.randomUUID());
        plan.setName("Test Plan");
        when(planRepository.findAll()).thenReturn(List.of(plan));
        when(userSubscriptionRepository.countByPlanPlanId(any())).thenReturn(5L);

        List<SubscriptionPlanResponseDto> result = subscriptionService.getAllPlans();

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("Test Plan", result.get(0).getName());
        assertEquals(5, result.get(0).getTotalPurchases());
    }

    @Test
    @DisplayName("TC-SERV-PLAN-002: Get active plans - Success")
    void getActivePlans_Success() {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setPlanId(UUID.randomUUID());
        plan.setIsActive(true);
        when(planRepository.findByIsActiveTrue()).thenReturn(List.of(plan));
        when(userSubscriptionRepository.countByPlanPlanId(any())).thenReturn(0L);

        List<SubscriptionPlanResponseDto> result = subscriptionService.getActivePlans();

        assertNotNull(result);
        assertEquals(1, result.size());
    }

    // ==================== WRITE TESTS ====================

    @Test
    @DisplayName("TC-SERV-PLAN-003: Create plan - Success")
    void createPlan_Success() {
        CreateSubscriptionPlanRequestDto request = new CreateSubscriptionPlanRequestDto();
        request.setName("New Plan");
        request.setPrice(BigDecimal.valueOf(1000));
        request.setDurationDays(30);

        when(planRepository.save(any(SubscriptionPlan.class))).thenAnswer(invocation -> {
            SubscriptionPlan p = invocation.getArgument(0);
            p.setPlanId(UUID.randomUUID());
            return p;
        });
        when(userSubscriptionRepository.countByPlanPlanId(any())).thenReturn(0L);

        SubscriptionPlanResponseDto result = subscriptionService.createPlan(request);

        assertNotNull(result);
        assertEquals("New Plan", result.getName());
        verify(planRepository).save(any(SubscriptionPlan.class));
    }

    @Test
    @DisplayName("TC-SERV-PLAN-004: Update plan - Success")
    void updatePlan_Success() {
        UUID planId = UUID.randomUUID();
        SubscriptionPlan existing = new SubscriptionPlan();
        existing.setPlanId(planId);
        existing.setName("Old Name");

        CreateSubscriptionPlanRequestDto request = new CreateSubscriptionPlanRequestDto();
        request.setName("Updated Name");
        request.setPrice(BigDecimal.valueOf(2000));
        request.setDurationDays(60);

        when(planRepository.findById(planId)).thenReturn(Optional.of(existing));
        when(planRepository.save(any(SubscriptionPlan.class))).thenReturn(existing);
        when(userSubscriptionRepository.countByPlanPlanId(any())).thenReturn(10L);

        SubscriptionPlanResponseDto result = subscriptionService.updatePlan(planId, request);

        assertEquals("Updated Name", result.getName());
        assertEquals(BigDecimal.valueOf(2000), result.getPrice());
        assertEquals(10, result.getTotalPurchases());
    }

    @Test
    @DisplayName("TC-SERV-PLAN-005: Deactivate plan - Success")
    void deactivatePlan_Success() {
        UUID planId = UUID.randomUUID();
        SubscriptionPlan existing = new SubscriptionPlan();
        existing.setPlanId(planId);
        existing.setIsActive(true);

        when(planRepository.findById(planId)).thenReturn(Optional.of(existing));
        when(planRepository.save(any(SubscriptionPlan.class))).thenReturn(existing);

        subscriptionService.deactivatePlan(planId);

        assertFalse(existing.getIsActive());
        verify(planRepository).save(existing);
    }

    @Test
    @DisplayName("TC-SERV-PLAN-006: Get plan by ID - Success")
    void getPlanById_Success() {
        UUID planId = UUID.randomUUID();
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setPlanId(planId);
        plan.setName("Target Plan");

        when(planRepository.findById(planId)).thenReturn(Optional.of(plan));
        when(userSubscriptionRepository.countByPlanPlanId(planId)).thenReturn(3L);

        SubscriptionPlanResponseDto result = subscriptionService.getPlanById(planId);

        assertEquals("Target Plan", result.getName());
        assertEquals(3, result.getTotalPurchases());
    }

    @Test
    @DisplayName("TC-SERV-PLAN-007: Get plan by ID - Not Found")
    void getPlanById_NotFound_ThrowsException() {
        UUID planId = UUID.randomUUID();
        when(planRepository.findById(planId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> subscriptionService.getPlanById(planId));
    }
}
