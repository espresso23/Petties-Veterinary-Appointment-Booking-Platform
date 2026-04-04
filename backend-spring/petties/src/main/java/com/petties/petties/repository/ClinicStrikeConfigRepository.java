package com.petties.petties.repository;

import com.petties.petties.model.ClinicStrikeConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ClinicStrikeConfigRepository extends JpaRepository<ClinicStrikeConfig, String> {
}
