package com.petties.petties.service;

import com.petties.petties.dto.otp.EmailChangeOtpData;
import com.petties.petties.dto.otp.PasswordResetOtpData;
import com.petties.petties.dto.otp.PendingRegistrationData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Service for storing OTP data in Redis with automatic TTL expiration.
 *
 * Key patterns:
 * - Password Reset: "otp:password_reset:{email}"
 * - Registration: "otp:registration:{email}"
 * - Email Change: "otp:email_change:{userId}"
 *
 * TTL: 5 minutes (auto-deleted by Redis)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OtpRedisService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final String PASSWORD_RESET_PREFIX = "otp:password_reset:"; // key = otp:password_reset:email
    private static final String REGISTRATION_PREFIX = "otp:registration:"; // key = otp:registration:email
    private static final String EMAIL_CHANGE_PREFIX = "otp:email_change:"; // key = otp:email_change:userId
    private static final Duration OTP_TTL = Duration.ofMinutes(5); // 5 minutes
    // ============================================
    // PASSWORD RESET OTP
    // ============================================

    /**
     * Save password reset OTP data to Redis
     */
    public void savePasswordResetOtp(String email, String otpCode) {
        String key = PASSWORD_RESET_PREFIX + email.toLowerCase();

        PasswordResetOtpData data = PasswordResetOtpData.builder()
                .email(email.toLowerCase())
                .otpCode(otpCode)
                .attempts(0)
                .createdAt(LocalDateTime.now())
                .build();

        redisTemplate.opsForValue().set(key, data, OTP_TTL); // save to redis
        log.info("Password reset OTP saved to Redis for email={}", email);
    }

    /**
     * Get password reset OTP data from Redis
     */
    public Optional<PasswordResetOtpData> getPasswordResetOtp(String email) {
        String key = PASSWORD_RESET_PREFIX + email.toLowerCase();
        Object data = redisTemplate.opsForValue().get(key);

        if (data instanceof PasswordResetOtpData) {
            return Optional.of((PasswordResetOtpData) data);
        }
        return Optional.empty();
    }

    /**
     * Increment attempts for password reset OTP
     */
    public void incrementPasswordResetAttempts(String email) {
        String key = PASSWORD_RESET_PREFIX + email.toLowerCase(); // key = otp:password_reset:email
        Optional<PasswordResetOtpData> optData = getPasswordResetOtp(email);

        if (optData.isPresent()) {
            PasswordResetOtpData data = optData.get();
            data.incrementAttempts();

            // Keep remaining TTL
            Long ttl = redisTemplate.getExpire(key);
            if (ttl != null && ttl > 0) {
                redisTemplate.opsForValue().set(key, data, Duration.ofSeconds(ttl));
            }
        }
    }

    /**
     * Delete password reset OTP from Redis
     */
    public void deletePasswordResetOtp(String email) {
        String key = PASSWORD_RESET_PREFIX + email.toLowerCase();
        redisTemplate.delete(key);
        log.info("Password reset OTP deleted from Redis for email={}", email);
    }

    /**
     * Check if password reset OTP exists (for cooldown check)
     */
    public boolean hasPasswordResetOtp(String email) {
        String key = PASSWORD_RESET_PREFIX + email.toLowerCase();
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }

    /**
     * Get seconds since password reset OTP was created (for cooldown)
     */
    public long getPasswordResetCooldownRemaining(String email) {
        Optional<PasswordResetOtpData> optData = getPasswordResetOtp(email);
        if (optData.isPresent()) {
            long secondsSinceCreated = java.time.temporal.ChronoUnit.SECONDS.between(
                    optData.get().getCreatedAt(), LocalDateTime.now());
            long cooldownSeconds = 60;
            if (secondsSinceCreated < cooldownSeconds) {
                return cooldownSeconds - secondsSinceCreated;
            }
        }
        return 0;
    }

    // ============================================
    // REGISTRATION OTP
    // ============================================

    /**
     * Save pending registration data to Redis
     */
    public void savePendingRegistration(PendingRegistrationData data) {
        String key = REGISTRATION_PREFIX + data.getEmail().toLowerCase();
        data.setEmail(data.getEmail().toLowerCase());
        data.setCreatedAt(LocalDateTime.now());

        redisTemplate.opsForValue().set(key, data, OTP_TTL);
        log.info("Pending registration saved to Redis for email={}", data.getEmail());
    }

    /**
     * Get pending registration data from Redis
     */
    public Optional<PendingRegistrationData> getPendingRegistration(String email) {
        String key = REGISTRATION_PREFIX + email.toLowerCase();
        Object data = redisTemplate.opsForValue().get(key);

        if (data instanceof PendingRegistrationData) {
            return Optional.of((PendingRegistrationData) data);
        }
        return Optional.empty();
    }

    /**
     * Increment attempts for pending registration
     */
    public void incrementRegistrationAttempts(String email) {
        String key = REGISTRATION_PREFIX + email.toLowerCase();
        Optional<PendingRegistrationData> optData = getPendingRegistration(email);

        if (optData.isPresent()) {
            PendingRegistrationData data = optData.get();
            data.incrementAttempts();

            // Keep remaining TTL
            Long ttl = redisTemplate.getExpire(key);
            if (ttl != null && ttl > 0) {
                redisTemplate.opsForValue().set(key, data, Duration.ofSeconds(ttl));
            }
        }
    }

    /**
     * Delete pending registration from Redis
     */
    public void deletePendingRegistration(String email) {
        String key = REGISTRATION_PREFIX + email.toLowerCase();
        redisTemplate.delete(key);
        log.info("Pending registration deleted from Redis for email={}", email);
    }

    /**
     * Check if pending registration exists
     */
    public boolean hasPendingRegistration(String email) {
        String key = REGISTRATION_PREFIX + email.toLowerCase();
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }

    /**
     * Get seconds since registration OTP was created (for cooldown)
     */
    public long getRegistrationCooldownRemaining(String email) {
        Optional<PendingRegistrationData> optData = getPendingRegistration(email);
        if (optData.isPresent()) {
            long secondsSinceCreated = java.time.temporal.ChronoUnit.SECONDS.between(
                    optData.get().getCreatedAt(), LocalDateTime.now());
            long cooldownSeconds = 60;
            if (secondsSinceCreated < cooldownSeconds) {
                return cooldownSeconds - secondsSinceCreated;
            }
        }
        return 0;
    }

    /**
     * Check if username exists in any pending registration
     * Note: This requires scanning keys, use sparingly
     */
    public boolean isUsernamePendingRegistration(String username) {
        var keys = redisTemplate.keys(REGISTRATION_PREFIX + "*");
        if (keys == null)
            return false;

        for (String key : keys) {
            Object data = redisTemplate.opsForValue().get(key);
            if (data instanceof PendingRegistrationData) {
                PendingRegistrationData regData = (PendingRegistrationData) data;
                if (regData.getUsername().equalsIgnoreCase(username)) {
                    return true;
                }
            }
        }
        return false;
    }

    // ============================================
    // EMAIL CHANGE OTP
    // ============================================

    /**
     * Save email change OTP data to Redis
     * 
     * @param userId   UUID of user requesting email change
     * @param newEmail The new email to change to
     * @param otpCode  The OTP code
     */
    public void saveEmailChangeOtp(UUID userId, String newEmail, String otpCode) {
        String key = EMAIL_CHANGE_PREFIX + userId.toString();

        EmailChangeOtpData data = EmailChangeOtpData.builder()
                .userId(userId)
                .newEmail(newEmail.toLowerCase())
                .otpCode(otpCode)
                .attempts(0)
                .createdAt(LocalDateTime.now())
                .build();

        redisTemplate.opsForValue().set(key, data, OTP_TTL);
        log.info("Email change OTP saved to Redis for userId={}", userId);
    }

    /**
     * Get email change OTP data from Redis
     * 
     * @param userId UUID of user
     * @return Optional containing EmailChangeOtpData if exists
     */
    public Optional<EmailChangeOtpData> getEmailChangeOtp(UUID userId) {
        String key = EMAIL_CHANGE_PREFIX + userId.toString();
        Object data = redisTemplate.opsForValue().get(key);

        if (data instanceof EmailChangeOtpData) {
            return Optional.of((EmailChangeOtpData) data);
        }
        return Optional.empty();
    }

    /**
     * Delete email change OTP from Redis
     * 
     * @param userId UUID of user
     */
    public void deleteEmailChangeOtp(UUID userId) {
        String key = EMAIL_CHANGE_PREFIX + userId.toString();
        redisTemplate.delete(key);
        log.info("Email change OTP deleted from Redis for userId={}", userId);
    }

    /**
     * Increment attempts for email change OTP
     * 
     * @param userId UUID of user
     */
    public void incrementEmailChangeAttempts(UUID userId) {
        String key = EMAIL_CHANGE_PREFIX + userId.toString();
        Optional<EmailChangeOtpData> optData = getEmailChangeOtp(userId);

        if (optData.isPresent()) {
            EmailChangeOtpData data = optData.get();
            data.incrementAttempts();

            // Keep remaining TTL
            Long ttl = redisTemplate.getExpire(key);
            if (ttl != null && ttl > 0) {
                redisTemplate.opsForValue().set(key, data, Duration.ofSeconds(ttl));
            }
        }
    }

    /**
     * Get remaining cooldown seconds for email change OTP
     * 
     * @param userId UUID of user
     * @return Remaining cooldown seconds (0 if no cooldown)
     */
    public long getEmailChangeCooldownRemaining(UUID userId) {
        Optional<EmailChangeOtpData> optData = getEmailChangeOtp(userId);
        if (optData.isPresent()) {
            long secondsSinceCreated = java.time.temporal.ChronoUnit.SECONDS.between(
                    optData.get().getCreatedAt(), LocalDateTime.now());
            long cooldownSeconds = 60;
            if (secondsSinceCreated < cooldownSeconds) {
                return cooldownSeconds - secondsSinceCreated;
            }
        }
        return 0;
    }

    /**
     * Check if email change OTP exists
     * 
     * @param userId UUID of user
     * @return true if exists
     */
    public boolean hasEmailChangeOtp(UUID userId) {
        String key = EMAIL_CHANGE_PREFIX + userId.toString();
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }
}
