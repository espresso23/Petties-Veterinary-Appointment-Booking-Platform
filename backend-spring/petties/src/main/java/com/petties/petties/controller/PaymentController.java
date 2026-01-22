package com.petties.petties.controller;

import com.petties.petties.service.PaymentHistoryService;
import com.petties.petties.service.QrPaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final QrPaymentService qrPaymentService;
    private final PaymentHistoryService paymentHistoryService;

    @GetMapping("/{bookingId}/qr-status")
    @PreAuthorize("hasRole('PET_OWNER')")
    public ResponseEntity<Map<String, Object>> checkQrStatus(@PathVariable UUID bookingId) {
        log.info("Check QR status for bookingId: {}", bookingId);

        QrPaymentService.QrStatusResult result = qrPaymentService.checkQrStatus(bookingId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("bookingId", bookingId);
        response.put("status", result.status());
        response.put("message", result.message());
        response.put("matchedTransactionId", result.matchedTransactionId());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/petowner/{petOwnerId}/history")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getPaymentHistoryByPetOwnerId(
            @PathVariable UUID petOwnerId,
            @RequestParam(defaultValue = "50") Integer limit,
            @RequestParam(required = false) String status
    ) {
        log.info("Get payment history for petOwnerId: {}", petOwnerId);

        List<Map<String, Object>> payments = paymentHistoryService.getPaymentHistoryByPetOwnerId(petOwnerId, limit, status);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("petOwnerId", petOwnerId);
        response.put("count", payments.size());
        response.put("payments", payments);
        response.put("message", "Lấy lịch sử thanh toán thành công");

        return ResponseEntity.ok(response);
    }
}
