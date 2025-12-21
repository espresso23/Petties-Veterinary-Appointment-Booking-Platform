package com.petties.petties.service;

import com.petties.petties.dto.auth.UserResponse;
import com.petties.petties.dto.otp.EmailChangeOtpData;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.User;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Service xu ly thay doi email voi xac thuc OTP.
 *
 * Flow:
 * 1. User yeu cau thay doi email -> Validate email -> Tao OTP luu Redis -> Gui
 * OTP den email moi
 * 2. User nhap OTP -> Verify OTP -> Update email trong database
 *
 * Redis Key: "otp:email_change:{userId}"
 * TTL: 5 minutes (auto-deleted by Redis)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailChangeService {

    private final UserRepository userRepository;
    private final OtpService otpService;
    private final EmailService emailService;
    private final OtpRedisService otpRedisService;

    /**
     * Yeu cau thay doi email.
     *
     * @param userId   UUID cua user hien tai
     * @param newEmail Email moi can thay doi
     * @return Thong bao thanh cong
     */
    public String requestEmailChange(UUID userId, String newEmail) {
        newEmail = newEmail.toLowerCase().trim();

        // 1. Tim user
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

        // 2. Validate email moi khong trung voi email hien tai
        if (user.getEmail().equalsIgnoreCase(newEmail)) {
            throw new BadRequestException("Email mới phải khác email hiện tại");
        }

        // 3. Check email moi chua duoc su dung boi user khac
        if (userRepository.existsByEmailAndUserIdNot(newEmail, userId)) {
            throw new BadRequestException("Email đã được sử dụng bởi tài khoản khác");
        }

        // 4. Check rate limiting - cooldown 60 giay
        long cooldownRemaining = otpRedisService.getEmailChangeCooldownRemaining(userId);
        if (cooldownRemaining > 0) {
            throw new BadRequestException(
                    String.format("Vui lòng đợi %d giây trước khi gửi lại mã OTP", cooldownRemaining));
        }

        // 5. Generate OTP va luu vao Redis (TTL 5 phut)
        String otpCode = otpService.generateOtp();
        otpRedisService.saveEmailChangeOtp(userId, newEmail, otpCode);

        // 6. Gui email OTP den email moi (async)
        emailService.sendEmailChangeOtpEmail(newEmail, otpCode);

        log.info("Email change OTP sent to newEmail={} for userId={}", newEmail, userId);

        return "OTP đã được gửi đến email mới";
    }

    /**
     * Xác nhận thay đổi email bằng OTP.
     *
     * @param userId   UUID cua user hien tai
     * @param newEmail Email moi (phai khop voi email da yeu cau)
     * @param otp      Ma OTP 6 so
     * @return UserResponse sau khi cap nhat email
     */
    @Transactional
    public UserResponse verifyAndChangeEmail(UUID userId, String newEmail, String otp) {
        newEmail = newEmail.toLowerCase().trim();

        // 1. Tim user
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

        // 2. Lay OTP data tu Redis
        EmailChangeOtpData otpData = otpRedisService.getEmailChangeOtp(userId)
                .orElseThrow(() -> new BadRequestException(
                        "Mã OTP không chính xác hoặc đã hết hạn"));

        // 3. Validate email moi khop voi email trong OTP data
        if (!otpData.getNewEmail().equalsIgnoreCase(newEmail)) {
            throw new BadRequestException("Email mới không khớp với yêu cầu trước đó");
        }

        // 4. Check max attempts truoc
        if (otpData.isMaxAttemptsReached()) {
            otpRedisService.deleteEmailChangeOtp(userId);
            throw new BadRequestException(
                    "Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng yêu cầu gửi mã OTP mới.");
        }

        // 5. Validate OTP code
        if (!otpData.getOtpCode().equals(otp)) {
            // Increment attempts
            otpRedisService.incrementEmailChangeAttempts(userId);

            // Tinh so lan thu con lai
            int remainingAttempts = otpData.getRemainingAttempts() - 1;

            // Neu da het lan thu, xoa OTP
            if (remainingAttempts <= 0) {
                otpRedisService.deleteEmailChangeOtp(userId);
                throw new BadRequestException(
                        "Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng yêu cầu gửi mã OTP mới.");
            }

            throw new BadRequestException(
                    String.format("Mã OTP không đúng. Bạn còn %d lần thử.", remainingAttempts));
        }

        // 6. Kiểm tra lại email mới chưa được sử dụng bởi user khác (double-check)
        if (userRepository.existsByEmailAndUserIdNot(newEmail, userId)) {
            otpRedisService.deleteEmailChangeOtp(userId);
            throw new BadRequestException("Email đã được sử dụng bởi tài khoản khác");
        }

        // 7. Update email của user
        String oldEmail = user.getEmail();
        user.setEmail(newEmail);
        user = userRepository.save(user);

        // 8. Xoa OTP tu Redis
        otpRedisService.deleteEmailChangeOtp(userId);

        log.info("Email changed successfully for userId={} from {} to {}", userId, oldEmail, newEmail);

        return mapToResponse(user);
    }

    /**
     * Gui lai OTP thay doi email.
     *
     * @param userId UUID cua user hien tai
     * @return Thong bao thanh cong
     */
    public String resendEmailChangeOtp(UUID userId) {
        // 1. Kiểm tra user tồn tại
        userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

        // 2. Lay OTP data hien tai tu Redis
        EmailChangeOtpData otpData = otpRedisService.getEmailChangeOtp(userId)
                .orElseThrow(() -> new BadRequestException(
                        "Không có yêu cầu thay đổi email. Vui lòng tạo yêu cầu mới."));

        // 3. Check cooldown
        long cooldownRemaining = otpRedisService.getEmailChangeCooldownRemaining(userId);
        if (cooldownRemaining > 0) {
            throw new BadRequestException(
                    String.format("Vui lòng đợi %d giây trước khi gửi lại mã OTP", cooldownRemaining));
        }

        // 4. Kiểm tra lại email mới chưa được sử dụng bởi user khác
        if (userRepository.existsByEmailAndUserIdNot(otpData.getNewEmail(), userId)) {
            otpRedisService.deleteEmailChangeOtp(userId);
            throw new BadRequestException("Email đã được sử dụng bởi tài khoản khác");
        }

        // 5. Generate OTP moi va luu vao Redis (TTL 5 phut)
        String newOtpCode = otpService.generateOtp();
        otpRedisService.saveEmailChangeOtp(userId, otpData.getNewEmail(), newOtpCode);

        // 6. Gui email
        emailService.sendEmailChangeOtpEmail(otpData.getNewEmail(), newOtpCode);

        log.info("Email change OTP resent to {} for userId={}", otpData.getNewEmail(), userId);

        return "Mã OTP mới đã được gửi đến email mới";
    }

    /**
     * Huy yêu cầu thay đổi email.
     * Xóa OTP record từ Redis để user có thể nhập email mới không cần đợi cooldown.
     *
     * @param userId UUID cua user hien tai
     * @return Thong bao thanh cong
     */
    public String cancelEmailChange(UUID userId) {
        // Xoa OTP record tu Redis (neu ton tai)
        otpRedisService.deleteEmailChangeOtp(userId);

        log.info("Email change request cancelled for userId={}", userId);

        return "Da huy yeu cau thay doi email";
    }

    /**
     * Map User entity sang UserResponse DTO.
     */
    private UserResponse mapToResponse(User user) {
        return UserResponse.builder()
                .userId(user.getUserId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .avatar(user.getAvatar())
                .role(user.getRole())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
