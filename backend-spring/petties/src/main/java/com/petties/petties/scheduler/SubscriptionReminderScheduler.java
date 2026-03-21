package com.petties.petties.scheduler;

import com.petties.petties.model.Notification;
import com.petties.petties.model.UserSubscription;
import com.petties.petties.model.enums.NotificationType;
import com.petties.petties.model.enums.UserSubscriptionStatus;
import com.petties.petties.repository.NotificationRepository;
import com.petties.petties.repository.UserSubscriptionRepository;
import com.petties.petties.service.FcmService;
import com.petties.petties.service.SseEmitterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduler to send reminders before subscription expires
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SubscriptionReminderScheduler {

    private final UserSubscriptionRepository userSubscriptionRepository;
    private final NotificationRepository notificationRepository;
    private final SseEmitterService sseEmitterService;
    private final FcmService fcmService;

    /**
     * Run daily at 9:00 AM
     */
    @Scheduled(cron = "0 0 9 * * ?")
    @Transactional
    public void checkExpiringSubscriptions() {
        log.info("Starting Subscription Expiration Reminder check...");

        // Target date is 3 days from now
        LocalDateTime targetDate = LocalDateTime.now().plusDays(3);
        LocalDateTime start = targetDate.toLocalDate().atStartOfDay();
        LocalDateTime end = start.plusDays(1).minusSeconds(1);

        // Notify for ACTIVE and CANCELLED (but still active) subscriptions expiring in
        // 3 days
        processExpirations(UserSubscriptionStatus.ACTIVE, start, end);
        processExpirations(UserSubscriptionStatus.CANCELLED, start, end);

        log.info("Completed Subscription Expiration Reminder check.");
    }

    private void processExpirations(UserSubscriptionStatus status, LocalDateTime start, LocalDateTime end) {
        List<UserSubscription> subscriptions = userSubscriptionRepository.findByStatusAndEndDateBetween(status, start,
                end);
        if (subscriptions.isEmpty())
            return;

        log.info("Found {} subscriptions with status {} expiring on {}", subscriptions.size(), status,
                start.toLocalDate());

        for (UserSubscription sub : subscriptions) {
            try {
                sendExpirationReminder(sub);
            } catch (Exception e) {
                log.error("Failed to send expiration reminder for subscription {}", sub.getSubscriptionId(), e);
            }
        }
    }

    private void sendExpirationReminder(UserSubscription sub) {
        if (sub.getClinic() == null || sub.getClinic().getOwner() == null) {
            return;
        }

        var owner = sub.getClinic().getOwner();
        String message = String.format(
                "Gói hội viên %s của phòng khám %s sẽ hết hạn vào ngày %s. Hãy gia hạn để tiếp tục sử dụng các tính năng AI.",
                sub.getPlan().getName(),
                sub.getClinic().getName(),
                sub.getEndDate().toLocalDate().toString());

        Notification notification = Notification.builder()
                .user(owner)
                .type(NotificationType.SUBSCRIPTION_EXPIRING_SOON)
                .message(message)
                .read(false)
                .actionType("RENEW_SUBSCRIPTION")
                .actionData(String.format("{\"clinicId\":\"%s\"}", sub.getClinic().getClinicId()))
                .build();

        notification = notificationRepository.save(notification);
        pushNotificationToUser(owner.getUserId(), notification);
    }

    private void pushNotificationToUser(java.util.UUID userId, Notification notification) {
        // 1. Push via SSE
        if (sseEmitterService.isUserConnected(userId)) {
            var response = com.petties.petties.dto.notification.NotificationResponse.builder()
                    .notificationId(notification.getNotificationId())
                    .type(notification.getType())
                    .message(notification.getMessage())
                    .read(false)
                    .createdAt(notification.getCreatedAt())
                    .build();

            sseEmitterService.pushToUser(userId, com.petties.petties.dto.sse.SseEventDto.notification(response));
        }

        // 2. Push via FCM
        var user = notification.getUser();
        if (user.getFcmToken() != null && !user.getFcmToken().isEmpty()) {
            try {
                fcmService.sendToUser(
                        user,
                        "Gói hội viên sắp hết hạn",
                        notification.getMessage(),
                        java.util.Map.of("type", notification.getType().name()));
            } catch (Exception e) {
                log.error("Failed to send FCM push for subscription to user {}", userId, e);
            }
        }
    }
}
