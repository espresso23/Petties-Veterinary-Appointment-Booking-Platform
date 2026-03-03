package com.petties.petties.service;

import com.petties.petties.exception.BadRequestException;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Payment;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.PaymentStatus;
import com.petties.petties.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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
     * Get payment history by clinic ID with optional payment status and booking status filters.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getPaymentHistoryByClinicId(UUID clinicId, Integer limit, String status,
            List<String> bookingStatus) {
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

        List<BookingStatus> parsedBookingStatuses = null;
        if (bookingStatus != null && !bookingStatus.isEmpty()) {
            try {
                List<BookingStatus> list = bookingStatus.stream()
                        .filter(s -> s != null && !s.isBlank())
                        .map(s -> BookingStatus.valueOf(s.trim().toUpperCase()))
                        .collect(Collectors.toList());
                parsedBookingStatuses = list.isEmpty() ? null : list;
            } catch (Exception e) {
                throw new BadRequestException("Trạng thái booking không hợp lệ");
            }
        }

        List<Payment> payments = paymentRepository.findByClinicAndOptionalFilters(
                clinicId, parsedStatus, parsedBookingStatuses, PageRequest.of(0, safeLimit));

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
                item.put("bookingStatus", booking.getStatus() != null ? booking.getStatus().name() : null);

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

    /**
     * Revenue summary by period: DAY, WEEK, MONTH, YEAR.
     * Returns list of { label, total } for table/chart.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRevenueSummaryByClinicId(UUID clinicId, String period) {
        if (clinicId == null) {
            throw new BadRequestException("Thiếu clinicId");
        }
        String p = (period == null || period.isBlank()) ? "MONTH" : period.trim().toUpperCase();
        List<Object[]> rows;
        DateTimeFormatter formatter;
        switch (p) {
            case "DAY" -> {
                rows = paymentRepository.getRevenueByDay(clinicId);
                formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy");
            }
            case "WEEK" -> {
                rows = paymentRepository.getRevenueByWeek(clinicId);
                formatter = DateTimeFormatter.ofPattern("'Tuần' w/yyyy");
            }
            case "MONTH" -> {
                rows = paymentRepository.getRevenueByMonth(clinicId);
                formatter = DateTimeFormatter.ofPattern("MM/yyyy");
            }
            case "YEAR" -> {
                rows = paymentRepository.getRevenueByYear(clinicId);
                formatter = DateTimeFormatter.ofPattern("yyyy");
            }
            default -> {
                rows = paymentRepository.getRevenueByMonth(clinicId);
                formatter = DateTimeFormatter.ofPattern("MM/yyyy");
            }
        }

        List<Map<String, Object>> items = new ArrayList<>();
        ZoneId zone = ZoneId.systemDefault();
        for (Object[] row : rows) {
            Object ts = row[0];
            Object sum = row[1];
            LocalDate date = ts instanceof java.sql.Timestamp
                    ? ((java.sql.Timestamp) ts).toInstant().atZone(zone).toLocalDate()
                    : Instant.ofEpochMilli(((java.util.Date) ts).getTime()).atZone(zone).toLocalDate();
            String label = date.format(formatter);
            BigDecimal total = sum != null ? (BigDecimal) sum : BigDecimal.ZERO;
            Map<String, Object> entry = new HashMap<>();
            entry.put("label", label);
            entry.put("total", total);
            entry.put("periodStart", date.toString());
            items.add(entry);
        }
        return items;
    }
}
