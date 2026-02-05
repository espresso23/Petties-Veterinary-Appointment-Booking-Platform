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

@Service
@RequiredArgsConstructor
@Slf4j
public class QrPaymentService {

    private static final DateTimeFormatter SEPAY_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss", Locale.ROOT);

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final AuthService authService;
    private final TransactionService transactionService;
    private final SePayClient sePayClient;

    @Value("${sepay.account-number:}")
    private String sepayAccountNumber;

    @Transactional
    public QrStatusResult checkQrStatus(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy booking"));

        var currentUser = authService.getCurrentUser();
        if (booking.getPetOwner() == null || booking.getPetOwner().getUserId() == null
                || !booking.getPetOwner().getUserId().equals(currentUser.getUserId())) {
            throw new ForbiddenException("Bạn không có quyền kiểm tra thanh toán của booking này");
        }

        Payment payment = paymentRepository.findByBookingBookingId(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thanh toán cho booking"));

        if (payment.getMethod() != PaymentMethod.QR) {
            throw new BadRequestException("Booking không sử dụng phương thức thanh toán QR");
        }

        if (payment.getStatus() == PaymentStatus.PAID) {
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

        for (SePayTransactionDto tx : transactions) {
            if (tx == null) {
                continue;
            }

            String content = tx.getTransactionContent();
            if (content == null || !content.contains(paymentDescription)) {
                continue;
            }

            if (expectedAmount != null) {
                BigDecimal amountIn;
                try {
                    amountIn = new BigDecimal(tx.getAmountIn());
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
                    if (txTime.isBefore(paymentCreatedAt)) {
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

        log.info("QR payment matched for booking {} - tx {}", booking.getBookingCode(), matched.getId());

        return QrStatusResult.paid("Thanh toán thành công", matched.getId());
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
