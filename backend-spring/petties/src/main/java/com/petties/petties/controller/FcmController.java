package com.petties.petties.controller;

import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.dto.fcm.FcmTokenRequest;
import com.petties.petties.service.FcmService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Controller for FCM token management
 */
@RestController
@RequestMapping("/fcm")
@RequiredArgsConstructor
public class FcmController {

    private final FcmService fcmService;
    private final JwtTokenProvider jwtTokenProvider;

    /**
     * Register FCM token for push notifications
     */
    @PostMapping("/token")
    public ResponseEntity<Map<String, String>> registerToken(
            @RequestHeader("Authorization") String authHeader,
            @Valid @RequestBody FcmTokenRequest request) {

        String token = authHeader.replace("Bearer ", "");
        UUID userId = jwtTokenProvider.getUserIdFromToken(token);
        fcmService.registerToken(userId, request.getFcmToken());

        return ResponseEntity.ok(Map.of("message", "FCM token registered successfully"));
    }

    /**
     * Remove FCM token on logout
     */
    @DeleteMapping("/token")
    public ResponseEntity<Map<String, String>> removeToken(
            @RequestHeader("Authorization") String authHeader) {

        String token = authHeader.replace("Bearer ", "");
        UUID userId = jwtTokenProvider.getUserIdFromToken(token);
        fcmService.removeToken(userId);

        return ResponseEntity.ok(Map.of("message", "FCM token removed successfully"));
    }
}
