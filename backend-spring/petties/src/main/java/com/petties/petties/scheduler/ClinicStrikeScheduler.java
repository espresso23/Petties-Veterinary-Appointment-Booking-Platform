package com.petties.petties.scheduler;

import com.petties.petties.service.ClinicStrikeService;
import com.petties.petties.service.UserStrikeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Scheduler xóa strike_until khi đã hết hạn (clinic và pet owner).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ClinicStrikeScheduler {

    private final ClinicStrikeService clinicStrikeService;
    private final UserStrikeService userStrikeService;

    @Scheduled(cron = "0 0 * * * ?") // Mỗi giờ
    @Transactional
    public void clearExpiredStrikes() {
        try {
            int clinicCleared = clinicStrikeService.clearExpiredStrikes();
            int userCleared = userStrikeService.clearExpiredStrikes();
            if (clinicCleared > 0 || userCleared > 0) {
                log.info("Cleared {} expired clinic strikes, {} expired user strikes", clinicCleared, userCleared);
            }
        } catch (Exception e) {
            log.error("Failed to clear expired strikes", e);
        }
    }
}
