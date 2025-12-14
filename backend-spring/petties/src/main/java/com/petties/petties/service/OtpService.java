package com.petties.petties.service;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;

/**
 * Service quản lý OTP (One-Time Password)
 */
@Service
public class OtpService {

    private static final int OTP_LENGTH = 6;
    private static final int OTP_EXPIRY_MINUTES = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * Generate 6-digit OTP code
     * 
     * @return OTP string (e.g., "385921")
     */
    public String generateOtp() {
        StringBuilder otp = new StringBuilder();
        for (int i = 0; i < OTP_LENGTH; i++) {
            otp.append(RANDOM.nextInt(10));
        }
        return otp.toString();
    }

    /**
     * Calculate OTP expiry time (5 minutes from now)
     * 
     * @return Expiry LocalDateTime
     */
    public LocalDateTime calculateExpiryTime() {
        return LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES);
    }

    /**
     * Get OTP expiry duration in minutes
     */
    public int getExpiryMinutes() {
        return OTP_EXPIRY_MINUTES;
    }

    /**
     * Validate OTP format (6 digits)
     */
    public boolean isValidOtpFormat(String otp) {
        if (otp == null || otp.length() != OTP_LENGTH) {
            return false;
        }
        return otp.matches("\\d{6}");
    }
}
