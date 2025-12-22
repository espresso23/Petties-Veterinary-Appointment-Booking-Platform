package com.petties.petties.controller;

import com.petties.petties.dto.service.ServiceRequest;
import com.petties.petties.dto.service.ServiceResponse;
import com.petties.petties.dto.service.ServiceUpdateRequest;
import com.petties.petties.service.ServiceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/services")
@RequiredArgsConstructor
public class ServiceController {

    private final ServiceService serviceService;

    /**
     * Create a new service
     * POST /api/services
     */
    @PostMapping
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ServiceResponse> createService(@Valid @RequestBody ServiceRequest request) {
        ServiceResponse response = serviceService.createService(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    /**
     * Get all services for the clinic
     * GET /api/services
     */
    @GetMapping
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<List<ServiceResponse>> getAllServices() {
        List<ServiceResponse> services = serviceService.getAllServices();
        return ResponseEntity.ok(services);
    }

    /**
     * Get a service by ID
     * GET /api/services/{serviceId}
     */
    @GetMapping("/{serviceId}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ServiceResponse> getServiceById(@PathVariable UUID serviceId) {
        ServiceResponse service = serviceService.getServiceById(serviceId);
        return ResponseEntity.ok(service);
    }

    /**
     * Update a service
     * PUT /api/services/{serviceId}
     */
    @PutMapping("/{serviceId}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ServiceResponse> updateService(
            @PathVariable UUID serviceId,
            @Valid @RequestBody ServiceUpdateRequest request) {
        ServiceResponse response = serviceService.updateService(serviceId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Delete a service
     * DELETE /api/services/{serviceId}
     */
    @DeleteMapping("/{serviceId}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Void> deleteService(@PathVariable UUID serviceId) {
        serviceService.deleteService(serviceId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Update service active status
     * PATCH /api/services/{serviceId}/status
     */
    @PatchMapping("/{serviceId}/status")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ServiceResponse> updateServiceStatus(
            @PathVariable UUID serviceId,
            @RequestParam Boolean isActive) {
        ServiceResponse response = serviceService.updateServiceStatus(serviceId, isActive);
        return ResponseEntity.ok(response);
    }

    /**
     * Update home visit status
     * PATCH /api/services/{serviceId}/home-visit
     */
    @PatchMapping("/{serviceId}/home-visit")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ServiceResponse> updateHomeVisitStatus(
            @PathVariable UUID serviceId,
            @RequestParam Boolean isHomeVisit) {
        ServiceResponse response = serviceService.updateHomeVisitStatus(serviceId, isHomeVisit);
        return ResponseEntity.ok(response);
    }

    /**
     * Update price per km
     * PATCH /api/services/{serviceId}/price-per-km
     */
    @PatchMapping("/{serviceId}/price-per-km")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ServiceResponse> updatePricePerKm(
            @PathVariable UUID serviceId,
            @RequestParam String pricePerKm) {
        ServiceResponse response = serviceService.updatePricePerKm(serviceId, pricePerKm);
        return ResponseEntity.ok(response);
    }

    /**
     * Update price per km for all home visit services
     * PATCH /api/services/bulk/price-per-km
     */
    @PatchMapping("/bulk/price-per-km")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Void> updateBulkPricePerKm(@RequestParam String pricePerKm) {
        serviceService.updateBulkPricePerKm(pricePerKm);
        return ResponseEntity.ok().build();
    }
}

