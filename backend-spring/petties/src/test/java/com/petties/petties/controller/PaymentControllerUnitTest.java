package com.petties.petties.controller;

import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.integration.sepay.SePayClient;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Payment;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.PaymentRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.PaymentHistoryService;
import com.petties.petties.service.QrPaymentService;
import com.petties.petties.service.TransactionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PaymentController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("PaymentController Unit Tests")
class PaymentControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private QrPaymentService qrPaymentService;

    @MockitoBean
    private PaymentHistoryService paymentHistoryService;

    @MockitoBean
    private TransactionService transactionService;

    @MockitoBean
    private SePayClient sePayClient;

    @MockitoBean
    private PaymentRepository paymentRepository;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private ClinicRepository clinicRepository;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private UserDetailsServiceImpl userDetailsServiceImpl;

    @MockitoBean
    private BlacklistedTokenRepository blacklistedTokenRepository;

    @Test
    @DisplayName("GET /payments/{bookingId}/status - trả về trạng thái QR thành công")
    void checkPaymentStatus_returnsSuccess() throws Exception {
        UUID bookingId = UUID.randomUUID();
        QrPaymentService.QrStatusResult result = new QrPaymentService.QrStatusResult(
                "PAID",
                "Đã thanh toán",
                "TXN-001");

        when(qrPaymentService.checkQrStatus(bookingId)).thenReturn(result);

        mockMvc.perform(get("/payments/{bookingId}/status", bookingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.message").value("Đã thanh toán"))
                .andExpect(jsonPath("$.matchedTransactionId").value("TXN-001"));
    }

    @Test
    @DisplayName("GET /payments/{bookingId}/method - trả về payment method QR")
    void getPaymentMethod_qr_returnsSuccess() throws Exception {
        UUID bookingId = UUID.randomUUID();
        Payment payment = Payment.builder()
                .method(PaymentMethod.QR)
                .amount(new BigDecimal("150000"))
                .build();

        when(paymentRepository.findByBookingBookingId(bookingId)).thenReturn(Optional.of(payment));

        mockMvc.perform(get("/payments/{bookingId}/method", bookingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.paymentMethod").value("QR"))
                .andExpect(jsonPath("$.isQrPayment").value(true));
    }

    @Test
    @DisplayName("GET /payments/{bookingId}/description - booking không dùng QR trả về 400")
    void getPaymentDescription_nonQrBooking_returnsBadRequest() throws Exception {
        UUID bookingId = UUID.randomUUID();
        when(transactionService.generatePaymentDescription(bookingId)).thenReturn(null);

        mockMvc.perform(get("/payments/{bookingId}/description", bookingId))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(containsString("không sử dụng phương thức thanh toán QR")));
    }

    @Test
    @DisplayName("GET /payments/history/my-payments - lấy lịch sử thanh toán của pet owner")
    void getMyPayments_returnsSuccess() throws Exception {
        UUID userId = UUID.randomUUID();
        User currentUser = User.builder()
                .userId(userId)
                .role(Role.PET_OWNER)
                .build();

        List<Map<String, Object>> payments = List.of(
                Map.of("bookingCode", "BK001", "amount", new BigDecimal("200000")));

        when(authService.getCurrentUser()).thenReturn(currentUser);
        when(paymentHistoryService.getPaymentHistoryByPetOwnerId(eq(userId), eq(50), eq("PAID")))
                .thenReturn(payments);

        mockMvc.perform(get("/payments/history/my-payments")
                        .param("limit", "50")
                        .param("status", "PAID"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.payments[0].bookingCode").value("BK001"));
    }

    @Test
    @DisplayName("GET /payments/history/clinic/{clinicId} - clinic owner không thuộc clinic trả về 403")
    void getClinicPayments_notOwnerOrManager_returnsForbidden() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        User currentUser = User.builder()
                .userId(userId)
                .role(Role.CLINIC_OWNER)
                .build();

        Clinic clinic = Clinic.builder()
                .clinicId(clinicId)
                .name("Petties Clinic")
                .build();

        when(authService.getCurrentUser()).thenReturn(currentUser);
        when(clinicRepository.findById(clinicId)).thenReturn(Optional.of(clinic));
        when(clinicRepository.existsByClinicIdAndOwnerUserId(clinicId, userId)).thenReturn(false);

        mockMvc.perform(get("/payments/history/clinic/{clinicId}", clinicId)
                        .param("limit", "20"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(containsString("không có quyền")));
    }

    @Test
    @DisplayName("GET /payments/{bookingId}/total - không tìm thấy booking trả về 404")
    void getBookingTotal_notFound_returns404() throws Exception {
        UUID bookingId = UUID.randomUUID();
        when(transactionService.getBookingTotalPrice(bookingId)).thenReturn(null);

        mockMvc.perform(get("/payments/{bookingId}/total", bookingId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /payments/history/clinic/{clinicId}/revenue - admin xem doanh thu thành công")
    void getClinicRevenueSummary_admin_returnsSuccess() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        User admin = User.builder()
                .userId(adminId)
                .role(Role.ADMIN)
                .build();
        Clinic clinic = Clinic.builder()
                .clinicId(clinicId)
                .name("Petties Clinic")
                .build();

        List<Map<String, Object>> items = List.of(Map.of("period", "2026-03", "amount", new BigDecimal("5000000")));

        when(authService.getCurrentUser()).thenReturn(admin);
        when(clinicRepository.findById(clinicId)).thenReturn(Optional.of(clinic));
        when(paymentHistoryService.getRevenueSummaryByClinicId(clinicId, "MONTH")).thenReturn(items);

        mockMvc.perform(get("/payments/history/clinic/{clinicId}/revenue", clinicId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.clinicName").value("Petties Clinic"))
                .andExpect(jsonPath("$.items[0].period").value("2026-03"));
    }
}
