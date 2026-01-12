package com.petties.petties.controller;

import com.petties.petties.dto.notification.NotificationResponse;
import com.petties.petties.model.User;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Controller for Notification management
 * Base path: /api/notifications
 */
@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final AuthService authService;

    /**
     * GET /api/notifications/me
     * Get notifications for current user (all roles)
     */
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<NotificationResponse>> getMyNotifications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        User currentUser = authService.getCurrentUser();
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<NotificationResponse> notifications = notificationService.getNotificationsByUserId(
                currentUser.getUserId(), pageable);
        return ResponseEntity.ok(notifications);
    }

    /**
     * GET /api/notifications/me/unread-count
     * Get unread notifications count for current user (all roles)
     */
    @GetMapping("/me/unread-count")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Long>> getUnreadCount() {
        User currentUser = authService.getCurrentUser();
        long count = notificationService.getUnreadCountByUserId(currentUser.getUserId());
        return ResponseEntity.ok(Map.of("count", count));
    }

    /**
     * PUT /api/notifications/{id}/read
     * Mark notification as read (all roles)
     */
    @PutMapping("/{id}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, String>> markAsRead(@PathVariable UUID id) {
        User currentUser = authService.getCurrentUser();
        notificationService.markAsRead(id, currentUser.getUserId());
        return ResponseEntity.ok(Map.of("message", "Notification marked as read"));
    }

    /**
     * PUT /api/notifications/me/mark-all-read
     * Mark all notifications as read (all roles)
     */
    @PutMapping("/me/mark-all-read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, String>> markAllAsRead() {
        User currentUser = authService.getCurrentUser();
        notificationService.markAllAsReadByUserId(currentUser.getUserId());
        return ResponseEntity.ok(Map.of("message", "All notifications marked as read"));
    }
}
