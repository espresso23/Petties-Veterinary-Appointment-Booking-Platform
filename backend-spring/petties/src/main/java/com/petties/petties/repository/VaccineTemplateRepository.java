package com.petties.petties.repository;

import com.petties.petties.model.VaccineTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface VaccineTemplateRepository extends JpaRepository<VaccineTemplate, UUID> {
    Optional<VaccineTemplate> findByName(String name);
}
