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
     * GET /api/notifications/clinic
     * Get clinic notifications for current user (CLINIC_OWNER only)
     */
    @GetMapping("/clinic")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Page<NotificationResponse>> getClinicNotifications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        User currentUser = authService.getCurrentUser();
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<NotificationResponse> notifications = notificationService.getNotificationsByUserId(
                currentUser.getUserId(), pageable);
        return ResponseEntity.ok(notifications);
    }

    /**
     * GET /api/notifications/clinic/unread-count
     * Get unread notifications count for current user (CLINIC_OWNER only)
     */
    @GetMapping("/clinic/unread-count")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Map<String, Long>> getUnreadCount() {
        User currentUser = authService.getCurrentUser();
        long count = notificationService.getUnreadCountByUserId(currentUser.getUserId());
        return ResponseEntity.ok(Map.of("count", count));
    }

    /**
     * PUT /api/notifications/{id}/read
     * Mark notification as read (CLINIC_OWNER only)
     */
    @PutMapping("/{id}/read")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Map<String, String>> markAsRead(@PathVariable UUID id) {
        User currentUser = authService.getCurrentUser();
        notificationService.markAsRead(id, currentUser.getUserId());
        return ResponseEntity.ok(Map.of("message", "Notification marked as read"));
    }

    /**
     * PUT /api/notifications/clinic/mark-all-read
     * Mark all clinic notifications as read (CLINIC_OWNER only)
     */
    @PutMapping("/clinic/mark-all-read")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<Map<String, String>> markAllAsRead() {
        User currentUser = authService.getCurrentUser();
        notificationService.markAllAsReadByUserId(currentUser.getUserId());
        return ResponseEntity.ok(Map.of("message", "All notifications marked as read"));
    }
}

