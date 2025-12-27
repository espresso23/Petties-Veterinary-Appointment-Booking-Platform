package com.petties.petties.repository;

import com.petties.petties.model.ClinicImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClinicImageRepository extends JpaRepository<ClinicImage, UUID> {

    /**
     * Find all images by clinic ID
     */
    List<ClinicImage> findByClinicClinicIdOrderByDisplayOrderAsc(UUID clinicId);

    /**
     * Find image by ID and clinic ID
     */
    Optional<ClinicImage> findByImageIdAndClinicClinicId(UUID imageId, UUID clinicId);

    /**
     * Count images by clinic ID
     */
    long countByClinicClinicId(UUID clinicId);

    /**
     * Find primary image by clinic ID
     */
    Optional<ClinicImage> findByClinicClinicIdAndIsPrimaryTrue(UUID clinicId);
}

