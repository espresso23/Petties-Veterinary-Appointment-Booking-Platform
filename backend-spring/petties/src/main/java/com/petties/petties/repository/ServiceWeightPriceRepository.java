package com.petties.petties.repository;

import com.petties.petties.model.ServiceWeightPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ServiceWeightPriceRepository extends JpaRepository<ServiceWeightPrice, UUID> {
}
