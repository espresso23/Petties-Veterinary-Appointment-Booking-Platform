package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal;
import com.petties.petties.dto.report.ReportResponse;
import com.petties.petties.dto.report.ResolveReportRequest;
import com.petties.petties.exception.BadRequestException;
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
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

/**
 * Reports API (no /v1 prefix; base path is /api from server context).
 * Create/update: multipart/form-data — BE uploads images to Cloudinary (folder {@code reports}).
 */
@RestController
@RequiredArgsConstructor
@Slf4j
public class ReportController {

    private final ReportService reportService;
    private final ObjectMapper objectMapper;

    @PostMapping(value = "/reports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('PET_OWNER', 'CLINIC_OWNER', 'CLINIC_MANAGER', 'STAFF')")
    public ResponseEntity<ReportResponse> createReport(
            @RequestParam("bookingId") UUID bookingId,
            @RequestParam("reason") String reason,
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @AuthenticationPrincipal UserDetails userDetails) {

        UserPrincipal userPrincipal = (UserPrincipal) userDetails;
        log.debug("createReport: bookingId={}, reporterId={}, reasonLength={}",
                bookingId, userPrincipal.getUserId(), reason != null ? reason.length() : 0);
        ReportResponse response = reportService.createReport(bookingId, reason, files, userPrincipal.getUserId());
        log.debug("createReport: success, reportId={}", response.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Cập nhật báo cáo (multipart). Ưu tiên dùng {@code POST .../update}: một số client/proxy không gửi đúng body với {@code PUT} + multipart.
     */
    @PostMapping(value = "/reports/{reportId}/update", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('PET_OWNER', 'CLINIC_OWNER', 'CLINIC_MANAGER', 'STAFF')")
    public ResponseEntity<ReportResponse> updateMyReportPost(
            @PathVariable UUID reportId,
            @RequestParam("reason") String reason,
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @RequestParam(value = "existingAttachmentUrlsJson", required = false) String existingAttachmentUrlsJson,
            @AuthenticationPrincipal UserDetails userDetails) {
        return doUpdateMyReport(reportId, reason, files, existingAttachmentUrlsJson, userDetails);
    }

    @PutMapping(value = "/reports/{reportId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('PET_OWNER', 'CLINIC_OWNER', 'CLINIC_MANAGER', 'STAFF')")
    public ResponseEntity<ReportResponse> updateMyReportPut(
            @PathVariable UUID reportId,
            @RequestParam("reason") String reason,
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @RequestParam(value = "existingAttachmentUrlsJson", required = false) String existingAttachmentUrlsJson,
            @AuthenticationPrincipal UserDetails userDetails) {
        return doUpdateMyReport(reportId, reason, files, existingAttachmentUrlsJson, userDetails);
    }

    private ResponseEntity<ReportResponse> doUpdateMyReport(
            UUID reportId,
            String reason,
            List<MultipartFile> files,
            String existingAttachmentUrlsJson,
            UserDetails userDetails) {
        UserPrincipal userPrincipal = (UserPrincipal) userDetails;
        List<String> keptUrls = parseExistingAttachmentUrlsJson(existingAttachmentUrlsJson);
        return ResponseEntity.ok(
                reportService.updateMyReport(reportId, reason, files, keptUrls, userPrincipal.getUserId()));
    }

    private List<String> parseExistingAttachmentUrlsJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(
                    json,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
        } catch (Exception e) {
            throw new BadRequestException("Danh sách ảnh giữ lại không hợp lệ");
        }
    }

    @DeleteMapping("/reports/{reportId}")
    @PreAuthorize("hasAnyRole('PET_OWNER', 'CLINIC_OWNER', 'CLINIC_MANAGER', 'STAFF')")
    public ResponseEntity<ReportResponse> withdrawMyReport(
            @PathVariable UUID reportId,
            @AuthenticationPrincipal UserDetails userDetails) {

        UserPrincipal userPrincipal = (UserPrincipal) userDetails;
        return ResponseEntity.ok(reportService.withdrawMyReport(reportId, userPrincipal.getUserId()));
    }

    @GetMapping("/reports/my")
    @PreAuthorize("hasAnyRole('PET_OWNER', 'CLINIC_OWNER', 'CLINIC_MANAGER', 'STAFF')")
    public ResponseEntity<Page<ReportResponse>> getMyReports(
            @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal UserDetails userDetails) {

        UserPrincipal userPrincipal = (UserPrincipal) userDetails;
        log.debug("getMyReports: reporterId={}, page={}, size={}", userPrincipal.getUserId(), pageable.getPageNumber(),
                pageable.getPageSize());
        Page<ReportResponse> reports = reportService.getMyReports(userPrincipal.getUserId(), pageable);
        log.debug("getMyReports: found {} reports", reports.getTotalElements());
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
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ReportResponse> resolveReport(
            @PathVariable UUID reportId,
            @Valid @RequestBody ResolveReportRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        UserPrincipal userPrincipal = (UserPrincipal) userDetails;
        ReportResponse response = reportService.resolveReport(reportId, request, userPrincipal.getUserId());

        return ResponseEntity.ok(response);
    }
}
