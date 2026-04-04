package com.petties.petties.service;

import com.petties.petties.dto.subscription.SubscribeRequestDto;
import com.petties.petties.dto.subscription.UserSubscriptionResponseDto;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.*;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.model.enums.UserSubscriptionStatus;
import com.petties.petties.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for UserSubscriptionService (Clinic Subscription behavior logic)
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("UserSubscriptionService Unit Tests")
class UserSubscriptionServiceUnitTest {

        @Mock
        private UserSubscriptionRepository subscriptionRepository;
        @Mock
        private SubscriptionPlanRepository planRepository;
        @Mock
        private PaymentRepository paymentRepository;
        @Mock
        private ClinicRepository clinicRepository;
        @Mock
        private UserRepository userRepository;

        @InjectMocks
        private UserSubscriptionService userSubscriptionService;

        private UUID userId;
        private UUID clinicId;
        private UUID planId;
        private User mockUser;
        private Clinic mockClinic;
        private SubscriptionPlan mockPlan;

        @BeforeEach
        void setUp() {
                userId = UUID.randomUUID();
                clinicId = UUID.randomUUID();
                planId = UUID.randomUUID();

                mockUser = new User();
                mockUser.setUserId(userId);
                mockUser.setFullName("Test User");

                mockClinic = new Clinic();
                mockClinic.setClinicId(clinicId);
                mockClinic.setOwner(mockUser);
                mockClinic.setName("Test Clinic");

                mockPlan = new SubscriptionPlan();
                mockPlan.setPlanId(planId);
                mockPlan.setName("Pro Plan");
                mockPlan.setPrice(BigDecimal.valueOf(1000));
                mockPlan.setIsActive(true);
        }

        // ==================== INITIATE SUBSCRIPTION TESTS ====================

        @Test
        @DisplayName("TC-SERV-SUB-001: Initiate subscription successfully - Returns 201 response")
        void initiateSubscription_Success_ReturnsResponse() {
                // Arrange
                SubscribeRequestDto request = SubscribeRequestDto.builder()
                                .clinicId(clinicId)
                                .planId(planId)
                                .paymentMethod(PaymentMethod.QR)
                                .build();

                UserSubscription mockSub = new UserSubscription();
                mockSub.setSubscriptionId(UUID.randomUUID());
                mockSub.setClinic(mockClinic);
                mockSub.setPlan(mockPlan);

                ReflectionTestUtils.setField(userSubscriptionService, "sepayQrAcc", "9624720102004");
                ReflectionTestUtils.setField(userSubscriptionService, "sepayQrBank", "BIDV");

                when(userRepository.findById(userId)).thenReturn(Optional.of(mockUser));
                when(clinicRepository.findById(clinicId)).thenReturn(Optional.of(mockClinic));
                when(planRepository.findById(planId)).thenReturn(Optional.of(mockPlan));
                when(subscriptionRepository.save(any(UserSubscription.class))).thenAnswer(i -> {
                        UserSubscription s = i.getArgument(0);
                        s.setSubscriptionId(UUID.randomUUID());
                        return s;
                });

                Payment mockPayment = Payment.builder()
                                .paymentDescription("SUBTEST")
                                .amount(mockPlan.getPrice())
                                .method(PaymentMethod.QR)
                                .build();
                when(paymentRepository.findFirstBySubscriptionSubscriptionIdOrderByCreatedAtDesc(any(UUID.class)))
                                .thenReturn(Optional.of(mockPayment));

                // Act
                UserSubscriptionResponseDto result = userSubscriptionService.initiateSubscription(userId, request);

                // Assert
                assertNotNull(result);
                assertEquals("SUBTEST", result.getPaymentDescription());
                assertTrue(result.getQrUrl().contains("BIDV"));
                assertTrue(result.getQrUrl().contains("9624720102004"));
                verify(subscriptionRepository).save(any(UserSubscription.class));
                verify(paymentRepository).save(any(Payment.class));
        }

        @Test
        @DisplayName("TC-SERV-SUB-002: Throws BadRequest if not owner of clinic")
        void initiateSubscription_NotOwner_ThrowsException() {
                // Arrange
                User anotherUser = new User();
                anotherUser.setUserId(UUID.randomUUID());
                mockClinic.setOwner(anotherUser); // No longer mockUser

                SubscribeRequestDto request = SubscribeRequestDto.builder()
                                .clinicId(clinicId)
                                .planId(planId)
                                .build();

                when(userRepository.findById(userId)).thenReturn(Optional.of(mockUser));
                when(clinicRepository.findById(clinicId)).thenReturn(Optional.of(mockClinic));

                // Act & Assert
                assertThrows(BadRequestException.class,
                                () -> userSubscriptionService.initiateSubscription(userId, request));
        }

        @Test
        @DisplayName("TC-SERV-SUB-003: Throws BadRequest if plan is inactive")
        void initiateSubscription_InactivePlan_ThrowsException() {
                // Arrange
                mockPlan.setIsActive(false);
                SubscribeRequestDto request = SubscribeRequestDto.builder()
                                .clinicId(clinicId)
                                .planId(planId)
                                .build();

                when(userRepository.findById(userId)).thenReturn(Optional.of(mockUser));
                when(clinicRepository.findById(clinicId)).thenReturn(Optional.of(mockClinic));
                when(planRepository.findById(planId)).thenReturn(Optional.of(mockPlan));

                // Act & Assert
                assertThrows(BadRequestException.class,
                                () -> userSubscriptionService.initiateSubscription(userId, request));
        }

        // ==================== GET CLINC SUBSCRIPTION TESTS ====================

