package com.petties.petties.controller;

import com.petties.petties.dto.clinic.ClinicPriceRequest;
import com.petties.petties.dto.clinic.ClinicPriceResponse;
import com.petties.petties.service.ClinicPriceService;
import com.petties.petties.service.AuthService;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.model.enums.Role;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/clinics")
@RequiredArgsConstructor
@Slf4j
public class ClinicPriceController {

    private final ClinicPriceService clinicPriceService;
    private final AuthService authService;
    private final ClinicRepository clinicRepository;

    @GetMapping("/{id}/pricing")
    public ResponseEntity<ClinicPriceResponse> getPricing(@PathVariable UUID id) {
        var pricingOpt = clinicPriceService.getPricing(id);
        return pricingOpt.map(p -> ResponseEntity.ok(new ClinicPriceResponse(id, p.getPricePerKm(), p.getSosFee())))
                .orElseGet(() -> ResponseEntity.ok(new ClinicPriceResponse(id, null, null)));
    }

    @PatchMapping("/{id}/pricing")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<ClinicPriceResponse> updatePricing(
            @PathVariable UUID id,
            @Valid @RequestBody ClinicPriceRequest request) {

        log.info("Received pricing update request for clinic {}: pricePerKm={}, sosFee={}",
                id, request.getPricePerKm(), request.getSosFee());

        var currentUser = authService.getCurrentUser();
        if (currentUser == null || currentUser.getRole() == null) {
            log.warn("Unauthorized access attempt: No current user or role found");
            return ResponseEntity.status(401).body(null);
        }

        // Check permissions based on role
        boolean isOwner = Role.CLINIC_OWNER.equals(currentUser.getRole());
        boolean isManager = Role.CLINIC_MANAGER.equals(currentUser.getRole());

        if (isOwner) {
            // Owner must own the clinic
            if (!clinicRepository.existsByClinicIdAndOwnerUserId(id, currentUser.getUserId())) {
                return ResponseEntity.status(403).body(null);
            }
        } else if (isManager) {
            // Manager can only update their working clinic
            if (currentUser.getWorkingClinic() == null || !currentUser.getWorkingClinic().getClinicId().equals(id)) {
                return ResponseEntity.status(403).body(null);
            }
            // Manager can update both pricePerKm and sosFee for their working clinic
        } else {
            return ResponseEntity.status(403).body(null);
        }

        try {
            var updated = clinicPriceService.updatePricing(id, request.getPricePerKm(), request.getSosFee());
            log.info("Successfully updated pricing for clinic {}: pricePerKm={}, sosFee={}",
                    id, updated.getPricePerKm(), updated.getSosFee());
            return ResponseEntity.ok(new ClinicPriceResponse(id, updated.getPricePerKm(), updated.getSosFee()));
        } catch (IllegalArgumentException iae) {
            log.warn("Clinic not found when updating pricing: {}", id, iae);
            return ResponseEntity.status(404).body(null);
        } catch (Exception ex) {
            log.error("Failed to update pricing for clinic {}", id, ex);
            return ResponseEntity.status(500).body(null);
        }
    }

    // Keep legacy endpoint for backward compatibility if needed, but update it to
    // use the new constructor
    @GetMapping("/{id}/price-per-km")
    public ResponseEntity<ClinicPriceResponse> getPricePerKm(@PathVariable UUID id) {
        var pricingOpt = clinicPriceService.getPricing(id);
        return pricingOpt.map(p -> ResponseEntity.ok(new ClinicPriceResponse(id, p.getPricePerKm(), p.getSosFee())))
                .orElseGet(() -> ResponseEntity.ok(new ClinicPriceResponse(id, null, null)));
    }

    @PatchMapping("/{id}/price-per-km")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicPriceResponse> updatePricePerKm(
            @PathVariable UUID id,
            @Valid @RequestBody ClinicPriceRequest request) {

        return updatePricing(id, request);
    }

    @DeleteMapping("/{id}/price-per-km")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Map<String, String>> deletePricePerKm(@PathVariable UUID id) {
        var currentUser = authService.getCurrentUser();
        if (currentUser == null || currentUser.getRole() == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        }
        if (!clinicRepository.existsByClinicIdAndOwnerUserId(id, currentUser.getUserId())) {
            return ResponseEntity.status(403).body(Map.of("message", "Forbidden"));
        }
        clinicPriceService.upsertPricePerKm(id, null);
        return ResponseEntity.ok(Map.of("message", "Price per km removed"));
    }
}
