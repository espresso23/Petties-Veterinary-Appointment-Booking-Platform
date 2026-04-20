package com.petties.petties.controller;

import com.petties.petties.service.SystemLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
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
            @RequestParam(required = false) String requestId
    ) {
        return ResponseEntity.ok(systemLogService.getBackendLogs(
                page,
                pageSize,
                status,
                action,
                userId,
                requestId
        ));
    }
}
