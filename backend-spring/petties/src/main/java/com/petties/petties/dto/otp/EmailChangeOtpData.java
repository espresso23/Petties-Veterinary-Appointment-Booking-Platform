package com.petties.petties.dto.otp;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO for Email Change OTP stored in Redis.
 * TTL is managed by Redis EXPIRE command (5 minutes).
 *
 * Key pattern: "otp:email_change:{userId}"
 * Value: EmailChangeOtpData (serialized as JSON)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailChangeOtpData implements Serializable {

    /**
     * UUID cua user dang thuc hien thay doi email
     */
    private UUID userId;

    /**
     * Email moi ma user muon thay doi sang
     */
    private String newEmail;

    /**
     * Ma OTP 6 so
     */
    private String otpCode;

    /**
     * So lan thu nhap OTP sai
     */
    private int attempts;

    /**
     * Thoi gian tao OTP
     */
    @JsonSerialize(using = LocalDateTimeSerializer.class)
    @JsonDeserialize(using = LocalDateTimeDeserializer.class)
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    /**
     * Max attempts = 5
     */
    private static final int MAX_ATTEMPTS = 5;

    /**
     * Kiem tra da vuot qua so lan thu toi da chua
     */
    @JsonIgnore
    public boolean isMaxAttemptsReached() {
        return attempts >= MAX_ATTEMPTS;
    }

    /**
     * Tang so lan thu
     */
    public void incrementAttempts() {
        this.attempts++;
    }

    /**
     * Lay so lan thu con lai
     */
    @JsonIgnore
    public int getRemainingAttempts() {
        return Math.max(0, MAX_ATTEMPTS - attempts);
    }
}
