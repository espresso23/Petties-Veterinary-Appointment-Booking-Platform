package com.petties.petties.controller;

import com.petties.petties.dto.staffshift.SlotResponse;
import com.petties.petties.dto.staffshift.StaffShiftRequest;
import com.petties.petties.dto.staffshift.StaffShiftResponse;
import com.petties.petties.service.StaffShiftService;
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
 * REST Controller for StaffShift management
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
public class StaffShiftController {

    private final StaffShiftService staffShiftService;
    private final AuthService authService;

    /**
     * Create a new shift for a staff member
     */
    @PostMapping("/clinics/{clinicId}/shifts")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<List<StaffShiftResponse>> createShift(
            @PathVariable UUID clinicId,
            @Valid @RequestBody StaffShiftRequest request) {
        List<StaffShiftResponse> response = staffShiftService.createShifts(clinicId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Get ALL shifts for a clinic in a date range
     */
    @GetMapping("/clinics/{clinicId}/shifts")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER', 'STAFF')")
    public ResponseEntity<List<StaffShiftResponse>> getShiftsByClinic(
            @PathVariable UUID clinicId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        List<StaffShiftResponse> shifts = staffShiftService.getShiftsByClinic(clinicId, startDate, endDate);
        return ResponseEntity.ok(shifts);
    }

    /**
     * Get shifts for the currently logged-in STAFF
     */
    @GetMapping("/shifts/me")
    @PreAuthorize("hasRole('STAFF')")
    public ResponseEntity<List<StaffShiftResponse>> getMyShifts(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        User currentUser = authService.getCurrentUser();
        List<StaffShiftResponse> shifts = staffShiftService.getShiftsByStaff(currentUser.getUserId(), startDate, endDate);
        return ResponseEntity.ok(shifts);
    }

    /**
     * Get shift detail with slots
     */
    @GetMapping("/shifts/{shiftId}")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER', 'STAFF')")
    public ResponseEntity<StaffShiftResponse> getShiftDetail(@PathVariable UUID shiftId) {
        StaffShiftResponse response = staffShiftService.getShiftDetail(shiftId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/shifts/{shiftId}")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<Void> deleteShift(@PathVariable UUID shiftId) {
        staffShiftService.deleteShift(shiftId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Delete multiple shifts
     */
    @DeleteMapping("/shifts/bulk")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<Void> bulkDeleteShifts(@RequestBody List<UUID> shiftIds) {
        staffShiftService.bulkDeleteShifts(shiftIds);
        return ResponseEntity.noContent().build();
    }

    /**
     * Block a slot
     */
    @PatchMapping("/slots/{slotId}/block")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<SlotResponse> blockSlot(@PathVariable UUID slotId) {
        SlotResponse response = staffShiftService.blockSlot(slotId);
        return ResponseEntity.ok(response);
    }

    /**
     * Unblock a slot
     */
    @PatchMapping("/slots/{slotId}/unblock")
    @PreAuthorize("hasAnyRole('CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<SlotResponse> unblockSlot(@PathVariable UUID slotId) {
        SlotResponse response = staffShiftService.unblockSlot(slotId);
        return ResponseEntity.ok(response);
    }
}
