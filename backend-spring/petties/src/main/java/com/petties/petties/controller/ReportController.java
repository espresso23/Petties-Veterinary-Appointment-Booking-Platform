package com.petties.petties.controller;

import com.petties.petties.dto.report.ReportRequest;
import com.petties.petties.dto.report.ReportResponse;
import com.petties.petties.dto.report.ResolveReportRequest;
import com.petties.petties.model.enums.ReportStatus;
import com.petties.petties.service.ReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Slf4j
public class ReportController {

    private final ReportService reportService;

    @PostMapping("/reports")
    @PreAuthorize("hasAnyRole('PET_OWNER', 'CLINIC_OWNER', 'CLINIC_MANAGER', 'STAFF')")
    public ResponseEntity<ReportResponse> createReport(
            @Valid @RequestBody ReportRequest request,
            Authentication authentication) {
        
        UUID reporterId = UUID.fromString(authentication.getName());
        ReportResponse response = reportService.createReport(request, reporterId);
        
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/reports/my")
    @PreAuthorize("hasAnyRole('PET_OWNER', 'CLINIC_OWNER', 'CLINIC_MANAGER', 'STAFF')")
    public ResponseEntity<Page<ReportResponse>> getMyReports(
            @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            Authentication authentication) {
        
        UUID reporterId = UUID.fromString(authentication.getName());
        Page<ReportResponse> reports = reportService.getMyReports(reporterId, pageable);
        
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/reports/clinics/{clinicId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CLINIC_OWNER', 'CLINIC_MANAGER')")
    public ResponseEntity<Page<ReportResponse>> getClinicReports(
            @PathVariable UUID clinicId,
            @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        
        Page<ReportResponse> reports = reportService.getClinicReports(clinicId, pageable);
        
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/admin/reports")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<ReportResponse>> getAllReports(
            @RequestParam(required = false) ReportStatus status,
            @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        
        Page<ReportResponse> reports = reportService.getReports(status, pageable);
        
        return ResponseEntity.ok(reports);
    }

    @PutMapping("/admin/reports/{reportId}/resolve")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<ReportResponse> resolveReport(
            @PathVariable UUID reportId,
            @Valid @RequestBody ResolveReportRequest request,
            Authentication authentication) {
        
        UUID adminId = UUID.fromString(authentication.getName());
        ReportResponse response = reportService.resolveReport(reportId, request, adminId);
        
        return ResponseEntity.ok(response);
    }
}
