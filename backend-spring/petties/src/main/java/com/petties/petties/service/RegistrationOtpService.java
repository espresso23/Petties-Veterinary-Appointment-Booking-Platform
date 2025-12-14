package com.petties.petties.service;

import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.dto.auth.AuthResponse;
import com.petties.petties.dto.auth.SendOtpRequest;
import com.petties.petties.dto.auth.SendOtpResponse;
import com.petties.petties.dto.auth.VerifyOtpRequest;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceAlreadyExistsException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.PendingRegistration;
import com.petties.petties.model.RefreshToken;
import com.petties.petties.model.User;
import com.petties.petties.repository.PendingRegistrationRepository;
import com.petties.petties.repository.RefreshTokenRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.util.TokenUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Service xử lý đăng ký với xác thực OTP qua email
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RegistrationOtpService {

    private final UserRepository userRepository;
    private final PendingRegistrationRepository pendingRegistrationRepository;
    private final PasswordEncoder passwordEncoder;
    private final OtpService otpService;
    private final EmailService emailService;
    private final JwtTokenProvider tokenProvider;
    private final RefreshTokenRepository refreshTokenRepository;

    private static final int RESEND_COOLDOWN_SECONDS = 60;

    /**
     * Gửi OTP cho đăng ký mới
     * 
     * Flow:
     * 1. Validate username/email chưa tồn tại
     * 2. Xóa pending registration cũ (nếu có)
     * 3. Tạo pending registration mới với OTP
     * 4. Gửi email OTP
     */
    @Transactional
    public SendOtpResponse sendRegistrationOtp(SendOtpRequest request) {
        // 1. Check username không tồn tại trong User table
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new ResourceAlreadyExistsException("Tên đăng nhập đã được sử dụng");
        }

        // 2. Check email không tồn tại trong User table
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResourceAlreadyExistsException("Email đã được sử dụng");
        }

        // 3. Check rate limiting - nếu pending registration tồn tại và chưa hết
        // cooldown
        pendingRegistrationRepository.findByEmail(request.getEmail()).ifPresent(existing -> {
            long secondsSinceCreated = ChronoUnit.SECONDS.between(existing.getCreatedAt(), LocalDateTime.now());
            if (secondsSinceCreated < RESEND_COOLDOWN_SECONDS) {
                long remainingSeconds = RESEND_COOLDOWN_SECONDS - secondsSinceCreated;
                throw new BadRequestException(
                        String.format("Vui lòng đợi %d giây trước khi gửi lại mã OTP", remainingSeconds));
            }
        });

        // 4. Xóa pending registration cũ (nếu có)
        pendingRegistrationRepository.deleteByEmail(request.getEmail());

        // 5. Generate OTP
        String otpCode = otpService.generateOtp();

        // 6. Tạo pending registration mới
        PendingRegistration pending = PendingRegistration.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .phone(request.getPhone())
                .fullName(request.getFullName())
                .role(request.getRole())
                .otpCode(otpCode)
                .otpExpiresAt(otpService.calculateExpiryTime())
                .attempts(0)
                .createdAt(LocalDateTime.now())
                .build();

        pendingRegistrationRepository.save(pending);

        // 7. Gửi email OTP (async)
        emailService.sendOtpEmail(request.getEmail(), request.getUsername(), otpCode);

        log.info("OTP sent for registration: email={}", request.getEmail());

        return SendOtpResponse.builder()
                .message("Mã OTP đã được gửi đến email của bạn")
                .email(request.getEmail())
                .expiryMinutes(otpService.getExpiryMinutes())
                .resendCooldownSeconds(RESEND_COOLDOWN_SECONDS)
                .build();
    }

    /**
     * Verify OTP và hoàn tất đăng ký
     * 
     * Flow:
     * 1. Tìm pending registration by email
     * 2. Validate OTP
     * 3. Tạo User chính thức
     * 4. Xóa pending registration
     * 5. Generate tokens và return
     */
    @Transactional
    public AuthResponse verifyOtpAndRegister(VerifyOtpRequest request) {
        // 1. Tìm pending registration
        PendingRegistration pending = pendingRegistrationRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy yêu cầu đăng ký. Vui lòng đăng ký lại."));

        // 2. Check max attempts
        if (pending.isMaxAttemptsReached()) {
            pendingRegistrationRepository.delete(pending);
            throw new BadRequestException(
                    "Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng đăng ký lại.");
        }

        // 3. Check OTP expired
        if (pending.isOtpExpired()) {
            throw new BadRequestException(
                    "Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.");
        }

        // 4. Validate OTP
        if (!pending.getOtpCode().equals(request.getOtpCode())) {
            // IMPORTANT: Dùng method với REQUIRES_NEW transaction để đảm bảo
            // increment được commit ngay lập tức, không bị rollback bởi exception
            pendingRegistrationRepository.incrementAttemptsByEmail(request.getEmail());

            // Cần re-fetch để lấy giá trị attempts mới
            int currentAttempts = pending.getAttempts() + 1;
            int remainingAttempts = 5 - currentAttempts;

            // Nếu đã hết lần thử, xóa pending registration
            if (remainingAttempts <= 0) {
                pendingRegistrationRepository.deleteByEmailWithNewTransaction(request.getEmail());
                throw new BadRequestException(
                        "Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng đăng ký lại.");
            }

            throw new BadRequestException(
                    String.format("Mã OTP không đúng. Bạn còn %d lần thử.", remainingAttempts));
        }

        // 5. Double check username/email không bị race condition
        if (userRepository.existsByUsername(pending.getUsername())) {
            pendingRegistrationRepository.delete(pending);
            throw new ResourceAlreadyExistsException("Tên đăng nhập đã được sử dụng bởi người khác");
        }
        if (userRepository.existsByEmail(pending.getEmail())) {
            pendingRegistrationRepository.delete(pending);
            throw new ResourceAlreadyExistsException("Email đã được sử dụng bởi người khác");
        }

        // 6. Tạo User chính thức
        User user = new User();
        user.setUsername(pending.getUsername());
        user.setEmail(pending.getEmail());
        user.setPassword(pending.getPassword()); // Already hashed
        user.setPhone(pending.getPhone());
        user.setFullName(pending.getFullName());
        user.setRole(pending.getRole());

        User savedUser = userRepository.save(user);

        // 7. Xóa pending registration
        pendingRegistrationRepository.delete(pending);

        // 8. Generate tokens
        String accessToken = tokenProvider.generateToken(
                savedUser.getUserId(),
                savedUser.getUsername(),
                savedUser.getRole().name());
        String refreshToken = tokenProvider.generateRefreshToken(
                savedUser.getUserId(),
                savedUser.getUsername());

        // 9. Save refresh token
        saveRefreshToken(savedUser.getUserId(), refreshToken);

        log.info("User registered successfully via OTP: email={}", savedUser.getEmail());

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .userId(savedUser.getUserId())
                .username(savedUser.getUsername())
                .email(savedUser.getEmail())
                .fullName(savedUser.getFullName())
                .role(savedUser.getRole().name())
                .build();
    }

    /**
     * Gửi lại OTP
     */
    @Transactional
    public SendOtpResponse resendOtp(String email) {
        PendingRegistration pending = pendingRegistrationRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy yêu cầu đăng ký. Vui lòng đăng ký lại."));

        // Check cooldown
        long secondsSinceCreated = ChronoUnit.SECONDS.between(pending.getCreatedAt(), LocalDateTime.now());
        if (secondsSinceCreated < RESEND_COOLDOWN_SECONDS) {
            long remainingSeconds = RESEND_COOLDOWN_SECONDS - secondsSinceCreated;
            throw new BadRequestException(
                    String.format("Vui lòng đợi %d giây trước khi gửi lại mã OTP", remainingSeconds));
        }

        // Generate new OTP
        String newOtpCode = otpService.generateOtp();
        pending.setOtpCode(newOtpCode);
        pending.setOtpExpiresAt(otpService.calculateExpiryTime());
        pending.setAttempts(0); // Reset attempts on resend
        pending.setCreatedAt(LocalDateTime.now()); // Reset cooldown timer

        pendingRegistrationRepository.save(pending);

        // Send email
        emailService.sendOtpEmail(email, pending.getUsername(), newOtpCode);

        log.info("OTP resent for registration: email={}", email);

        return SendOtpResponse.builder()
                .message("Mã OTP mới đã được gửi đến email của bạn")
                .email(email)
                .expiryMinutes(otpService.getExpiryMinutes())
                .resendCooldownSeconds(RESEND_COOLDOWN_SECONDS)
                .build();
    }

    private void saveRefreshToken(UUID userId, String refreshToken) {
        String tokenHash = TokenUtil.hashToken(refreshToken);
        LocalDateTime expiresAt = LocalDateTime.ofInstant(
                tokenProvider.getExpirationDateFromToken(refreshToken).toInstant(),
                java.time.ZoneId.systemDefault());

        RefreshToken token = new RefreshToken();
        token.setUserId(userId);
        token.setTokenHash(tokenHash);
        token.setExpiresAt(expiresAt);
        refreshTokenRepository.save(token);
    }
}
