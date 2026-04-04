package com.petties.petties.repository;

import com.petties.petties.model.ClinicVoucher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClinicVoucherRepository extends JpaRepository<ClinicVoucher, UUID> {

    List<ClinicVoucher> findByClinicClinicIdOrderByAppliedAtDesc(UUID clinicId);

    boolean existsByVoucherVoucherIdAndClinicClinicId(UUID voucherId, UUID clinicId);

    Optional<ClinicVoucher> findByVoucherVoucherIdAndClinicClinicId(UUID voucherId, UUID clinicId);

    /**
     * Tìm các voucher hợp lệ cho clinic + đơn hàng của pet owner để hiển thị khi thanh toán
     */
    @Query("""
            SELECT cv FROM ClinicVoucher cv
            JOIN FETCH cv.voucher v
            WHERE cv.clinic.clinicId = :clinicId
              AND cv.isEnabled = true
              AND v.isActive = true
              AND CURRENT_DATE BETWEEN v.startDate AND v.endDate
              AND v.minOrderAmount <= :orderAmount
            """)
    List<ClinicVoucher> findAvailableForBooking(
            @Param("clinicId") UUID clinicId,
            @Param("orderAmount") BigDecimal orderAmount);
}
