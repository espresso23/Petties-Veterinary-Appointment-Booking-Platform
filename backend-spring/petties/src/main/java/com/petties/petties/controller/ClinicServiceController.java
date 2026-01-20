package com.petties.petties.controller;

import com.petties.petties.dto.clinicService.ClinicServiceRequest;
import com.petties.petties.dto.clinicService.ClinicServiceResponse;
import com.petties.petties.dto.clinicService.ClinicServiceUpdateRequest;
import com.petties.petties.service.ClinicServiceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/services")
@RequiredArgsConstructor
public class ClinicServiceController {

    private final ClinicServiceService serviceService;

    /**
     * Create a new service
     * POST /api/services
     */
    @PostMapping
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicServiceResponse> createService(@Valid @RequestBody ClinicServiceRequest request) {
        ClinicServiceResponse response = serviceService.createService(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    /**
     * Get all services for the clinic
     * GET /api/services
     */
    @GetMapping
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<List<ClinicServiceResponse>> getAllServices() {
        List<ClinicServiceResponse> services = serviceService.getAllServices();
        return ResponseEntity.ok(services);
    }

    /**
     * Get a service by ID
     * GET /api/services/{serviceId}
     */
    @GetMapping("/{serviceId}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicServiceResponse> getServiceById(@PathVariable UUID serviceId) {
        ClinicServiceResponse service = serviceService.getServiceById(serviceId);
        return ResponseEntity.ok(service);
    }

    /**
     * Update a service
     * PUT /api/services/{serviceId}
     */
    @PutMapping("/{serviceId}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicServiceResponse> updateService(
            @PathVariable UUID serviceId,
            @Valid @RequestBody ClinicServiceUpdateRequest request) {
        ClinicServiceResponse response = serviceService.updateService(serviceId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Delete a service
     * DELETE /api/services/{serviceId}
     */
    @DeleteMapping("/{serviceId}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Void> deleteService(
            @PathVariable UUID serviceId,
            @RequestParam(required = false) UUID clinicId) {
        serviceService.deleteService(serviceId, clinicId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Update service active status
     * PATCH /api/services/{serviceId}/status
     */
    @PatchMapping("/{serviceId}/status")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicServiceResponse> updateServiceStatus(
            @PathVariable UUID serviceId,
            @RequestParam Boolean isActive) {
        ClinicServiceResponse response = serviceService.updateServiceStatus(serviceId, isActive);
        return ResponseEntity.ok(response);
    }

    /**
     * Update home visit status
     * PATCH /api/services/{serviceId}/home-visit
     */
    @PatchMapping("/{serviceId}/home-visit")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicServiceResponse> updateHomeVisitStatus(
            @PathVariable UUID serviceId,
            @RequestParam Boolean isHomeVisit) {
        ClinicServiceResponse response = serviceService.updateHomeVisitStatus(serviceId, isHomeVisit);
        return ResponseEntity.ok(response);
    }

    /**
     * Update price per km
     * PATCH /api/services/{serviceId}/price-per-km
     */
    @PatchMapping("/{serviceId}/price-per-km")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicServiceResponse> updatePricePerKm(
            @PathVariable UUID serviceId,
            @RequestParam BigDecimal pricePerKm) {
        ClinicServiceResponse response = serviceService.updatePricePerKm(serviceId, pricePerKm);
        return ResponseEntity.ok(response);
    }

    /**
     * Update price per km for all home visit services
     * PATCH /api/services/bulk/price-per-km
     */
    @PatchMapping("/bulk/price-per-km")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Void> updateBulkPricePerKm(@RequestParam BigDecimal pricePerKm) {
        serviceService.updateBulkPricePerKm(pricePerKm);
        return ResponseEntity.ok().build();
    }

    /**
     * NEW: Inherit service from Master Service
     * POST /api/services/inherit/{masterServiceId}
     * Body: { "clinicId": "uuid" (optional), "clinicPrice": 100000 (optional),
     * "clinicPricePerKm": 5000 (optional) }
     */
    @PostMapping("/inherit/{masterServiceId}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicServiceResponse> inheritFromMasterService(
            @PathVariable UUID masterServiceId,
            @RequestParam(required = false) UUID clinicId,
            @RequestParam(required = false) BigDecimal clinicPrice,
            @RequestParam(required = false) BigDecimal clinicPricePerKm) {
        ClinicServiceResponse response = serviceService.inheritFromMasterService(masterServiceId, clinicId, clinicPrice,
                clinicPricePerKm);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    /**
     * NEW: Get all services for a specific clinic
     * GET /api/services/by-clinic/{clinicId}
     * Allows both CLINIC_OWNER and CLINIC_MANAGER to view services
     */
    @GetMapping("/by-clinic/{clinicId}")
    @PreAuthorize("permitAll()")
    public ResponseEntity<List<ClinicServiceResponse>> getServicesByClinicId(@PathVariable UUID clinicId) {
        List<ClinicServiceResponse> services = serviceService.getServicesByClinicId(clinicId);
        return ResponseEntity.ok(services);
    }
}
