package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.integration.sepay.SePayClient;
import com.petties.petties.integration.sepay.dto.SePayTransactionDto;
import com.petties.petties.integration.sepay.dto.SePayTransactionsListResponseDto;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Payment;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.repository.PaymentRepository;
import com.petties.petties.service.PaymentHistoryService;
import com.petties.petties.service.QrPaymentService;
import com.petties.petties.service.TransactionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Comprehensive unit tests for consolidated PaymentController
 *
 * Covers all endpoints:
 * - GET /{bookingId}/status - QR payment status
 * - GET /{bookingId}/method - Payment method
 * - GET /{bookingId}/total - Booking total
 * - GET /{bookingId}/description - Payment description
 * - GET /history/petowner/{id} - Payment history
 * - GET /sepay/transactions - SePay transactions
 * - GET /admin/all-bookings - All bookings
 */
@WebMvcTest(PaymentController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("PaymentController Unit Tests - Consolidated")
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

        // Security-related dependencies
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

        // ==================== PAYMENT STATUS TESTS ====================

        @Test
        @WithMockUser(roles = "PET_OWNER")
        @DisplayName("TC-UNIT-PAYMENT-001: checkPaymentStatus_paid_returns200")
        void checkPaymentStatus_paid_returns200() throws Exception {
                UUID bookingId = UUID.randomUUID();
                QrPaymentService.QrStatusResult mockResult = QrPaymentService.QrStatusResult
                                .paid("Thanh toán thành công", "tx123456");

                when(qrPaymentService.checkQrStatus(bookingId)).thenReturn(mockResult);

                mockMvc.perform(get("/payments/{bookingId}/status", bookingId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.status").value("PAID"))
                                .andExpect(jsonPath("$.message").value("Thanh toán thành công"))
                                .andExpect(jsonPath("$.matchedTransactionId").value("tx123456"));
        }

        @Test
        @WithMockUser(roles = "PET_OWNER")
        @DisplayName("TC-UNIT-PAYMENT-002: checkPaymentStatus_pending_returns200")
        void checkPaymentStatus_pending_returns200() throws Exception {
                UUID bookingId = UUID.randomUUID();
                QrPaymentService.QrStatusResult mockResult = QrPaymentService.QrStatusResult
                                .pending("Chưa tìm thấy giao dịch", null);

                when(qrPaymentService.checkQrStatus(bookingId)).thenReturn(mockResult);

                mockMvc.perform(get("/payments/{bookingId}/status", bookingId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value("PENDING"));
        }

        @Test
        @WithMockUser(roles = "PET_OWNER")
        @DisplayName("TC-UNIT-PAYMENT-003: checkPaymentStatus_notFound_returns404")
        void checkPaymentStatus_notFound_returns404() throws Exception {
                UUID bookingId = UUID.randomUUID();

                when(qrPaymentService.checkQrStatus(bookingId))
                                .thenThrow(new ResourceNotFoundException("Không tìm thấy booking"));

                mockMvc.perform(get("/payments/{bookingId}/status", bookingId))
                                .andExpect(status().isNotFound());
        }

        @Test
        @WithMockUser(roles = "PET_OWNER")
        @DisplayName("TC-UNIT-PAYMENT-004: checkPaymentStatus_forbidden_returns403")
        void checkPaymentStatus_forbidden_returns403() throws Exception {
                UUID bookingId = UUID.randomUUID();

                when(qrPaymentService.checkQrStatus(bookingId))
                                .thenThrow(new ForbiddenException("Không có quyền"));

                mockMvc.perform(get("/payments/{bookingId}/status", bookingId))
                                .andExpect(status().isForbidden());
        }

        // ==================== PAYMENT METHOD TESTS ====================

        @Test
        @DisplayName("TC-UNIT-PAYMENT-005: getPaymentMethod_QR_returns200")
        void getPaymentMethod_QR_returns200() throws Exception {
                UUID bookingId = UUID.randomUUID();
                Payment mockPayment = new Payment();
                mockPayment.setMethod(PaymentMethod.QR);

                when(paymentRepository.findByBookingBookingId(bookingId))
                                .thenReturn(Optional.of(mockPayment));

                mockMvc.perform(get("/payments/{bookingId}/method", bookingId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.paymentMethod").value("QR"))
                                .andExpect(jsonPath("$.isQrPayment").value(true));
        }

        @Test
        @DisplayName("TC-UNIT-PAYMENT-006: getPaymentMethod_CASH_returns200")
        void getPaymentMethod_CASH_returns200() throws Exception {
                UUID bookingId = UUID.randomUUID();
                Payment mockPayment = new Payment();
                mockPayment.setMethod(PaymentMethod.CASH);

                when(paymentRepository.findByBookingBookingId(bookingId))
                                .thenReturn(Optional.of(mockPayment));

                mockMvc.perform(get("/payments/{bookingId}/method", bookingId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.paymentMethod").value("CASH"))
                                .andExpect(jsonPath("$.isQrPayment").value(false));
        }

        @Test
        @DisplayName("TC-UNIT-PAYMENT-007: getPaymentMethod_CARD_returns200")
        void getPaymentMethod_CARD_returns200() throws Exception {
                UUID bookingId = UUID.randomUUID();
                Payment mockPayment = new Payment();
                mockPayment.setMethod(PaymentMethod.CARD);

                when(paymentRepository.findByBookingBookingId(bookingId))
                                .thenReturn(Optional.of(mockPayment));

                mockMvc.perform(get("/payments/{bookingId}/method", bookingId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.paymentMethod").value("CARD"))
                                .andExpect(jsonPath("$.isQrPayment").value(false));
        }

        @Test
        @DisplayName("TC-UNIT-PAYMENT-008: getPaymentMethod_notFound_returns404")
        void getPaymentMethod_notFound_returns404() throws Exception {
                UUID bookingId = UUID.randomUUID();

                when(paymentRepository.findByBookingBookingId(bookingId))
                                .thenReturn(Optional.empty());

                mockMvc.perform(get("/payments/{bookingId}/method", bookingId))
                                .andExpect(status().isNotFound());
        }

        // ==================== BOOKING TOTAL TESTS ====================

        @Test
        @DisplayName("TC-UNIT-PAYMENT-009: getBookingTotal_valid_returns200")
        void getBookingTotal_valid_returns200() throws Exception {
                UUID bookingId = UUID.randomUUID();
                BigDecimal totalPrice = new BigDecimal("500000");

                when(transactionService.getBookingTotalPrice(bookingId))
                                .thenReturn(totalPrice);

                mockMvc.perform(get("/payments/{bookingId}/total", bookingId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.totalPrice").value(500000));
        }

        @Test
        @DisplayName("TC-UNIT-PAYMENT-010: getBookingTotal_notFound_returns404")
        void getBookingTotal_notFound_returns404() throws Exception {
                UUID bookingId = UUID.randomUUID();

                when(transactionService.getBookingTotalPrice(bookingId))
                                .thenReturn(null);

                mockMvc.perform(get("/payments/{bookingId}/total", bookingId))
                                .andExpect(status().isNotFound());
        }

        // ==================== PAYMENT DESCRIPTION TESTS ====================

        @Test
        @DisplayName("TC-UNIT-PAYMENT-011: getPaymentDescription_valid_returns200")
        void getPaymentDescription_valid_returns200() throws Exception {
                UUID bookingId = UUID.randomUUID();
                String description = "PETTIES BK123456";

                when(transactionService.generatePaymentDescription(bookingId))
                                .thenReturn(description);

                mockMvc.perform(get("/payments/{bookingId}/description", bookingId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.paymentDescription").value(description));
        }

        @Test
        @DisplayName("TC-UNIT-PAYMENT-012: getPaymentDescription_nonQrPayment_returns400")
        void getPaymentDescription_nonQrPayment_returns400() throws Exception {
                UUID bookingId = UUID.randomUUID();

                when(transactionService.generatePaymentDescription(bookingId))
                                .thenReturn(null);

                mockMvc.perform(get("/payments/{bookingId}/description", bookingId))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.success").value(false));
        }

        @Test
        @DisplayName("TC-UNIT-PAYMENT-013: getPaymentDescription_invalidBooking_returns400")
        void getPaymentDescription_invalidBooking_returns400() throws Exception {
                UUID bookingId = UUID.randomUUID();

                when(transactionService.generatePaymentDescription(bookingId))
                                .thenThrow(new IllegalArgumentException("Invalid booking"));

                mockMvc.perform(get("/payments/{bookingId}/description", bookingId))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // ==================== PAYMENT HISTORY TESTS ====================

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("TC-UNIT-PAYMENT-014: getPaymentHistory_valid_returns200")
        void getPaymentHistory_valid_returns200() throws Exception {
                UUID petOwnerId = UUID.randomUUID();
                Map<String, Object> paymentRecord = new HashMap<>();
                paymentRecord.put("paymentId", UUID.randomUUID().toString());
                paymentRecord.put("amount", 500000);
                paymentRecord.put("status", "PAID");

                List<Map<String, Object>> mockHistory = List.of(paymentRecord);

                when(paymentHistoryService.getPaymentHistoryByPetOwnerId(eq(petOwnerId), eq(50), any()))
                                .thenReturn(mockHistory);

                mockMvc.perform(get("/payments/history/petowner/{petOwnerId}", petOwnerId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.count").value(1))
                                .andExpect(jsonPath("$.payments[0].status").value("PAID"));
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("TC-UNIT-PAYMENT-015: getPaymentHistory_withStatusFilter_returns200")
        void getPaymentHistory_withStatusFilter_returns200() throws Exception {
                UUID petOwnerId = UUID.randomUUID();
                List<Map<String, Object>> mockHistory = List.of(Map.of("status", "PAID"));

                when(paymentHistoryService.getPaymentHistoryByPetOwnerId(eq(petOwnerId), eq(50), eq("PAID")))
                                .thenReturn(mockHistory);

                mockMvc.perform(get("/payments/history/petowner/{petOwnerId}", petOwnerId)
                                .param("status", "PAID"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.count").value(1));
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("TC-UNIT-PAYMENT-016: getPaymentHistory_empty_returns200")
        void getPaymentHistory_empty_returns200() throws Exception {
                UUID petOwnerId = UUID.randomUUID();

                when(paymentHistoryService.getPaymentHistoryByPetOwnerId(eq(petOwnerId), eq(50), any()))
                                .thenReturn(Collections.emptyList());

                mockMvc.perform(get("/payments/history/petowner/{petOwnerId}", petOwnerId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.count").value(0))
                                .andExpect(jsonPath("$.payments").isEmpty());
        }

        // ==================== SEPAY TRANSACTIONS TESTS ====================

        @Test
        @DisplayName("TC-UNIT-PAYMENT-017: listSePayTransactions_valid_returns200")
        void listSePayTransactions_valid_returns200() throws Exception {
                SePayTransactionDto tx = new SePayTransactionDto();
                tx.setId("123");
                tx.setAmountIn("500000");

                SePayTransactionsListResponseDto responseDto = new SePayTransactionsListResponseDto();
                responseDto.setTransactions(List.of(tx));

                when(sePayClient.listTransactions(any(), any(), any(), any(), any()))
                                .thenReturn(responseDto);

                mockMvc.perform(get("/payments/sepay/transactions"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.count").value(1))
                                .andExpect(jsonPath("$.transactions[0].id").value("123"));
        }

        @Test
        @DisplayName("TC-UNIT-PAYMENT-018: listSePayTransactions_withParams_returns200")
        void listSePayTransactions_withParams_returns200() throws Exception {
                SePayTransactionsListResponseDto responseDto = new SePayTransactionsListResponseDto();
                responseDto.setTransactions(Collections.emptyList());

                when(sePayClient.listTransactions(eq(100), eq("123456"), any(), any(), any()))
                                .thenReturn(responseDto);

                mockMvc.perform(get("/payments/sepay/transactions")
                                .param("limit", "100")
                                .param("account_number", "123456"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.count").value(0));
        }

        // ==================== ADMIN ALL BOOKINGS TESTS ====================

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("TC-UNIT-PAYMENT-019: getAllBookings_valid_returns200")
        void getAllBookings_valid_returns200() throws Exception {
                Booking booking = new Booking();
                booking.setBookingId(UUID.randomUUID());
                booking.setBookingCode("BK123");

                when(transactionService.getAllBookings())
                                .thenReturn(List.of(booking));

                mockMvc.perform(get("/payments/admin/all-bookings"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.count").value(1))
                                .andExpect(jsonPath("$.bookings[0].bookingCode").value("BK123"));
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("TC-UNIT-PAYMENT-020: getAllBookings_empty_returns200")
        void getAllBookings_empty_returns200() throws Exception {
                when(transactionService.getAllBookings())
                                .thenReturn(Collections.emptyList());

                mockMvc.perform(get("/payments/admin/all-bookings"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.count").value(0));
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("TC-UNIT-PAYMENT-021: getAllBookings_error_returns500")
        void getAllBookings_error_returns500() throws Exception {
                when(transactionService.getAllBookings())
                                .thenThrow(new RuntimeException("DB error"));

                mockMvc.perform(get("/payments/admin/all-bookings"))
                                .andExpect(status().isInternalServerError())
                                .andExpect(jsonPath("$.success").value(false));
        }
}
