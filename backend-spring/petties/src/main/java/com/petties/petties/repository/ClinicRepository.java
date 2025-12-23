package com.petties.petties.repository;

import com.petties.petties.model.Clinic;
import com.petties.petties.model.enums.ClinicStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClinicRepository extends JpaRepository<Clinic, UUID> {

    /**
     * Find clinic by ID (excluding soft deleted)
     */
    @Query("SELECT c FROM Clinic c WHERE c.clinicId = :id AND c.deletedAt IS NULL")
    Optional<Clinic> findByIdAndNotDeleted(@Param("id") UUID id);

    /**
     * Find all clinics by status
     */
    Page<Clinic> findByStatus(ClinicStatus status, Pageable pageable);

    /**
     * Find clinics by owner
     */
    Page<Clinic> findByOwnerUserId(UUID ownerId, Pageable pageable);

    /**
     * Search clinics by name (case-insensitive)
     */
    @Query("SELECT c FROM Clinic c WHERE LOWER(c.name) LIKE LOWER(CONCAT('%', :name, '%')) AND c.deletedAt IS NULL")
    Page<Clinic> searchByName(@Param("name") String name, Pageable pageable);

    /**
     * Find nearby clinics using Haversine formula
     * Radius in kilometers
     */
    @Query(value = """
        SELECT c.*, 
               (6371 * acos(cos(radians(:lat)) * cos(radians(c.latitude)) * 
               cos(radians(c.longitude) - radians(:lng)) + 
               sin(radians(:lat)) * sin(radians(c.latitude)))) AS distance
        FROM clinics c
        WHERE c.deleted_at IS NULL 
          AND c.status = 'APPROVED'
          AND c.latitude IS NOT NULL 
          AND c.longitude IS NOT NULL
          AND (6371 * acos(cos(radians(:lat)) * cos(radians(c.latitude)) * 
               cos(radians(c.longitude) - radians(:lng)) + 
               sin(radians(:lat)) * sin(radians(c.latitude)))) <= :radius
        ORDER BY distance
        """, nativeQuery = true)
    List<Clinic> findNearbyClinics(
        @Param("lat") BigDecimal latitude,
        @Param("lng") BigDecimal longitude,
        @Param("radius") double radius
    );

    /**
     * Find clinics with filters
     */
    @Query("SELECT c FROM Clinic c WHERE " +
           "(:status IS NULL OR c.status = :status) AND " +
           "(:name IS NULL OR :name = '' OR LOWER(c.name) LIKE LOWER(CONCAT('%', :name, '%'))) AND " +
           "c.deletedAt IS NULL")
    Page<Clinic> findWithFilters(
        @Param("status") ClinicStatus status,
        @Param("name") String name,
        Pageable pageable
    );

    /**
     * Check if clinic exists and belongs to owner
     */
    boolean existsByClinicIdAndOwnerUserId(UUID clinicId, UUID ownerId);

    /**
     * Count clinics by status
     */
    long countByStatus(ClinicStatus status);
}

