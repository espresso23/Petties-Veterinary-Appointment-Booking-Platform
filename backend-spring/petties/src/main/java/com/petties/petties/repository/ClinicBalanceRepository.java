package com.petties.petties.repository;

import com.petties.petties.model.ClinicBalance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ClinicBalanceRepository extends JpaRepository<ClinicBalance, UUID> {

    ClinicBalance findByClinicClinicId(UUID clinicId);

    boolean existsByClinicClinicId(UUID clinicId);
}
