package com.petties.petties.controller;

import com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal;
import com.petties.petties.dto.report.ClinicStrikeConfigResponse;
import com.petties.petties.dto.report.ClinicStrikeConfigUpdateRequest;
import com.petties.petties.service.ClinicStrikeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Controller cấu hình ngưỡng strike cho Admin.
 */
@RestController
@RequestMapping("/admin/clinic-strike-config")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ClinicStrikeConfigController {

    private static final Map<String, String> DESCRIPTIONS = Map.of(
            "strike_threshold", "Số report được approve để kích hoạt strike (mặc định: 3)",
            "strike_permanent_threshold", "Số report để block vĩnh viễn (>= ngưỡng này = hạn chế không thời hạn). Đặt 0 để tắt (mặc định: 7)",
            "strike_duration_days", "Số ngày clinic bị hạn chế (mặc định: 7)",
            "strike_window_days", "Chỉ tính report trong X ngày gần nhất (mặc định: 90)"
    );

    private final ClinicStrikeService clinicStrikeService;

    @GetMapping
    public ResponseEntity<ClinicStrikeConfigResponse> getConfig() {
        Map<String, String> configs = clinicStrikeService.getAllConfig();
        ClinicStrikeConfigResponse response = ClinicStrikeConfigResponse.builder()
                .configs(configs)
                .descriptions(DESCRIPTIONS)
                .build();
        return ResponseEntity.ok(response);
    }

    @PutMapping
    public ResponseEntity<Map<String, String>> updateConfig(
            @Valid @RequestBody ClinicStrikeConfigUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        UUID adminId = userDetails != null ? ((UserPrincipal) userDetails).getUserId() : null;
        clinicStrikeService.updateConfig(request.getConfigKey(), request.getConfigValue(), adminId);
        return ResponseEntity.ok(clinicStrikeService.getAllConfig());
    }
}
