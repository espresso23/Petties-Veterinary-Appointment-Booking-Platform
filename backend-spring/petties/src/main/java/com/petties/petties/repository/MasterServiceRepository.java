package com.petties.petties.repository;

import com.petties.petties.model.MasterService;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MasterServiceRepository extends JpaRepository<MasterService, UUID> {
    
    // Tìm theo category
    List<MasterService> findByServiceCategory(String serviceCategory);
    
    // Tìm theo pet type
    List<MasterService> findByPetType(String petType);
    
    // Tìm theo loại service (home visit hay không)
    List<MasterService> findByIsHomeVisit(Boolean isHomeVisit);
    
    // Tìm theo tên (for search)
    List<MasterService> findByNameContainingIgnoreCase(String name);
}
