package com.petties.petties.controller;

import com.petties.petties.dto.vetshift.SlotResponse;
import com.petties.petties.dto.vetshift.VetShiftRequest;
import com.petties.petties.dto.vetshift.VetShiftResponse;
import com.petties.petties.service.VetShiftService;
import com.petties.petties.service.AuthService;
import com.petties.petties.model.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * REST Controller for VetShift management
 * 
 * Endpoints:
 * - POST /api/clinics/{clinicId}/shifts - Create shift
 * - GET /api/clinics/{clinicId}/shifts - Get shifts by date range
 * - GET /api/shifts/{shiftId} - Get shift detail
 * - DELETE /api/shifts/{shiftId} - Delete shift
 * - PATCH /api/slots/{slotId}/block - Block slot
 * - PATCH /api/slots/{slotId}/unblock - Unblock slot
 */
@RestController
@RequiredArgsConstructor
public class VetShiftController {

    private final VetShiftService vetShiftService;
    private final AuthService authService;

    /**
     * Create a new shift for a vet
     */
    @PostMapping("/clinics/{clinicId}/shifts")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<List<VetShiftResponse>> createShift(
            @PathVariable UUID clinicId,
            @Valid @RequestBody VetShiftRequest request) {
        List<VetShiftResponse> response = vetShiftService.createShifts(clinicId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Get ALL shifts for a clinic in a date range
     */
    @GetMapping("/clinics/{clinicId}/shifts")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER', 'VET')")
    public ResponseEntity<List<VetShiftResponse>> getShiftsByClinic(
            @PathVariable UUID clinicId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<VetShiftResponse> shifts = vetShiftService.getShiftsByClinic(clinicId, startDate, endDate);
        return ResponseEntity.ok(shifts);
    }

    /**
     * Get shifts for the currently logged-in VET
     */
    @GetMapping("/shifts/me")
    @PreAuthorize("hasRole('VET')")
    public ResponseEntity<List<VetShiftResponse>> getMyShifts(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        User currentUser = authService.getCurrentUser();
        List<VetShiftResponse> shifts = vetShiftService.getShiftsByVet(currentUser.getUserId(), startDate, endDate);
        return ResponseEntity.ok(shifts);
    }

    /**
     * Get shift detail with slots
     */
    @GetMapping("/shifts/{shiftId}")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER', 'VET')")
    public ResponseEntity<VetShiftResponse> getShiftDetail(@PathVariable UUID shiftId) {
        VetShiftResponse response = vetShiftService.getShiftDetail(shiftId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/shifts/{shiftId}")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<Void> deleteShift(@PathVariable UUID shiftId) {
        vetShiftService.deleteShift(shiftId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Delete multiple shifts
     */
    @DeleteMapping("/shifts/bulk")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<Void> bulkDeleteShifts(@RequestBody List<UUID> shiftIds) {
        vetShiftService.bulkDeleteShifts(shiftIds);
        return ResponseEntity.noContent().build();
    }

    /**
     * Block a slot
     */
    @PatchMapping("/slots/{slotId}/block")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<SlotResponse> blockSlot(@PathVariable UUID slotId) {
        SlotResponse response = vetShiftService.blockSlot(slotId);
        return ResponseEntity.ok(response);
    }

    /**
     * Unblock a slot
     */
    @PatchMapping("/slots/{slotId}/unblock")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<SlotResponse> unblockSlot(@PathVariable UUID slotId) {
        SlotResponse response = vetShiftService.unblockSlot(slotId);
        return ResponseEntity.ok(response);
    }
}
