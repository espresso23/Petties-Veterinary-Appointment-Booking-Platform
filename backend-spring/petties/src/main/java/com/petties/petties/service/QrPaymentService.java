package com.petties.petties.service;

import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.integration.sepay.SePayClient;
import com.petties.petties.integration.sepay.dto.SePayTransactionDto;
import com.petties.petties.integration.sepay.dto.SePayTransactionsListResponseDto;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Payment;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.model.enums.PaymentStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.PaymentRepository;
import com.petties.petties.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class QrPaymentService {

    private static final DateTimeFormatter SEPAY_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss", Locale.ROOT);
    private static final Pattern WHITESPACE_PATTERN = Pattern.compile("\\s+");
    private static final Pattern NON_ALNUM_PATTERN = Pattern.compile("[^a-zA-Z0-9]");

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
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

        String accountNumber = (sepayAccountNumber != null && !sepayAccountNumber.isBlank()) ? sepayAccountNumber : null;
        SePayTransactionsListResponseDto sepayResponse = sePayClient.listTransactions(
                200,
                accountNumber,
                transactionDateMin,
                null,
                null
        );

        List<SePayTransactionDto> transactions = sepayResponse.getTransactions();
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

                if (amountIn.compareTo(expectedAmount) != 0) {
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

    public record QrStatusResult(String status, String message, String matchedTransactionId) {

        public static QrStatusResult pending(String message, String matchedTransactionId) {
            return new QrStatusResult("PENDING", message, matchedTransactionId);
        }

        public static QrStatusResult paid(String message, String matchedTransactionId) {
            return new QrStatusResult("PAID", message, matchedTransactionId);
        }
    }
}
