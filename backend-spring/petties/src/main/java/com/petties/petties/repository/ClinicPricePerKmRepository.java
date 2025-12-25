package com.petties.petties.repository;

import com.petties.petties.model.ClinicPricePerKm;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClinicPricePerKmRepository extends JpaRepository<ClinicPricePerKm, UUID> {
    Optional<ClinicPricePerKm> findByClinicId(UUID clinicId);
}
