package com.petties.petties.dto.otp;

import lombok.*;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * DTO for Pending Registration stored in Redis.
 * TTL is managed by Redis EXPIRE command (5 minutes).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PendingRegistrationData implements Serializable {

    private String username;
    private String email;
    private String password; // Already hashed
    private String phone;
    private String fullName;
    private String role;
    private String otpCode;
    private int attempts;
    @com.fasterxml.jackson.databind.annotation.JsonSerialize(using = com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer.class)
    @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer.class)
    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    /**
     * Check if max attempts reached (5 attempts)
     */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isMaxAttemptsReached() {
        return attempts >= 5;
    }

    /**
     * Increment attempt counter
     */
    public void incrementAttempts() {
        this.attempts++;
    }
}
