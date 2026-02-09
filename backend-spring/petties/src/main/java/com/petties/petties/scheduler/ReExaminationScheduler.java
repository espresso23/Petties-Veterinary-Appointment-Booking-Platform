package com.petties.petties.scheduler;

import com.petties.petties.model.EmrRecord;
import com.petties.petties.model.Notification;
import com.petties.petties.model.enums.NotificationType;
import com.petties.petties.repository.EmrRecordRepository;
import com.petties.petties.repository.NotificationRepository;
import com.petties.petties.repository.PetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReExaminationScheduler {

    private final EmrRecordRepository emrRecordRepository;
    private final NotificationRepository notificationRepository;
    private final PetRepository petRepository;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /**
     * Run daily at 8:00 AM
     * Cron: Seconds Minutes Hours DayOfMonth Month DayOfWeek
     */
    @Scheduled(cron = "0 0 8 * * ?")
    @Transactional
    public void checkReExaminations() {
        log.info("Starting Re-examination Reminder check...");
        LocalDateTime now = LocalDateTime.now();

        // 1. Reminder 30 days before
        scanAndProcess(now.plusDays(30), "REMINDER_30_DAYS", "Còn 1 tháng nữa là đến lịch tái khám");

        // 2. Reminder 7 days before
        scanAndProcess(now.plusDays(7), "REMINDER_7_DAYS", "Chỉ còn 1 tuần nữa là đến lịch tái khám");

        // 3. Reminder 1 day before (Tomorrow)
        scanAndProcess(now.plusDays(1), "REMINDER_1_DAY", "Ngày mai là lịch tái khám của bé");

        log.info("Completed Re-examination Reminder check.");
    }

    private void scanAndProcess(LocalDateTime targetDate, String actionSuffix, String titlePrefix) {
        LocalDateTime start = targetDate.toLocalDate().atStartOfDay();
        LocalDateTime end = start.plusDays(1).minusSeconds(1);

        List<EmrRecord> records = emrRecordRepository.findByReExaminationDateBetween(start, end);
        if (records.isEmpty())
            return;

        log.info("Found {} re-examinations due on {}", records.size(), targetDate.toLocalDate());

        for (EmrRecord emr : records) {
            try {
                processReminder(emr, actionSuffix, titlePrefix);
            } catch (Exception e) {
                log.error("Failed to processed reminder for EMR {}", emr.getId(), e);
            }
        }
    }

    private void processReminder(EmrRecord emr, String actionSuffix, String titlePrefix) {
        if (emr.getPetId() == null)
            return;

        var petOpt = petRepository.findById(emr.getPetId());
        if (petOpt.isEmpty())
            return;
        var pet = petOpt.get();
        var owner = pet.getUser();

        if (owner == null)
            return;

        String message = String.format(
                "%s. Bé %s có lịch tái khám vào ngày %s.",
                titlePrefix,
                pet.getName(),
                emr.getReExaminationDate().format(DATE_FORMATTER));

        // Create Action Data JSON
        String actionData = String.format(
                "{\"petId\":\"%s\",\"serviceName\":\"Tái khám\",\"suggestedDate\":\"%s\"}",
                pet.getId(),
                emr.getReExaminationDate().toLocalDate().toString());

        Notification notification = Notification.builder()
                .user(owner)
                .emrId(emr.getId()) // Store MongoDB ID as String
                .type(NotificationType.RE_EXAMINATION_REMINDER)
                .message(message)
                .read(false)
                .actionType("QUICK_BOOKING")
                .actionData(actionData)
                .build();

        notificationRepository.save(notification);
        log.info("Saved {} reminder for pet {} (owner {})", actionSuffix, pet.getName(), owner.getUserId());
    }
}
