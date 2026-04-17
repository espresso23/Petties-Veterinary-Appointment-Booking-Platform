package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.subscription.MySubscriptionStatusDto;
import com.petties.petties.dto.subscription.SubscribeRequestDto;
import com.petties.petties.dto.subscription.UserSubscriptionResponseDto;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.User;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.model.enums.UserSubscriptionStatus;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.UserSubscriptionService;
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

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for UserSubscriptionController
 * Covers: IES-333, IES-336, IES-337, IES-338
 */
@WebMvcTest(UserSubscriptionController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("UserSubscriptionController Unit Tests")
class UserSubscriptionControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private UserSubscriptionService userSubscriptionService;

        @MockitoBean
        private AuthService authService;

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

        // ==================== IES-333: SUBSCRIBE ====================

        @Test
        @DisplayName("TC-SUB-001: Subscribe with valid data - Returns 201")
        void subscribe_validRequest_returns201() throws Exception {
                UUID userId = UUID.randomUUID();
                SubscribeRequestDto request = SubscribeRequestDto.builder()
                                .clinicId(UUID.randomUUID())
                                .planId(UUID.randomUUID())
                                .paymentMethod(PaymentMethod.QR)
                                .build();

                User mockUser = new User();
                mockUser.setUserId(userId);

                UserSubscriptionResponseDto response = UserSubscriptionResponseDto.builder()
                                .status(UserSubscriptionStatus.PENDING_PAYMENT)
                                .build();

                when(authService.getCurrentUser()).thenReturn(mockUser);
                when(userSubscriptionService.initiateSubscription(eq(userId), any(SubscribeRequestDto.class)))
                                .thenReturn(response);

                mockMvc.perform(post("/subscriptions/subscribe")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.status").value("PENDING_PAYMENT"));

                verify(userSubscriptionService).initiateSubscription(eq(userId), any(SubscribeRequestDto.class));
        }

        @Test
        @DisplayName("TC-SUB-002: Subscribe with null Plan ID - Returns 400")
        void subscribe_nullPlanId_returns400() throws Exception {
                SubscribeRequestDto request = SubscribeRequestDto.builder()
                                .clinicId(UUID.randomUUID())
                                .planId(null)
                                .paymentMethod(PaymentMethod.QR)
                                .build();

                mockMvc.perform(post("/subscriptions/subscribe")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(userSubscriptionService, never()).initiateSubscription(any(), any());
        }

        @Test
        @DisplayName("TC-SUB-003: Subscribe when not owner of clinic - Returns 400")
        void subscribe_notOwner_returns400() throws Exception {
                UUID userId = UUID.randomUUID();
                User mockUser = new User();
                mockUser.setUserId(userId);

                when(authService.getCurrentUser()).thenReturn(mockUser);
                when(userSubscriptionService.initiateSubscription(eq(userId), any(SubscribeRequestDto.class)))
                                .thenThrow(new BadRequestException("Bạn không có quyền đăng ký cho phòng khám này"));

                SubscribeRequestDto request = SubscribeRequestDto.builder()
                                .clinicId(UUID.randomUUID())
                                .planId(UUID.randomUUID())
                                .paymentMethod(PaymentMethod.QR)
                                .build();

                mockMvc.perform(post("/subscriptions/subscribe")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());
        }

        // ==================== IES-336 & 337: VIEW STATUS & DETAIL ====================

        @Test
        @DisplayName("TC-SUB-004: Get clinic subscription - Returns 200")
        void getClinicSubscription_returns200() throws Exception {
                UUID clinicId = UUID.randomUUID();
                UserSubscriptionResponseDto response = UserSubscriptionResponseDto.builder()
                                .clinicName("Test Clinic")
                                .status(UserSubscriptionStatus.ACTIVE)
                                .build();

                when(userSubscriptionService.getClinicSubscription(clinicId)).thenReturn(response);

                mockMvc.perform(get("/subscriptions/my-clinic/" + clinicId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.clinicName").value("Test Clinic"))
                                .andExpect(jsonPath("$.status").value("ACTIVE"));
        }

        @Test
        @DisplayName("TC-SUB-005: Get clinic subscription - Not found - Returns 404")
        void getClinicSubscription_notFound_returns404() throws Exception {
                UUID clinicId = UUID.randomUUID();
                when(userSubscriptionService.getClinicSubscription(clinicId))
                                .thenThrow(new ResourceNotFoundException("Not found"));

                mockMvc.perform(get("/subscriptions/my-clinic/" + clinicId))
                                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("TC-SUB-006: Get my status - Returns 200")
        void getMyStatus_returns200() throws Exception {
                UUID clinicId = UUID.randomUUID();
                User mockUser = new User();
                Clinic mockClinic = new Clinic();
                mockClinic.setClinicId(clinicId);
                mockUser.setWorkingClinic(mockClinic);

                MySubscriptionStatusDto response = MySubscriptionStatusDto.builder()
                                .status("ACTIVE")
                                .clinicId(clinicId)
                                .build();

                when(authService.getCurrentUser()).thenReturn(mockUser);
                when(userSubscriptionService.getMySubscriptionStatus(mockUser)).thenReturn(response);

                mockMvc.perform(get("/subscriptions/my-status"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value("ACTIVE"));
        }

        // ==================== IES-338: CANCEL ====================

        @Test
        @DisplayName("TC-SUB-007: Cancel subscription - Returns 200")
        void cancelSubscription_returns200() throws Exception {
                UUID clinicId = UUID.randomUUID();
                UserSubscriptionResponseDto response = UserSubscriptionResponseDto.builder()
                                .cancelAtPeriodEnd(true)
                                .build();

                when(userSubscriptionService.cancelClinicSubscription(clinicId)).thenReturn(response);

                mockMvc.perform(put("/subscriptions/my-clinic/" + clinicId + "/cancel"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.cancelAtPeriodEnd").value(true));
        }

        @Test
        @DisplayName("TC-SUB-008: Cancel subscription - Only for ACTIVE - Returns 400")
        void cancelSubscription_wrongStatus_returns400() throws Exception {
                UUID clinicId = UUID.randomUUID();
                when(userSubscriptionService.cancelClinicSubscription(clinicId))
                                .thenThrow(new BadRequestException("Chỉ có thể hủy những gói đang hoạt động"));

                mockMvc.perform(put("/subscriptions/my-clinic/" + clinicId + "/cancel"))
                                .andExpect(status().isBadRequest());
        }
}
