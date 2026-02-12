package com.petties.petties.controller;

import com.petties.petties.dto.vaccination.CreateVaccinationRequest;
import com.petties.petties.dto.vaccination.VaccinationResponse;
import com.petties.petties.model.User;
import com.petties.petties.service.VaccinationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/vaccinations")
@Slf4j // Add Slf4j annotation
public class VaccinationController {

    public VaccinationController(VaccinationService vaccinationService) {
        this.vaccinationService = vaccinationService;
        log.info("DEBUG: VaccinationController BEAN CREATED");
    }

    private final VaccinationService vaccinationService;

    @PostMapping
    public ResponseEntity<VaccinationResponse> createVaccination(
            @Valid @RequestBody CreateVaccinationRequest request,
            @AuthenticationPrincipal org.springframework.security.core.userdetails.UserDetails userDetails) {

        UUID staffId = null;
        if (userDetails instanceof com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) {
            staffId = ((com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails).getUserId();
        } else {
            throw new RuntimeException("Unexpected principal type: " + userDetails.getClass());
        }

        return ResponseEntity.ok(vaccinationService.createVaccination(request, staffId));
    }

    @GetMapping("/pet/{petId}")
    public ResponseEntity<List<VaccinationResponse>> getVaccinationsByPet(@PathVariable UUID petId) {
        log.info("DEBUG: Entering getVaccinationsByPet with ID: {}", petId);
        try {
            return ResponseEntity.ok(vaccinationService.getVaccinationsByPet(petId));
        } catch (Exception e) {
            log.error("DEBUG: Error in getVaccinationsByPet: ", e);
            throw e;
        }
    }

    @GetMapping("/pet/{petId}/upcoming")
    public ResponseEntity<List<VaccinationResponse>> getUpcomingVaccinations(@PathVariable UUID petId) {
        return ResponseEntity.ok(vaccinationService.getUpcomingVaccinations(petId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<VaccinationResponse> updateVaccination(
            @PathVariable String id,
            @Valid @RequestBody CreateVaccinationRequest request,
            @AuthenticationPrincipal org.springframework.security.core.userdetails.UserDetails userDetails) {

        UUID staffId = null;
        if (userDetails instanceof com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) {
            staffId = ((com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails).getUserId();
        }

        return ResponseEntity.ok(vaccinationService.updateVaccination(id, request, staffId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteVaccination(@PathVariable String id) {
        vaccinationService.deleteVaccination(id);
        return ResponseEntity.noContent().build();
    }
}
