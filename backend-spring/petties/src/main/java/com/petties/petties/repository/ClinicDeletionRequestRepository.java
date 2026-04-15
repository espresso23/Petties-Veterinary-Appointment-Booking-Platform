package com.petties.petties.repository;

import com.petties.petties.model.ClinicDeletionRequest;
import com.petties.petties.model.enums.ClinicDeletionRequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClinicDeletionRequestRepository extends JpaRepository<ClinicDeletionRequest, UUID> {

    boolean existsByClinicClinicIdAndStatus(UUID clinicId, ClinicDeletionRequestStatus status);

    @EntityGraph(attributePaths = {"clinic", "owner", "reviewedBy"})
    Page<ClinicDeletionRequest> findByOwnerUserId(UUID ownerId, Pageable pageable);

    @EntityGraph(attributePaths = {"clinic", "owner", "reviewedBy"})
    Page<ClinicDeletionRequest> findByStatus(ClinicDeletionRequestStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"clinic", "owner", "reviewedBy"})
    Optional<ClinicDeletionRequest> findByRequestId(UUID requestId);
}
