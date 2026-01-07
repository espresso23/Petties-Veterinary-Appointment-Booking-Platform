package com.petties.petties.service;

import com.petties.petties.dto.notification.NotificationResponse;
import com.petties.petties.dto.sse.SseEventDto;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Notification;
import com.petties.petties.model.User;
import com.petties.petties.model.VetShift;
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

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.petties.petties.model.enums.Role;

/**
 * Service for managing notifications
 *
 * Handles:
 * - Clinic status notifications (APPROVED, REJECTED, PENDING)
 * - Clinic registration notifications (CLINIC_PENDING_APPROVAL for Admin)
 * - VetShift notifications (VET_SHIFT_ASSIGNED, VET_SHIFT_UPDATED,
 * VET_SHIFT_DELETED)
 * - SSE push for real-time delivery
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

        private final NotificationRepository notificationRepository;
        private final UserRepository userRepository;
        private final SseEmitterService sseEmitterService;// use for 1 direction real time notification
        private final FcmService fcmService; // use for mobile push notification

        private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
        private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

        // ======================== CLINIC NOTIFICATIONS ========================

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
                                type);

                if (exists) {
                        log.debug("Notification already exists for clinic: {} type: {}. Skipping duplicate.",
                                        clinic.getClinicId(), type);
                        return null;
                }

                String message = switch (type) {
                        case APPROVED -> String.format(
                                        "Phòng khám \"%s\" đã được duyệt và có thể hoạt động trên nền tảng Petties.",
                                        clinic.getName());
                        case REJECTED -> String.format(
                                        "Phòng khám \"%s\" không được duyệt. Vui lòng xem lại thông tin và đăng ký lại.",
                                        clinic.getName());
                        case PENDING -> String.format("Phòng khám \"%s\" đang chờ duyệt.", clinic.getName());
                        default -> "Thông báo từ phòng khám " + clinic.getName();
                };

                Notification notification = Notification.builder()
                                .user(owner)
                                .clinic(clinic)
                                .type(type)
                                .message(message)
                                .reason(reason)
                                .read(false)
                                .build();

                notification = notificationRepository.save(notification);
                log.info("Notification created: {} for clinic: {} type: {} user: {}",
                                notification.getNotificationId(), clinic.getClinicId(), type, owner.getUserId());

                // Push via SSE
                pushNotificationToUser(owner.getUserId(), notification);

                return notification;
        }

        /**
         * Notify all Admins when a new clinic is registered and pending approval
         */
        @Transactional
        public void notifyAdminsNewClinicRegistration(Clinic clinic) {
                // Get all active admin users
                List<User> admins = userRepository.findByRoleAndDeletedAtIsNull(Role.ADMIN);

                if (admins.isEmpty()) {
                        log.warn("No active admin users found to notify about new clinic registration");
                        return;
                }

                String message = String.format(
                                "Phòng khám mới \"%s\" vừa đăng ký và đang chờ duyệt. Chủ sở hữu: %s",
                                clinic.getName(),
                                clinic.getOwner().getFullName());

                for (User admin : admins) {
                        // Check if notification already exists for this clinic+admin+type
                        boolean exists = notificationRepository.existsByUserUserIdAndClinicClinicIdAndType(
                                        admin.getUserId(),
                                        clinic.getClinicId(),
                                        NotificationType.CLINIC_PENDING_APPROVAL);

                        if (exists) {
                                log.debug("Admin notification already exists for clinic: {} admin: {}. Skipping.",
                                                clinic.getClinicId(), admin.getUserId());
                                continue;
                        }

                        Notification notification = Notification.builder()
                                        .user(admin)
                                        .clinic(clinic)
                                        .type(NotificationType.CLINIC_PENDING_APPROVAL)
                                        .message(message)
                                        .read(false)
                                        .build();

                        notification = notificationRepository.save(notification);
                        log.info("Admin notification created: {} for admin: {} clinic: {}",
                                        notification.getNotificationId(), admin.getUserId(), clinic.getClinicId());

                        // Push via SSE
                        pushNotificationToUser(admin.getUserId(), notification);
                }
        }

        /**
         * Broadcast the current count of pending clinics to all active admins
         */
        @Transactional(readOnly = true)
        public void broadcastClinicCounterUpdate(long count) {
                List<User> admins = userRepository.findByRoleAndDeletedAtIsNull(Role.ADMIN);
                if (admins.isEmpty())
                        return;

                SseEventDto event = SseEventDto.clinicCounterUpdate(count);
                log.info("Broadcasting pending clinic count ({}) to {} admins", count, admins.size());
                for (User admin : admins) {
                        sseEmitterService.pushToUser(admin.getUserId(), event);
                }
        }

        // ======================== VET SHIFT NOTIFICATIONS ========================

        /**
         * Notify Vet when a new shift is assigned (single shift)
         */
        @Transactional
        public Notification notifyVetShiftAssigned(User vet, VetShift shift) {
                String message = String.format(
                                "Bạn được gán ca làm việc ngày %s (%s - %s) tại %s",
                                shift.getWorkDate().format(DATE_FORMATTER),
                                shift.getStartTime().format(TIME_FORMATTER),
                                shift.getEndTime().format(TIME_FORMATTER),
                                shift.getClinic().getName());

                Notification notification = Notification.builder()
                                .user(vet)
                                .shift(shift)
                                .clinic(shift.getClinic())
                                .type(NotificationType.VET_SHIFT_ASSIGNED)
                                .message(message)
                                .read(false)
                                .build();

                notification = notificationRepository.save(notification);
                log.info("VetShift notification created: {} for vet: {} shift: {}",
                                notification.getNotificationId(), vet.getUserId(), shift.getShiftId());

                // Push via SSE
                pushNotificationToUser(vet.getUserId(), notification);

                return notification;
        }

        /**
         * Notify Vet when multiple shifts are assigned in batch
         * Creates ONE notification summarizing all shifts instead of N individual
         * notifications
         *
         * @param vet    The vet being notified
         * @param shifts List of shifts assigned (must not be empty)
         * @param clinic The clinic where shifts are assigned
         */
        @Transactional
        public Notification notifyVetShiftsBatchAssigned(User vet, List<VetShift> shifts, Clinic clinic) {
                if (shifts == null || shifts.isEmpty()) {
                        log.warn("notifyVetShiftsBatchAssigned called with empty shifts list");
                        return null;
                }

                // If only 1 shift, use the single notification method
                if (shifts.size() == 1) {
                        return notifyVetShiftAssigned(vet, shifts.get(0));
                }

                // Sort shifts by workDate to get date range
                List<VetShift> sortedShifts = shifts.stream()
                                .sorted((a, b) -> a.getWorkDate().compareTo(b.getWorkDate()))
                                .toList();

                LocalDate startDate = sortedShifts.get(0).getWorkDate();
                LocalDate endDate = sortedShifts.get(sortedShifts.size() - 1).getWorkDate();
                int shiftCount = shifts.size();

                String message = String.format(
                                "Bạn được gán %d ca làm việc từ ngày %s đến ngày %s tại %s",
                                shiftCount,
                                startDate.format(DATE_FORMATTER),
                                endDate.format(DATE_FORMATTER),
                                clinic.getName());

                // Link to the first shift for navigation purposes
                VetShift firstShift = sortedShifts.get(0);

                Notification notification = Notification.builder()
                                .user(vet)
                                .shift(firstShift)
                                .clinic(clinic)
                                .type(NotificationType.VET_SHIFT_ASSIGNED)
                                .message(message)
                                .read(false)
                                .build();

                notification = notificationRepository.save(notification);
                log.info("Batch VetShift notification created: {} for vet: {} ({} shifts from {} to {})",
                                notification.getNotificationId(), vet.getUserId(), shiftCount, startDate, endDate);

                // Push via SSE
                pushNotificationToUser(vet.getUserId(), notification);

                return notification;
        }

        /**
         * Notify Vet when their shift is updated (single shift)
         */
        @Transactional
        public Notification notifyVetShiftUpdated(User vet, VetShift shift) {
                String message = String.format(
                                "Ca làm việc ngày %s đã được cập nhật (%s - %s) tại %s",
                                shift.getWorkDate().format(DATE_FORMATTER),
                                shift.getStartTime().format(TIME_FORMATTER),
                                shift.getEndTime().format(TIME_FORMATTER),
                                shift.getClinic().getName());

                Notification notification = Notification.builder()
                                .user(vet)
                                .shift(shift)
                                .clinic(shift.getClinic())
                                .type(NotificationType.VET_SHIFT_UPDATED)
                                .message(message)
                                .read(false)
                                .build();

                notification = notificationRepository.save(notification);
                log.info("VetShift update notification created: {} for vet: {} shift: {}",
                                notification.getNotificationId(), vet.getUserId(), shift.getShiftId());

                // Push via SSE
                pushNotificationToUser(vet.getUserId(), notification);

                return notification;
        }

        /**
         * Notify Vet when multiple shifts are updated in batch
         * Creates ONE notification summarizing all shifts instead of N individual
         * notifications
         */
        @Transactional
        public Notification notifyVetShiftsBatchUpdated(User vet, List<VetShift> shifts, Clinic clinic) {
                if (shifts == null || shifts.isEmpty()) {
                        log.warn("notifyVetShiftsBatchUpdated called with empty shifts list");
                        return null;
                }

                // If only 1 shift, use the single notification method
                if (shifts.size() == 1) {
                        return notifyVetShiftUpdated(vet, shifts.get(0));
                }

                // Sort shifts by workDate to get date range
                List<VetShift> sortedShifts = shifts.stream()
                                .sorted((a, b) -> a.getWorkDate().compareTo(b.getWorkDate()))
                                .toList();

                LocalDate startDate = sortedShifts.get(0).getWorkDate();
                LocalDate endDate = sortedShifts.get(sortedShifts.size() - 1).getWorkDate();
                int shiftCount = shifts.size();

                String message = String.format(
                                "%d ca làm việc từ ngày %s đến ngày %s tại %s đã được cập nhật",
                                shiftCount,
                                startDate.format(DATE_FORMATTER),
                                endDate.format(DATE_FORMATTER),
                                clinic.getName());

                // Link to the first shift for navigation purposes
                VetShift firstShift = sortedShifts.get(0);

                Notification notification = Notification.builder()
                                .user(vet)
                                .shift(firstShift)
                                .clinic(clinic)
                                .type(NotificationType.VET_SHIFT_UPDATED)
                                .message(message)
                                .read(false)
                                .build();

                notification = notificationRepository.save(notification);
                log.info("Batch VetShift update notification created: {} for vet: {} ({} shifts)",
                                notification.getNotificationId(), vet.getUserId(), shiftCount);

                // Push via SSE
                pushNotificationToUser(vet.getUserId(), notification);

                return notification;
        }

        /**
         * Notify Vet when their shift is deleted
         */
        @Transactional
        public Notification notifyVetShiftDeleted(User vet, LocalDate workDate, String clinicName) {
                String message = String.format(
                                "Ca làm việc ngày %s tại %s đã bị xóa",
                                workDate.format(DATE_FORMATTER),
                                clinicName);

                Notification notification = Notification.builder()
                                .user(vet)
                                .type(NotificationType.VET_SHIFT_DELETED)
                                .message(message)
                                .read(false)
                                .build();

                notification = notificationRepository.save(notification);
                log.info("VetShift delete notification created: {} for vet: {}",
                                notification.getNotificationId(), vet.getUserId());

                // Push via SSE
                pushNotificationToUser(vet.getUserId(), notification);

                return notification;
        }

        // ======================== COMMON OPERATIONS ========================

        /**
         * Push notification to user via SSE and FCM
         */
        private void pushNotificationToUser(UUID userId, Notification notification) {
                // 1. Push via SSE if user is online
                if (sseEmitterService.isUserConnected(userId)) {
                        NotificationResponse response = mapToResponse(notification);
                        SseEventDto event = SseEventDto.notification(response);
                        sseEmitterService.pushToUser(userId, event);
                        log.debug("Notification pushed via SSE to user: {}", userId);
                } else {
                        log.debug("User {} not connected to SSE, skipped SSE push", userId);
                }

                // 2. Push via FCM if user has a token
                User user = notification.getUser();
                if (user.getFcmToken() != null && !user.getFcmToken().isEmpty()) {
                        log.info("Attempting to send FCM push to user {}. Token: {}", userId, user.getFcmToken());
                        try {
                                boolean sent = fcmService.sendToUser(
                                                user,
                                                getNotificationTitle(notification.getType()),
                                                notification.getMessage(),
                                                Map.of(
                                                                "notificationId",
                                                                notification.getNotificationId().toString(),
                                                                "type", notification.getType().name()));
                                if (sent) {
                                        log.info("Push notification sent successfully via FCM to user: {}", userId);
                                } else {
                                        log.warn("FCM service returned false for user: {}", userId);
                                }
                        } catch (Exception e) {
                                log.error("Failed to send FCM push notification to user: {}", userId, e);
                        }
                } else {
                        log.warn("User {} has no FCM token, skipped FCM push", userId);
                }
        }

        private String getNotificationTitle(NotificationType type) {
                return switch (type) {
                        case VET_SHIFT_ASSIGNED -> "Lịch trực mới đã được gán";
                        case VET_SHIFT_UPDATED -> "Lịch trực đã thay đổi";
                        case VET_SHIFT_DELETED -> "Lịch trực đã bị xóa";
                        case BOOKING_CREATED -> "Lịch hẹn mới";
                        case BOOKING_CONFIRMED -> "Lịch hẹn đã xác nhận";
                        case BOOKING_CANCELLED -> "Lịch hẹn đã bị hủy";
                        case CLINIC_VERIFIED, APPROVED -> "Phòng khám đã được xác minh";
                        case REJECTED -> "Phòng khám bị từ chối";
                        default -> "Thông báo từ Petties";
                };
        }

        /**
         * Get all notifications for current user
         */
        @Transactional(readOnly = true)
        public Page<NotificationResponse> getNotificationsByUserId(UUID userId, Pageable pageable) {
                Page<Notification> notifications = notificationRepository.findByUserUserIdOrderByCreatedAtDesc(userId,
                                pageable);
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
                        throw new ForbiddenException("Bạn chỉ có thể đánh dấu đã đọc thông báo của mình");
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

        /**
         * Map Notification entity to response DTO
         */
        private NotificationResponse mapToResponse(Notification notification) {
                NotificationResponse.NotificationResponseBuilder builder = NotificationResponse.builder()
                                .notificationId(notification.getNotificationId())
                                .type(notification.getType())
                                .message(notification.getMessage())
                                .reason(notification.getReason())
                                .read(notification.getRead())
                                .createdAt(notification.getCreatedAt());

                // Add clinic fields if present
                if (notification.getClinic() != null) {
                        builder.clinicId(notification.getClinic().getClinicId())
                                        .clinicName(notification.getClinic().getName());
                }

                // Add shift fields if present
                if (notification.getShift() != null) {
                        VetShift shift = notification.getShift();
                        builder.shiftId(shift.getShiftId())
                                        .shiftDate(shift.getWorkDate())
                                        .shiftStartTime(shift.getStartTime())
                                        .shiftEndTime(shift.getEndTime());
                }

                return builder.build();
        }
}
