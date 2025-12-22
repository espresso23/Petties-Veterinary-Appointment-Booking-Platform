package com.petties.petties.repository;

import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicService;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClinicServiceRepository extends JpaRepository<ClinicService, UUID> {
    List<ClinicService> findByClinic(Clinic clinic);

    Optional<ClinicService> findByServiceIdAndClinic(UUID serviceId, Clinic clinic);

    List<ClinicService> findByClinicAndIsHomeVisit(Clinic clinic, Boolean isHomeVisit);
}
