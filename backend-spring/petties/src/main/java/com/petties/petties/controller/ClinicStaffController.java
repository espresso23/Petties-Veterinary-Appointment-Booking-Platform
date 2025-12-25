package com.petties.petties.controller;

import com.petties.petties.dto.clinic.QuickAddStaffRequest;
import com.petties.petties.dto.clinic.StaffResponse;
import com.petties.petties.service.ClinicStaffService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/clinics/{clinicId}/staff")
@RequiredArgsConstructor
public class ClinicStaffController {

    private final ClinicStaffService staffService;

    @GetMapping
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER', 'ADMIN')")
    public ResponseEntity<List<StaffResponse>> getStaff(@PathVariable UUID clinicId) {
        return ResponseEntity.ok(staffService.getClinicStaff(clinicId));
    }

    /**
     * Check if clinic already has a manager
     */
    @GetMapping("/has-manager")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER', 'ADMIN')")
    public ResponseEntity<Boolean> hasManager(@PathVariable UUID clinicId) {
        return ResponseEntity.ok(staffService.hasManager(clinicId));
    }

    /**
     * Quick add a new staff member (creates account and assigns to clinic)
     */
    @PostMapping("/quick-add")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<String> quickAddStaff(
            @PathVariable UUID clinicId,
            @Valid @RequestBody QuickAddStaffRequest request) {
        staffService.quickAddStaff(clinicId, request);
        return ResponseEntity.ok("Staff account created and assigned successfully");
    }

    /**
     * Only Clinic Owner can assign a Manager to the clinic
     */
    @PostMapping("/manager/{usernameOrEmail}")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<String> assignManager(
            @PathVariable UUID clinicId,
            @PathVariable String usernameOrEmail) {
        staffService.assignManager(clinicId, usernameOrEmail);
        return ResponseEntity.ok("Clinic Manager assigned successfully");
    }

    /**
     * Both Clinic Owner and Clinic Manager can assign Vets
     */
    @PostMapping("/vet/{usernameOrEmail}")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<String> assignVet(
            @PathVariable UUID clinicId,
            @PathVariable String usernameOrEmail) {
        staffService.assignVet(clinicId, usernameOrEmail);
        return ResponseEntity.ok("Vet assigned successfully");
    }

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<String> removeStaff(
            @PathVariable UUID clinicId,
            @PathVariable UUID userId) {
        staffService.removeStaff(clinicId, userId);
        return ResponseEntity.ok("Staff removed successfully");
    }
}
