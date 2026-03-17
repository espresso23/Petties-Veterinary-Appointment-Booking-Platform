package com.petties.petties.service;

import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicBalance;
import com.petties.petties.model.User;
import com.petties.petties.repository.ClinicBalanceRepository;
import com.petties.petties.repository.PaymentRepository;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.model.enums.PaymentStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Service quản lý balance của clinic
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ClinicBalanceService {

    private final ClinicBalanceRepository clinicBalanceRepository;
    private final PaymentRepository paymentRepository;

    private ClinicBalance getOrCreateClinicBalance(UUID clinicId) {
        ClinicBalance balance = clinicBalanceRepository.findByClinicClinicId(clinicId);
        if (balance != null) {
            return balance;
        }

        BigDecimal qrRevenue = paymentRepository.sumAmountByClinicIdAndMethodAndStatus(
                clinicId, PaymentMethod.QR, PaymentStatus.PAID);
        BigDecimal cashRevenue = paymentRepository.sumAmountByClinicIdAndMethodAndStatus(
                clinicId, PaymentMethod.CASH, PaymentStatus.PAID);

        BigDecimal totalQr = qrRevenue != null ? qrRevenue : BigDecimal.ZERO;
        BigDecimal totalCash = cashRevenue != null ? cashRevenue : BigDecimal.ZERO;
        BigDecimal platformFeeFromQR = totalQr.multiply(new BigDecimal("0.05"));
        BigDecimal platformFeeFromCash = totalCash.multiply(new BigDecimal("0.05"));
        BigDecimal withdrawableBalance = totalQr.subtract(platformFeeFromQR).subtract(platformFeeFromCash);

        ClinicBalance newBalance = ClinicBalance.builder()
                .clinic(Clinic.builder().clinicId(clinicId).build())
                .currentBalance(withdrawableBalance)
                .totalWithdrawn(BigDecimal.ZERO)
                .totalPlatformFees(platformFeeFromQR.add(platformFeeFromCash))
                .totalTransactionFees(BigDecimal.ZERO)
                .notes("Tự động khởi tạo khi xử lý rút tiền")
                .build();

        newBalance = clinicBalanceRepository.save(newBalance);
        log.info("Auto initialized clinic balance: clinicId={}, balance={}", clinicId, newBalance.getCurrentBalance());
        return newBalance;
    }

    /**
     * Lấy balance của clinic
     */
    @Transactional(readOnly = true)
    public ClinicBalance getClinicBalance(UUID clinicId) {
        ClinicBalance balance = clinicBalanceRepository.findByClinicClinicId(clinicId);
        if (balance == null) {
            throw new ResourceNotFoundException("Không tìm thấy balance của phòng khám.");
        }
        return balance;
    }

    /**
     * Khởi tạo balance cho clinic (chạy một lần)
     */
    @Transactional
    public ClinicBalance initializeClinicBalance(UUID clinicId) {
        if (clinicBalanceRepository.existsByClinicClinicId(clinicId)) {
            log.warn("Clinic balance already exists for clinic: {}", clinicId);
            throw new BadRequestException("Balance của phòng khám này đã được khởi tạo.");
        }

        ClinicBalance balance = ClinicBalance.builder()
                .clinic(Clinic.builder().clinicId(clinicId).build())
                .currentBalance(BigDecimal.ZERO)
                .totalWithdrawn(BigDecimal.ZERO)
                .totalPlatformFees(BigDecimal.ZERO)
                .totalTransactionFees(BigDecimal.ZERO)
                .notes("Khởi tạo balance tự động")
                .build();

        balance = clinicBalanceRepository.save(balance);
        log.info("Clinic balance initialized: clinicId={}, balance={}", clinicId, balance.getCurrentBalance());
        return balance;
    }

    /**
     * Trừ tiền khi withdrawal được hoàn thành
     */
    @Transactional
    public ClinicBalance deductFromWithdrawal(UUID clinicId, BigDecimal withdrawalAmount, BigDecimal platformFee,
            BigDecimal transactionFee) {
        ClinicBalance balance = getOrCreateClinicBalance(clinicId);

        BigDecimal totalDeduction = withdrawalAmount.add(platformFee).add(transactionFee);

        if (balance.getCurrentBalance().compareTo(totalDeduction) < 0) {
            throw new BadRequestException("Số dư không đủ để thực hiện giao dịch. Balance hiện tại: " +
                    balance.getCurrentBalance() + ", Số tiền cần trừ: " + totalDeduction);
        }

        // Cập nhật balance
        balance.setCurrentBalance(balance.getCurrentBalance().subtract(totalDeduction));
        balance.setTotalWithdrawn(balance.getTotalWithdrawn().add(withdrawalAmount));
        balance.setTotalPlatformFees(balance.getTotalPlatformFees().add(platformFee));
        balance.setTotalTransactionFees(balance.getTotalTransactionFees().add(transactionFee));
        balance.setUpdatedAt(LocalDateTime.now());

        balance = clinicBalanceRepository.save(balance);

        log.info("Balance deducted: clinicId={}, amount={}, newBalance={}",
                clinicId, totalDeduction, balance.getCurrentBalance());

        return balance;
    }

    /**
     * Cộng lại tiền khi withdrawal thất bại
     */
    @Transactional
    public ClinicBalance refundFromFailedWithdrawal(UUID clinicId, BigDecimal withdrawalAmount, BigDecimal platformFee,
            BigDecimal transactionFee) {
        ClinicBalance balance = getClinicBalance(clinicId);

        BigDecimal totalRefund = withdrawalAmount.add(platformFee).add(transactionFee);

        // Cập nhật balance
        balance.setCurrentBalance(balance.getCurrentBalance().add(totalRefund));
        balance.setTotalWithdrawn(balance.getTotalWithdrawn().subtract(withdrawalAmount));
        balance.setTotalPlatformFees(balance.getTotalPlatformFees().subtract(platformFee));
        balance.setTotalTransactionFees(balance.getTotalTransactionFees().subtract(transactionFee));
        balance.setUpdatedAt(LocalDateTime.now());

        balance = clinicBalanceRepository.save(balance);

        log.info("Balance refunded: clinicId={}, amount={}, newBalance={}",
                clinicId, totalRefund, balance.getCurrentBalance());

        return balance;
    }
}
