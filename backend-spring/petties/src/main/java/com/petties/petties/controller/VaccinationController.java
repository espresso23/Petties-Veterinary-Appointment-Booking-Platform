package com.petties.petties.controller;

import com.petties.petties.dto.vaccination.CreateVaccinationRequest;
import com.petties.petties.dto.vaccination.VaccinationResponse;
import com.petties.petties.model.User;
import com.petties.petties.service.VaccinationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/vaccinations")
@RequiredArgsConstructor
public class VaccinationController {

    private final VaccinationService vaccinationService;

    @PostMapping
    public ResponseEntity<VaccinationResponse> createVaccination(
            @Valid @RequestBody CreateVaccinationRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(vaccinationService.createVaccination(request, user.getUserId()));
    }

    @GetMapping("/pet/{petId}")
    public ResponseEntity<List<VaccinationResponse>> getVaccinationsByPet(@PathVariable UUID petId) {
        return ResponseEntity.ok(vaccinationService.getVaccinationsByPet(petId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteVaccination(@PathVariable String id) {
        vaccinationService.deleteVaccination(id);
        return ResponseEntity.noContent().build();
    }
}
