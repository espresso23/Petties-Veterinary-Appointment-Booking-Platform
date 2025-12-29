package com.petties.petties.controller;

import com.petties.petties.dto.masterService.MasterServiceRequest;
import com.petties.petties.dto.masterService.MasterServiceResponse;
import com.petties.petties.dto.masterService.MasterServiceUpdateRequest;
import com.petties.petties.service.MasterServiceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/master-services")
@RequiredArgsConstructor
public class MasterServiceController {

    private final MasterServiceService masterServiceService;

    /**
     * Create a new master service
     * POST /api/master-services
     */
    @PostMapping
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<MasterServiceResponse> createMasterService(
            @Valid @RequestBody MasterServiceRequest request) {
        MasterServiceResponse response = masterServiceService.createMasterService(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    /**
     * Get all master services
     * GET /api/master-services
     */
    @GetMapping
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<List<MasterServiceResponse>> getAllMasterServices() {
        List<MasterServiceResponse> services = masterServiceService.getAllMasterServices();
        return ResponseEntity.ok(services);
    }

    /**
     * Get a master service by ID
     * GET /api/master-services/{masterServiceId}
     */
    @GetMapping("/{masterServiceId}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<MasterServiceResponse> getMasterServiceById(
            @PathVariable UUID masterServiceId) {
        MasterServiceResponse service = masterServiceService.getMasterServiceById(masterServiceId);
        return ResponseEntity.ok(service);
    }

    /**
     * Update a master service
     * PUT /api/master-services/{masterServiceId}
     */
    @PutMapping("/{masterServiceId}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<MasterServiceResponse> updateMasterService(
            @PathVariable UUID masterServiceId,
            @Valid @RequestBody MasterServiceUpdateRequest request) {
        MasterServiceResponse response = masterServiceService.updateMasterService(masterServiceId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Delete a master service
     * DELETE /api/master-services/{masterServiceId}
     */
    @DeleteMapping("/{masterServiceId}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Void> deleteMasterService(@PathVariable UUID masterServiceId) {
        masterServiceService.deleteMasterService(masterServiceId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Search master services by name
     * GET /api/master-services/search?name=xxx
     */
    @GetMapping("/search")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<List<MasterServiceResponse>> searchMasterServices(
            @RequestParam String name) {
        List<MasterServiceResponse> services = masterServiceService.searchMasterServicesByName(name);
        return ResponseEntity.ok(services);
    }

    /**
     * Get master services by category
     * GET /api/master-services/category/{category}
     */
    @GetMapping("/category/{category}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<List<MasterServiceResponse>> getMasterServicesByCategory(
            @PathVariable String category) {
        List<MasterServiceResponse> services = masterServiceService.getMasterServicesByCategory(category);
        return ResponseEntity.ok(services);
    }

    /**
     * Get master services by pet type
     * GET /api/master-services/pet-type/{petType}
     */
    @GetMapping("/pet-type/{petType}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<List<MasterServiceResponse>> getMasterServicesByPetType(
            @PathVariable String petType) {
        List<MasterServiceResponse> services = masterServiceService.getMasterServicesByPetType(petType);
        return ResponseEntity.ok(services);
    }
}
