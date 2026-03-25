package com.petties.petties.repository;

import com.petties.petties.model.RefundApplication;
import com.petties.petties.model.enums.RefundApplicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RefundApplicationRepository extends JpaRepository<RefundApplication, UUID> {

    List<RefundApplication> findByClinicClinicIdOrderByCreatedAtDesc(UUID clinicId);

    List<RefundApplication> findByStatusOrderByCreatedAtDesc(RefundApplicationStatus status);

    boolean existsByClinicClinicIdAndPeriodYearMonth(UUID clinicId, String periodYearMonth);
}
