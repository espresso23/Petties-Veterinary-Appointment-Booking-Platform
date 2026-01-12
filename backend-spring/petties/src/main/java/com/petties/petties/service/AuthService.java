package com.petties.petties.service;

import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.auth.AuthResponse;
import com.petties.petties.dto.auth.GoogleSignInRequest;
import com.petties.petties.dto.auth.LoginRequest;
import com.petties.petties.dto.auth.RegisterRequest;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceAlreadyExistsException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.exception.UnauthorizedException;
import com.petties.petties.model.BlacklistedToken;
import com.petties.petties.model.RefreshToken;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.repository.RefreshTokenRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.util.TokenUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

        private final UserRepository userRepository;
        private final PasswordEncoder passwordEncoder;
        private final JwtTokenProvider tokenProvider;
        private final AuthenticationManager authenticationManager;
        private final RefreshTokenRepository refreshTokenRepository;
        private final BlacklistedTokenRepository blacklistedTokenRepository;
        private final GoogleAuthService googleAuthService;

        @Transactional
        public AuthResponse register(RegisterRequest request) {
                // Check if username or email already exists
                if (userRepository.existsByUsername(request.getUsername())) {
                        throw new ResourceAlreadyExistsException("Username already exists");
                }

                if (userRepository.existsByEmail(request.getEmail())) {
                        throw new ResourceAlreadyExistsException("Email already exists");
                }

                // Create new user
                User user = new User();
                user.setUsername(request.getUsername());
                user.setPassword(passwordEncoder.encode(request.getPassword()));
                user.setEmail(request.getEmail());
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

                // Save refresh token to database
                saveRefreshToken(savedUser.getUserId(), refreshToken);

                return AuthResponse.builder()
                                .accessToken(accessToken)
                                .refreshToken(refreshToken)
                                .tokenType("Bearer")
                                .userId(savedUser.getUserId())
                                .username(savedUser.getUsername())
                                .email(savedUser.getEmail())
                                .fullName(savedUser.getFullName() != null ? savedUser.getFullName()
                                                : savedUser.getUsername())
                                .avatar(savedUser.getAvatar())
                                .role(savedUser.getRole().name())
                                .build();
        }

        @Transactional
        public AuthResponse login(LoginRequest request) {
                Authentication authentication = authenticationManager.authenticate(
                                new UsernamePasswordAuthenticationToken(
                                                request.getUsername(),
                                                request.getPassword()));

                SecurityContextHolder.getContext().setAuthentication(authentication);

                UserDetailsServiceImpl.UserPrincipal userPrincipal = (UserDetailsServiceImpl.UserPrincipal) authentication
                                .getPrincipal();

                String token = tokenProvider.generateToken(
                                userPrincipal.getUserId(),
                                userPrincipal.getUsername(),
                                userPrincipal.getRole());

                User user = userRepository.findByIdWithWorkingClinic(userPrincipal.getUserId())
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                // Generate refresh token
                String refreshToken = tokenProvider.generateRefreshToken(
                                user.getUserId(),
                                user.getUsername());

                // Delete old refresh tokens for this user (rotation)
                refreshTokenRepository.deleteAllByUserId(user.getUserId());

                // Save new refresh token
                saveRefreshToken(user.getUserId(), refreshToken);

                return AuthResponse.builder()
                                .accessToken(token)
                                .refreshToken(refreshToken)
                                .tokenType("Bearer")
                                .userId(user.getUserId())
                                .username(user.getUsername())
                                .email(user.getEmail())
                                .fullName(user.getFullName() != null ? user.getFullName() : user.getUsername())
                                .avatar(user.getAvatar())
                                .role(user.getRole().name())
                                .workingClinicId(user.getWorkingClinic() != null ? user.getWorkingClinic().getClinicId()
                                                : null)
                                .workingClinicName(user.getWorkingClinic() != null ? user.getWorkingClinic().getName()
                                                : null)
                                .build();
        }

        @Transactional
        public AuthResponse refreshToken(String refreshToken) {
                // Validate token format and expiration
                if (!tokenProvider.validateToken(refreshToken)) {
                        throw new UnauthorizedException("Token làm mới không hợp lệ hoặc đã hết hạn");
                }

                // Check if it's actually a refresh token
                String tokenType = tokenProvider.getTokenType(refreshToken);
                if (!"refresh".equals(tokenType)) {
                        throw new UnauthorizedException("Loại token không hợp lệ");
                }

                // Check if token exists in database
                String tokenHash = TokenUtil.hashToken(refreshToken);
                RefreshToken storedToken = refreshTokenRepository.findByTokenHash(tokenHash)
                                .orElseThrow(() -> new UnauthorizedException("Không tìm thấy token làm mới"));

                // Check if token is expired
                if (storedToken.isExpired()) {
                        refreshTokenRepository.delete(storedToken);
                        throw new UnauthorizedException("Token làm mới đã hết hạn");
                }

                // Get user info
                String username = tokenProvider.getUsernameFromToken(refreshToken);
                UUID userId = tokenProvider.getUserIdFromToken(refreshToken);

                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                // Generate new tokens
                String newAccessToken = tokenProvider.generateToken(
                                userId,
                                username,
                                user.getRole().name());
                String newRefreshToken = tokenProvider.generateRefreshToken(
                                userId,
                                username);

                // Delete old refresh token (rotation)
                refreshTokenRepository.delete(storedToken);

                // Save new refresh token
                saveRefreshToken(userId, newRefreshToken);

                return AuthResponse.builder()
                                .accessToken(newAccessToken)
                                .refreshToken(newRefreshToken)
                                .tokenType("Bearer")
                                .userId(user.getUserId())
                                .username(user.getUsername())
                                .email(user.getEmail())
                                .fullName(user.getFullName() != null ? user.getFullName() : user.getUsername())
                                .avatar(user.getAvatar())
                                .role(user.getRole().name())
                                .workingClinicId(user.getWorkingClinic() != null ? user.getWorkingClinic().getClinicId()
                                                : null)
                                .workingClinicName(user.getWorkingClinic() != null ? user.getWorkingClinic().getName()
                                                : null)
                                .build();
        }

        @Transactional
        public void logout(String accessToken) {
                if (!tokenProvider.validateToken(accessToken)) {
                        throw new UnauthorizedException("Token truy cập không hợp lệ");
                }

                // Check if it's an access token
                String tokenType = tokenProvider.getTokenType(accessToken);
                if (!"access".equals(tokenType)) {
                        throw new UnauthorizedException("Loại token không hợp lệ");
                }

                UUID userId = tokenProvider.getUserIdFromToken(accessToken);
                LocalDateTime expiresAt = LocalDateTime.ofInstant(
                                tokenProvider.getExpirationDateFromToken(accessToken).toInstant(),
                                java.time.ZoneId.systemDefault());

                // Blacklist the access token
                String tokenHash = TokenUtil.hashToken(accessToken);
                BlacklistedToken blacklistedToken = new BlacklistedToken();
                blacklistedToken.setTokenHash(tokenHash);
                blacklistedToken.setUserId(userId);
                blacklistedToken.setExpiresAt(expiresAt);
                blacklistedTokenRepository.save(blacklistedToken);

                // Delete all refresh tokens for this user
                refreshTokenRepository.deleteAllByUserId(userId);
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

        @Transactional(readOnly = true)
        public User getCurrentUser() {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

                if (authentication == null || !authentication.isAuthenticated()) {
                        log.warn("Attempted to get current user but no authentication found in SecurityContext");
                        throw new UnauthorizedException("Người dùng chưa được xác thực");
                }

                Object principal = authentication.getPrincipal();

                if (principal instanceof UserDetailsServiceImpl.UserPrincipal) {
                        UserDetailsServiceImpl.UserPrincipal userPrincipal = (UserDetailsServiceImpl.UserPrincipal) principal;
                        return userRepository.findById(userPrincipal.getUserId())
                                        .orElseThrow(() -> {
                                                log.error("User not found in database for ID: {}",
                                                                userPrincipal.getUserId());
                                                return new ResourceNotFoundException("User not found");
                                        });
                }

                // Log the actual class type to helps debug why it's not UserPrincipal
                String principalType = principal != null ? principal.getClass().getName() : "null";
                log.error("Unexpected principal type in SecurityContext: {}. Expected UserPrincipal.", principalType);

                // Fallback for cases where principal might be just the username (String)
                if (principal instanceof String) {
                        String username = (String) principal;
                        return userRepository.findByUsername(username)
                                        .orElseThrow(() -> {
                                                log.error("User not found in database for username: {}", username);
                                                return new ResourceNotFoundException("User not found");
                                        });
                }

                throw new UnauthorizedException("Không thể lấy thông tin người dùng từ phiên đăng nhập");
        }

        /**
         * Login or register with Google Sign-In
         * 
         * @param request Contains idToken and platform
         * @return AuthResponse with JWT tokens
         */
        @Transactional
        public AuthResponse loginWithGoogle(GoogleSignInRequest request) {
                // 1. Verify Google ID token
                GoogleAuthService.GoogleUserInfo googleUser = googleAuthService.verifyIdToken(request.getIdToken());

                log.info("Google Sign-In for email: {}, platform: {}", googleUser.email(), request.getPlatform());

                // 2. Find or create user (with race condition handling)
                User user = findOrCreateGoogleUser(googleUser, request.getPlatform());

                // 3. Validate role-platform access
                validateRolePlatformAccess(user.getRole(), request.getPlatform());

                // 4. Generate tokens
                String accessToken = tokenProvider.generateToken(
                                user.getUserId(),
                                user.getUsername(),
                                user.getRole().name());
                String refreshToken = tokenProvider.generateRefreshToken(
                                user.getUserId(),
                                user.getUsername());

                // 5. Delete old refresh tokens and save new one
                refreshTokenRepository.deleteAllByUserId(user.getUserId());
                saveRefreshToken(user.getUserId(), refreshToken);

                log.info("Google Sign-In successful for user: {}, role: {}", user.getUsername(), user.getRole());

                return AuthResponse.builder()
                                .accessToken(accessToken)
                                .refreshToken(refreshToken)
                                .tokenType("Bearer")
                                .userId(user.getUserId())
                                .username(user.getUsername())
                                .email(user.getEmail())
                                .fullName(user.getFullName() != null ? user.getFullName() : user.getUsername())
                                .avatar(user.getAvatar())
                                .role(user.getRole().name())
                                .workingClinicId(user.getWorkingClinic() != null ? user.getWorkingClinic().getClinicId()
                                                : null)
                                .workingClinicName(user.getWorkingClinic() != null ? user.getWorkingClinic().getName()
                                                : null)
                                .specialty(user.getSpecialty() != null ? user.getSpecialty().name() : null)
                                .build();
        }

        /**
         * Find existing user by email or create new one.
         * Handles race condition where concurrent requests might try to create
         * the same user simultaneously.
         * 
         * If user exists but fullName is empty (invited by email),
         * update fullName from Google profile.
         * 
         * @param googleUser Google user info
         * @param platform   Platform (mobile/web)
         * @return User (existing or newly created)
         */
        private User findOrCreateGoogleUser(GoogleAuthService.GoogleUserInfo googleUser, String platform) {
                // First attempt: try to find existing user with workingClinic eager loaded
                var existingUser = userRepository.findByEmailWithWorkingClinic(googleUser.email());

                if (existingUser.isPresent()) {
                        User user = existingUser.get();
                        boolean updated = false;

                        // Update fullName if empty (invited user logging in first time)
                        if (user.getFullName() == null || user.getFullName().isBlank()) {
                                user.setFullName(googleUser.name());
                                updated = true;
                        }

                        // Update avatar if empty
                        if (user.getAvatar() == null || user.getAvatar().isBlank()) {
                                user.setAvatar(googleUser.picture());
                                updated = true;
                        }

                        if (updated) {
                                userRepository.save(user);
                                log.info("Updated profile for invited user: {}", googleUser.email());
                        }
                        return user;
                }

                // User not found, create new one
                try {
                        return createUserFromGoogle(googleUser, platform);
                } catch (DataIntegrityViolationException e) {
                        // Race condition: another request created the user first
                        // Retry finding the user that was just created
                        log.warn("Race condition detected for email: {}. Retrying findByEmail.",
                                        googleUser.email());
                        return userRepository.findByEmail(googleUser.email())
                                        .orElseThrow(() -> new RuntimeException(
                                                        "Failed to create or find user for email: "
                                                                        + googleUser.email(),
                                                        e));
                }
        }

        /**
         * Create a new user from Google Sign-In data
         * Role is determined by platform:
         * - mobile → PET_OWNER
         * - web → CLINIC_OWNER
         * 
         * Username = email (guaranteed unique)
         * FullName = name from Google
         */
        private User createUserFromGoogle(GoogleAuthService.GoogleUserInfo googleUser, String platform) {
                // Determine role based on platform
                Role role = "web".equalsIgnoreCase(platform) ? Role.CLINIC_OWNER : Role.PET_OWNER;

                log.info("Creating new user from Google: email={}, name={}, platform={}, role={}",
                                googleUser.email(), googleUser.name(), platform, role);

                User user = new User();
                user.setUsername(googleUser.email()); // Use email as username
                user.setEmail(googleUser.email());
                user.setFullName(googleUser.name()); // Use name as fullName
                user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
                user.setRole(role);
                user.setAvatar(googleUser.picture());

                return userRepository.save(user);
        }

        /**
         * Validate if the user's role is allowed on the platform.
         * Role-Platform Matrix:
         * - PET_OWNER: mobile only
         * - VET: web + mobile
         * - CLINIC_OWNER, CLINIC_MANAGER, ADMIN: web only
         */
        private void validateRolePlatformAccess(Role role, String platform) {
                boolean isWeb = "web".equalsIgnoreCase(platform);
                boolean isMobile = "mobile".equalsIgnoreCase(platform);

                boolean allowed = switch (role) {
                        case PET_OWNER -> isMobile;
                        case VET -> true;
                        case CLINIC_OWNER, CLINIC_MANAGER, ADMIN -> isWeb;
                };

                if (!allowed) {
                        String message = isWeb
                                        ? "Tài khoản PET_OWNER chỉ có thể sử dụng ứng dụng mobile. Vui lòng tải ứng dụng Petties trên điện thoại."
                                        : "Tài khoản này chỉ có thể đăng nhập trên trang web.";
                        throw new ForbiddenException(message);
                }
        }
}
