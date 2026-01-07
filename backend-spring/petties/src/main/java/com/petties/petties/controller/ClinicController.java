package com.petties.petties.controller;

import com.petties.petties.dto.clinic.ClinicLocationResponse;
import com.petties.petties.dto.clinic.ApproveClinicRequest;
import com.petties.petties.dto.clinic.ClinicRequest;
import com.petties.petties.dto.clinic.ClinicResponse;
import com.petties.petties.dto.clinic.DistanceResponse;
import com.petties.petties.dto.clinic.GeocodeResponse;
import com.petties.petties.dto.clinic.RejectClinicRequest;
import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.ClinicService;
import com.petties.petties.service.CloudinaryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import lombok.extern.slf4j.Slf4j;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/**
 * Controller for Clinic management
 * Base path: /api/clinics
 */
@RestController
@RequestMapping("/clinics") // Context path is /api, so full path will be /api/clinics
@RequiredArgsConstructor
@Slf4j
public class ClinicController {

    private final ClinicService clinicService;
    private final AuthService authService;
    private final CloudinaryService cloudinaryService;

    /**
     * GET /api/clinics
     * Get all clinics with filters and pagination
     * Public access - all authenticated users can view clinics
     */
    @GetMapping
    public ResponseEntity<Page<ClinicResponse>> getAllClinics(
            @RequestParam(required = false) ClinicStatus status,
            @RequestParam(required = false) String name,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") Sort.Direction sortDir) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(sortDir, sortBy));
        Page<ClinicResponse> clinics = clinicService.getAllClinics(status, name, pageable);
        return ResponseEntity.ok(clinics);
    }

    /**
     * GET /api/clinics/locations
     * Get all unique locations (province, district, ward) that have approved
     * clinics
     * Public access
     */
    @GetMapping("/locations")
    public ResponseEntity<java.util.List<ClinicLocationResponse>> getActiveLocations() {
        return ResponseEntity.ok(clinicService.getActiveLocations());
    }

    /**
     * GET /api/clinics/{id}
     * Get clinic by ID
     * Public access
     */
    @GetMapping("/{id}")
    public ResponseEntity<ClinicResponse> getClinicById(@PathVariable UUID id) {
        ClinicResponse clinic = clinicService.getClinicById(id);
        return ResponseEntity.ok(clinic);
    }

