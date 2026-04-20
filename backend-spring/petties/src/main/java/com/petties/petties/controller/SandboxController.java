package com.petties.petties.controller;

import com.petties.petties.dto.clinic.ClinicResponse;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.User;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.SandboxService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST controller for Sandbox Workspace management
 *
 * Purpose: Allow Clinic Owners and Clinic Managers to practice with demo data
 * before handling real patient bookings and clinic management
 *
 * Base path: /api/sandbox
 *
 * Features:
 * - Enter sandbox mode for specific feature (clinic_info, services, clinic_services, master_services, scheduling, bookings)
 * - Exit sandbox mode (deletes all mock data)
 * - Get current active sandbox
 *
 * Security:
 * - Only CLINIC_OWNER and CLINIC_MANAGER roles can access
 * - Query scope hardcoding ensures sandboxes never appear in B2C APIs
 */
@RestController
@RequestMapping("/sandbox")
@RequiredArgsConstructor
@Slf4j
public class SandboxController {

    private final SandboxService sandboxService;
    private final AuthService authService;

    /**
     * POST /api/sandbox/enter?feature={featureName}
     * Enter sandbox mode for a specific feature
     *
     * This endpoint creates a new sandbox clinic with pre-seeded mock data
     * appropriate for the specified feature.
     *
    * @param featureName Feature to practice: clinic_info, services, clinic_services, master_services, scheduling, or bookings
     * @return Created sandbox clinic with full details
     *
     * Example:
    * POST /api/sandbox/enter?feature=clinic_services
    * Response: { clinic_id: "...", is_sandbox: true, name: "Sandbox - clinic_services (...)" }
     */
    @PostMapping("/enter")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<ClinicResponse> enterSandboxMode(
            @RequestParam(name = "feature") String featureName) {

        User currentUser = authService.getCurrentUser();
        log.info("User {} ({}) entering sandbox mode for feature: {}", 
                currentUser.getUserId(), currentUser.getFullName(), featureName);

        ClinicResponse response = sandboxService.enterSandboxMode(featureName, currentUser.getUserId());

        return ResponseEntity.ok(response);
    }

    /**
     * DELETE /api/sandbox/exit/{clinicId}
     * Exit sandbox mode and delete all mock data
     *
     * This endpoint deletes the specified sandbox clinic and all associated data:
     * - Bookings
     * - Services
     * - Staff Shifts and Slots
     * - EMR Records (MongoDB)
     *
     * CASCADE DELETE ensures no orphaned data remains.
     *
     * @param clinicId ID of the sandbox clinic to delete
     * @return 204 No Content on success
     *
     * Example:
     * DELETE /api/sandbox/exit/00000000-0000-0000-0000-000000000001
     * Response: 204 No Content
     */
    @DeleteMapping("/exit/{clinicId}")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<Void> exitSandboxMode(
            @PathVariable(name = "clinicId") UUID clinicId) {

        User currentUser = authService.getCurrentUser();
        log.info("User {} ({}) exiting sandbox mode for clinic: {}", 
                currentUser.getUserId(), currentUser.getFullName(), clinicId);

        sandboxService.exitSandboxMode(clinicId, currentUser.getUserId());

        return ResponseEntity.noContent().build();
    }

    /**
     * GET /api/sandbox/current
     * Get the currently active sandbox clinic for the authenticated user
     *
     * Returns the most recently created sandbox clinic that hasn't been deleted yet.
     * Useful for frontend to determine if user is currently in sandbox mode.
     *
     * @return Active sandbox clinic DTO, or 404 if no active sandbox
     *
     * Example:
     * GET /api/sandbox/current
    * Response: { clinic_id: "...", is_sandbox: true, name: "Sandbox - clinic_services (...)" }
     */
    @GetMapping("/current")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<ClinicResponse> getCurrentSandbox() {

        User currentUser = authService.getCurrentUser();
        log.debug("Fetching current sandbox for user: {}", currentUser.getUserId());

        ClinicResponse sandbox = sandboxService.getCurrentSandbox(currentUser.getUserId());

        if (sandbox == null) {
            log.debug("No active sandbox found for user: {}", currentUser.getUserId());
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(sandbox);
    }
}
