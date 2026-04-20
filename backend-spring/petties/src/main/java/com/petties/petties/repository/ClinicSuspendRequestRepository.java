package com.petties.petties.repository;

import com.petties.petties.model.ClinicSuspendRequest;
import com.petties.petties.model.enums.ClinicSuspendRequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ClinicSuspendRequestRepository extends JpaRepository<ClinicSuspendRequest, UUID> {

    boolean existsByClinicClinicIdAndStatus(UUID clinicId, ClinicSuspendRequestStatus status);

    List<ClinicSuspendRequest> findByRequestedByUserIdOrderByCreatedAtDesc(UUID userId);

    Page<ClinicSuspendRequest> findByRequestedByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Page<ClinicSuspendRequest> findByStatusOrderByCreatedAtDesc(ClinicSuspendRequestStatus status, Pageable pageable);
}