package com.petties.petties.repository;

import com.petties.petties.model.Clinic;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClinicRepository extends JpaRepository<Clinic, UUID> {
    
    Optional<Clinic> findByIdAndOwnerUserId(UUID clinicId, UUID ownerId);
    
    Optional<Clinic> findByOwnerUserId(UUID ownerId);
    
    boolean existsByOwnerUserId(UUID ownerId);
}

