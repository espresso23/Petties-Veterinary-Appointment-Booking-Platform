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
        LocalDateTime tomorrowStart = now.plusDays(1).toLocalDate().atStartOfDay();
        LocalDateTime tomorrowEnd = tomorrowStart.plusDays(1).minusSeconds(1);

        LocalDateTime nextWeekStart = now.plusDays(7).toLocalDate().atStartOfDay();
        LocalDateTime nextWeekEnd = nextWeekStart.plusDays(1).minusSeconds(1);

        // 1. Remind 1 day before
        List<EmrRecord> tomorrowReminders = emrRecordRepository.findByReExaminationDateBetween(tomorrowStart,
                tomorrowEnd);
        processReminders(tomorrowReminders, "ngày mai");

        // 2. Remind 1 week before
        List<EmrRecord> nextWeekReminders = emrRecordRepository.findByReExaminationDateBetween(nextWeekStart,
                nextWeekEnd);
        processReminders(nextWeekReminders, "trong 1 tuần tới");

        log.info("Completed Re-examination Reminder check. Processed {} + {} records.",
                tomorrowReminders.size(), nextWeekReminders.size());
    }

    private void processReminders(List<EmrRecord> records, String timeText) {
        for (EmrRecord emr : records) {
            try {
                if (emr.getPetId() == null)
                    continue;

                var petOpt = petRepository.findById(emr.getPetId());
                if (petOpt.isEmpty()) {
                    continue;
                }
                var pet = petOpt.get();
                var owner = pet.getUser(); // Changed from getOwner() to getUser()

                if (owner == null)
                    continue;

                String message = String.format(
                        "Nhắc nhở: Bé %s có lịch tái khám vào %s (%s). Vui lòng đặt lịch hẹn hoặc mang bé đến phòng khám.",
                        pet.getName(),
                        emr.getReExaminationDate().format(DATE_FORMATTER),
                        timeText);

                Notification notification = Notification.builder()
                        .user(owner)
                        .emrId(emr.getId()) // Store MongoDB ID as String
                        .type(NotificationType.RE_EXAMINATION_REMINDER)
                        .message(message)
                        .read(false)
                        .build();

                notificationRepository.save(notification);
                log.info("Saved re-exam reminder for pet {} (owner {})", pet.getName(), owner.getUserId());

            } catch (Exception e) {
                log.error("Failed to process reminder for EMR {}", emr.getId(), e);
            }
        }
    }
}
