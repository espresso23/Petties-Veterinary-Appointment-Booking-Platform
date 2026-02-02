package com.petties.petties.service;

import com.petties.petties.exception.BadRequestException;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Payment;
import com.petties.petties.model.enums.PaymentStatus;
import com.petties.petties.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentHistoryService {

    private final PaymentRepository paymentRepository;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getPaymentHistoryByPetOwnerId(UUID petOwnerId, Integer limit, String status) {
        if (petOwnerId == null) {
            throw new BadRequestException("Thiếu petOwnerId");
        }

        int safeLimit = (limit == null) ? 50 : limit;
        if (safeLimit <= 0) {
            throw new BadRequestException("Giới hạn không hợp lệ");
        }
        if (safeLimit > 200) {
            safeLimit = 200;
        }

        PaymentStatus parsedStatus = null;
        if (status != null && !status.isBlank()) {
            try {
                parsedStatus = PaymentStatus.valueOf(status.trim().toUpperCase());
            } catch (Exception e) {
                throw new BadRequestException("Trạng thái thanh toán không hợp lệ");
            }
        }

        List<Payment> payments;
        if (parsedStatus == null) {
            payments = paymentRepository.findByBookingPetOwnerUserIdOrderByCreatedAtDesc(
                    petOwnerId,
                    PageRequest.of(0, safeLimit));
        } else {
            payments = paymentRepository.findByBookingPetOwnerUserIdAndStatusOrderByCreatedAtDesc(
                    petOwnerId,
                    parsedStatus,
                    PageRequest.of(0, safeLimit));
        }

        return payments.stream().map(payment -> {
            Map<String, Object> item = new HashMap<>();
            item.put("paymentId", payment.getPaymentId());
            item.put("amount", payment.getAmount());
            item.put("method", payment.getMethod());
            item.put("status", payment.getStatus());
            item.put("paymentDescription", payment.getPaymentDescription());
            item.put("createdAt", payment.getCreatedAt());
            item.put("paidAt", payment.getPaidAt());

            Booking booking = payment.getBooking();
            if (booking != null) {
                item.put("bookingId", booking.getBookingId());
                item.put("bookingCode", booking.getBookingCode());

                if (booking.getPetOwner() != null) {
                    item.put("petOwnerId", booking.getPetOwner().getUserId());
                }
            }

            return item;
        }).toList();
    }

    /**
     * Get payment history by clinic ID
     * Used by ClinicOwner/Manager to view their clinic's payments
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getPaymentHistoryByClinicId(UUID clinicId, Integer limit, String status) {
        if (clinicId == null) {
            throw new BadRequestException("Thiếu clinicId");
        }

        int safeLimit = (limit == null) ? 50 : limit;
        if (safeLimit <= 0) {
            throw new BadRequestException("Giới hạn không hợp lệ");
        }
        if (safeLimit > 200) {
            safeLimit = 200;
        }

        PaymentStatus parsedStatus = null;
        if (status != null && !status.isBlank()) {
            try {
                parsedStatus = PaymentStatus.valueOf(status.trim().toUpperCase());
            } catch (Exception e) {
                throw new BadRequestException("Trạng thái thanh toán không hợp lệ");
            }
        }

        List<Payment> payments;
        if (parsedStatus == null) {
            payments = paymentRepository.findByBookingClinicClinicIdOrderByCreatedAtDesc(
                    clinicId,
                    PageRequest.of(0, safeLimit));
        } else {
            payments = paymentRepository.findByBookingClinicClinicIdAndStatusOrderByCreatedAtDesc(
                    clinicId,
                    parsedStatus,
                    PageRequest.of(0, safeLimit));
        }

        return payments.stream().map(payment -> {
            Map<String, Object> item = new HashMap<>();
            item.put("paymentId", payment.getPaymentId());
            item.put("amount", payment.getAmount());
            item.put("method", payment.getMethod());
            item.put("status", payment.getStatus());
            item.put("paymentDescription", payment.getPaymentDescription());
            item.put("createdAt", payment.getCreatedAt());
            item.put("paidAt", payment.getPaidAt());

            Booking booking = payment.getBooking();
            if (booking != null) {
                item.put("bookingId", booking.getBookingId());
                item.put("bookingCode", booking.getBookingCode());

                if (booking.getPetOwner() != null) {
                    item.put("petOwnerId", booking.getPetOwner().getUserId());
                    item.put("petOwnerName", booking.getPetOwner().getFullName());
                }

                if (booking.getClinic() != null) {
                    item.put("clinicId", booking.getClinic().getClinicId());
                    item.put("clinicName", booking.getClinic().getName());
                }
            }

            return item;
        }).toList();
    }
}