        @Test
        @DisplayName("TC-SERV-SUB-004: Get clinic subscription - Success")
        void getClinicSubscription_Success() {
                // Arrange
                UserSubscription mockSub = new UserSubscription();
                mockSub.setClinic(mockClinic);
                mockSub.setPlan(mockPlan);

                when(subscriptionRepository.findFirstByClinicClinicIdAndStatusNotOrderByCreatedAtDesc(eq(clinicId),
                                eq(UserSubscriptionStatus.CANCELLED)))
                                .thenReturn(Optional.of(mockSub));

                // Act
                UserSubscriptionResponseDto result = userSubscriptionService.getClinicSubscription(clinicId);

                // Assert
                assertNotNull(result);
                assertEquals(mockClinic.getName(), result.getClinicName());
        }

        @Test
        @DisplayName("TC-SERV-SUB-005: Get clinic subscription - None registered - Throws Exception")
        void getClinicSubscription_NoneRegistered_ThrowsException() {
                // Arrange
                when(subscriptionRepository.findFirstByClinicClinicIdAndStatusNotOrderByCreatedAtDesc(eq(clinicId),
                                eq(UserSubscriptionStatus.CANCELLED)))
                                .thenReturn(Optional.empty());

                // Act & Assert
                assertThrows(ResourceNotFoundException.class,
                                () -> userSubscriptionService.getClinicSubscription(clinicId));
        }

        // ==================== CANCEL SUBSCRIPTION TESTS ====================

        @Test
        @DisplayName("TC-SERV-SUB-006: Cancel subscription - Success only for ACTIVE status")
        void cancelClinicSubscription_Success() {
                // Arrange
                UserSubscription sub = new UserSubscription();
                sub.setStatus(UserSubscriptionStatus.ACTIVE);
                sub.setCancelAtPeriodEnd(false);
                sub.setClinic(mockClinic);
                sub.setPlan(mockPlan);

                when(subscriptionRepository.findFirstByClinicClinicIdOrderByCreatedAtDesc(clinicId))
                                .thenReturn(Optional.of(sub));
                when(subscriptionRepository.save(sub)).thenReturn(sub);

                // Act
                UserSubscriptionResponseDto result = userSubscriptionService.cancelClinicSubscription(clinicId);

                // Assert
                assertTrue(result.getCancelAtPeriodEnd());
                verify(subscriptionRepository).save(sub);
        }

        @Test
        @DisplayName("TC-SERV-SUB-007: Cancel PENDING subscription - Marks as CANCELLED")
        void cancelClinicSubscription_PendingStatus_Success() {
                // Arrange
                UserSubscription sub = new UserSubscription();
                sub.setClinic(mockClinic);
                sub.setPlan(mockPlan);
                sub.setStatus(UserSubscriptionStatus.PENDING_PAYMENT);

                when(subscriptionRepository.findFirstByClinicClinicIdOrderByCreatedAtDesc(clinicId))
                                .thenReturn(Optional.of(sub));
                when(subscriptionRepository.save(sub)).thenReturn(sub);

                // Act
                UserSubscriptionResponseDto result = userSubscriptionService.cancelClinicSubscription(clinicId);

                // Assert
                assertEquals(UserSubscriptionStatus.CANCELLED, result.getStatus());
                verify(subscriptionRepository).save(any(UserSubscription.class));
        }

        @Test
        @DisplayName("TC-SERV-SUB-008: Throws BadRequest when subscription is already cancelled")
        void cancelClinicSubscription_AlreadyCancelled_ThrowsException() {
                // Arrange
                UserSubscription sub = new UserSubscription();
                sub.setStatus(UserSubscriptionStatus.ACTIVE);
                sub.setCancelAtPeriodEnd(true); // Already requested cancel

                when(subscriptionRepository.findFirstByClinicClinicIdOrderByCreatedAtDesc(clinicId))
                                .thenReturn(Optional.of(sub));

                // Act & Assert
                assertThrows(BadRequestException.class,
                                () -> userSubscriptionService.cancelClinicSubscription(clinicId));
        }

        @Test
        @DisplayName("TC-SERV-SUB-009: Throws BadRequest if clinic already has an active subscription")
        void initiateSubscription_AlreadyActive_ThrowsException() {
                // Arrange
                SubscribeRequestDto request = SubscribeRequestDto.builder()
                                .clinicId(clinicId)
                                .planId(planId)
                                .paymentMethod(PaymentMethod.QR)
                                .build();
                UserSubscription activeSub = new UserSubscription();
                activeSub.setStatus(UserSubscriptionStatus.ACTIVE);
                activeSub.setEndDate(LocalDateTime.now().plusDays(10)); // Far from expiry

                when(userRepository.findById(userId)).thenReturn(Optional.of(mockUser));
                when(clinicRepository.findById(clinicId)).thenReturn(Optional.of(mockClinic));
                when(planRepository.findById(planId)).thenReturn(Optional.of(mockPlan));
                when(subscriptionRepository.findFirstByClinicClinicIdAndStatusOrderByCreatedAtDesc(clinicId,
                                UserSubscriptionStatus.PENDING_PAYMENT))
                                .thenReturn(Optional.empty());
                when(subscriptionRepository.findFirstByClinicClinicIdAndStatusOrderByCreatedAtDesc(clinicId,
                                UserSubscriptionStatus.ACTIVE))
                                .thenReturn(Optional.of(activeSub));

                // Act & Assert
                BadRequestException ex = assertThrows(BadRequestException.class,
                                () -> userSubscriptionService.initiateSubscription(userId, request));
                assertTrue(ex.getMessage().contains("đang hoạt động"));
        }
}
