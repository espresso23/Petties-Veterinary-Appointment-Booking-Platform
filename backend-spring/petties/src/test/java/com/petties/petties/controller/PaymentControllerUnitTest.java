package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.PaymentHistoryService;
import com.petties.petties.service.QrPaymentService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.*;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for PaymentController using @WebMvcTest and MockMvc.
 *
 * Tests cover:
 * - Check QR status endpoint (checkQrStatus)
 * - Get payment history endpoint (getPaymentHistoryByPetOwnerId)
 *
 * Scenarios:
 * - Happy Path (200 OK)
 * - Bad Request (400)
 * - Forbidden (403)
 * - Not Found (404)
 * - Internal Server Error (500)
 */
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

    // Security-related dependencies for JwtAuthenticationFilter
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

    // ==================== CHECK QR STATUS TESTS ====================

    @Test
    @WithMockUser(roles = "PET_OWNER")
    @DisplayName("TC-UNIT-PAYMENT-001: checkQrStatus_validBookingId_returns200")
    void checkQrStatus_validBookingId_returns200() throws Exception {
        // Arrange
        UUID bookingId = UUID.randomUUID();
        QrPaymentService.QrStatusResult mockResult = QrPaymentService.QrStatusResult.paid("Thanh toán thành công", "tx123456");

        when(qrPaymentService.checkQrStatus(bookingId)).thenReturn(mockResult);

        // Act & Assert
        mockMvc.perform(get("/payments/{bookingId}/qr-status", bookingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.bookingId").value(bookingId.toString()))
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.message").value("Thanh toán thành công"))
                .andExpect(jsonPath("$.matchedTransactionId").value("tx123456"));
    }

    @Test
    @WithMockUser(roles = "PET_OWNER")
    @DisplayName("TC-UNIT-PAYMENT-002: checkQrStatus_pendingPayment_returns200")
    void checkQrStatus_pendingPayment_returns200() throws Exception {
        // Arrange
        UUID bookingId = UUID.randomUUID();
        QrPaymentService.QrStatusResult mockResult = QrPaymentService.QrStatusResult.pending("Chưa tìm thấy giao dịch", null);

        when(qrPaymentService.checkQrStatus(bookingId)).thenReturn(mockResult);

        // Act & Assert
        mockMvc.perform(get("/payments/{bookingId}/qr-status", bookingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.matchedTransactionId").doesNotExist());
    }

    @Test
    @WithMockUser(roles = "PET_OWNER")
    @DisplayName("TC-UNIT-PAYMENT-003: checkQrStatus_notFound_returns404")
    void checkQrStatus_notFound_returns404() throws Exception {
        // Arrange
        UUID bookingId = UUID.randomUUID();

        when(qrPaymentService.checkQrStatus(bookingId))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy booking"));

        // Act & Assert
        mockMvc.perform(get("/payments/{bookingId}/qr-status", bookingId))
                .andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(roles = "PET_OWNER")
    @DisplayName("TC-UNIT-PAYMENT-004: checkQrStatus_forbidden_returns403")
    void checkQrStatus_forbidden_returns403() throws Exception {
        // Arrange
        UUID bookingId = UUID.randomUUID();

        when(qrPaymentService.checkQrStatus(bookingId))
                .thenThrow(new ForbiddenException("Bạn không có quyền kiểm tra thanh toán của booking này"));

        // Act & Assert
        mockMvc.perform(get("/payments/{bookingId}/qr-status", bookingId))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "PET_OWNER")
    @DisplayName("TC-UNIT-PAYMENT-005: checkQrStatus_badRequest_returns400")
    void checkQrStatus_badRequest_returns400() throws Exception {
        // Arrange
        UUID bookingId = UUID.randomUUID();

        when(qrPaymentService.checkQrStatus(bookingId))
                .thenThrow(new BadRequestException("Booking không sử dụng phương thức thanh toán QR"));

        // Act & Assert
        mockMvc.perform(get("/payments/{bookingId}/qr-status", bookingId))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(roles = "PET_OWNER")
    @DisplayName("TC-UNIT-PAYMENT-006: checkQrStatus_unknownError_returns500")
    void checkQrStatus_unknownError_returns500() throws Exception {
        // Arrange
        UUID bookingId = UUID.randomUUID();

        when(qrPaymentService.checkQrStatus(bookingId))
                .thenThrow(new RuntimeException("Unexpected db error"));

        // Act & Assert
        mockMvc.perform(get("/payments/{bookingId}/qr-status", bookingId))
                .andExpect(status().isInternalServerError());
    }

    // ==================== GET PAYMENT HISTORY TESTS ====================

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("TC-UNIT-PAYMENT-007: getPaymentHistoryByPetOwnerId_validId_returns200")
    void getPaymentHistoryByPetOwnerId_validId_returns200() throws Exception {
        // Arrange
        UUID petOwnerId = UUID.randomUUID();
        Map<String, Object> paymentRecord = new HashMap<>();
        paymentRecord.put("paymentId", UUID.randomUUID().toString());
        paymentRecord.put("amount", 500000);
        paymentRecord.put("status", "PAID");
        paymentRecord.put("createdAt", LocalDateTime.now().toString());

        List<Map<String, Object>> mockHistory = List.of(paymentRecord);

        // Match default limit = 50 from controller
        when(paymentHistoryService.getPaymentHistoryByPetOwnerId(eq(petOwnerId), eq(50), any()))
                .thenReturn(mockHistory);

        // Act & Assert
        mockMvc.perform(get("/payments/petowner/{petOwnerId}/history", petOwnerId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.petOwnerId").value(petOwnerId.toString()))
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.payments[0].status").value("PAID"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("TC-UNIT-PAYMENT-008: getPaymentHistoryByPetOwnerId_withFilter_returns200")
    void getPaymentHistoryByPetOwnerId_withFilter_returns200() throws Exception {
        // Arrange
        UUID petOwnerId = UUID.randomUUID();
        Map<String, Object> paymentRecord = new HashMap<>();
        paymentRecord.put("paymentId", UUID.randomUUID().toString());
        paymentRecord.put("status", "PAID");

        List<Map<String, Object>> mockHistory = List.of(paymentRecord);

        when(paymentHistoryService.getPaymentHistoryByPetOwnerId(eq(petOwnerId), eq(50), eq("PAID")))
                .thenReturn(mockHistory);

        // Act & Assert
        mockMvc.perform(get("/payments/petowner/{petOwnerId}/history", petOwnerId)
                        .param("status", "PAID"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.count").value(1));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("TC-UNIT-PAYMENT-009: getPaymentHistoryByPetOwnerId_empty_returns200")
    void getPaymentHistoryByPetOwnerId_empty_returns200() throws Exception {
        // Arrange
        UUID petOwnerId = UUID.randomUUID();
        List<Map<String, Object>> mockHistory = Collections.emptyList();

        when(paymentHistoryService.getPaymentHistoryByPetOwnerId(eq(petOwnerId), eq(50), any()))
                .thenReturn(mockHistory);

        // Act & Assert
        mockMvc.perform(get("/payments/petowner/{petOwnerId}/history", petOwnerId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0))
                .andExpect(jsonPath("$.payments").isEmpty());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("TC-UNIT-PAYMENT-010: getPaymentHistory_internalError_returns500")
    void getPaymentHistory_internalError_returns500() throws Exception {
        // Arrange
        UUID petOwnerId = UUID.randomUUID();

        when(paymentHistoryService.getPaymentHistoryByPetOwnerId(any(), any(), any()))
                .thenThrow(new RuntimeException("Database timeout"));

        // Act & Assert
        mockMvc.perform(get("/payments/petowner/{petOwnerId}/history", petOwnerId))
                .andExpect(status().isInternalServerError());
    }
}
