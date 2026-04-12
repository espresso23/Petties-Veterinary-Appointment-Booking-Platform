package com.petties.petties.service;

import com.petties.petties.model.Clinic;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * SOS Session Manager
 *
 * Handles all Redis operations for SOS matching sessions.
 * Extracted from SosMatchingService for better separation of concerns.
 *
 * Session data stored:
 * - sos:matching:{bookingId}:clinics - List of clinic IDs to try
 * - sos:matching:{bookingId}:index - Current clinic index
 * - sos:matching:{bookingId}:createdAt - Session creation timestamp
 * - sos:matching:{bookingId}:notifiedAt - When current clinic was notified
 * - sos:lock:user:{userId} - Distributed lock for preventing race conditions
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SosSessionManager {

    private final RedisTemplate<String, Object> redisTemplate;

    // Redis key prefixes
    private static final String REDIS_KEY_PREFIX = "sos:matching:";
    private static final String REDIS_CLINICS_KEY = ":clinics";
    private static final String REDIS_INDEX_KEY = ":index";
    private static final String REDIS_CREATED_AT_KEY = ":createdAt";
    private static final String REDIS_NOTIFIED_AT_KEY = ":notifiedAt";
    private static final String REDIS_LOCK_PREFIX = "sos:lock:user:";
    private static final String REDIS_BOOKING_LOCK_PREFIX = "sos:lock:booking:";

    // Configuration
    private static final int CLINIC_TIMEOUT_SECONDS = 60;
    private static final int MAX_CLINICS_TO_TRY = 5;
    private static final int LOCK_TIMEOUT_SECONDS = 30;

    // ========== Distributed Lock Operations ==========

    /**
     * Acquire distributed lock for a user to prevent race conditions
     *
     * @param userId User ID
     * @return true if lock acquired, false if already locked
     */
    public boolean acquireUserLock(UUID userId) {
        String lockKey = REDIS_LOCK_PREFIX + userId;
        Boolean acquired = redisTemplate.opsForValue()
                .setIfAbsent(lockKey, "LOCKED", LOCK_TIMEOUT_SECONDS, TimeUnit.SECONDS);

        if (Boolean.TRUE.equals(acquired)) {
            log.debug("Acquired SOS lock for user: {}", userId);
            return true;
        }
        log.warn("Failed to acquire lock for user {}, request already in progress", userId);
        return false;
    }

    /**
     * Release user lock
     *
     * @param userId User ID
     */
    public void releaseUserLock(UUID userId) {
        String lockKey = REDIS_LOCK_PREFIX + userId;
        redisTemplate.delete(lockKey);
        log.debug("Released SOS lock for user: {}", userId);
    }

    /**
     * Acquire distributed lock for a specific booking
     */
    public boolean acquireBookingLock(UUID bookingId) {
        String lockKey = REDIS_BOOKING_LOCK_PREFIX + bookingId;
        Boolean acquired = redisTemplate.opsForValue()
                .setIfAbsent(lockKey, "LOCKED", LOCK_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        return Boolean.TRUE.equals(acquired);
    }

    /**
     * Release booking lock
     */
    public void releaseBookingLock(UUID bookingId) {
        String lockKey = REDIS_BOOKING_LOCK_PREFIX + bookingId;
        redisTemplate.delete(lockKey);
    }

    // ========== Session Operations ==========

    /**
     * Create a new matching session
     *
     * @param bookingId Booking ID
     * @param clinics   List of clinics to try (sorted by distance)
     */
    public void createSession(UUID bookingId, List<Clinic> clinics) {
        List<String> clinicIds = clinics.stream()
                .map(c -> c.getClinicId().toString())
                .limit(MAX_CLINICS_TO_TRY)
                .collect(Collectors.toList());

        long ttlSeconds = calculateSessionTtl();

        redisTemplate.opsForValue().set(
                REDIS_KEY_PREFIX + bookingId + REDIS_CLINICS_KEY,
                clinicIds,
                ttlSeconds,
                TimeUnit.SECONDS);

        redisTemplate.opsForValue().set(
                REDIS_KEY_PREFIX + bookingId + REDIS_INDEX_KEY,
                0,
                ttlSeconds,
                TimeUnit.SECONDS);

        redisTemplate.opsForValue().set(
                REDIS_KEY_PREFIX + bookingId + REDIS_CREATED_AT_KEY,
                System.currentTimeMillis(),
                ttlSeconds,
                TimeUnit.SECONDS);

        log.info("Created SOS session for booking {} with {} clinics", bookingId, clinicIds.size());
    }

    /**
     * Clear all session data for a booking
     *
     * @param bookingId Booking ID
     */
    public void clearSession(UUID bookingId) {
        redisTemplate.delete(REDIS_KEY_PREFIX + bookingId + REDIS_CLINICS_KEY);
        redisTemplate.delete(REDIS_KEY_PREFIX + bookingId + REDIS_INDEX_KEY);
        redisTemplate.delete(REDIS_KEY_PREFIX + bookingId + REDIS_CREATED_AT_KEY);
        redisTemplate.delete(REDIS_KEY_PREFIX + bookingId + REDIS_NOTIFIED_AT_KEY);
        log.debug("Cleared SOS session for booking: {}", bookingId);
    }

    // ========== Clinic Index Operations ==========

    /**
     * Get current clinic index
     *
     * @param bookingId Booking ID
     * @return Current index or empty if session not found
     */
    public Optional<Integer> getCurrentIndex(UUID bookingId) {
        Integer index = (Integer) redisTemplate.opsForValue()
                .get(REDIS_KEY_PREFIX + bookingId + REDIS_INDEX_KEY);
        return Optional.ofNullable(index);
    }

    /**
     * Get list of clinic IDs from session
     *
     * @param bookingId Booking ID
     * @return List of clinic ID strings or empty if session not found
     */
    @SuppressWarnings("unchecked")
    public Optional<List<String>> getClinicIds(UUID bookingId) {
        List<String> clinicIds = (List<String>) redisTemplate.opsForValue()
                .get(REDIS_KEY_PREFIX + bookingId + REDIS_CLINICS_KEY);
        return Optional.ofNullable(clinicIds);
    }

    /**
     * Increment clinic index to move to next clinic
     *
     * @param bookingId Booking ID
     * @param newIndex  New index value
     */
    public void updateIndex(UUID bookingId, int newIndex) {
        redisTemplate.opsForValue().set(
                REDIS_KEY_PREFIX + bookingId + REDIS_INDEX_KEY,
                newIndex,
                calculateSessionTtl(),
                TimeUnit.SECONDS);
        log.debug("Updated SOS session index to {} for booking {}", newIndex, bookingId);
    }

    // ========== Notification Timestamp Operations ==========

    /**
     * Update the timestamp when a clinic was notified
     * Used for accurate timeout calculation per clinic
     *
     * @param bookingId Booking ID
     */
    public void updateNotifiedAt(UUID bookingId) {
        redisTemplate.opsForValue().set(
                REDIS_KEY_PREFIX + bookingId + REDIS_NOTIFIED_AT_KEY,
                System.currentTimeMillis(),
                calculateSessionTtl(),
                TimeUnit.SECONDS);
        log.debug("Updated notifiedAt timestamp for booking {}", bookingId);
    }

    /**
     * Get the timestamp when current clinic was notified
     * Falls back to createdAt if notifiedAt not set
     *
     * @param bookingId Booking ID
     * @return Timestamp in milliseconds or empty if not found
     */
    public Optional<Long> getNotifiedAt(UUID bookingId) {
        Long notifiedAt = (Long) redisTemplate.opsForValue()
                .get(REDIS_KEY_PREFIX + bookingId + REDIS_NOTIFIED_AT_KEY);

        if (notifiedAt == null) {
            // Fallback to createdAt for backward compatibility
            notifiedAt = (Long) redisTemplate.opsForValue()
                    .get(REDIS_KEY_PREFIX + bookingId + REDIS_CREATED_AT_KEY);
        }

        return Optional.ofNullable(notifiedAt);
    }

    // ========== Timeout Check ==========

    /**
     * Check if current clinic has timed out
     *
     * @param bookingId Booking ID
     * @return true if timed out, false otherwise
     */
    public boolean hasCurrentClinicTimedOut(UUID bookingId) {
        Optional<Long> notifiedAt = getNotifiedAt(bookingId);
        if (notifiedAt.isEmpty()) {
            return false;
        }

        long elapsedSeconds = (System.currentTimeMillis() - notifiedAt.get()) / 1000;
        return elapsedSeconds >= CLINIC_TIMEOUT_SECONDS;
    }

    /**
     * Get elapsed seconds since current clinic was notified
     *
     * @param bookingId Booking ID
     * @return Elapsed seconds or 0 if not found
     */
    public long getElapsedSeconds(UUID bookingId) {
        Optional<Long> notifiedAt = getNotifiedAt(bookingId);
        if (notifiedAt.isEmpty()) {
            return 0;
        }
        return (System.currentTimeMillis() - notifiedAt.get()) / 1000;
    }

    // ========== Session Validation ==========

    /**
     * Check if session exists for a booking
     *
     * @param bookingId Booking ID
     * @return true if session exists
     */
    public boolean sessionExists(UUID bookingId) {
        return Boolean.TRUE.equals(
                redisTemplate.hasKey(REDIS_KEY_PREFIX + bookingId + REDIS_CLINICS_KEY));
    }

    /**
     * Check if there are more clinics to try
     *
     * @param bookingId Booking ID
     * @return true if more clinics available
     */
    public boolean hasMoreClinics(UUID bookingId) {
        Optional<Integer> currentIndex = getCurrentIndex(bookingId);
        Optional<List<String>> clinicIds = getClinicIds(bookingId);

        if (currentIndex.isEmpty() || clinicIds.isEmpty()) {
            return false;
        }

        int nextIndex = currentIndex.get() + 1;
        return nextIndex < clinicIds.get().size() && nextIndex < MAX_CLINICS_TO_TRY;
    }

    // ========== Configuration Getters ==========

    public int getClinicTimeoutSeconds() {
        return CLINIC_TIMEOUT_SECONDS;
    }

    public int getMaxClinicsToTry() {
        return MAX_CLINICS_TO_TRY;
    }

    /**
     * Check if there are any active SOS sessions in Redis
     * Used to optimize DB queries - skip if no active sessions
     *
     * @return true if there are active SOS sessions
     */
    public boolean hasActiveSessions() {
        try {
            var keys = redisTemplate.keys(REDIS_KEY_PREFIX + "*" + REDIS_CLINICS_KEY);
            return keys != null && !keys.isEmpty();
        } catch (Exception e) {
            log.warn("Error checking active SOS sessions: {}", e.getMessage());
            return true; // Default to query DB on error
        }
    }

    // ========== Private Helpers ==========

    private long calculateSessionTtl() {
        // TTL = timeout per clinic * max clinics + buffer
        return (long) CLINIC_TIMEOUT_SECONDS * MAX_CLINICS_TO_TRY + 60;
    }
}
