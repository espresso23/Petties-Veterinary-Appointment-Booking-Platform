package com.petties.petties.service;

import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.dto.auth.AuthResponse;
import com.petties.petties.dto.auth.SendOtpRequest;
import com.petties.petties.dto.auth.SendOtpResponse;
import com.petties.petties.dto.auth.VerifyOtpRequest;
import com.petties.petties.dto.otp.PendingRegistrationData;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceAlreadyExistsException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.RefreshToken;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.RefreshTokenRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.util.TokenUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Service xu ly dang ky voi xac thuc OTP qua email.
 * Su dung Redis de luu pending registration voi TTL tu dong (5 phut).
 *
 * Flow:
 * 1. User gui thong tin dang ky -> Luu vao Redis -> Gui OTP qua email
 * 2. User nhap OTP -> Verify -> Tao User chinh thuc
 *
 * Redis Key: "otp:registration:{email}"
 * TTL: 5 minutes (auto-deleted by Redis)
 */
@Slf4j
@Service
public class RegistrationOtpService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final OtpService otpService;
    private final EmailService emailService;
    private final JwtTokenProvider tokenProvider;
    private final RefreshTokenRepository refreshTokenRepository;
    private final OtpRedisService otpRedisService;

    /**
     * DEV MODE: Khi true, bỏ qua xác thực OTP và tạo user trực tiếp.
     * Cấu hình trong application-{profile}.properties
     */
    private final boolean skipOtpVerification;

    private static final int RESEND_COOLDOWN_SECONDS = 60;
    private static final int MAX_ATTEMPTS = 5;

    public RegistrationOtpService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            OtpService otpService,
            EmailService emailService,
            JwtTokenProvider tokenProvider,
            RefreshTokenRepository refreshTokenRepository,
            OtpRedisService otpRedisService,
            @Value("${app.otp.skip-verification:false}") boolean skipOtpVerification) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.otpService = otpService;
        this.emailService = emailService;
        this.tokenProvider = tokenProvider;
        this.refreshTokenRepository = refreshTokenRepository;
        this.otpRedisService = otpRedisService;
        this.skipOtpVerification = skipOtpVerification;
    }

    /**
     * Gui OTP cho dang ky moi
     *
     * Flow:
     * 1. Validate username/email chua ton tai
     * 2. Check cooldown
     * 3. Luu pending registration vao Redis (TTL 5 phut)
     * 4. Gui email OTP
     *
     * DEV MODE: Neu skipOtpVerification=true, bo qua OTP va dang ky truc tiep
     * 
     * @return SendOtpResponse (normal) or AuthResponse (dev mode with skip OTP)
     */
    public Object sendRegistrationOtp(SendOtpRequest request) {
        String email = request.getEmail().toLowerCase().trim();

        // 1. Check username khong ton tai trong User table
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new ResourceAlreadyExistsException("Tên đăng nhập đã được sử dụng");
        }

        // 2. Check email khong ton tai trong User table
        if (userRepository.existsByEmail(email)) {
            throw new ResourceAlreadyExistsException("Email đã được sử dụng");
        }

        // DEV MODE: Skip OTP và đăng ký trực tiếp
        if (skipOtpVerification) {
            log.warn("[DEV MODE] OTP verification is DISABLED. Registering user directly without email verification.");
            return registerWithoutOtp(request, email);
        }

        // 3. Check username khong dang pending o email khac
        if (otpRedisService.isUsernamePendingRegistration(request.getUsername())) {
            throw new ResourceAlreadyExistsException("Tên đăng nhập đang được sử dụng trong yêu cầu đăng ký khác");
        }

        // 4. Check rate limiting - cooldown 60 giay
        long cooldownRemaining = otpRedisService.getRegistrationCooldownRemaining(email);
        if (cooldownRemaining > 0) {
            throw new BadRequestException(
                    String.format("Vui lòng đợi %d giây trước khi gửi lại mã OTP", cooldownRemaining));
        }

        // 5. Generate OTP
        String otpCode = otpService.generateOtp();

        // 6. Luu pending registration vao Redis (TTL 5 phut)
        PendingRegistrationData pendingData = PendingRegistrationData.builder()
                .username(request.getUsername())
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .phone(request.getPhone())
                .fullName(request.getFullName())
                .role(request.getRole().name())
                .otpCode(otpCode)
                .attempts(0)
                .createdAt(LocalDateTime.now())
                .build();

        otpRedisService.savePendingRegistration(pendingData);

        // 7. Gui email OTP (async)
        emailService.sendOtpEmail(email, request.getUsername(), otpCode);

        log.info("OTP sent for registration: email={}", email);

        return SendOtpResponse.builder()
                .message("Mã OTP đã được gửi đến email của bạn")
                .email(email)
                .expiryMinutes(otpService.getExpiryMinutes())
                .resendCooldownSeconds(RESEND_COOLDOWN_SECONDS)
                .build();
    }

    /**
     * [DEV MODE ONLY] Dang ky truc tiep khong can OTP
     * Chi su dung khi app.otp.skip-verification=true
     */
    @Transactional
    private AuthResponse registerWithoutOtp(SendOtpRequest request, String email) {
        // Tao User truc tiep
        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setPhone(request.getPhone());
        user.setFullName(request.getFullName());
        user.setRole(request.getRole());

        User savedUser = userRepository.save(user);

        // Generate tokens
        String accessToken = tokenProvider.generateToken(
                savedUser.getUserId(),
                savedUser.getUsername(),
                savedUser.getRole().name());
        String refreshToken = tokenProvider.generateRefreshToken(
                savedUser.getUserId(),
                savedUser.getUsername());

        // Save refresh token
        saveRefreshToken(savedUser.getUserId(), refreshToken);

        log.info("[DEV MODE] User registered without OTP verification: email={}", email);

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
     * Verify OTP va hoan tat dang ky
     *
     * Flow:
     * 1. Tim pending registration tu Redis
     * 2. Validate OTP (max attempts, dung/sai)
     * 3. Tao User chinh thuc
     * 4. Xoa pending registration tu Redis
     * 5. Generate tokens va return
     */
    @Transactional
    public AuthResponse verifyOtpAndRegister(VerifyOtpRequest request) {
        String email = request.getEmail().toLowerCase().trim();

        // 1. Tim pending registration tu Redis
        PendingRegistrationData pending = otpRedisService.getPendingRegistration(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy yêu cầu đăng ký. Mã OTP đã hết hạn hoặc chưa đăng ký."));

        // 2. Check max attempts
        if (pending.isMaxAttemptsReached()) {
            otpRedisService.deletePendingRegistration(email);
            throw new BadRequestException(
                    "Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng đăng ký lại.");
        }

        // 3. Validate OTP
        if (!pending.getOtpCode().equals(request.getOtpCode())) {
            // Increment attempts
            otpRedisService.incrementRegistrationAttempts(email);

            // Tinh so lan thu con lai
            int remainingAttempts = MAX_ATTEMPTS - pending.getAttempts() - 1;

            // Neu da het lan thu, xoa pending registration
            if (remainingAttempts <= 0) {
                otpRedisService.deletePendingRegistration(email);
                throw new BadRequestException(
                        "Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng đăng ký lại.");
            }

            throw new BadRequestException(
                    String.format("Mã OTP không đúng. Bạn còn %d lần thử.", remainingAttempts));
        }

        // 4. Double check username/email khong bi race condition
        if (userRepository.existsByUsername(pending.getUsername())) {
            otpRedisService.deletePendingRegistration(email);
            throw new ResourceAlreadyExistsException("Tên đăng nhập đã được sử dụng bởi người khác");
        }
        if (userRepository.existsByEmail(email)) {
            otpRedisService.deletePendingRegistration(email);
            throw new ResourceAlreadyExistsException("Email đã được sử dụng bởi người khác");
        }

        // 5. Tao User chinh thuc
        User user = new User();
        user.setUsername(pending.getUsername());
        user.setEmail(email);
        user.setPassword(pending.getPassword()); // Already hashed
        user.setPhone(pending.getPhone());
        user.setFullName(pending.getFullName());
        user.setRole(Role.valueOf(pending.getRole()));

        User savedUser = userRepository.save(user);

        // 6. Xoa pending registration tu Redis
        otpRedisService.deletePendingRegistration(email);

        // 7. Generate tokens
        String accessToken = tokenProvider.generateToken(
                savedUser.getUserId(),
                savedUser.getUsername(),
                savedUser.getRole().name());
        String refreshToken = tokenProvider.generateRefreshToken(
                savedUser.getUserId(),
                savedUser.getUsername());

        // 8. Save refresh token
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
     * Gui lai OTP
     *
     * Neu khong co pending registration (da het han), se bao loi yeu cau dang ky
     * lai.
     */
    public SendOtpResponse resendOtp(String email) {
        email = email.toLowerCase().trim();

        // Tim pending registration tu Redis
        PendingRegistrationData pending = otpRedisService.getPendingRegistration(email)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy yêu cầu đăng ký. Mã OTP đã hết hạn, vui lòng đăng ký lại."));

        // Check cooldown
        long cooldownRemaining = otpRedisService.getRegistrationCooldownRemaining(email);
        if (cooldownRemaining > 0) {
            throw new BadRequestException(
                    String.format("Vui lòng đợi %d giây trước khi gửi lại mã OTP", cooldownRemaining));
        }

        // Generate new OTP
        String newOtpCode = otpService.generateOtp();

        // Update pending registration voi OTP moi
        pending.setOtpCode(newOtpCode);
        pending.setAttempts(0); // Reset attempts on resend
        pending.setCreatedAt(LocalDateTime.now()); // Reset cooldown timer

        otpRedisService.savePendingRegistration(pending);

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
