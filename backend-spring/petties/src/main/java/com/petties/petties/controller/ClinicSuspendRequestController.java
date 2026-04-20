package com.petties.petties.controller;

import com.petties.petties.dto.clinic.ClinicSuspendRequestCreateRequest;
import com.petties.petties.dto.clinic.ClinicSuspendRequestResponse;
import com.petties.petties.dto.clinic.ClinicSuspendRequestReviewRequest;
import com.petties.petties.model.enums.ClinicSuspendRequestStatus;
import com.petties.petties.service.ClinicSuspendRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/clinics/suspend-requests")
@RequiredArgsConstructor
public class ClinicSuspendRequestController {

    private final ClinicSuspendRequestService suspendRequestService;

    @PostMapping
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<ClinicSuspendRequestResponse> create(@Valid @RequestBody ClinicSuspendRequestCreateRequest request) {
        return ResponseEntity.ok(suspendRequestService.create(request));
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<List<ClinicSuspendRequestResponse>> getMyRequests() {
        return ResponseEntity.ok(suspendRequestService.getMyRequests());
    }

    @GetMapping("/admin/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<ClinicSuspendRequestResponse>> getPending(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(suspendRequestService.getPendingForAdmin(pageable));
    }

    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<ClinicSuspendRequestResponse>> getAll(
            @RequestParam(required = false) ClinicSuspendRequestStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(suspendRequestService.getAllForAdmin(status, pageable));
    }

    @PutMapping("/{id}/review")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ClinicSuspendRequestResponse> review(
            @PathVariable UUID id,
            @Valid @RequestBody ClinicSuspendRequestReviewRequest request) {
        return ResponseEntity.ok(suspendRequestService.review(id, request));
    }

    @PostMapping("/admin/{clinicId}/activate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ClinicSuspendRequestResponse> activate(@PathVariable UUID clinicId) {
        return ResponseEntity.ok(suspendRequestService.activateClinic(clinicId));
    }
}