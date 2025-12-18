package com.petties.petties.service;

import com.petties.petties.dto.auth.ForgotPasswordRequest;
import com.petties.petties.dto.auth.MessageResponse;
import com.petties.petties.dto.auth.ResetPasswordRequest;
import com.petties.petties.dto.auth.SendOtpResponse;
import com.petties.petties.dto.otp.PasswordResetOtpData;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.User;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service xu ly reset password voi xac thuc OTP qua email.
 * Su dung Redis de luu OTP voi TTL tu dong (5 phut).
 *
 * Flow:
 * 1. User gui email -> Tao OTP luu Redis -> Gui email
 * 2. User nhap OTP + password moi -> Verify OTP -> Update password
 *
 * Redis Key: "otp:password_reset:{email}"
 * TTL: 5 minutes (auto-deleted by Redis)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final OtpService otpService;
    private final EmailService emailService;
    private final OtpRedisService otpRedisService;

    private static final int RESEND_COOLDOWN_SECONDS = 60;
    private static final int MAX_ATTEMPTS = 5;

    /**
     * Gui OTP de reset password
     *
     * Flow:
     * 1. Validate email ton tai trong he thong
     * 2. Check rate limiting (cooldown 60 giay)
     * 3. Tao OTP moi va luu vao Redis (TTL 5 phut)
     * 4. Gui email OTP
     */
    public SendOtpResponse sendPasswordResetOtp(ForgotPasswordRequest request) {
        String email = request.getEmail().toLowerCase().trim();

        // 1. Check user ton tai voi email
        userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy tài khoản với email này"));

        // 2. Check rate limiting - cooldown 60 giay
        long cooldownRemaining = otpRedisService.getPasswordResetCooldownRemaining(email);
        if (cooldownRemaining > 0) {
            throw new BadRequestException(
                    String.format("Vui lòng đợi %d giây trước khi gửi lại mã OTP", cooldownRemaining));
        }

        // 3. Generate OTP va luu vao Redis (TTL 5 phut)
        String otpCode = otpService.generateOtp();
        otpRedisService.savePasswordResetOtp(email, otpCode);

        // 4. Gui email OTP (async)
        emailService.sendPasswordResetOtpEmail(email, otpCode);

        log.info("Password reset OTP sent to email={}", email);

        return SendOtpResponse.builder()
                .message("Mã OTP đã được gửi đến email của bạn")
                .email(email)
                .expiryMinutes(otpService.getExpiryMinutes())
                .resendCooldownSeconds(RESEND_COOLDOWN_SECONDS)
                .build();
    }

    /**
     * Verify OTP va reset password
     *
     * Flow:
     * 1. Validate confirmPassword match newPassword
     * 2. Tim password reset OTP tu Redis
     * 3. Validate OTP (max attempts, dung/sai)
     * 4. Update password cua user
     * 5. Xoa password reset OTP tu Redis
     */
    @Transactional
    public MessageResponse verifyOtpAndResetPassword(ResetPasswordRequest request) {
        String email = request.getEmail().toLowerCase().trim();

        // 1. Validate confirmPassword match newPassword
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BadRequestException("Mật khẩu xác nhận không khớp");
        }

        // 2. Tim password reset OTP tu Redis
        PasswordResetOtpData otpData = otpRedisService.getPasswordResetOtp(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy yêu cầu đặt lại mật khẩu. Mã OTP đã hết hạn hoặc chưa được yêu cầu."));

        // 3. Check max attempts truoc
        if (otpData.isMaxAttemptsReached()) {
            otpRedisService.deletePasswordResetOtp(email);
            throw new BadRequestException(
                    "Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng yêu cầu gửi mã OTP mới.");
        }

        // 4. Validate OTP code
        if (!otpData.getOtpCode().equals(request.getOtpCode())) {
            // Increment attempts
            otpRedisService.incrementPasswordResetAttempts(email);

            // Tinh so lan thu con lai
            int remainingAttempts = MAX_ATTEMPTS - otpData.getAttempts() - 1;

            // Neu da het lan thu, xoa OTP
            if (remainingAttempts <= 0) {
                otpRedisService.deletePasswordResetOtp(email);
                throw new BadRequestException(
                        "Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng yêu cầu gửi mã OTP mới.");
            }

            throw new BadRequestException(
                    String.format("Mã OTP không đúng. Bạn còn %d lần thử.", remainingAttempts));
        }

        // 5. Tim user va update password
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy tài khoản với email này"));

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // 6. Xoa password reset OTP tu Redis
        otpRedisService.deletePasswordResetOtp(email);

        log.info("Password reset successfully for email={}", email);

        return MessageResponse.of("Đổi mật khẩu thành công");
    }

    /**
     * Gui lai OTP reset password
     *
     * Neu khong co OTP record (da het han), se tao moi.
     */
    public SendOtpResponse resendPasswordResetOtp(String email) {
        email = email.toLowerCase().trim();

        // Check user ton tai
        userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy tài khoản với email này"));

        // Check cooldown
        long cooldownRemaining = otpRedisService.getPasswordResetCooldownRemaining(email);
        if (cooldownRemaining > 0) {
            throw new BadRequestException(
                    String.format("Vui lòng đợi %d giây trước khi gửi lại mã OTP", cooldownRemaining));
        }

        // Generate OTP moi va luu vao Redis (TTL 5 phut)
        String otpCode = otpService.generateOtp();
        otpRedisService.savePasswordResetOtp(email, otpCode);

        // Gui email
        emailService.sendPasswordResetOtpEmail(email, otpCode);

        log.info("Password reset OTP resent to email={}", email);

        return SendOtpResponse.builder()
                .message("Mã OTP mới đã được gửi đến email của bạn")
                .email(email)
                .expiryMinutes(otpService.getExpiryMinutes())
                .resendCooldownSeconds(RESEND_COOLDOWN_SECONDS)
                .build();
    }
}
