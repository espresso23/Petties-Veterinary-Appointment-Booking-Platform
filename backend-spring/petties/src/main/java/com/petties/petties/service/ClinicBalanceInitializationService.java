package com.petties.petties.service;

import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicBalance;
import com.petties.petties.repository.ClinicBalanceRepository;
import com.petties.petties.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Service để đồng bộ và khởi tạo balance cho các clinic đã có
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ClinicBalanceInitializationService {

    private final ClinicBalanceRepository clinicBalanceRepository;
    private final PaymentRepository paymentRepository;

    /**
     * Khởi tạo balance cho tất cả clinic chưa có trong clinic_balances
     * Dựa trên tổng payments đã PAID
     */
    @Transactional
    public void initializeAllClinicBalances() {
        log.info("Starting clinic balance initialization...");
        
        // Lấy tất cả clinic đã có balance
        List<UUID> existingClinicIds = clinicBalanceRepository.findAll()
                .stream()
                .map(cb -> cb.getClinic().getClinicId())
                .toList();
        
        // Lấy tất cả clinic có payments
        List<Object[]> clinicIdsWithPayments = paymentRepository.findClinicIdsWithPaidPayments();
        
        for (Object[] row : clinicIdsWithPayments) {
            UUID clinicId = (UUID) row[0];
            BigDecimal totalQr = (BigDecimal) row[1];
            BigDecimal totalCash = (BigDecimal) row[2];
            
            // Bỏ qua nếu đã có balance
            if (existingClinicIds.contains(clinicId)) {
                log.debug("Clinic {} already has balance, skipping", clinicId);
                continue;
            }
            
            // Tính balance theo công thức hiện tại
            // Total Clinic Balance = (QR * 0.95) - (CASH * 0.05)
            BigDecimal platformFeeFromQr = totalQr.multiply(new BigDecimal("0.05"));
            BigDecimal platformFeeFromCash = totalCash.multiply(new BigDecimal("0.05"));
            BigDecimal withdrawableBalance = totalQr.subtract(platformFeeFromQr).subtract(platformFeeFromCash);
            
            ClinicBalance balance = ClinicBalance.builder()
                    .clinic(Clinic.builder().clinicId(clinicId).build())
                    .currentBalance(withdrawableBalance)
                    .totalWithdrawn(BigDecimal.ZERO)
                    .totalPlatformFees(platformFeeFromQr.add(platformFeeFromCash))
                    .totalTransactionFees(BigDecimal.ZERO)
                    .notes("Khởi tạo tự động từ payments đã có")
                    .build();
            
            clinicBalanceRepository.save(balance);
            log.info("Initialized balance for clinic {}: QR={}, Cash={}, Balance={}", 
                    clinicId, totalQr, totalCash, withdrawableBalance);
        }
        
        log.info("Clinic balance initialization completed. Processed {} clinics.", clinicIdsWithPayments.size());
    }
}
