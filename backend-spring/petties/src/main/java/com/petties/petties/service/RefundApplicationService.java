package com.petties.petties.service;

import com.petties.petties.dto.refund.RefundApplicationRequest;
import com.petties.petties.dto.refund.RefundApplicationResponse;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.RefundApplication;
import com.petties.petties.model.User;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.RefundApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RefundApplicationService {

    private static final int WEB_DEDUCTION_PERCENT = 5;
    private static final DateTimeFormatter PERIOD_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");

    private final RefundApplicationRepository refundApplicationRepository;
    private final ClinicRepository clinicRepository;
    private final AuthService authService;

    /**
     * Tạo đơn hoàn tiền (Clinic Manager/Owner). Tự tính 5% khấu trừ và số tiền nhận.
     */
    @Transactional
    public RefundApplicationResponse create(RefundApplicationRequest request) {
        User currentUser = authService.getCurrentUser();
        Clinic clinic = currentUser.getWorkingClinic();
        if (clinic == null) {
            throw new ForbiddenException("Bạn chưa được gán phòng khám. Chỉ Clinic Owner/Manager mới được nộp đơn hoàn tiền.");
        }
        if (!currentUser.getRole().name().equals("CLINIC_OWNER") && !currentUser.getRole().name().equals("CLINIC_MANAGER")) {
            throw new ForbiddenException("Chỉ Clinic Owner hoặc Clinic Manager mới được nộp đơn hoàn tiền.");
        }

        String period = request.getPeriodYearMonth();
        if (period == null || period.isBlank()) {
            period = YearMonth.now().format(PERIOD_FORMAT);
        }
        if (!period.matches("\\d{4}-\\d{2}")) {
            throw new BadRequestException("Định dạng kỳ không hợp lệ. Dùng yyyy-MM (ví dụ 2026-03).");
        }

        if (refundApplicationRepository.existsByClinicClinicIdAndPeriodYearMonth(clinic.getClinicId(), period)) {
            throw new BadRequestException("Đã tồn tại đơn hoàn tiền cho kỳ " + period + ". Vui lòng kiểm tra danh sách đơn.");
        }

        BigDecimal revenue = request.getMonthRevenue().setScale(2, RoundingMode.HALF_UP);
        BigDecimal deductionAmount = revenue.multiply(BigDecimal.valueOf(WEB_DEDUCTION_PERCENT))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal amountAfter = revenue.subtract(deductionAmount);

        RefundApplication entity = RefundApplication.builder()
                .clinic(clinic)
                .periodYearMonth(period)
                .monthRevenue(revenue)
                .webDeductionPercent(WEB_DEDUCTION_PERCENT)
                .webDeductionAmount(deductionAmount)
                .amountAfterDeduction(amountAfter)
                .status(com.petties.petties.model.enums.RefundApplicationStatus.PENDING)
                .build();

        entity = refundApplicationRepository.save(entity);
        log.info("Refund application created: id={}, clinicId={}, period={}", entity.getRefundApplicationId(), clinic.getClinicId(), period);
        return toResponse(entity);
    }

    /**
     * Danh sách đơn hoàn tiền của phòng khám hiện tại (Clinic Manager/Owner).
     */
    public List<RefundApplicationResponse> getMyClinicApplications() {
        User currentUser = authService.getCurrentUser();
        Clinic clinic = currentUser.getWorkingClinic();
        if (clinic == null) {
            throw new ForbiddenException("Bạn chưa được gán phòng khám.");
        }
        return refundApplicationRepository.findByClinicClinicIdOrderByCreatedAtDesc(clinic.getClinicId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Danh sách đơn PENDING cho Admin duyệt.
     */
    public List<RefundApplicationResponse> getPendingForAdmin() {
        return refundApplicationRepository.findByStatusOrderByCreatedAtDesc(com.petties.petties.model.enums.RefundApplicationStatus.PENDING)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private RefundApplicationResponse toResponse(RefundApplication e) {
        return RefundApplicationResponse.builder()
                .refundApplicationId(e.getRefundApplicationId())
                .clinicId(e.getClinic().getClinicId())
                .clinicName(e.getClinic().getName())
                .periodYearMonth(e.getPeriodYearMonth())
                .monthRevenue(e.getMonthRevenue())
                .webDeductionPercent(e.getWebDeductionPercent())
                .webDeductionAmount(e.getWebDeductionAmount())
                .amountAfterDeduction(e.getAmountAfterDeduction())
                .status(e.getStatus().name())
                .rejectionReason(e.getRejectionReason())
                .reviewedAt(e.getReviewedAt())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
