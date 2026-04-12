package com.petties.petties.service;

import com.petties.petties.model.Booking;
import com.petties.petties.model.Payment;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Random;
import java.util.UUID;

/**
 * Transaction Service - Xử lý logic giao dịch và tạo payment description
 * 
 * Main flow:
 * 1. Load booking by bookingId
 * 2. Check payment method = QR?
 * 3. If QR: Generate payment description with format
 * 4. Return description for SePay integration
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TransactionService {

    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final Random random = new Random();

    private static final String PAYMENT_DESCRIPTION_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int PAYMENT_DESCRIPTION_LENGTH = 10;

    /**
     * Tạo payment description cho SePay dựa trên booking
     * 
     * @param bookingId ID của booking cần xử lý
     * @return Payment description format: {clinicID}-{petownerID}-{5digit}
     *         hoặc null nếu payment method không phải QR
     */
    public String generatePaymentDescription(UUID bookingId) {
        log.info("Generating payment description for bookingId: {}", bookingId);
        
        // 1. Load booking
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> {
                    log.error("Booking not found with ID: {}", bookingId);
                    return new IllegalArgumentException("Không tìm thấy booking với ID: " + bookingId);
                });
        
        // 2. Get payment method from payment relationship
        Payment payment = booking.getPayment();
        if (payment == null) {
            log.warn("Booking {} has no payment associated", bookingId);
            return null;
        }

        if (payment.getPaymentDescription() != null && !payment.getPaymentDescription().isBlank()) {
            return payment.getPaymentDescription();
        }
        
        // 3. Check if payment method is QR
        if (payment.getMethod() != PaymentMethod.QR) {
            log.info("Payment method is not QR for booking {}: {}", 
                    bookingId, payment.getMethod());
            return null;
        }
        
        // 4. Generate payment description
        String paymentDescription = buildPaymentDescription(booking);
        payment.setPaymentDescription(paymentDescription);
        paymentRepository.save(payment);
        
        log.info("Generated payment description for booking {}: {}", 
                bookingId, paymentDescription);
        
        return paymentDescription;
    }
    
    /**
     * Build payment description với format: booking code
     * SePay sẽ check nội dung giao dịch có chứa booking code hay không
     */
    private String buildPaymentDescription(Booking booking) {
        if (booking == null || booking.getBookingCode() == null) {
            throw new IllegalArgumentException("Dữ liệu booking không hợp lệ");
        }

        String bookingCode = booking.getBookingCode();

        // Check if any other payment already has this description
        if (paymentRepository.existsByPaymentDescription(bookingCode)) {
            log.warn("Payment description already exists for booking code: {}", bookingCode);
            // This shouldn't happen since booking code is unique, but handle gracefully
        }

        return bookingCode;
    }
    
    /**
     * Lấy total price của booking để hiển thị cho user
     * 
     * @param bookingId ID của booking
     * @return Total price hoặc null nếu không tìm thấy
     */
    public java.math.BigDecimal getBookingTotalPrice(UUID bookingId) {
        return bookingRepository.findById(bookingId)
                .map(Booking::getTotalPrice)
                .orElse(null);
    }
    
    /**
     * Check if booking uses QR payment method
     * 
     * @param bookingId ID của booking
     * @return true nếu payment method là QR
     */
    public boolean isQrPayment(UUID bookingId) {
        return bookingRepository.findById(bookingId)
                .map(booking -> {
                    Payment payment = booking.getPayment();
                    return payment != null && payment.getMethod() == PaymentMethod.QR;
                })
                .orElse(false);
    }

    /**
     * Lấy tất cả bookings trong hệ thống
     * 
     * @return List of all bookings
     */
    @Transactional(readOnly = true)
    public List<Booking> getAllBookings() {
        log.info("Getting all bookings from database");
        List<Booking> bookings = bookingRepository.findAllWithToOneRelations();
        log.info("Found {} bookings", bookings.size());
        return bookings;
    }
}
