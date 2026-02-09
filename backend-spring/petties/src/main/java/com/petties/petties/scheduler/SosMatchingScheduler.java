package com.petties.petties.scheduler;

import com.petties.petties.service.SosMatchingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled job for SOS Auto-Match timeout checking
 * 
 * Runs every 5 seconds to check for SOS bookings that have timed out
 * and escalates them to the next clinic.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SosMatchingScheduler {

    private final SosMatchingService sosMatchingService;

    /**
     * Check for SOS booking timeouts every 5 seconds
     * Escalates to next clinic if current one doesn't respond within 60 seconds
     */
    @Scheduled(fixedRate = 5000)
    public void checkSosTimeouts() {
        try {
            sosMatchingService.checkTimeouts();
        } catch (Exception e) {
            log.error("Error checking SOS timeouts: {}", e.getMessage(), e);
        }
    }
}
