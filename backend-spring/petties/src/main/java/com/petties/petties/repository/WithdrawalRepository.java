package com.petties.petties.repository;

import com.petties.petties.model.Withdrawal;
import com.petties.petties.model.enums.WithdrawalStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface WithdrawalRepository extends JpaRepository<Withdrawal, UUID> {

    List<Withdrawal> findByClinicClinicIdOrderByCreatedAtDesc(UUID clinicId);

    Page<Withdrawal> findByClinicClinicIdOrderByCreatedAtDesc(UUID clinicId, Pageable pageable);

    List<Withdrawal> findByStatusOrderByCreatedAtDesc(WithdrawalStatus status);

    @Query("SELECT w FROM Withdrawal w WHERE w.clinic.clinicId = :clinicId AND w.status = :status ORDER BY w.createdAt DESC")
    List<Withdrawal> findByClinicAndStatus(@Param("clinicId") UUID clinicId, @Param("status") WithdrawalStatus status);

    @Query("SELECT w FROM Withdrawal w WHERE w.status IN :statuses ORDER BY w.createdAt DESC")
    List<Withdrawal> findByStatusInOrderByCreatedAtDesc(@Param("statuses") List<WithdrawalStatus> statuses);

    @Query("SELECT COALESCE(SUM(w.transferredAmount), 0) FROM Withdrawal w WHERE w.clinic.clinicId = :clinicId AND w.status = 'COMPLETED'")
    BigDecimal getTotalWithdrawnByClinic(@Param("clinicId") UUID clinicId);

        @Query("SELECT COALESCE(SUM(w.transferredAmount), 0) FROM Withdrawal w WHERE w.clinic.clinicId = :clinicId AND w.status IN :statuses")
        BigDecimal getTotalTransferredByClinicAndStatuses(@Param("clinicId") UUID clinicId,
            @Param("statuses") List<WithdrawalStatus> statuses);

    @Query("SELECT CASE WHEN COUNT(w) > 0 THEN true ELSE false END FROM Withdrawal w WHERE w.refundApplication.refundApplicationId = :refundApplicationId")
    boolean existsByRefundApplicationRefundApplicationId(@Param("refundApplicationId") UUID refundApplicationId);
}
