package com.petties.petties.service;

import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.integration.sepay.SePayClient;
import com.petties.petties.integration.sepay.dto.SePayTransactionDto;
import com.petties.petties.integration.sepay.dto.SePayTransactionsListResponseDto;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Payment;
import com.petties.petties.model.UserSubscription;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.model.enums.PaymentStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.UserSubscriptionStatus;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.PaymentRepository;
import com.petties.petties.repository.UserSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class QrPaymentService {

    private static final DateTimeFormatter SEPAY_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss",
            Locale.ROOT);
    private static final Pattern WHITESPACE_PATTERN = Pattern.compile("\\s+");
    private static final Pattern NON_ALNUM_PATTERN = Pattern.compile("[^a-zA-Z0-9]");

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final UserSubscriptionRepository userSubscriptionRepository;
    private final AuthService authService;
    private final TransactionService transactionService;
    private final SePayClient sePayClient;
    private final NotificationService notificationService;

    @Value("${sepay.account-number:}")
    private String sepayAccountNumber;

    @Transactional
    public QrStatusResult checkQrStatus(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy booking"));

        var currentUser = authService.getCurrentUser();
        Role currentRole = currentUser.getRole();
        if (currentRole == Role.PET_OWNER) {
            if (booking.getPetOwner() == null || booking.getPetOwner().getUserId() == null
                    || !booking.getPetOwner().getUserId().equals(currentUser.getUserId())) {
                throw new ForbiddenException("Bạn không có quyền kiểm tra thanh toán của booking này");
            }
        } else if (currentRole == Role.STAFF || currentRole == Role.CLINIC_MANAGER) {
            if (booking.getClinic() == null || currentUser.getWorkingClinic() == null
                    || !booking.getClinic().getClinicId().equals(currentUser.getWorkingClinic().getClinicId())) {
                throw new ForbiddenException("Bạn không có quyền kiểm tra thanh toán của booking này");
            }
        } else if (currentRole != Role.ADMIN) {
            throw new ForbiddenException("Bạn không có quyền kiểm tra thanh toán của booking này");
        }

        Payment payment = paymentRepository.findByBookingBookingId(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thanh toán cho booking"));

        if (payment.getMethod() != PaymentMethod.QR) {
            throw new BadRequestException("Booking không sử dụng phương thức thanh toán QR");
        }

        if (payment.getStatus() == PaymentStatus.PAID) {
            notificationService.sendQrPaymentSuccessNotificationToStaffAndManagers(booking);
            return QrStatusResult.paid("Thanh toán đã được xác nhận trước đó", null);
        }

        String paymentDescription = payment.getPaymentDescription();
        if (paymentDescription == null || paymentDescription.isBlank()) {
            paymentDescription = transactionService.generatePaymentDescription(bookingId);
        }

        if (paymentDescription == null || paymentDescription.isBlank()) {
            throw new BadRequestException("Không thể tạo nội dung thanh toán cho booking");
        }

        LocalDateTime paymentCreatedAt = payment.getCreatedAt();
        String transactionDateMin = null;
        if (paymentCreatedAt != null) {
            transactionDateMin = paymentCreatedAt.format(SEPAY_TIME_FORMATTER);
        }

        List<SePayTransactionDto> transactions = loadTransactionsWithFallback(transactionDateMin);
        if (transactions == null || transactions.isEmpty()) {
            return QrStatusResult.pending("Chưa tìm thấy giao dịch phù hợp", null);
        }

        BigDecimal expectedAmount = payment.getAmount();
        SePayTransactionDto matched = null;
        String normalizedPaymentDescription = normalizeForMatching(paymentDescription);

        for (SePayTransactionDto tx : transactions) {
            if (tx == null) {
                continue;
            }

            String content = tx.getTransactionContent();
            String normalizedContent = normalizeForMatching(content);
            if (normalizedContent == null || normalizedPaymentDescription == null
                    || !normalizedContent.contains(normalizedPaymentDescription)) {
                continue;
            }

            if (expectedAmount != null) {
                BigDecimal amountIn;
                try {
                    amountIn = parseAmount(tx.getAmountIn());
                } catch (Exception e) {
                    continue;
                }

                if (!isAmountMatched(expectedAmount, amountIn)) {
                    continue;
                }
            }

            if (paymentCreatedAt != null && tx.getTransactionDate() != null) {
                try {
                    LocalDateTime txTime = LocalDateTime.parse(tx.getTransactionDate(), SEPAY_TIME_FORMATTER);
                    // Allow up to 2 minutes clock drift between systems.
                    if (txTime.isBefore(paymentCreatedAt.minusMinutes(2))) {
                        continue;
                    }
                } catch (Exception e) {
                    // Ignore parsing errors and still allow match if content + amount matches
                }
            }

            matched = tx;
            break;
        }

        if (matched == null) {
            return QrStatusResult.pending("Chưa tìm thấy giao dịch phù hợp", null);
        }

        payment.markAsPaid();
        paymentRepository.save(payment);

        // Chỉ sync trạng thái thanh toán vào Booking.
        // Booking status phải giữ IN_PROGRESS và chỉ Staff mới được complete.
        booking.syncPaymentStatus(payment);
        bookingRepository.save(booking);

        log.info("QR payment matched for booking {} - tx {}", booking.getBookingCode(), matched.getId());

        notificationService.sendQrPaymentSuccessNotificationToStaffAndManagers(booking);

        return QrStatusResult.paid("Đã xác nhận thanh toán QR thành công", matched.getId());
    }

    @Transactional
    public QrStatusResult checkSubscriptionQrStatus(UUID subscriptionId) {
        UserSubscription subscription = userSubscriptionRepository.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin đăng ký gói"));

        var currentUser = authService.getCurrentUser();
        // Permission check: only clinic owner or admin
        if (currentUser.getRole() != Role.ADMIN) {
            if (subscription.getClinic() == null || subscription.getClinic().getOwner() == null
                    || !subscription.getClinic().getOwner().getUserId().equals(currentUser.getUserId())) {
                throw new ForbiddenException("Bạn không có quyền kiểm tra thanh toán của đăng ký này");
            }
        }

        Payment payment = paymentRepository.findFirstBySubscriptionSubscriptionIdOrderByCreatedAtDesc(subscriptionId)
                .orElseThrow(
                        () -> new ResourceNotFoundException("Không tìm thấy thông tin thanh toán cho đăng ký này"));

        if (payment.getMethod() != PaymentMethod.QR) {
            throw new BadRequestException("Đăng ký này không sử dụng phương thức thanh toán QR");
        }

        if (payment.getStatus() == PaymentStatus.PAID) {
            return QrStatusResult.paid("Thanh toán đã được xác nhận trước đó", null);
        }

        String paymentDescription = payment.getPaymentDescription();
        if (paymentDescription == null || paymentDescription.isBlank()) {
            throw new BadRequestException("Không tìm thấy nội dung thanh toán");
        }

        LocalDateTime paymentCreatedAt = payment.getCreatedAt();
        String transactionDateMin = null;
        if (paymentCreatedAt != null) {
            transactionDateMin = paymentCreatedAt.format(SEPAY_TIME_FORMATTER);
        }

        List<SePayTransactionDto> transactions = loadTransactionsWithFallback(transactionDateMin);
        if (transactions == null || transactions.isEmpty()) {
            return QrStatusResult.pending("Chưa tìm thấy giao dịch phù hợp", null);
        }

        BigDecimal expectedAmount = payment.getAmount();
        SePayTransactionDto matched = null;
        String normalizedPaymentDescription = normalizeForMatching(paymentDescription);

        for (SePayTransactionDto tx : transactions) {
            if (tx == null)
                continue;

            String content = tx.getTransactionContent();
            String normalizedContent = normalizeForMatching(content);
            if (normalizedContent == null || normalizedPaymentDescription == null
                    || !normalizedContent.contains(normalizedPaymentDescription)) {
                continue;
            }

            if (expectedAmount != null) {
                BigDecimal amountIn;
                try {
                    amountIn = parseAmount(tx.getAmountIn());
                } catch (Exception e) {
                    continue;
                }

                if (!isAmountMatched(expectedAmount, amountIn)) {
                    continue;
                }
            }

            matched = tx;
            break;
        }

        if (matched == null) {
            return QrStatusResult.pending("Chưa tìm thấy giao dịch phù hợp", null);
        }

        // Mark payment as paid
        payment.markAsPaid();
        paymentRepository.save(payment);

        // Activate the subscription
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime newStartDate = now;

        // Check for existing active subscription to extend
        Optional<UserSubscription> existingActive = userSubscriptionRepository
                .findActiveSubscriptionByClinicId(subscription.getClinic().getClinicId());
        if (existingActive.isPresent() && existingActive.get().getEndDate() != null
                && existingActive.get().getEndDate().isAfter(now)
                && existingActive.get().getPlan().getPlanId().equals(subscription.getPlan().getPlanId())) {
            newStartDate = existingActive.get().getEndDate();
            // Optional: Mark the old one as EXPIRED/OVERWRITTEN if you prefer a single
            // active record,
            // but usually it's better to keep one record and update it, OR have consecutive
            // ones.
            // For now, we allow consecutive ACTIVE ones where the later one starts when
            // earlier one ends.
        }

        subscription.setStatus(UserSubscriptionStatus.ACTIVE);
        subscription.setStartDate(newStartDate);
        subscription.setEndDate(newStartDate.plusDays(subscription.getPlan().getDurationDays()));
        userSubscriptionRepository.save(subscription);

        log.info("QR subscription payment matched for sub {} - tx {}", subscriptionId, matched.getId());

        return QrStatusResult.paid("Đã xác nhận thanh toán gói hội viên thành công", matched.getId());
    }

    private String normalizeForMatching(String raw) {

        if (raw == null) {
            return null;
        }
        String normalized = raw.toLowerCase(Locale.ROOT).trim();
        normalized = WHITESPACE_PATTERN.matcher(normalized).replaceAll("");
        normalized = NON_ALNUM_PATTERN.matcher(normalized).replaceAll("");
        return normalized;
    }

    private BigDecimal parseAmount(String rawAmount) {
        if (rawAmount == null || rawAmount.isBlank()) {
            throw new IllegalArgumentException("amountIn is blank");
        }
        String cleaned = rawAmount.replace(",", "").trim();
        return new BigDecimal(cleaned);
    }

    private List<SePayTransactionDto> loadTransactionsWithFallback(String transactionDateMin) {
        String accountNumber = (sepayAccountNumber != null && !sepayAccountNumber.isBlank()) ? sepayAccountNumber
                : null;

        SePayTransactionsListResponseDto sepayResponse = sePayClient.listTransactions(
                200,
                accountNumber,
                transactionDateMin,
                null,
                null);

        List<SePayTransactionDto> transactions = sepayResponse.getTransactions();

        if (transactions == null || transactions.isEmpty()) {
            if (accountNumber != null) {
                log.warn("No SePay transactions found with account_number='{}'. Retrying without account filter.",
                        accountNumber);
                SePayTransactionsListResponseDto fallbackResponse = sePayClient.listTransactions(
                        200,
                        null,
                        transactionDateMin,
                        null,
                        null);
                return fallbackResponse.getTransactions();
            }
        }

        return transactions;
    }

    private boolean isAmountMatched(BigDecimal expectedAmount, BigDecimal amountIn) {
        if (expectedAmount == null || amountIn == null) {
            return false;
        }

        if (amountIn.compareTo(expectedAmount) == 0) {
            return true;
        }

        // Bank transfer is VND-based, so allow matching on rounded integer VND.
        BigDecimal expectedRounded = expectedAmount.setScale(0, RoundingMode.HALF_UP);
        BigDecimal amountRounded = amountIn.setScale(0, RoundingMode.HALF_UP);
        return expectedRounded.compareTo(amountRounded) == 0;
    }

    public record QrStatusResult(String status, String message, String matchedTransactionId) {

        public static QrStatusResult pending(String message, String matchedTransactionId) {
            return new QrStatusResult("PENDING", message, matchedTransactionId);
        }

        public static QrStatusResult paid(String message, String matchedTransactionId) {
            return new QrStatusResult("PAID", message, matchedTransactionId);
        }
    }
}
