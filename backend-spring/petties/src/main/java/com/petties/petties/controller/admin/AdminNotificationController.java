package com.petties.petties.controller.admin;

import com.petties.petties.dto.request.AdminNotificationRequest;
import com.petties.petties.dto.response.SystemNotificationResponse;
import com.petties.petties.model.User;
import com.petties.petties.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin/notifications")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminNotificationController {

    private final NotificationService notificationService;

    @PostMapping
    public ResponseEntity<Map<String, String>> createNotification(
            @Valid @RequestBody AdminNotificationRequest request,
            @AuthenticationPrincipal User admin) {
        
        notificationService.createAdminNotification(request, admin);
        
        return ResponseEntity.ok(Map.of("message", "Đã gửi thông báo thành công", "status", "success"));
    }

    @GetMapping
    public ResponseEntity<Page<SystemNotificationResponse>> getNotifications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        
        Pageable pageable = PageRequest.of(page, size);
        Page<SystemNotificationResponse> result = notificationService.getAdminNotifications(pageable);
        
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteNotification(@PathVariable UUID id) {
        notificationService.deleteAdminNotification(id);
        
        return ResponseEntity.ok(Map.of("message", "Xóa thông báo thành công", "status", "success"));
    }
}
