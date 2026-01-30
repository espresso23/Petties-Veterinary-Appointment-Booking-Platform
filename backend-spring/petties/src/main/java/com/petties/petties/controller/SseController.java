package com.petties.petties.controller;

import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.model.User;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.SseEmitterService;
import com.petties.petties.exception.UnauthorizedException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.bind.annotation.CrossOrigin;

import java.util.UUID;

/**
 * Controller for Server-Sent Events (SSE) subscriptions
 *
 * Provides real-time push notifications to authenticated users
 *
 * Usage:
 * 1. Client connects to GET /api/sse/subscribe?token=JWT
 * 2. Server validates token and keeps connection open
 * 3. Client receives events in real-time (notifications, updates)
 *
 * Endpoint:
 * - GET /api/sse/subscribe - Subscribe to SSE events
 */
@RestController
@RequestMapping("/sse")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
public class SseController {

    private final SseEmitterService sseEmitterService;
    private final AuthService authService;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;

    /**
     * Subscribe to Server-Sent Events
     *
     * Authentication is handled via query param token (EventSource doesn't support
     * headers)
     *
     * Event types that may be received:
     * - CONNECTED: Initial connection confirmation
     * - HEARTBEAT: Keep-alive ping (every 30 seconds)
     * - NOTIFICATION: New notification arrived
     * - SHIFT_UPDATE: VetShift changed (for calendar auto-refresh)
     *
     * @param token JWT access token passed as query parameter
     * @return SseEmitter for the SSE stream
     */
    @GetMapping(value = "/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(@RequestParam(required = false) String token) {
        // Try to get user from SecurityContext first (set by JwtAuthenticationFilter)
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User currentUser = null;

        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            try {
                currentUser = authService.getCurrentUser();
            } catch (Exception e) {
                log.debug("Could not get user from SecurityContext: {}", e.getMessage());
            }
        }

        // If not authenticated via filter, try to validate token directly
        if (currentUser == null && token != null && !token.isBlank()) {
            try {
                if (jwtTokenProvider.validateToken(token)) {
                    UUID userId = jwtTokenProvider.getUserIdFromToken(token);
                    currentUser = userRepository.findById(userId).orElse(null);
                }
            } catch (Exception e) {
                log.warn("Invalid token for SSE subscribe: {}", e.getMessage());
            }
        }

        if (currentUser == null) {
            throw new UnauthorizedException("Valid authentication required for SSE subscription");
        }

        log.info("SSE subscription request from user: {} ({})",
                currentUser.getFullName(), currentUser.getUserId());

        return sseEmitterService.subscribe(currentUser.getUserId());
    }

    /**
     * Get SSE connection statistics (for admin/debugging)
     *
     * @return Connection count
     */
    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public java.util.Map<String, Object> getStats() {
        return java.util.Map.of(
                "totalConnections", sseEmitterService.getTotalConnectionCount());
    }
}
