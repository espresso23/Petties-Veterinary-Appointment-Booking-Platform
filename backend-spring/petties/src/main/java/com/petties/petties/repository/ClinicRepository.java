package com.petties.petties.repository;

import com.petties.petties.dto.clinic.ClinicLocationResponse;
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
     * Find clinics by owner and status (with pagination)
     */
    Page<Clinic> findByOwnerUserIdAndStatus(UUID ownerId, ClinicStatus status, Pageable pageable);

    /**
     * Find ALL clinics by owner (any status, excluding soft deleted)
     */
    @Query("SELECT c FROM Clinic c WHERE c.owner.userId = :ownerId AND c.deletedAt IS NULL")
    Page<Clinic> findByOwnerUserId(@Param("ownerId") UUID ownerId, Pageable pageable);

    /**
     * Find a single clinic by owner (for current user's clinic)
     */
    Optional<Clinic> findFirstByOwnerUserId(UUID ownerId);

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
            @Param("radius") double radius);

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
            Pageable pageable);

    /**
     * Check if clinic exists and belongs to owner
     */
    boolean existsByClinicIdAndOwnerUserId(UUID clinicId, UUID ownerId);

    /**
     * Check if owner has any clinic
     */
    boolean existsByOwnerUserId(UUID ownerId);

    /**
     * Count clinics by status (excluding soft deleted)
     */
    long countByStatusAndDeletedAtIsNull(ClinicStatus status);

    /**
     * Get all unique locations that have approved clinics
     */
    @Query("SELECT DISTINCT new com.petties.petties.dto.clinic.ClinicLocationResponse(c.province, c.district, c.ward) " +
            "FROM Clinic c " +
            "WHERE c.status = 'APPROVED' AND c.deletedAt IS NULL " +
            "ORDER BY c.province, c.district, c.ward")
    List<ClinicLocationResponse> findActiveLocations();

    /**
     * Advanced search clinics with multiple filters (internal use)
     *
     * Price filter semantics:
     * - "Any service in range": clinic is returned if EXISTS at least one active service matching:
     *   + optional service name
     *   + optional minPrice/maxPrice bounds
     */
    @Query(value = """
            SELECT c.*,
                   CASE
                       WHEN :lat IS NOT NULL AND :lng IS NOT NULL AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
                       THEN (6371 * acos(greatest(-1.0, least(1.0, cos(radians(:lat)) * cos(radians(c.latitude)) *
                            cos(radians(c.longitude) - radians(:lng)) +
                            sin(radians(:lat)) * sin(radians(c.latitude))))))
                       ELSE NULL
                   END AS distance
            FROM clinics c
            WHERE c.deleted_at IS NULL
              AND c.status = 'APPROVED'
              AND (:query IS NULL OR :query = '' OR (
                  LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%'))
                  OR LOWER(c.description) LIKE LOWER(CONCAT('%', :query, '%'))
                  OR EXISTS (
                      SELECT 1 FROM clinic_services s2
                      WHERE s2.clinic_id = c.clinic_id
                        AND s2.is_active = true
                        AND LOWER(s2.name) LIKE LOWER(CONCAT('%', :query, '%'))
                  )
              ))
              AND (
                   :lat IS NULL OR :lng IS NULL OR :radius IS NULL
                   OR (6371 * acos(greatest(-1.0, least(1.0, cos(radians(:lat)) * cos(radians(c.latitude)) *
                       cos(radians(c.longitude) - radians(:lng)) +
                       sin(radians(:lat)) * sin(radians(c.latitude)))))) <= :radius
              )
              AND (:province IS NULL OR :province = '' OR LOWER(c.province) = LOWER(:province))
              AND (:district IS NULL OR :district = '' OR LOWER(c.district) = LOWER(:district))
              AND (
                   -- No filter by service/price => skip service join entirely
                   (
                     (:service IS NULL OR :service = '')
                     AND :minPrice IS NULL
                     AND :maxPrice IS NULL
                   )
                   OR EXISTS (
                      SELECT 1
                      FROM clinic_services s
                      WHERE s.clinic_id = c.clinic_id
                        AND s.is_active = true
                        AND (:service IS NULL OR :service = '' OR LOWER(s.name) LIKE LOWER(CONCAT('%', :service, '%')))
                        AND (:minPrice IS NULL OR s.base_price >= :minPrice)
                        AND (:maxPrice IS NULL OR s.base_price <= :maxPrice)
                   )
              )
            ORDER BY
              CASE
                WHEN :lat IS NOT NULL AND :lng IS NOT NULL AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
                THEN (6371 * acos(greatest(-1.0, least(1.0, cos(radians(:lat)) * cos(radians(c.latitude)) *
                     cos(radians(c.longitude) - radians(:lng)) +
                     sin(radians(:lat)) * sin(radians(c.latitude))))))
                ELSE 999999999
              END
            """, nativeQuery = true)
    List<Clinic> searchClinicsInternal(
            @Param("query") String query,
            @Param("lat") BigDecimal latitude,
            @Param("lng") BigDecimal longitude,
            @Param("radius") Double radius,
            @Param("province") String province,
            @Param("district") String district,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("service") String service);
}
