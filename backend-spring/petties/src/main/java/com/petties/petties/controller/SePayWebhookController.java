package com.petties.petties.controller;

import com.petties.petties.integration.sepay.dto.SePayTransactionDto;
import com.petties.petties.model.Payment;
import com.petties.petties.model.UserSubscription;
import com.petties.petties.model.enums.PaymentStatus;
import com.petties.petties.model.enums.UserSubscriptionStatus;
import com.petties.petties.repository.PaymentRepository;
import com.petties.petties.repository.UserSubscriptionRepository;
import com.petties.petties.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Webhook controller for SePay payment notifications
 */
@RestController
@RequestMapping("/webhooks/sepay")
@RequiredArgsConstructor
@Slf4j
public class SePayWebhookController {

    private final PaymentRepository paymentRepository;
    private final UserSubscriptionRepository userSubscriptionRepository;
    private final NotificationService notificationService;

    // Pattern for matching subscription payment codes (e.g., SUB8A1B2C3D)
    private static final Pattern SUB_PATTERN = Pattern.compile("SUB([A-Z0-9]{8})");

    @PostMapping
    public ResponseEntity<String> handleSePayWebhook(@RequestBody SePayTransactionDto transaction) {
        log.info("Received SePay webhook: txId={}, amountIn={}, content='{}'",
                transaction.getId(), transaction.getAmountIn(), transaction.getTransactionContent());

        String content = transaction.getTransactionContent();
        if (content == null) {
            return ResponseEntity.ok("ACK_NO_CONTENT");
        }

        content = content.toUpperCase();

        // Check for Subscription Payment
        Matcher subMatcher = SUB_PATTERN.matcher(content);
        if (subMatcher.find()) {
            String subCode = "SUB" + subMatcher.group(1);
            return processSubscriptionPayment(subCode, transaction);
        }

        // Add other patterns if needed (e.g., for direct booking payments)
        log.info("No matching pattern found in SePay content: '{}'", content);
        return ResponseEntity.ok("ACK");
    }

    private ResponseEntity<String> processSubscriptionPayment(String subCode, SePayTransactionDto tx) {
        log.info("Processing subscription payment for code: {}", subCode);

        Optional<Payment> paymentOpt = paymentRepository.findByPaymentDescription(subCode);
        if (paymentOpt.isEmpty()) {
            log.warn("No payment found matching description: {}", subCode);
            return ResponseEntity.ok("NOT_FOUND");
        }

        Payment payment = paymentOpt.get();
        if (payment.getStatus() == PaymentStatus.PAID) {
            log.info("Payment {} already marked as PAID", payment.getPaymentId());
            return ResponseEntity.ok("ALREADY_PAID");
        }

        // 1. Mark payment as paid
        payment.markAsPaid();
        paymentRepository.save(payment);

        // 2. Activate linked subscription
        UserSubscription sub = payment.getSubscription();
        if (sub != null) {
            sub.setStatus(UserSubscriptionStatus.ACTIVE);

            int durationDays = (sub.getPlan() != null) ? sub.getPlan().getDurationDays() : 30;

            // Check if there is an existing ACTIVE subscription to calculate extension.
            Optional<UserSubscription> currentActiveOpt = userSubscriptionRepository
                    .findActiveSubscriptionByClinicId(sub.getClinic().getClinicId());

            if (currentActiveOpt.isPresent()
                    && !currentActiveOpt.get().getSubscriptionId().equals(sub.getSubscriptionId())) {
                UserSubscription currentActive = currentActiveOpt.get();
                if (currentActive.getEndDate() != null && currentActive.getEndDate().isAfter(LocalDateTime.now())) {
                    // CUMULATE (Gia hạn cộng dồn)
                    sub.setStartDate(LocalDateTime.now());
                    sub.setEndDate(currentActive.getEndDate().plusDays(durationDays));

                    // Expire the old subscription so the new one fully takes over with the total
                    // remaining time
                    currentActive.setStatus(UserSubscriptionStatus.EXPIRED);
                    userSubscriptionRepository.save(currentActive);

                    log.info("Cumulated subscription for clinic {}. Old EndDate: {}, New EndDate: {}",
                            sub.getClinic().getName(), currentActive.getEndDate(), sub.getEndDate());
                } else {
                    sub.setStartDate(LocalDateTime.now());
                    sub.setEndDate(LocalDateTime.now().plusDays(durationDays));
                }
            } else {
                sub.setStartDate(LocalDateTime.now());
                sub.setEndDate(LocalDateTime.now().plusDays(durationDays));
            }

            userSubscriptionRepository.save(sub);
            log.info("Subscription {} activated for clinic {}. End date: {}",
                    sub.getSubscriptionId(), sub.getClinic().getName(), sub.getEndDate());

            // 3. Send notification to owner
            notificationService.sendSubscriptionSuccessNotification(sub);
        } else {
            log.error("Payment {} is not linked to any subscription", payment.getPaymentId());
        }

        return ResponseEntity.ok("SUCCESS");
    }
}
