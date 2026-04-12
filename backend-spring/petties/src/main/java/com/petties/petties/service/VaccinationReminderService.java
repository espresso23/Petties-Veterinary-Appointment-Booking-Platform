package com.petties.petties.service;

import com.petties.petties.model.Notification;
import com.petties.petties.model.VaccinationRecord;
import com.petties.petties.model.enums.NotificationType;
import com.petties.petties.repository.NotificationRepository;
import com.petties.petties.repository.VaccinationRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Service to handle scheduled vaccination reminders
 * Runs daily to check for upcoming vaccinations
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VaccinationReminderService {

    private final VaccinationRecordRepository vaccinationRecordRepository;
    private final NotificationRepository notificationRepository;
    private final com.petties.petties.repository.PetRepository petRepository;
    private final SseEmitterService sseEmitterService;
    private final FcmService fcmService;

    // Use string format for querying as nextDueDate is stored as String
    // 'YYYY-MM-DD'
    private static final DateTimeFormatter DISPLAY_DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /**
     * Run daily at 09:00 AM
     * Cron: second, minute, hour, day of month, month, day of week
     */
    @Scheduled(cron = "0 0 9 * * ?")
    @Transactional
    public void sendDailyVaccinationReminders() {
        log.info("Starting daily vaccination reminder job...");
        LocalDate today = LocalDate.now();

        // 1. Reminder 30 days before
        scanAndSend(today.plusDays(30), "REMINDER_30_DAYS", "Còn 1 tháng nữa là đến lịch tái chủng");

        // 2. Reminder 7 days before
        scanAndSend(today.plusDays(7), "REMINDER_7_DAYS", "Chỉ còn 1 tuần nữa là đến lịch tiêm phòng");

        // 3. Reminder 1 day before (Tomorrow)
        scanAndSend(today.plusDays(1), "REMINDER_1_DAY", "Ngày mai là lịch tái chủng của bé");

        log.info("Daily vaccination reminder job completed.");
    }

    private void scanAndSend(LocalDate targetDate, String actionSuffix, String titlePrefix) {
        List<VaccinationRecord> records = vaccinationRecordRepository.findByNextDueDate(targetDate);
        if (records.isEmpty())
            return;

        log.info("Found {} vaccinations due on {}", records.size(), targetDate);

        for (VaccinationRecord record : records) {
            try {
                sendActionableReminder(record, actionSuffix, titlePrefix);
            } catch (Exception e) {
                log.error("Failed to send reminder for record {}", record.getId(), e);
            }
        }
    }

    private void sendActionableReminder(VaccinationRecord record, String actionSuffix, String titlePrefix) {
        if (record.getPetId() == null)
            return;

        var petOpt = petRepository.findById(record.getPetId());
        if (petOpt.isEmpty())
            return;
        var pet = petOpt.get();
        var owner = pet.getUser();

        if (owner == null)
            return;

        // Enhance message
        String vaccineInfo = record.getVaccineName();
        if (record.getDoseNumber() != null) {
            vaccineInfo += String.format(" (Mũi %d)", record.getDoseNumber());
        }

        String message = String.format(
                "%s. Bé %s cần tiêm vắc-xin %s vào ngày %s.",
                titlePrefix,
                pet.getName(),
                vaccineInfo,
                record.getNextDueDate().format(DISPLAY_DATE_FORMAT));

        // Create Action Data JSON
        String actionData = String.format(
                "{\"petId\":\"%s\",\"vaccineName\":\"%s\",\"suggestedDate\":\"%s\"}",
                pet.getId(),
                record.getVaccineName(),
                record.getNextDueDate().toString());

        Notification notification = Notification.builder()
                .user(owner)
                .type(NotificationType.VACCINATION_REMINDER)
                .message(message)
                .read(false)
                .actionType("QUICK_BOOKING") // Identifies actionable notification
                .actionData(actionData)
                .build();

        notification = notificationRepository.save(notification);

        // Push notification
        pushNotificationToUser(owner.getUserId(), notification);
        log.info("Sent {} reminder for pet {}", actionSuffix, pet.getName());
    }

    private void pushNotificationToUser(java.util.UUID userId, Notification notification) {
        // 1. Push via SSE
        if (sseEmitterService.isUserConnected(userId)) {
            // We map manually to avoid dependency complexity, sharing minimal needed fields
            // Or better, we can assume NotificationService helper methods should be public.
            // But let's just trigger SseEventDto directly as we have access to it.
            // The NotificationResponse mapping logic is private in NotificationService.
            // Let's create a minimal event or use simple mapping.
            // SseEventDto.notification expects NotificationResponse.
            // We can build NotificationResponse manually here.

            // Minimal mapping
            var response = com.petties.petties.dto.notification.NotificationResponse.builder()
                    .notificationId(notification.getNotificationId())
                    .type(notification.getType())
                    .message(notification.getMessage())
                    .read(false)
                    .createdAt(notification.getCreatedAt())
                    .build();

            var event = com.petties.petties.dto.sse.SseEventDto.notification(response);
            sseEmitterService.pushToUser(userId, event);
        }

        // 2. Push via FCM
        var user = notification.getUser();
        if (user.getFcmToken() != null && !user.getFcmToken().isEmpty()) {
            try {
                fcmService.sendToUser(
                        user,
                        "Nhắc nhở lịch tiêm chủng",
                        notification.getMessage(),
                        java.util.Map.of(
                                "notificationId", notification.getNotificationId().toString(),
                                "type", notification.getType().name()));
            } catch (Exception e) {
                log.error("Failed to send FCM push to user {}", userId, e);
            }
        }
    }
}
