package com.petties.petties.controller;

import com.petties.petties.dto.clinic.InviteByEmailRequest;
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
     * Invite staff by email - Staff can login with Google
     * Creates user if not exists, assigns clinic and specialty
     * FullName and Avatar will be auto-filled from Google profile
     */
    @PostMapping("/invite-by-email")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<String> inviteByEmail(
            @PathVariable UUID clinicId,
            @Valid @RequestBody InviteByEmailRequest request) {
        staffService.inviteByEmail(clinicId, request);
        return ResponseEntity.ok("Staff invited successfully");
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

    /**
     * Update staff specialty (VET only)
     */
    @PatchMapping("/{userId}/specialty")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<String> updateStaffSpecialty(
            @PathVariable UUID clinicId,
            @PathVariable UUID userId,
            @RequestBody java.util.Map<String, String> body) {
        String specialty = body.get("specialty");
        staffService.updateStaffSpecialty(clinicId, userId, specialty);
        return ResponseEntity.ok("Staff specialty updated successfully");
    }
}
