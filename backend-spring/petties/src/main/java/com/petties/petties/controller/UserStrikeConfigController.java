package com.petties.petties.controller;

import com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal;
import com.petties.petties.dto.report.ClinicStrikeConfigResponse;
import com.petties.petties.dto.report.ClinicStrikeConfigUpdateRequest;
import com.petties.petties.service.UserStrikeService;
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
 * Controller cấu hình ngưỡng strike cho pet owner (Admin).
 */
@RestController
@RequestMapping("/v1/admin/user-strike-config")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class UserStrikeConfigController {

    private static final Map<String, String> DESCRIPTIONS = Map.of(
            "user_strike_threshold", "Số report được approve để kích hoạt strike (mặc định: 3)",
            "user_strike_permanent_threshold", "Số report để block vĩnh viễn pet owner (>= ngưỡng này = hạn chế không thời hạn). Đặt 0 để tắt (mặc định: 7)",
            "user_strike_duration_days", "Số ngày pet owner bị hạn chế đặt lịch (mặc định: 7)",
            "user_strike_window_days", "Chỉ tính report trong X ngày gần nhất (mặc định: 90)"
    );

    private final UserStrikeService userStrikeService;

    @GetMapping
    public ResponseEntity<ClinicStrikeConfigResponse> getConfig() {
        Map<String, String> configs = userStrikeService.getAllConfig();
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
        userStrikeService.updateConfig(request.getConfigKey(), request.getConfigValue(), adminId);
        return ResponseEntity.ok(userStrikeService.getAllConfig());
    }
}
