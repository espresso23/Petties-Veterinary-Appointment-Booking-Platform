package com.petties.petties.service;

import com.petties.petties.dto.notification.NotificationResponse;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Notification;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.NotificationType;
import com.petties.petties.repository.NotificationRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.exception.ForbiddenException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Service for managing clinic status notifications
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    /**
     * Create a notification for clinic owner when clinic status changes
     * Simple approach: Check if notification already exists for this clinic+type
     * Only create if no notification exists - prevents all duplicates
     */
    @Transactional
    public Notification createClinicNotification(Clinic clinic, NotificationType type, String reason) {
        User owner = clinic.getOwner();
        
        // Double-check: Verify no notification exists for this clinic+type
        // This prevents duplicate even if method is called multiple times concurrently
        boolean exists = notificationRepository.existsByClinicClinicIdAndType(
            clinic.getClinicId(), 
            type
        );
        
        if (exists) {
            log.debug("Notification already exists for clinic: {} type: {}. Skipping duplicate.", 
                    clinic.getClinicId(), type);
            return null;
        }
        
        String message = switch (type) {
            case APPROVED -> String.format("Phòng khám \"%s\" đã được duyệt và có thể hoạt động trên nền tảng Petties.", clinic.getName());
            case REJECTED -> String.format("Phòng khám \"%s\" không được duyệt. Vui lòng xem lại thông tin và đăng ký lại.", clinic.getName());
            case PENDING -> String.format("Phòng khám \"%s\" đang chờ duyệt.", clinic.getName());
        };

        Notification notification = new Notification();
        notification.setUser(owner);
        notification.setClinic(clinic);
        notification.setType(type);
        notification.setMessage(message);
        notification.setReason(reason);
        notification.setRead(false);

        notification = notificationRepository.save(notification);
        log.info("Notification created: {} for clinic: {} type: {} user: {}", 
                notification.getNotificationId(), clinic.getClinicId(), type, owner.getUserId());
        
        return notification;
    }

    /**
     * Get all notifications for current user (clinic owner)
     */
    @Transactional(readOnly = true)
    public Page<NotificationResponse> getNotificationsByUserId(UUID userId, Pageable pageable) {
        Page<Notification> notifications = notificationRepository.findByUserUserIdOrderByCreatedAtDesc(userId, pageable);
        return notifications.map(this::mapToResponse);
    }

    /**
     * Get unread notifications count for current user
     */
    @Transactional(readOnly = true)
    public long getUnreadCountByUserId(UUID userId) {
        return notificationRepository.countByUserUserIdAndReadFalse(userId);
    }

    /**
     * Mark notification as read
     */
    @Transactional
    public void markAsRead(UUID notificationId, UUID userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));

        // Verify ownership
        if (!notification.getUser().getUserId().equals(userId)) {
            throw new ForbiddenException("You can only mark your own notifications as read");
        }

        notificationRepository.markAsRead(notificationId);
        log.info("Notification marked as read: {} by user: {}", notificationId, userId);
    }

    /**
     * Mark all notifications as read for current user
     */
    @Transactional
    public void markAllAsReadByUserId(UUID userId) {
        int updated = notificationRepository.markAllAsReadByUserId(userId);
        log.info("Marked {} notifications as read for user: {}", updated, userId);
    }

    private NotificationResponse mapToResponse(Notification notification) {
        return NotificationResponse.builder()
                .notificationId(notification.getNotificationId())
                .clinicId(notification.getClinic().getClinicId())
                .clinicName(notification.getClinic().getName())
                .type(notification.getType())
                .message(notification.getMessage())
                .reason(notification.getReason())
                .read(notification.getRead())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}

