package com.petties.petties.controller;

import com.petties.petties.dto.pet.PetRequest;
import com.petties.petties.dto.pet.PetResponse;
import com.petties.petties.service.PetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/pets")
@RequiredArgsConstructor
public class PetController {

    private final PetService petService;

    @GetMapping
    public ResponseEntity<Page<PetResponse>> getPets(
            @RequestParam(required = false) String species,
            @RequestParam(required = false) String breed,
            Pageable pageable) {
        return ResponseEntity.ok(petService.getPets(species, breed, pageable));
    }

    @GetMapping("/me")
    public ResponseEntity<List<PetResponse>> getMyPets() {
        return ResponseEntity.ok(petService.getMyPets());
    }

    @GetMapping("/vet")
    public ResponseEntity<List<com.petties.petties.dto.pet.VetPatientDTO>> getVetPatients(
            @RequestParam UUID clinicId,
            @RequestParam UUID vetId) {
        return ResponseEntity.ok(petService.getPatientsForVet(clinicId, vetId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PetResponse> getPet(@PathVariable UUID id) {
        return ResponseEntity.ok(petService.getPet(id));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PetResponse> createPet(
            @ModelAttribute @Valid PetRequest request,
            @RequestPart(value = "image", required = false) MultipartFile image) {
        return ResponseEntity.ok(petService.createPet(request, image));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PetResponse> updatePet(
            @PathVariable UUID id,
            @ModelAttribute @Valid PetRequest request,
            @RequestPart(value = "image", required = false) MultipartFile image) {
        return ResponseEntity.ok(petService.updatePet(id, request, image));
    }

    /**
     * VET can update only allergies field
     */
    @PatchMapping("/{id}/allergies")
    public ResponseEntity<PetResponse> updateAllergies(
            @PathVariable UUID id,
            @RequestBody java.util.Map<String, String> body) {
        String allergies = body.get("allergies");
        return ResponseEntity.ok(petService.updateAllergies(id, allergies));
    }

    /**
     * VET can update pet weight
     */
    @PatchMapping("/{id}/weight")
    public ResponseEntity<PetResponse> updateWeight(
            @PathVariable UUID id,
            @RequestBody java.util.Map<String, Double> body) {
        Double weight = body.get("weight");
        return ResponseEntity.ok(petService.updateWeight(id, weight));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePet(@PathVariable UUID id) {
        petService.deletePet(id);
        return ResponseEntity.noContent().build();
    }
}
