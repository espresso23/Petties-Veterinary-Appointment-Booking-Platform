package com.petties.petties.service;

import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.RefundApplication;
import com.petties.petties.model.User;
import com.petties.petties.model.Withdrawal;
import com.petties.petties.model.enums.WithdrawalStatus;
import com.petties.petties.repository.RefundApplicationRepository;
import com.petties.petties.repository.WithdrawalRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Service xử lý rút tiền thực tế khi admin duyệt refund application
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WithdrawalService {

    private final WithdrawalRepository withdrawalRepository;
    private final RefundApplicationRepository refundApplicationRepository;
    private final AuthService authService;
    private final ClinicBalanceService clinicBalanceService;

    /**
     * Lấy clinic ID của user hiện tại
     */
    private UUID getCurrentClinicId() {
        User currentUser = authService.getCurrentUser();
        if (currentUser.getWorkingClinic() != null) {
            return currentUser.getWorkingClinic().getClinicId();
        } else if (currentUser.getRole().name().equals("CLINIC_OWNER")) {
            // Clinic Owner cần truyền clinicId, tạm thời return null
            throw new BadRequestException("Clinic Owner cần cung cấp clinic ID");
        } else {
            throw new BadRequestException("Bạn chưa được gán phòng khám.");
        }
    }

    /**
     * Tạo withdrawal record khi admin duyệt refund application
     * @param refundApplicationRefId ID của refund application đã được duyệt
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Withdrawal createWithdrawalFromApprovedRefund(UUID refundApplicationRefId) {
        User currentUser = authService.getCurrentUser();
        
        RefundApplication refundApp = refundApplicationRepository.findById(refundApplicationRefId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn hoàn tiền."));

        if (refundApp.getStatus() == com.petties.petties.model.enums.RefundApplicationStatus.REJECTED) {
            throw new BadRequestException("Không thể tạo withdrawal cho đơn đã bị từ chối.");
        }

        // Kiểm tra xem đã có withdrawal nào cho refund application này chưa
        boolean existingWithdrawal = withdrawalRepository.existsByRefundApplicationRefundApplicationId(refundApplicationRefId);
        if (existingWithdrawal) {
            log.warn("Withdrawal already exists for refund application: {}", refundApplicationRefId);
            throw new BadRequestException("Đã có giao dịch rút tiền cho đơn này.");
        }

        // Tính toán số tiền
        BigDecimal requestedAmount = refundApp.getRequestedAmount(); // Số tiền clinic thực tế yêu cầu rút
        BigDecimal platformFee = BigDecimal.ZERO; // Phí nền tảng đã được tính ở bước doanh thu, không trừ lại khi rút
        BigDecimal transactionFee = BigDecimal.ZERO; // Có thể có phí giao dịch sau
        
        // Số tiền thực tế chuyển = requested amount (đã trừ platform fee trong amountAfterDeduction)
        BigDecimal transferredAmount = requestedAmount;

        Withdrawal withdrawal = Withdrawal.builder()
                .clinic(refundApp.getClinic())
                .refundApplication(refundApp)
                .requestedAmount(requestedAmount)
                .transferredAmount(transferredAmount)
                .platformFee(platformFee)
                .transactionFee(transactionFee)
                .status(WithdrawalStatus.PENDING)
                .approvedBy(currentUser)
                .approvedAt(LocalDateTime.now())
                .adminNotes("Tự động tạo từ việc duyệt đơn hoàn tiền")
                .build();

        withdrawal = withdrawalRepository.save(withdrawal);
        
        // TRỪ TIỀN THỰC TỪ BALANCE CLINIC
        try {
            clinicBalanceService.deductFromWithdrawal(
                refundApp.getClinic().getClinicId(),
                transferredAmount,
                platformFee,
                transactionFee
            );
            log.info("Balance deducted successfully for withdrawal: {}", withdrawal.getWithdrawalId());
        } catch (BadRequestException e) {
            log.error("Insufficient balance for withdrawal: {} - {}", withdrawal.getWithdrawalId(), e.getMessage());
            // Update withdrawal status to FAILED
            withdrawal.setStatus(WithdrawalStatus.FAILED);
            withdrawal.setFailureReason("Số dư không đủ: " + e.getMessage());
            withdrawalRepository.save(withdrawal);
            // Re-throw to inform admin
            throw new BadRequestException("Không thể tạo withdrawal: Số dư clinic không đủ. " + e.getMessage());
        } catch (Exception e) {
            log.error("Failed to deduct balance for withdrawal: {}", withdrawal.getWithdrawalId(), e);
            // Update withdrawal status to FAILED
            withdrawal.setStatus(WithdrawalStatus.FAILED);
            withdrawal.setFailureReason("Lỗi hệ thống khi trừ balance: " + e.getMessage());
            withdrawalRepository.save(withdrawal);
            throw new BadRequestException("Không thể tạo withdrawal: " + e.getMessage());
        }
        
        log.info("Withdrawal created: id={}, clinicId={}, amount={}, refundAppId={}", 
                withdrawal.getWithdrawalId(), 
                refundApp.getClinic().getClinicId(), 
                transferredAmount,
                refundApplicationRefId);

        return withdrawal;
    }

    /**
     * Cập nhật trạng thái withdrawal (khi chuyển tiền thành công/thất bại)
     */
    @Transactional
    public Withdrawal updateWithdrawalStatus(UUID withdrawalId, WithdrawalStatus status, String transferReference, String failureReason) {
        Withdrawal withdrawal = withdrawalRepository.findById(withdrawalId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy giao dịch rút tiền."));

        withdrawal.setStatus(status);
        withdrawal.setTransferReference(transferReference);
        withdrawal.setFailureReason(failureReason);

        if (status == WithdrawalStatus.COMPLETED) {
            withdrawal.setCompletedAt(LocalDateTime.now());
            log.info("Withdrawal completed: id={}, transferRef={}", withdrawalId, transferReference);
        } else if (status == WithdrawalStatus.FAILED) {
            log.error("Withdrawal failed: id={}, reason={}", withdrawalId, failureReason);
            
            // HOÀN TIỀN KHI GIAO DỊCH THẤT BẠI
            try {
                clinicBalanceService.refundFromFailedWithdrawal(
                    withdrawal.getClinic().getClinicId(),
                    withdrawal.getTransferredAmount(),
                    withdrawal.getPlatformFee(),
                    withdrawal.getTransactionFee()
                );
                log.info("Balance refunded successfully for failed withdrawal: {}", withdrawalId);
            } catch (Exception e) {
                log.error("Failed to refund balance for failed withdrawal: {}", withdrawalId, e);
            }
        }

        return withdrawalRepository.save(withdrawal);
    }

    /**
     * Lấy danh sách withdrawal của clinic
     */
    @Transactional(readOnly = true)
    public java.util.List<Withdrawal> getClinicWithdrawals(UUID clinicId) {
        return withdrawalRepository.findByClinicClinicIdOrderByCreatedAtDesc(clinicId);
    }

    /**
     * Lấy danh sách withdrawal theo trạng thái (dùng cho admin)
     */
    @Transactional(readOnly = true)
    public java.util.List<Withdrawal> getWithdrawalsByStatus(WithdrawalStatus status) {
        return withdrawalRepository.findByStatusOrderByCreatedAtDesc(status);
    }
}
