package com.petties.petties.controller;

import com.petties.petties.dto.clinic.ClinicPriceRequest;
import com.petties.petties.dto.clinic.ClinicPriceResponse;
import com.petties.petties.service.ClinicPriceService;
import com.petties.petties.service.AuthService;
import com.petties.petties.repository.ClinicRepository;
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

    @GetMapping("/{id}/price-per-km")
    public ResponseEntity<ClinicPriceResponse> getPricePerKm(@PathVariable UUID id) {
        var priceOpt = clinicPriceService.getPricePerKm(id);
        return ResponseEntity.ok(new ClinicPriceResponse(id, priceOpt.orElse(null)));
    }

    @PatchMapping("/{id}/price-per-km")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
        public ResponseEntity<ClinicPriceResponse> updatePricePerKm(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) ClinicPriceRequest request) {

        var currentUser = authService.getCurrentUser();
        // verify ownership
        if (!clinicRepository.existsByClinicIdAndOwnerUserId(id, currentUser.getUserId())) {
            return ResponseEntity.status(403).body(null);
        }

        try {
            if (request == null) {
                log.warn("Empty request body for updatePricePerKm for clinic {}", id);
                return ResponseEntity.badRequest().body(null);
            }
            var updated = clinicPriceService.upsertPricePerKm(id, request.getPricePerKm());
            return ResponseEntity.ok(new ClinicPriceResponse(id, updated));
        } catch (IllegalArgumentException iae) {
            log.warn("Clinic not found when updating price per km: {}", id, iae);
            return ResponseEntity.status(404).body(null);
        } catch (Exception ex) {
            log.error("Failed to update price per km for clinic {}", id, ex);
            return ResponseEntity.status(500).body(null);
        }
    }

    @DeleteMapping("/{id}/price-per-km")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Map<String, String>> deletePricePerKm(@PathVariable UUID id) {
        var currentUser = authService.getCurrentUser();
        if (!clinicRepository.existsByClinicIdAndOwnerUserId(id, currentUser.getUserId())) {
            return ResponseEntity.status(403).body(Map.of("message", "Forbidden"));
        }
        clinicPriceService.upsertPricePerKm(id, null);
        return ResponseEntity.ok(Map.of("message", "Price per km removed"));
    }
}
