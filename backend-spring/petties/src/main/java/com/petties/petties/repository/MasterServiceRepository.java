package com.petties.petties.repository;

import com.petties.petties.model.MasterService;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MasterServiceRepository extends JpaRepository<MasterService, UUID> {
    
    // Tìm theo category với weightPrices
    @Query("SELECT DISTINCT ms FROM MasterService ms LEFT JOIN FETCH ms.weightPrices WHERE ms.serviceCategory = :category")
    List<MasterService> findByServiceCategory(@Param("category") String serviceCategory);
    
    // Tìm theo pet type với weightPrices
    @Query("SELECT DISTINCT ms FROM MasterService ms LEFT JOIN FETCH ms.weightPrices WHERE ms.petType = :petType")
    List<MasterService> findByPetType(@Param("petType") String petType);
    
    // Tìm theo loại service (home visit hay không) với weightPrices
    @Query("SELECT DISTINCT ms FROM MasterService ms LEFT JOIN FETCH ms.weightPrices WHERE ms.isHomeVisit = :isHomeVisit")
    List<MasterService> findByIsHomeVisit(@Param("isHomeVisit") Boolean isHomeVisit);
    
    // Tìm theo tên (for search) với weightPrices
    @Query("SELECT DISTINCT ms FROM MasterService ms LEFT JOIN FETCH ms.weightPrices WHERE LOWER(ms.name) LIKE LOWER(CONCAT('%', :name, '%'))")
    List<MasterService> findByNameContainingIgnoreCase(@Param("name") String name);
    
    // Find by ID với weightPrices
    @Query("SELECT ms FROM MasterService ms LEFT JOIN FETCH ms.weightPrices WHERE ms.masterServiceId = :id")
    Optional<MasterService> findByIdWithWeightPrices(@Param("id") UUID id);
    
    // Find all với weightPrices
    @Query("SELECT DISTINCT ms FROM MasterService ms LEFT JOIN FETCH ms.weightPrices")
    List<MasterService> findAllWithWeightPrices();
}