    /**
     * POST /api/clinics
     * Create new clinic
     * CLINIC_OWNER only
     */
    @PostMapping
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicResponse> createClinic(@Valid @RequestBody ClinicRequest request) {
        User currentUser = authService.getCurrentUser();
        ClinicResponse clinic = clinicService.createClinic(request, currentUser.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(clinic);
    }

    /**
     * PUT /api/clinics/{id}
     * Update clinic
     * CLINIC_OWNER can only update their own clinic
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicResponse> updateClinic(
            @PathVariable UUID id,
            @Valid @RequestBody ClinicRequest request) {
        User currentUser = authService.getCurrentUser();
        ClinicResponse clinic = clinicService.updateClinic(id, request, currentUser.getUserId());
        return ResponseEntity.ok(clinic);
    }

    /**
     * DELETE /api/clinics/{id}
     * Delete clinic (soft delete)
     * CLINIC_OWNER can only delete their own clinic
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Map<String, String>> deleteClinic(@PathVariable UUID id) {
        User currentUser = authService.getCurrentUser();
        clinicService.deleteClinic(id, currentUser.getUserId());
        return ResponseEntity.ok(Map.of("message", "Clinic deleted successfully"));
    }

    /**
     * GET /api/clinics/search
     * Search clinics by name
     * Public access
     */
    @GetMapping("/search")
    public ResponseEntity<Page<ClinicResponse>> searchClinics(
            @RequestParam String name,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<ClinicResponse> clinics = clinicService.searchClinics(name, pageable);
        return ResponseEntity.ok(clinics);
    }

    /**
     * GET /api/clinics/nearby
     * Find nearby clinics
     * Public access
     */
    @GetMapping("/nearby")
    public ResponseEntity<Page<ClinicResponse>> findNearbyClinics(
            @RequestParam BigDecimal latitude,
            @RequestParam BigDecimal longitude,
            @RequestParam(defaultValue = "10.0") double radius,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<ClinicResponse> clinics = clinicService.findNearbyClinics(
                latitude, longitude, radius, pageable);
        return ResponseEntity.ok(clinics);
    }

    /**
     * POST /api/clinics/{id}/geocode
     * Geocode address to lat/lng
     * CLINIC_OWNER can geocode for their own clinic
     */
    @PostMapping("/{id}/geocode")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<GeocodeResponse> geocodeClinicAddress(
            @PathVariable UUID id,
            @RequestBody Map<String, String> request) {

        String address = request.get("address");
        if (address == null || address.isEmpty()) {
            throw new IllegalArgumentException("Address is required");
        }

        GeocodeResponse geocode = clinicService.geocodeAddress(address);
        return ResponseEntity.ok(geocode);
    }

    /**
     * GET /api/clinics/{id}/distance
     * Calculate distance from point A to clinic
     * Public access
     */
    @GetMapping("/{id}/distance")
    public ResponseEntity<DistanceResponse> calculateDistance(
            @PathVariable UUID id,
            @RequestParam BigDecimal latitude,
            @RequestParam BigDecimal longitude) {

        DistanceResponse distance = clinicService.calculateDistance(id, latitude, longitude);
        return ResponseEntity.ok(distance);
    }

    /**
     * GET /api/clinics/admin/pending
     * Get all pending clinics for admin approval
     * ADMIN only
     */
    @GetMapping("/admin/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<ClinicResponse>> getPendingClinics(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") Sort.Direction sortDir) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(sortDir, sortBy));
        Page<ClinicResponse> clinics = clinicService.getPendingClinics(pageable);
        return ResponseEntity.ok(clinics);
    }

    /**
     * GET /api/clinics/admin/pending/count
     * Get count of pending clinics for admin badge
     * ADMIN only
     */
    @GetMapping("/admin/pending/count")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Long> getPendingClinicsCount() {
        return ResponseEntity.ok(clinicService.countPendingClinics());
    }

    /**
     * POST /api/clinics/{id}/approve
     * Approve clinic
     * ADMIN only
     * Request body is optional - can send empty body or {"reason": "optional
     * reason"}
     */
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ClinicResponse> approveClinic(
            @PathVariable UUID id,
            @RequestBody(required = false) ApproveClinicRequest request) {

        String reason = (request != null && request.getReason() != null) ? request.getReason() : null;
        ClinicResponse clinic = clinicService.approveClinic(id, reason);
        return ResponseEntity.ok(clinic);
    }

    /**
     * POST /api/clinics/{id}/reject
     * Reject clinic
     * ADMIN only
     */
    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ClinicResponse> rejectClinic(
            @PathVariable UUID id,
            @Valid @RequestBody RejectClinicRequest request) {

        ClinicResponse clinic = clinicService.rejectClinic(id, request.getReason());
        return ResponseEntity.ok(clinic);
    }

    /**
     * GET /api/clinics/owner/my-clinics
     * Get clinics owned by current user
     * CLINIC_OWNER only
     */
    @GetMapping("/owner/my-clinics")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Page<ClinicResponse>> getMyClinics(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        User currentUser = authService.getCurrentUser();
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<ClinicResponse> clinics = clinicService.getClinicsByOwner(
                currentUser.getUserId(), pageable);
        return ResponseEntity.ok(clinics);
    }

    /**
     * POST /api/clinics/{id}/images
     * Upload image for clinic
     * CLINIC_OWNER can only upload for their own clinic
     */
    @PostMapping(value = "/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicResponse> uploadClinicImage(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String caption,
            @RequestParam(required = false) Integer displayOrder,
            @RequestParam(required = false, defaultValue = "false") Boolean isPrimary) {

        try {
            log.info("Uploading image for clinic: {}, file size: {}, content type: {}",
                    id, file.getSize(), file.getContentType());

            User currentUser = authService.getCurrentUser();

            // Upload file to Cloudinary
            UploadResponse uploadResponse = cloudinaryService.uploadClinicImage(file);
            log.info("File uploaded to Cloudinary: {}", uploadResponse.getUrl());

            // Save image info to database
            ClinicResponse clinic = clinicService.uploadClinicImage(
                    id,
                    uploadResponse.getUrl(),
                    caption,
                    displayOrder,
                    isPrimary,
                    currentUser.getUserId());

            log.info("Clinic image saved successfully for clinic: {}", id);
            return ResponseEntity.status(HttpStatus.CREATED).body(clinic);

        } catch (Exception e) {
            log.error("Error uploading clinic image for clinic: {}", id, e);
            throw e; // Re-throw to let GlobalExceptionHandler handle it
        }
    }

    /**
     * POST /api/clinics/{id}/logo
     * Upload logo for clinic
     * CLINIC_OWNER can only upload for their own clinic
     */
    @PostMapping(value = "/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicResponse> uploadClinicLogo(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file) {

        try {
            log.info("Uploading logo for clinic: {}, file size: {}, content type: {}",
                    id, file.getSize(), file.getContentType());

            User currentUser = authService.getCurrentUser();

            // Upload file to Cloudinary
            UploadResponse uploadResponse = cloudinaryService.uploadClinicImage(file);
            log.info("Logo uploaded to Cloudinary: {}", uploadResponse.getUrl());

            // Update clinic logo
            ClinicResponse clinic = clinicService.updateClinicLogo(id, uploadResponse.getUrl(),
                    currentUser.getUserId());

            log.info("Clinic logo saved successfully for clinic: {}", id);
            return ResponseEntity.ok(clinic);

        } catch (Exception e) {
            log.error("Error uploading clinic logo for clinic: {}", id, e);
            throw e;
        }
    }

    /**
     * DELETE /api/clinics/{id}/images/{imageId}
     * Delete clinic image
     * CLINIC_OWNER can only delete from their own clinic
     */
    @DeleteMapping("/{id}/images/{imageId}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Map<String, String>> deleteClinicImage(
            @PathVariable UUID id,
            @PathVariable UUID imageId) {

        User currentUser = authService.getCurrentUser();
        clinicService.deleteClinicImage(id, imageId, currentUser.getUserId());

        return ResponseEntity.ok(Map.of("message", "Image deleted successfully"));
    }

    /**
     * POST /api/clinics/{id}/images/{imageId}/primary
     * Set an image as primary for the clinic
     * CLINIC_OWNER can only update their own clinic
     */
    @PostMapping("/{id}/images/{imageId}/primary")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicResponse> setPrimaryClinicImage(
            @PathVariable UUID id,
            @PathVariable UUID imageId) {

        User currentUser = authService.getCurrentUser();
        ClinicResponse clinic = clinicService.setPrimaryClinicImage(id, imageId, currentUser.getUserId());
        return ResponseEntity.ok(clinic);
    }

    /**
     * GET /api/clinics/owner/approved
     * Get APPROVED clinics owned by current user
     * CLINIC_OWNER only
     */
    @GetMapping("/owner/approved")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Page<ClinicResponse>> getMyApprovedClinics(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {

        User currentUser = authService.getCurrentUser();
        Pageable pageable = PageRequest.of(page, size);
        Page<ClinicResponse> clinics = clinicService.getClinicsByOwner(currentUser.getUserId(), pageable);
        return ResponseEntity.ok(clinics);
    }
}
