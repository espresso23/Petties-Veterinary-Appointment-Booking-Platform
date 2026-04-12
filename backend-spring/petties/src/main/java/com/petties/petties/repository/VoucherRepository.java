package com.petties.petties.repository;

import com.petties.petties.model.Voucher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VoucherRepository extends JpaRepository<Voucher, UUID> {

    Optional<Voucher> findByCode(String code);

    boolean existsByCode(String code);

    List<Voucher> findAllByOrderByCreatedAtDesc();

    @Query("SELECT v FROM Voucher v WHERE v.isActive = true AND CURRENT_DATE BETWEEN v.startDate AND v.endDate")
    List<Voucher> findAllValid();

    @Query("""
            SELECT v FROM Voucher v
            WHERE v.isActive = true
              AND CURRENT_DATE BETWEEN v.startDate AND v.endDate
              AND (v.applicableCategory IS NULL OR v.applicableCategory = :category)
              AND v.minOrderAmount <= :orderAmount
            """)
    List<Voucher> findApplicableVouchers(
            @Param("category") com.petties.petties.model.enums.ServiceCategory category,
            @Param("orderAmount") java.math.BigDecimal orderAmount);
}
