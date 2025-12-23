package com.petties.petties.service;

import com.petties.petties.dto.clinic.ClinicRequest;
import com.petties.petties.dto.clinic.ClinicResponse;
import com.petties.petties.dto.clinic.DistanceResponse;
import com.petties.petties.dto.clinic.GeocodeResponse;
import com.petties.petties.model.enums.ClinicStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Service interface for Clinic management
 */
public interface ClinicService {

    /**
     * Get all clinics with filters and pagination
     */
    Page<ClinicResponse> getAllClinics(ClinicStatus status, String name, Pageable pageable);

    /**
     * Get clinic by ID
     */
    ClinicResponse getClinicById(UUID clinicId);

    /**
     * Create new clinic (CLINIC_OWNER only)
     */
    ClinicResponse createClinic(ClinicRequest request, UUID ownerId);

    /**
     * Update clinic (CLINIC_OWNER can only update their own clinic)
     */
    ClinicResponse updateClinic(UUID clinicId, ClinicRequest request, UUID ownerId);

    /**
     * Delete clinic (soft delete)
     */
    void deleteClinic(UUID clinicId, UUID ownerId);

    /**
     * Search clinics by name
     */
    Page<ClinicResponse> searchClinics(String name, Pageable pageable);

    /**
     * Find nearby clinics
     */
    Page<ClinicResponse> findNearbyClinics(BigDecimal latitude, BigDecimal longitude, 
                                           double radius, Pageable pageable);

    /**
     * Geocode address to lat/lng
     */
    GeocodeResponse geocodeAddress(String address);

    /**
     * Calculate distance from point A to clinic
     */
    DistanceResponse calculateDistance(UUID clinicId, BigDecimal latitude, BigDecimal longitude);

    /**
     * Approve clinic (ADMIN only)
     */
    ClinicResponse approveClinic(UUID clinicId);

    /**
     * Reject clinic (ADMIN only)
     */
    ClinicResponse rejectClinic(UUID clinicId, String reason);

    /**
     * Get clinics by owner
     */
    Page<ClinicResponse> getClinicsByOwner(UUID ownerId, Pageable pageable);

    /**
     * Upload image for clinic
     */
    ClinicResponse uploadClinicImage(UUID clinicId, String imageUrl, String caption, Integer displayOrder, Boolean isPrimary, UUID ownerId);

    /**
     * Delete clinic image
     */
    void deleteClinicImage(UUID clinicId, UUID imageId, UUID ownerId);

    /**
     * Update clinic logo
     */
    ClinicResponse updateClinicLogo(UUID clinicId, String logoUrl, UUID ownerId);
}

