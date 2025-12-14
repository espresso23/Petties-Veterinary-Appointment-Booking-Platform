package com.petties.petties.model;

import com.petties.petties.model.enums.Role;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity lưu thông tin đăng ký chờ xác thực OTP.
 * Record sẽ bị xóa sau khi:
 * - OTP được verify thành công → User được tạo
 * - OTP hết hạn → Cleanup job xóa
 */
@Entity
@Table(name = "pending_registrations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PendingRegistration {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "username", nullable = false, length = 50)
    private String username;

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Column(name = "password", nullable = false)
    private String password; // Already hashed

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "full_name", length = 100)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private Role role;

    @Column(name = "otp_code", nullable = false, length = 6)
    private String otpCode;

    @Column(name = "otp_expires_at", nullable = false)
    private LocalDateTime otpExpiresAt;

    @Column(name = "attempts", nullable = false)
    @Builder.Default
    private Integer attempts = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /**
     * Check if OTP is expired
     */
    public boolean isOtpExpired() {
        return LocalDateTime.now().isAfter(otpExpiresAt);
    }

    /**
     * Check if max attempts reached (5 attempts)
     */
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
