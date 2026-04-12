package com.petties.petties.service;

import com.petties.petties.exception.BadRequestException;
import com.petties.petties.model.Booking;
import com.petties.petties.model.ClinicBalance;
import com.petties.petties.model.Payment;
import com.petties.petties.model.enums.WithdrawalStatus;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.PaymentStatus;
import com.petties.petties.repository.PaymentRepository;
import com.petties.petties.repository.ClinicBalanceRepository;
import com.petties.petties.repository.WithdrawalRepository;
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
    private final ClinicBalanceRepository clinicBalanceRepository;
    private final WithdrawalRepository withdrawalRepository;

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
     * Get payment history by clinic ID with optional payment status and booking
     * status filters.
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

    /**
     * Get revenue breakdown for revenue page (QR vs Cash vs Withdrawable).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getRevenueBreakdown(UUID clinicId) {
        BigDecimal qrRevenue = paymentRepository.sumAmountByClinicIdAndMethodAndStatus(
                clinicId, com.petties.petties.model.enums.PaymentMethod.QR, PaymentStatus.PAID);
        BigDecimal cashRevenue = paymentRepository.sumAmountByClinicIdAndMethodAndStatus(
                clinicId, com.petties.petties.model.enums.PaymentMethod.CASH, PaymentStatus.PAID);

        BigDecimal totalQr = qrRevenue != null ? qrRevenue : BigDecimal.ZERO;
        BigDecimal totalCash = cashRevenue != null ? cashRevenue : BigDecimal.ZERO;

        // Current platform rules:
        // System keeps 5% of everything.
        // For CASH: Clinic owes 5% to platform.
        // For QR: Platform already has 100%, clinic is owed 95%.
        // Total Clinic Balance = (QR * 0.95) - (CASH * 0.05)
        BigDecimal platformFeeFromQR = totalQr.multiply(new BigDecimal("0.05"));
        BigDecimal platformFeeFromCash = totalCash.multiply(new BigDecimal("0.05"));

        BigDecimal withdrawableBalance = totalQr.subtract(platformFeeFromQR).subtract(platformFeeFromCash);
        BigDecimal totalWithdrawn = BigDecimal.ZERO;

        ClinicBalance clinicBalance = clinicBalanceRepository.findByClinicClinicId(clinicId);
        if (clinicBalance != null && clinicBalance.getTotalWithdrawn() != null) {
            totalWithdrawn = clinicBalance.getTotalWithdrawn();
        } else {
            BigDecimal withdrawn = withdrawalRepository.getTotalWithdrawnByClinic(clinicId);
            if (withdrawn != null) {
                totalWithdrawn = withdrawn;
            }
        }

        if (clinicBalance != null && clinicBalance.getCurrentBalance() != null) {
            withdrawableBalance = clinicBalance.getCurrentBalance();
        } else {
            BigDecimal totalActiveWithdrawals = withdrawalRepository.getTotalTransferredByClinicAndStatuses(
                    clinicId,
                    List.of(WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING, WithdrawalStatus.COMPLETED));
            if (totalActiveWithdrawals != null) {
                withdrawableBalance = withdrawableBalance.subtract(totalActiveWithdrawals);
            }
            if (withdrawableBalance.compareTo(BigDecimal.ZERO) < 0) {
                withdrawableBalance = BigDecimal.ZERO;
            }
        }

        Map<String, Object> breakdown = new HashMap<>();
        breakdown.put("success", true);
        breakdown.put("clinicId", clinicId);
        breakdown.put("totalRevenue", totalQr.add(totalCash));
        breakdown.put("qrRevenue", totalQr);
        breakdown.put("cashRevenue", totalCash);
        breakdown.put("withdrawableBalance", withdrawableBalance.setScale(2, java.math.RoundingMode.HALF_UP));
        breakdown.put("totalWithdrawn", totalWithdrawn.setScale(2, java.math.RoundingMode.HALF_UP));

        return breakdown;
    }

    /**
     * Get detailed balance fluctuation list (per-booking paid payments).
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getBalanceFluctuation(UUID clinicId, String method, int limit) {
        com.petties.petties.model.enums.PaymentMethod paymentMethod;
        try {
            paymentMethod = com.petties.petties.model.enums.PaymentMethod.valueOf(method.toUpperCase());
        } catch (Exception e) {
            throw new BadRequestException("Phương thức thanh toán không hợp lệ");
        }

        List<Payment> payments = paymentRepository.findPaidByClinicAndMethod(
                clinicId, paymentMethod, PageRequest.of(0, limit));

        List<Map<String, Object>> items = new ArrayList<>();
        BigDecimal feeRate = new BigDecimal("0.05");

        for (Payment payment : payments) {
            Map<String, Object> item = new HashMap<>();
            item.put("paymentId", payment.getPaymentId());
            item.put("amount", payment.getAmount());

            BigDecimal platformFee = payment.getAmount().multiply(feeRate);
            item.put("platformFee", platformFee);
            item.put("netAmount", payment.getAmount().subtract(platformFee));
            item.put("paidAt", payment.getPaidAt());

            Booking booking = payment.getBooking();
            if (booking != null) {
                item.put("bookingCode", booking.getBookingCode());
                if (booking.getPetOwner() != null) {
                    item.put("petOwnerName", booking.getPetOwner().getFullName());
                }
            }
            items.add(item);
        }
        return items;
    }
}
