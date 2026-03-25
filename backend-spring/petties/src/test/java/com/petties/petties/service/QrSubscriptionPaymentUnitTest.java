package com.petties.petties.service;

import com.petties.petties.integration.sepay.SePayClient;
import com.petties.petties.integration.sepay.dto.SePayTransactionDto;
import com.petties.petties.integration.sepay.dto.SePayTransactionsListResponseDto;
import com.petties.petties.model.*;
import com.petties.petties.model.enums.*;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.PaymentRepository;
import com.petties.petties.repository.UserSubscriptionRepository;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("QrPaymentService - Subscription Payment Verification Unit Tests")
class QrSubscriptionPaymentUnitTest {

    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private UserSubscriptionRepository userSubscriptionRepository;
    @Mock
    private AuthService authService;
    @Mock
    private SePayClient sePayClient;

    @InjectMocks
    private QrPaymentService qrPaymentService;

    private UUID subscriptionId;
    private UserSubscription mockSubscription;
    private Payment mockPayment;
    private User mockUser;

    @BeforeEach
    void setUp() {
        subscriptionId = UUID.randomUUID();

        mockUser = new User();
        mockUser.setUserId(UUID.randomUUID());
        mockUser.setRole(Role.CLINIC_OWNER);

        Clinic mockClinic = new Clinic();
        mockClinic.setClinicId(UUID.randomUUID());
        mockClinic.setOwner(mockUser);

        mockSubscription = new UserSubscription();
        mockSubscription.setSubscriptionId(subscriptionId);
        mockSubscription.setClinic(mockClinic);
        mockSubscription.setStatus(UserSubscriptionStatus.PENDING_PAYMENT);

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setDurationDays(30);
        mockSubscription.setPlan(plan);

        mockPayment = new Payment();
        mockPayment.setSubscription(mockSubscription);
        mockPayment.setAmount(BigDecimal.valueOf(500000));
        mockPayment.setMethod(PaymentMethod.QR);
        mockPayment.setStatus(PaymentStatus.PENDING);
        mockPayment.setPaymentDescription("SUB" + subscriptionId.toString().substring(0, 8).toUpperCase());
        mockPayment.setCreatedAt(LocalDateTime.now().minusMinutes(5));

        ReflectionTestUtils.setField(qrPaymentService, "sepayAccountNumber", "9624720102004");
    }

    @Test
    @DisplayName("TC-SUB-PAY-001: Subscription payment verification success")
    void checkSubscriptionQrStatus_Success() {
        // Arrange
        when(userSubscriptionRepository.findById(subscriptionId)).thenReturn(Optional.of(mockSubscription));
        when(authService.getCurrentUser()).thenReturn(mockUser);
        when(paymentRepository.findFirstBySubscriptionSubscriptionIdOrderByCreatedAtDesc(subscriptionId))
                .thenReturn(Optional.of(mockPayment));

        SePayTransactionDto tx = new SePayTransactionDto();
        tx.setTransactionContent("Nap tien " + mockPayment.getPaymentDescription());
        tx.setAmountIn("500,000");
        tx.setTransactionDate(
                LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));

        SePayTransactionsListResponseDto response = new SePayTransactionsListResponseDto();
        response.setTransactions(List.of(tx));

        when(sePayClient.listTransactions(any(), any(), any(), any(), any())).thenReturn(response);

        // Act
        QrPaymentService.QrStatusResult result = qrPaymentService.checkSubscriptionQrStatus(subscriptionId);

        // Assert
        assertEquals("PAID", result.status());
        assertEquals(UserSubscriptionStatus.ACTIVE, mockSubscription.getStatus());
        assertNotNull(mockSubscription.getStartDate());
        assertEquals(PaymentStatus.PAID, mockPayment.getStatus());
        verify(paymentRepository).save(mockPayment);
        verify(userSubscriptionRepository).save(mockSubscription);
    }

    @Test
    @DisplayName("TC-SUB-PAY-002: Subscription payment verification pending if no transaction found")
    void checkSubscriptionQrStatus_Pending() {
        // Arrange
        when(userSubscriptionRepository.findById(subscriptionId)).thenReturn(Optional.of(mockSubscription));
        when(authService.getCurrentUser()).thenReturn(mockUser);
        when(paymentRepository.findFirstBySubscriptionSubscriptionIdOrderByCreatedAtDesc(subscriptionId))
                .thenReturn(Optional.of(mockPayment));

        SePayTransactionsListResponseDto response = new SePayTransactionsListResponseDto();
        response.setTransactions(List.of());

        when(sePayClient.listTransactions(any(), any(), any(), any(), any())).thenReturn(response);

        // Act
        QrPaymentService.QrStatusResult result = qrPaymentService.checkSubscriptionQrStatus(subscriptionId);

        // Assert
        assertEquals("PENDING", result.status());
        assertEquals(UserSubscriptionStatus.PENDING_PAYMENT, mockSubscription.getStatus());
    }
}
