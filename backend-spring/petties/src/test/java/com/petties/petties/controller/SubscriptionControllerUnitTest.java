package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.subscription.CreateSubscriptionPlanRequestDto;
import com.petties.petties.dto.subscription.SubscriptionPlanResponseDto;
import com.petties.petties.service.SubscriptionService;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.repository.BlacklistedTokenRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for SubscriptionController (Plan Management)
 * Covers: IES-334, IES-335
 */
@WebMvcTest(SubscriptionController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("SubscriptionController (Plan) Unit Tests")
class SubscriptionControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private SubscriptionService subscriptionService;

        @MockitoBean
        private JwtTokenProvider jwtTokenProvider;

        @MockitoBean
        private JwtAuthenticationFilter jwtAuthenticationFilter;

        @MockitoBean
        private UserDetailsServiceImpl userDetailsService;

        @MockitoBean
        private BlacklistedTokenRepository blacklistedTokenRepository;

        @Autowired
        private ObjectMapper objectMapper;

        // ==================== IES-335: VIEW PLANS ====================

        @Test
        @DisplayName("TC-PLAN-001: Get active plans - Returns 200")
        void getActivePlans_returns200() throws Exception {
                SubscriptionPlanResponseDto plan = SubscriptionPlanResponseDto.builder()
                                .name("Gói Nâng Cao")
                                .isActive(true)
                                .build();

                when(subscriptionService.getActivePlans()).thenReturn(List.of(plan));

                mockMvc.perform(get("/subscriptions/plans/active"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$[0].name").value("Gói Nâng Cao"))
                                .andExpect(jsonPath("$[0].isActive").value(true));
        }

        // ==================== IES-334: EDIT SUBSCRIPTION PLAN ====================

        @Test
        @DisplayName("TC-PLAN-002: Update plan with valid data - Returns 200")
        void updatePlan_validData_returns200() throws Exception {
                UUID planId = UUID.randomUUID();
                CreateSubscriptionPlanRequestDto request = new CreateSubscriptionPlanRequestDto();
                request.setName("Pro Plan Updated");
                request.setPrice(new BigDecimal("999000"));
                request.setDurationDays(365);

                SubscriptionPlanResponseDto response = SubscriptionPlanResponseDto.builder()
                                .planId(planId)
                                .name("Pro Plan Updated")
                                .build();

                when(subscriptionService.updatePlan(eq(planId), any(CreateSubscriptionPlanRequestDto.class)))
                                .thenReturn(response);

                mockMvc.perform(put("/subscriptions/plans/" + planId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.name").value("Pro Plan Updated"));
        }

        @Test
        @DisplayName("TC-PLAN-003: Update plan with blank name - Returns 400")
        void updatePlan_blankName_returns400() throws Exception {
                UUID planId = UUID.randomUUID();
                CreateSubscriptionPlanRequestDto request = new CreateSubscriptionPlanRequestDto();
                request.setName(""); // Invalid
                request.setPrice(new BigDecimal("1000"));
                request.setDurationDays(30);

                mockMvc.perform(put("/subscriptions/plans/" + planId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(subscriptionService, never()).updatePlan(any(), any());
        }

        @Test
        @DisplayName("TC-PLAN-004: Update plan with negative price - Returns 400")
        void updatePlan_negativePrice_returns400() throws Exception {
                UUID planId = UUID.randomUUID();
                CreateSubscriptionPlanRequestDto request = new CreateSubscriptionPlanRequestDto();
                request.setName("Pro Plan");
                request.setPrice(new BigDecimal("-1.00")); // Invalid
                request.setDurationDays(30);

                mockMvc.perform(put("/subscriptions/plans/" + planId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("TC-PLAN-005: Deactivate plan - Returns 204")
        void deactivatePlan_returns204() throws Exception {
                UUID planId = UUID.randomUUID();
                doNothing().when(subscriptionService).deactivatePlan(planId);

                mockMvc.perform(patch("/subscriptions/plans/" + planId + "/deactivate"))
                                .andExpect(status().isNoContent());

                verify(subscriptionService).deactivatePlan(planId);
        }
}
