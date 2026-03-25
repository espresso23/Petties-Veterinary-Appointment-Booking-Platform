package com.petties.petties.service;

import com.petties.petties.dto.refund.RefundApplicationRequest;
import com.petties.petties.dto.refund.RefundApplicationResponse;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.RefundApplication;
import com.petties.petties.model.User;
import com.petties.petties.model.Withdrawal;
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
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.repository.ClinicBalanceRepository;
import com.petties.petties.model.ClinicBalance;

@Service
@RequiredArgsConstructor
@Slf4j
public class RefundApplicationService {

    private static final int WEB_DEDUCTION_PERCENT = 5;
    private static final DateTimeFormatter PERIOD_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");

    /**
     * Kiểm tra xem requestedAmount + tổng đơn PENDING
     * không vượt quá clinic balance hiện có.
     *
     * Lưu ý: Đơn APPROVED đã tạo withdrawal và đã trừ vào currentBalance,
     * nên không cộng dồn lại để tránh trừ kép.
     */
    private void validateRequestedAmountAgainstBalance(UUID clinicId, BigDecimal requestedAmount) {
        // Get clinic's current balance
        ClinicBalance clinicBalance = clinicBalanceRepository.findByClinicClinicId(clinicId);
        if (clinicBalance == null) {
            throw new BadRequestException("Không tìm thấy thông tin balance của phòng khám.");
        }

        // Chỉ cộng đơn PENDING (APPROVED đã phản ánh trong currentBalance)
        List<RefundApplication> pendingRefunds = refundApplicationRepository
            .findByClinicClinicIdOrderByCreatedAtDesc(clinicId)
            .stream()
            .filter(r -> r.getStatus() == com.petties.petties.model.enums.RefundApplicationStatus.PENDING)
            .toList();

        BigDecimal totalPendingRefunds = pendingRefunds.stream()
            .map(RefundApplication::getRequestedAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Check: requestedAmount + totalPendingRefunds <= currentBalance
        BigDecimal totalRequested = totalPendingRefunds.add(requestedAmount);
        
        if (totalRequested.compareTo(clinicBalance.getCurrentBalance()) > 0) {
            String error = String.format(
                "Số tiền yêu cầu rút (%.0fđ) + các đơn đang chờ (%.0fđ) = %.0fđ vượt quá balance hiện có (%.0fđ). " +
                "Vui lòng giảm số tiền hoặc chờ các đơn trước được xử lý.",
                requestedAmount, totalPendingRefunds, totalRequested, clinicBalance.getCurrentBalance()
            );
            throw new BadRequestException(error);
        }

        log.info("Balance validation passed for clinic: {}, currentBalance={}, totalPendingRefunds={}, " +
                 "requestedAmount={}, totalRequested={}", 
                 clinicId, clinicBalance.getCurrentBalance(), totalPendingRefunds, 
                 requestedAmount, totalRequested);
    }

    private final RefundApplicationRepository refundApplicationRepository;
    private final ClinicRepository clinicRepository;
    private final AuthService authService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final WithdrawalService withdrawalService;
    private final ClinicBalanceRepository clinicBalanceRepository;

    /**
     * Tạo đơn hoàn tiền (Clinic Manager/Owner). Tự tính 5% khấu trừ và số tiền
     * nhận.
     */
    @Transactional
    public RefundApplicationResponse create(RefundApplicationRequest request) {
        User currentUser = authService.getCurrentUser();
        Clinic clinic;

        if (currentUser.getRole().name().equals("CLINIC_OWNER")) {
            if (request.getClinicId() == null) {
                throw new BadRequestException("Vui lòng chọn phòng khám để nộp đơn (clinicId bị trống).");
            }
            clinic = clinicRepository.findById(request.getClinicId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám."));
            if (!clinic.getOwner().getUserId().equals(currentUser.getUserId())) {
                throw new ForbiddenException("Bạn không phải chủ sở hữu của phòng khám này.");
            }
        } else if (currentUser.getRole().name().equals("CLINIC_MANAGER")) {
            clinic = currentUser.getWorkingClinic();
            if (clinic == null) {
                throw new ForbiddenException("Bạn chưa được gán phòng khám.");
            }
        } else {
            throw new ForbiddenException("Chỉ Clinic Owner hoặc Clinic Manager mới được nộp đơn hoàn tiền.");
        }

        String period = request.getPeriodYearMonth();
        if (period == null || period.isBlank()) {
            period = YearMonth.now().format(PERIOD_FORMAT);
        }
        if (!period.matches("\\d{4}-\\d{2}")) {
            throw new BadRequestException("Định dạng kỳ không hợp lệ. Dùng yyyy-MM (ví dụ 2026-03).");
        }

        BigDecimal qrRevenue = request.getQrRevenue() != null ? request.getQrRevenue() : BigDecimal.ZERO;
        BigDecimal cashRevenue = request.getCashRevenue() != null ? request.getCashRevenue() : BigDecimal.ZERO;
        BigDecimal totalRevenue = qrRevenue.add(cashRevenue);
        
        // Nếu không có monthRevenue, dùng tổng QR + Cash
        BigDecimal revenue = request.getMonthRevenue() != null ? request.getMonthRevenue() : totalRevenue;
        
        BigDecimal requestedAmount = request.getRequestedAmount() != null ? request.getRequestedAmount()
            : revenue;

        BigDecimal deductionAmount = revenue.multiply(BigDecimal.valueOf(WEB_DEDUCTION_PERCENT))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal amountAfter = revenue.subtract(deductionAmount);

        if (requestedAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Số tiền yêu cầu rút phải lớn hơn 0.");
        }
        if (requestedAmount.compareTo(amountAfter) > 0) {
            throw new BadRequestException("Số tiền yêu cầu rút không được vượt quá số tiền có thể rút sau khấu trừ.");
        }

        // Validate: requestedAmount + pending refunds <= clinic balance
        validateRequestedAmountAgainstBalance(clinic.getClinicId(), requestedAmount);

        RefundApplication entity = RefundApplication.builder()
                .clinic(clinic)
                .periodYearMonth(period)
                .monthRevenue(revenue)
                .qrRevenue(qrRevenue)
                .cashRevenue(cashRevenue)
                .requestedAmount(requestedAmount)
                .webDeductionPercent(WEB_DEDUCTION_PERCENT)
                .webDeductionAmount(deductionAmount)
                .amountAfterDeduction(amountAfter)
                .status(com.petties.petties.model.enums.RefundApplicationStatus.PENDING)
                .build();

        entity = refundApplicationRepository.save(entity);
        log.info("Refund application created: id={}, clinicId={}, period={}", entity.getRefundApplicationId(),
                clinic.getClinicId(), period);

        // Notify Admins
        notificationService.notifyAdminsRefundRequested(entity);

        return toResponse(entity);
    }

    private String formatVnd(BigDecimal amount) {
        if (amount == null)
            return "0";
        return java.text.NumberFormat.getInstance(new java.util.Locale("vi", "VN")).format(amount);
    }

    /**
     * Danh sách đơn hoàn tiền của phòng khám hiện tại (Clinic Manager).
     * Tuy nhiên, nếu là Owner, frontend sẽ gọi API khác hoặc truyền clinicId.
     */
    @Transactional(readOnly = true)
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
    @Transactional(readOnly = true)
    public List<RefundApplicationResponse> getPendingForAdmin() {
        return refundApplicationRepository
                .findByStatusOrderByCreatedAtDesc(com.petties.petties.model.enums.RefundApplicationStatus.PENDING)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Lấy toàn bộ danh sách đơn cho Admin (kèm filter đơn giản).
     */
    @Transactional(readOnly = true)
    public List<RefundApplicationResponse> getAllForAdmin(String status, UUID clinicId, String period, String from,
            String to) {
        // Tạm thời lấy hết vì native query cũ bị lỗi. Sẽ refactor sang Specification
        // sau nếu cần query phức tạp.
        return refundApplicationRepository.findAll()
                .stream()
                .filter(e -> status == null || status.isBlank() || status.equalsIgnoreCase("undefined")
                        || e.getStatus().name().equalsIgnoreCase(status))
                .filter(e -> clinicId == null || e.getClinic().getClinicId().equals(clinicId))
                .filter(e -> period == null || period.isBlank() || period.equalsIgnoreCase("undefined")
                        || e.getPeriodYearMonth().equals(period))
                // Bỏ qua lọc date range tạm thời để tránh lỗi parse date phức tạp
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Cập nhật trạng thái đơn (Admin).
     */
    @Transactional
    public RefundApplicationResponse updateStatus(UUID id,
            com.petties.petties.dto.refund.RefundApplicationStatusUpdateRequest request) {
        RefundApplication entity = refundApplicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn nộp này."));

        if (entity.getStatus() != com.petties.petties.model.enums.RefundApplicationStatus.PENDING) {
            throw new BadRequestException("Chỉ có thể duyệt đơn đang ở trạng thái PENDING.");
        }

        if (request.getStatus() == com.petties.petties.model.enums.RefundApplicationStatus.PENDING) {
            throw new BadRequestException("Trạng thái duyệt không hợp lệ.");
        }

        entity.setStatus(request.getStatus());
        entity.setRejectionReason(request.getNote());
        entity.setReviewedAt(java.time.LocalDateTime.now());

        entity = refundApplicationRepository.save(entity);

        // Notify Clinic Owner/Manager
        if (entity.getStatus() == com.petties.petties.model.enums.RefundApplicationStatus.APPROVED) {
            notificationService.notifyClinicOwnerRefundApproved(entity);
            
            // Tạo withdrawal record để thực tế trừ tiền
            try {
                Withdrawal withdrawal = withdrawalService.createWithdrawalFromApprovedRefund(entity.getRefundApplicationId());
                log.info("Withdrawal created for approved refund application: withdrawalId={}, amount={}", 
                    withdrawal.getWithdrawalId(), withdrawal.getTransferredAmount());
            } catch (Exception e) {
                log.error("Failed to create withdrawal for approved refund application: {}", entity.getRefundApplicationId(), e);
                // Không throw lỗi để không ảnh hưởng đến approval process
            }
            
            // TODO: Tích hợp với payment gateway để thực hiện chuyển tiền tự động
            log.info("Refund application APPROVED: id={}, amount={} - Manual transfer required", 
                entity.getRefundApplicationId(), entity.getRequestedAmount());
        } else if (entity.getStatus() == com.petties.petties.model.enums.RefundApplicationStatus.REJECTED) {
            notificationService.notifyClinicOwnerRefundRejected(entity, request.getNote());
        }

        return toResponse(entity);
    }

    /**
     * Lấy danh sách đơn của một phòng khám (Owner/Admin).
     */
    @Transactional(readOnly = true)
    public List<RefundApplicationResponse> getClinicApplications(UUID clinicId) {
        // Owner checks could be added here if needed, but we rely on controller
        // PreAuthorize for now.
        return refundApplicationRepository.findByClinicClinicIdOrderByCreatedAtDesc(clinicId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private RefundApplicationResponse toResponse(RefundApplication e) {
        return RefundApplicationResponse.builder()
                .refundApplicationId(e.getRefundApplicationId())
                .clinicId(e.getClinic().getClinicId())
                .clinicName(e.getClinic().getName())
                .bankName(e.getClinic().getBankName())
                .accountNumber(e.getClinic().getAccountNumber())
                .periodYearMonth(e.getPeriodYearMonth())
                .monthRevenue(e.getMonthRevenue())
                .qrRevenue(e.getQrRevenue())
                .cashRevenue(e.getCashRevenue())
                .requestedAmount(e.getRequestedAmount())
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
