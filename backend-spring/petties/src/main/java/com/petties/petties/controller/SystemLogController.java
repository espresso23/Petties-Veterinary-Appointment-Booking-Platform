package com.petties.petties.controller;

import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.systemlog.BulkDeleteAuditLogsRequest;
import com.petties.petties.dto.systemlog.DeleteAuditLogsByTimeRangeRequest;
import com.petties.petties.service.SystemLogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/admin/system-logs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SystemLogController {

    private final SystemLogService systemLogService;

    @GetMapping("/backend")
    public ResponseEntity<Map<String, Object>> getBackendLogs(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "30") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String requestId,
            @RequestParam(defaultValue = "ALL") String source
    ) {
        return ResponseEntity.ok(systemLogService.getBackendLogs(
                page,
                pageSize,
                status,
                action,
                userId,
                requestId,
                source
        ));
    }

    @DeleteMapping("/backend/bulk")
    public ResponseEntity<Map<String, Object>> bulkDeleteAuditLogs(
            @Valid @RequestBody BulkDeleteAuditLogsRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(systemLogService.bulkDeleteAuditLogs(
                request.getEventIds(),
                request.getSource(),
                resolveActorUserId(authentication)
        ));
    }

    @DeleteMapping("/backend/time-range")
    public ResponseEntity<Map<String, Object>> deleteAuditLogsByTimeRange(
            @Valid @RequestBody DeleteAuditLogsByTimeRangeRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(systemLogService.deleteAuditLogsByTimeRange(
                request.getFromTime(),
                request.getToTime(),
                request.getSource(),
                resolveActorUserId(authentication)
        ));
    }

    private String resolveActorUserId(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            return "unknown-admin";
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetailsServiceImpl.UserPrincipal userPrincipal) {
            return userPrincipal.getUserId().toString();
        }

        return authentication.getName() != null ? authentication.getName() : "unknown-admin";
    }
}
