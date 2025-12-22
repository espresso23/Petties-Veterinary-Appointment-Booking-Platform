package com.petties.petties.repository;

import com.petties.petties.model.Clinic;
import com.petties.petties.model.Service;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ServiceRepository extends JpaRepository<Service, UUID> {
    
    List<Service> findByClinic(Clinic clinic);
    
    Optional<Service> findByServiceIdAndClinic(UUID serviceId, Clinic clinic);
    
    boolean existsByServiceIdAndClinic(UUID serviceId, Clinic clinic);
    
    List<Service> findByClinicAndIsActiveTrue(Clinic clinic);
    
    List<Service> findByClinicAndIsHomeVisit(Clinic clinic, Boolean isHomeVisit);
}

