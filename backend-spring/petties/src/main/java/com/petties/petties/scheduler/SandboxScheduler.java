package com.petties.petties.scheduler;

import com.petties.petties.service.SandboxService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * SandboxScheduler - Manages automated cleanup of sandbox/demo clinics
 *
 * Purpose: Delete sandbox clinics that have expired (older than 24 hours)
 * This serves as a safety net for cases where:
 * - User exits sandbox mode but data persists
 * - User abandons sandbox without explicitly exiting
 * - User's browser crashes during sandbox session
 *
 * Schedule: Daily at 2:00 AM (off-peak hours)
 * Cron: "0 0 2 * * *" (seconds minutes hours day month day-of-week)
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SandboxScheduler {

    private final SandboxService sandboxService;

    /**
     * Cleanup expired sandbox clinics daily at 2:00 AM
     * Triggered via CRON expression to run during low-traffic hours
     */
    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void cleanupExpiredSandboxes() {
        log.info("=== Starting scheduled sandbox cleanup task ===");
        try {
            sandboxService.cleanupExpiredSandboxes();
            log.info("=== Sandbox cleanup task completed successfully ===");
        } catch (Exception e) {
            log.error("=== Error during sandbox cleanup task ===", e);
            // Don't rethrow - we want the scheduler to continue running even if cleanup fails
        }
    }
}
