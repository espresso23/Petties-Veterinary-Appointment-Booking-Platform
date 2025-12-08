package com.petties.petties.repository;

import com.petties.petties.model.Vet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VetRepository extends JpaRepository<Vet, UUID> {

    List<Vet> findByClinicId(UUID clinicId);

    Optional<Vet> findByUserId(UUID userId);
}

