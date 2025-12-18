package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.auth.ForgotPasswordRequest;
import com.petties.petties.dto.auth.MessageResponse;
import com.petties.petties.dto.auth.ResetPasswordRequest;
import com.petties.petties.dto.auth.SendOtpResponse;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.PasswordResetService;
import com.petties.petties.service.RegistrationOtpService;
import com.petties.petties.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for AuthController - Password Reset Endpoints.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AuthController - Password Reset Tests")
class AuthControllerPasswordResetTest {

    @Mock
    private AuthService authService;

    @Mock
    private UserService userService;

    @Mock
    private RegistrationOtpService registrationOtpService;

    @Mock
    private PasswordResetService passwordResetService;

    @InjectMocks
    private AuthController authController;

    @Nested
    @DisplayName("POST /auth/forgot-password")
    class ForgotPasswordTests {

        @Test
        @DisplayName("Should send OTP and return 200")
        void shouldSendOtpSuccessfully() {
            // Arrange
            ForgotPasswordRequest request = new ForgotPasswordRequest();
            request.setEmail("test@example.com");

            SendOtpResponse responseMock = SendOtpResponse.builder()
                    .email("test@example.com")
                    .message("OTP sent")
                    .expiryMinutes(5)
                    .resendCooldownSeconds(60)
                    .build();

            when(passwordResetService.sendPasswordResetOtp(any(ForgotPasswordRequest.class)))
                    .thenReturn(responseMock);

            // Act
            ResponseEntity<SendOtpResponse> response = authController.forgotPassword(request);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getEmail()).isEqualTo("test@example.com");
            verify(passwordResetService).sendPasswordResetOtp(any(ForgotPasswordRequest.class));
        }
    }

    @Nested
    @DisplayName("POST /auth/reset-password")
    class ResetPasswordTests {

        @Test
        @DisplayName("Should reset password and return 200")
        void shouldResetPasswordSuccessfully() {
            // Arrange
            ResetPasswordRequest request = new ResetPasswordRequest();
            request.setEmail("test@example.com");
            request.setOtpCode("123456");
            request.setNewPassword("NewPass123");
            request.setConfirmPassword("NewPass123");

            MessageResponse responseMock = MessageResponse.builder()
                    .message("Password reset successfully")
                    .build();

            when(passwordResetService.verifyOtpAndResetPassword(any(ResetPasswordRequest.class)))
                    .thenReturn(responseMock);

            // Act
            ResponseEntity<MessageResponse> response = authController.resetPassword(request);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage()).isEqualTo("Password reset successfully");
            verify(passwordResetService).verifyOtpAndResetPassword(any(ResetPasswordRequest.class));
        }
    }

    @Nested
    @DisplayName("POST /auth/forgot-password/resend-otp")
    class ResendOtpTests {

        @Test
        @DisplayName("Should resend OTP and return 200")
        void shouldResendOtpSuccessfully() {
            // Arrange
            String email = "test@example.com";

            SendOtpResponse responseMock = SendOtpResponse.builder()
                    .email(email)
                    .message("OTP resent")
                    .expiryMinutes(5)
                    .resendCooldownSeconds(60)
                    .build();

            when(passwordResetService.resendPasswordResetOtp(email))
                    .thenReturn(responseMock);

            // Act
            ResponseEntity<SendOtpResponse> response = authController.resendPasswordResetOtp(email);

            // Assert
            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getEmail()).isEqualTo(email);
            verify(passwordResetService).resendPasswordResetOtp(email);
        }
    }
}
