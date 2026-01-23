package com.petties.petties.controller;

import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.integration.sepay.SePayClient;
import com.petties.petties.integration.sepay.dto.SePayTransactionsListResponseDto;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Payment;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.PaymentRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.PaymentHistoryService;
import com.petties.petties.service.QrPaymentService;
import com.petties.petties.service.TransactionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Unified Payment Controller - All payment-related endpoints
 * 
 * Consolidated from:
 * - TransactionController
 * - SePayController
 * - PaymentController (original)
 */
@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final QrPaymentService qrPaymentService;
    private final PaymentHistoryService paymentHistoryService;
    private final TransactionService transactionService;
    private final SePayClient sePayClient;
    private final PaymentRepository paymentRepository;
    private final AuthService authService;
    private final ClinicRepository clinicRepository;

    // ==================== HELPER METHODS ====================

    /**
     * Get current authenticated user's ID
     */
    private UUID getCurrentUserId() {
        return authService.getCurrentUser().getUserId();
    }

    // ==================== QR PAYMENT STATUS ====================

    /**
     * Check QR payment status for a booking
     * Previously: GET /payments/{bookingId}/qr-status
     */
    @GetMapping("/{bookingId}/status")
    @PreAuthorize("hasRole('PET_OWNER')")
    public ResponseEntity<Map<String, Object>> checkPaymentStatus(@PathVariable UUID bookingId) {
        log.info("Check payment status for bookingId: {}", bookingId);

        QrPaymentService.QrStatusResult result = qrPaymentService.checkQrStatus(bookingId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("bookingId", bookingId);
        response.put("status", result.status());
        response.put("message", result.message());
        response.put("matchedTransactionId", result.matchedTransactionId());

        return ResponseEntity.ok(response);
    }

    // ==================== PAYMENT METHOD ====================

    /**
     * Get actual payment method for a booking
     * Replaces: GET /api/transactions/is-qr/{bookingId}
     * FIX: Returns actual PaymentMethod enum instead of boolean
     */
    @GetMapping("/{bookingId}/method")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getPaymentMethod(@PathVariable UUID bookingId) {
        log.info("Get payment method for bookingId: {}", bookingId);

        Payment payment = paymentRepository.findByBookingBookingId(bookingId)
                .orElseThrow(() -> new com.petties.petties.exception.ResourceNotFoundException(
                        "Không tìm thấy thanh toán cho booking: " + bookingId));

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("bookingId", bookingId);
        response.put("paymentMethod", payment.getMethod().name());
        response.put("isQrPayment", payment.getMethod().name().equals("QR"));
        response.put("message", "Lấy phương thức thanh toán thành công");

        return ResponseEntity.ok(response);
    }

    // ==================== BOOKING TOTAL PRICE ====================

    /**
     * Get total price for a booking
     * Previously: GET /api/transactions/total-price/{bookingId}
     */
    @GetMapping("/{bookingId}/total")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getBookingTotal(@PathVariable UUID bookingId) {
        log.info("Get total price for bookingId: {}", bookingId);

        BigDecimal totalPrice = transactionService.getBookingTotalPrice(bookingId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", totalPrice != null);
        response.put("bookingId", bookingId.toString());
        response.put("totalPrice", totalPrice);

        if (totalPrice == null) {
            response.put("message", "Không tìm thấy booking");
            return ResponseEntity.notFound().build();
        }

        response.put("message", "Lấy total price thành công");
        return ResponseEntity.ok(response);
    }

    // ==================== PAYMENT DESCRIPTION ====================

    /**
     * Generate payment description for SePay
     * Previously: GET /api/transactions/payment-description/{bookingId}
     */
    @GetMapping("/{bookingId}/description")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getPaymentDescription(@PathVariable UUID bookingId) {
        log.info("Get payment description for bookingId: {}", bookingId);

        try {
            String paymentDescription = transactionService.generatePaymentDescription(bookingId);

            Map<String, Object> response = new HashMap<>();
            response.put("success", paymentDescription != null);
            response.put("bookingId", bookingId.toString());
            response.put("paymentDescription", paymentDescription);

            if (paymentDescription == null) {
                response.put("message", "Booking không sử dụng phương thức thanh toán QR");
                return ResponseEntity.badRequest().body(response);
            }

            response.put("message", "Tạo payment description thành công");
            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {
            log.error("Error generating payment description: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    // ==================== PAYMENT HISTORY ====================

    /**
     * Get payment history for a pet owner
     * Previously: GET /payments/petowner/{petOwnerId}/history
     */
    @GetMapping("/history/petowner/{petOwnerId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getPaymentHistoryByPetOwnerId(
            @PathVariable UUID petOwnerId,
            @RequestParam(defaultValue = "50") Integer limit,
            @RequestParam(required = false) String status) {
        log.info("Get payment history for petOwnerId: {}", petOwnerId);

        List<Map<String, Object>> payments = paymentHistoryService.getPaymentHistoryByPetOwnerId(petOwnerId, limit,
                status);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("petOwnerId", petOwnerId);
        response.put("count", payments.size());
        response.put("payments", payments);
        response.put("message", "Lấy lịch sử thanh toán thành công");

        return ResponseEntity.ok(response);
    }

    /**
     * PetOwner: Get own payment history
     * NEW: Self-service endpoint for pet owners
     */
    @GetMapping("/history/my-payments")
    @PreAuthorize("hasRole('PET_OWNER')")
    public ResponseEntity<Map<String, Object>> getMyPayments(
            @RequestParam(defaultValue = "50") Integer limit,
            @RequestParam(required = false) String status) {
        UUID petOwnerId = getCurrentUserId();
        log.info("PetOwner {} viewing own payment history", petOwnerId);

        List<Map<String, Object>> payments = paymentHistoryService.getPaymentHistoryByPetOwnerId(
                petOwnerId, limit, status);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("count", payments.size());
        response.put("payments", payments);
        response.put("message", "Lấy lịch sử thanh toán thành công");

        return ResponseEntity.ok(response);
    }

    /**
     * ClinicOwner/Manager: Get payment history for their clinic
     * NEW: Clinic-based payment history with ownership verification
     */
    @GetMapping("/history/my-clinic")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<Map<String, Object>> getMyClinicPayments(
            @RequestParam(defaultValue = "50") Integer limit,
            @RequestParam(required = false) String status) {
        UUID userId = getCurrentUserId();
        log.info("User {} requesting clinic payment history", userId);

        // Find user's clinic
        Clinic clinic = clinicRepository.findFirstByOwnerUserId(userId)
                .orElseThrow(() -> new com.petties.petties.exception.ResourceNotFoundException(
                        "Bạn chưa có phòng khám nào"));

        List<Map<String, Object>> payments = paymentHistoryService.getPaymentHistoryByClinicId(
                clinic.getClinicId(), limit, status);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("clinicId", clinic.getClinicId());
        response.put("clinicName", clinic.getName());
        response.put("count", payments.size());
        response.put("payments", payments);
        response.put("message", "Lấy lịch sử thanh toán của phòng khám thành công");

        return ResponseEntity.ok(response);
    }

    /**
     * Admin: Get payment history for a specific clinic
     * NEW: Admin can view any clinic, with optional ownership check for Clinic
     * staff
     */
    @GetMapping("/history/clinic/{clinicId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<Map<String, Object>> getClinicPayments(
            @PathVariable UUID clinicId,
            @RequestParam(defaultValue = "50") Integer limit,
            @RequestParam(required = false) String status) {
        UUID userId = getCurrentUserId();
        log.info("User {} requesting payment history for clinic {}", userId, clinicId);

        // Verify clinic exists
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new com.petties.petties.exception.ResourceNotFoundException(
                        "Không tìm thấy phòng khám"));

        // Check ownership for non-admin users
        boolean isAdmin = authService.getCurrentUser().getRole().name().equals("ADMIN");
        if (!isAdmin) {
            boolean ownsClinic = clinicRepository.existsByClinicIdAndOwnerUserId(clinicId, userId);
            if (!ownsClinic) {
                throw new ForbiddenException("Bạn không có quyền xem lịch sử thanh toán của phòng khám này");
            }
        }

        List<Map<String, Object>> payments = paymentHistoryService.getPaymentHistoryByClinicId(
                clinicId, limit, status);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("clinicId", clinicId);
        response.put("clinicName", clinic.getName());
        response.put("count", payments.size());
        response.put("payments", payments);
        response.put("message", "Lấy lịch sử thanh toán thành công");

        return ResponseEntity.ok(response);
    }

    // ==================== SEPAY INTEGRATION ====================

    /**
     * List SePay transactions
     * Previously: GET /sepay/transactions
     */
    @GetMapping("/sepay/transactions")
    @PreAuthorize("hasAnyRole('ADMIN', 'CLINIC_OWNER')")
    public ResponseEntity<Map<String, Object>> listSePayTransactions(
            @RequestParam(defaultValue = "200") Integer limit,
            @RequestParam(required = false, name = "account_number") String accountNumber,
            @RequestParam(required = false, name = "transaction_date_min") String transactionDateMin,
            @RequestParam(required = false, name = "transaction_date_max") String transactionDateMax,
            @RequestParam(required = false, name = "since_id") String sinceId) {
        log.info("List SePay transactions, limit={}", limit);

        SePayTransactionsListResponseDto responseDto = sePayClient.listTransactions(
                limit,
                accountNumber,
                transactionDateMin,
                transactionDateMax,
                sinceId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("count", responseDto.getTransactions() != null ? responseDto.getTransactions().size() : 0);
        response.put("transactions", responseDto.getTransactions());
        response.put("message", "Lấy danh sách giao dịch thành công");

        return ResponseEntity.ok(response);
    }

    // ==================== ADMIN - ALL BOOKINGS ====================

    /**
     * Get all bookings with payment info
     * Previously: GET /api/transactions/all
     */
    @GetMapping("/admin/all-bookings")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getAllBookings() {
        log.info("Admin request: Get all bookings");

        try {
            List<Booking> bookings = transactionService.getAllBookings();
            List<Map<String, Object>> bookingItems = bookings.stream().map(booking -> {
                Map<String, Object> item = new HashMap<>();
                item.put("bookingId", booking.getBookingId());
                item.put("bookingCode", booking.getBookingCode());
                item.put("bookingDate", booking.getBookingDate());
                item.put("bookingTime", booking.getBookingTime());
                item.put("type", booking.getType());
                item.put("totalPrice", booking.getTotalPrice());
                item.put("status", booking.getStatus());

                if (booking.getClinic() != null) {
                    Map<String, Object> clinic = new HashMap<>();
                    clinic.put("clinicId", booking.getClinic().getClinicId());
                    clinic.put("name", booking.getClinic().getName());
                    item.put("clinic", clinic);
                }

                if (booking.getPetOwner() != null) {
                    Map<String, Object> petOwner = new HashMap<>();
                    petOwner.put("userId", booking.getPetOwner().getUserId());
                    petOwner.put("username", booking.getPetOwner().getUsername());
                    item.put("petOwner", petOwner);
                }

                if (booking.getPet() != null) {
                    Map<String, Object> pet = new HashMap<>();
                    pet.put("id", booking.getPet().getId());
                    pet.put("name", booking.getPet().getName());
                    item.put("pet", pet);
                }

                if (booking.getAssignedVet() != null) {
                    Map<String, Object> assignedVet = new HashMap<>();
                    assignedVet.put("userId", booking.getAssignedVet().getUserId());
                    assignedVet.put("username", booking.getAssignedVet().getUsername());
                    item.put("assignedVet", assignedVet);
                }

                if (booking.getPayment() != null) {
                    Map<String, Object> payment = new HashMap<>();
                    payment.put("paymentId", booking.getPayment().getPaymentId());
                    payment.put("amount", booking.getPayment().getAmount());
                    payment.put("method", booking.getPayment().getMethod());
                    payment.put("status", booking.getPayment().getStatus());
                    item.put("payment", payment);
                }

                return item;
            }).toList();

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("count", bookingItems.size());
            response.put("bookings", bookingItems);
            response.put("message", "Lấy tất cả bookings thành công");

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error getting all bookings: {}", e.getMessage());
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("error", "Lỗi khi lấy danh sách bookings: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
}
