package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.subscription.MySubscriptionStatusDto;
import com.petties.petties.dto.subscription.ClinicSubscriptionStatusDto;
import com.petties.petties.dto.subscription.SubscribeRequestDto;
import com.petties.petties.dto.subscription.UserSubscriptionResponseDto;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.GlobalExceptionHandler;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.User;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.model.enums.UserSubscriptionStatus;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.UserSubscriptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.UUID;

import java.lang.reflect.Field;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for UserSubscriptionController
 * Covers: IES-333, IES-336, IES-337, IES-338
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("UserSubscriptionController Unit Tests")
class UserSubscriptionControllerUnitTest {

        private MockMvc mockMvc;

        @Mock
        private UserSubscriptionService userSubscriptionService;

        @Mock
        private AuthService authService;

        @Mock
        private Environment environment;

        @InjectMocks
        private UserSubscriptionController userSubscriptionController;

        private ObjectMapper objectMapper = new ObjectMapper();

        private <T> T createInstance(Class<T> clazz) {
                try {
                        return clazz.getDeclaredConstructor().newInstance();
                } catch (Exception e) {
                        throw new RuntimeException("Cannot create instance of " + clazz.getName(), e);
                }
        }

        private void setField(Object obj, String fieldName, Object value) {
                try {
                        Field field = obj.getClass().getDeclaredField(fieldName);
                        field.setAccessible(true);
                        field.set(obj, value);
                } catch (Exception e) {
                        throw new RuntimeException("Cannot set field " + fieldName, e);
                }
        }

        @BeforeEach
        void setUp() {
                GlobalExceptionHandler exceptionHandler = new GlobalExceptionHandler(environment);
                mockMvc = MockMvcBuilders.standaloneSetup(userSubscriptionController)
                                .setControllerAdvice(exceptionHandler)
                                .build();
        }

        // ==================== IES-333: SUBSCRIBE ====================

        @Test
        @DisplayName("TC-SUB-001: Subscribe with valid data - Returns 201")
        void subscribe_validRequest_returns201() throws Exception {
                UUID userId = UUID.randomUUID();
                UUID clinicId = UUID.randomUUID();
                UUID planId = UUID.randomUUID();

                SubscribeRequestDto request = createInstance(SubscribeRequestDto.class);
                setField(request, "planId", planId);
                setField(request, "clinicId", clinicId);
                setField(request, "paymentMethod", PaymentMethod.QR);

                User mockUser = createInstance(User.class);
                setField(mockUser, "userId", userId);

                UserSubscriptionResponseDto response = createInstance(UserSubscriptionResponseDto.class);
                setField(response, "status", UserSubscriptionStatus.PENDING_PAYMENT);

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
                UUID clinicId = UUID.randomUUID();
                SubscribeRequestDto request = createInstance(SubscribeRequestDto.class);
                setField(request, "planId", null);
                setField(request, "clinicId", clinicId);
                setField(request, "paymentMethod", PaymentMethod.QR);

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
                User mockUser = createInstance(User.class);
                setField(mockUser, "userId", userId);

                when(authService.getCurrentUser()).thenReturn(mockUser);
                when(userSubscriptionService.initiateSubscription(eq(userId), any(SubscribeRequestDto.class)))
                                .thenThrow(new BadRequestException("Bạn không có quyền đăng ký cho phòng khám này"));

                SubscribeRequestDto request = createInstance(SubscribeRequestDto.class);
                setField(request, "planId", UUID.randomUUID());
                setField(request, "clinicId", UUID.randomUUID());
                setField(request, "paymentMethod", PaymentMethod.QR);

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
                UserSubscriptionResponseDto response = createInstance(UserSubscriptionResponseDto.class);
                setField(response, "clinicName", "Test Clinic");
                setField(response, "status", UserSubscriptionStatus.ACTIVE);

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
        @DisplayName("TC-SUB-004B: Get clinic subscription status - Returns 200")
        void getClinicSubscriptionStatus_returns200() throws Exception {
                UUID clinicId = UUID.randomUUID();
                ClinicSubscriptionStatusDto response = createInstance(ClinicSubscriptionStatusDto.class);

                when(userSubscriptionService.getClinicSubscriptionStatus(clinicId)).thenReturn(response);

                mockMvc.perform(get("/subscriptions/my-clinic/" + clinicId + "/status"))
                                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("TC-SUB-006: Get my status - Returns 200")
        void getMyStatus_returns200() throws Exception {
                UUID clinicId = UUID.randomUUID();
                User mockUser = createInstance(User.class);
                Clinic mockClinic = createInstance(Clinic.class);
                setField(mockClinic, "clinicId", clinicId);
                setField(mockUser, "workingClinic", mockClinic);

                MySubscriptionStatusDto response = createInstance(MySubscriptionStatusDto.class);
                setField(response, "status", "ACTIVE");
                setField(response, "clinicId", clinicId);

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
                UserSubscriptionResponseDto response = createInstance(UserSubscriptionResponseDto.class);
                setField(response, "cancelAtPeriodEnd", true);

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