package com.petties.petties.controller;

import com.petties.petties.dto.clinic.ClinicPriceRequest;
import com.petties.petties.dto.clinic.ClinicPriceResponse;
import com.petties.petties.service.ClinicPriceService;
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

        var updated = clinicPriceService.updatePricing(id, request.getPricePerKm(), request.getSosFee());
        log.info("Successfully updated pricing for clinic {}: pricePerKm={}, sosFee={}",
                id, updated.getPricePerKm(), updated.getSosFee());
        return ResponseEntity.ok(new ClinicPriceResponse(id, updated.getPricePerKm(), updated.getSosFee()));
    }

    // Keep legacy endpoint for backward compatibility if needed, but update it to
    // use the new constructor
    @Deprecated
    @GetMapping("/{id}/price-per-km")
    public ResponseEntity<ClinicPriceResponse> getPricePerKm(@PathVariable UUID id) {
        var pricingOpt = clinicPriceService.getPricing(id);
        return pricingOpt.map(p -> ResponseEntity.ok(new ClinicPriceResponse(id, p.getPricePerKm(), p.getSosFee())))
                .orElseGet(() -> ResponseEntity.ok(new ClinicPriceResponse(id, null, null)));
    }

    @Deprecated
    @PatchMapping("/{id}/price-per-km")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicPriceResponse> updatePricePerKm(
            @PathVariable UUID id,
            @Valid @RequestBody ClinicPriceRequest request) {

        return updatePricing(id, request);
    }

    @Deprecated
    @DeleteMapping("/{id}/price-per-km")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Map<String, String>> deletePricePerKm(@PathVariable UUID id) {
        clinicPriceService.updatePricing(id, null, null);
        return ResponseEntity.ok(Map.of("message", "Đã xóa giá di chuyển theo km"));
    }
}
