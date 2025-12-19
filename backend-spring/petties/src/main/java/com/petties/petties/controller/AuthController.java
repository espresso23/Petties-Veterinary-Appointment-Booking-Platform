package com.petties.petties.controller;

import com.petties.petties.dto.auth.AuthResponse;
import com.petties.petties.dto.auth.ForgotPasswordRequest;
import com.petties.petties.dto.auth.GoogleSignInRequest;
import com.petties.petties.dto.auth.LoginRequest;
import com.petties.petties.dto.auth.MessageResponse;
import com.petties.petties.dto.auth.RegisterRequest;
import com.petties.petties.dto.auth.ResetPasswordRequest;
import com.petties.petties.dto.auth.SendOtpRequest;
import com.petties.petties.dto.auth.SendOtpResponse;
import com.petties.petties.dto.auth.VerifyOtpRequest;
import com.petties.petties.dto.auth.UserResponse;
import com.petties.petties.model.User;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.PasswordResetService;
import com.petties.petties.service.RegistrationOtpService;
import com.petties.petties.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserService userService;
    private final RegistrationOtpService registrationOtpService;
    private final PasswordResetService passwordResetService;

    /**
     * [DEPRECATED] Direct registration without email verification
     * Keep for backward compatibility, use /register/send-otp instead
     */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Step 1: Send OTP to email for registration
     * 
     * @param request Registration data (username, email, password, phone, role)
     * @return SendOtpResponse with email and expiry info
     */
    @PostMapping("/register/send-otp")
    public ResponseEntity<SendOtpResponse> sendRegistrationOtp(@Valid @RequestBody SendOtpRequest request) {
        SendOtpResponse response = registrationOtpService.sendRegistrationOtp(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Step 2: Verify OTP and complete registration
     * 
     * @param request Email and OTP code
     * @return AuthResponse with tokens (user is logged in after registration)
     */
    @PostMapping("/register/verify-otp")
    public ResponseEntity<AuthResponse> verifyOtpAndRegister(@Valid @RequestBody VerifyOtpRequest request) {
        AuthResponse response = registrationOtpService.verifyOtpAndRegister(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Resend OTP for registration
     * 
     * @param email Email to resend OTP to
     * @return SendOtpResponse with new expiry info
     */
    @PostMapping("/register/resend-otp")
    public ResponseEntity<SendOtpResponse> resendOtp(@RequestParam String email) {
        SendOtpResponse response = registrationOtpService.resendOtp(email);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        log.info("Login request for user: {}", request.getUsername());
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Login or register with Google Sign-In
     * 
     * Platform determines the default role for new users:
     * - "mobile" → PET_OWNER
     * - "web" → CLINIC_OWNER
     */
    @PostMapping("/google")
    public ResponseEntity<AuthResponse> googleSignIn(@Valid @RequestBody GoogleSignInRequest request) {
        AuthResponse response = authService.loginWithGoogle(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refreshToken(@RequestHeader("Authorization") String authHeader) {
        String refreshToken = authHeader.replace("Bearer ", "");
        AuthResponse response = authService.refreshToken(refreshToken);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader("Authorization") String authHeader) {
        String accessToken = authHeader.replace("Bearer ", "");
        authService.logout(accessToken);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser() {
        User currentUser = authService.getCurrentUser();
        UserResponse response = userService.getUserById(currentUser.getUserId());
        return ResponseEntity.ok(response);
    }

    // ==================== Password Reset Endpoints ====================

    /**
     * Step 1: Send OTP to email for password reset
     *
     * @param request Email of the user requesting password reset
     * @return SendOtpResponse with email and expiry info
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<SendOtpResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        SendOtpResponse response = passwordResetService.sendPasswordResetOtp(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Step 2: Verify OTP and reset password
     *
     * @param request Email, OTP code, new password and confirm password
     * @return MessageResponse confirming password has been reset
     */
    @PostMapping("/reset-password")
    public ResponseEntity<MessageResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        MessageResponse response = passwordResetService.verifyOtpAndResetPassword(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Resend OTP for password reset
     *
     * @param email Email to resend OTP to
     * @return SendOtpResponse with new expiry info
     */
    @PostMapping("/forgot-password/resend-otp")
    public ResponseEntity<SendOtpResponse> resendPasswordResetOtp(@RequestParam String email) {
        SendOtpResponse response = passwordResetService.resendPasswordResetOtp(email);
        return ResponseEntity.ok(response);
    }
}
