package com.petties.petties.controller;

import com.petties.petties.dto.auth.*;
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
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for AuthController - Registration and Login flows.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AuthController - Authentication Tests")
class AuthControllerAuthTest {

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
    @DisplayName("POST /auth/login")
    class LoginTests {
        @Test
        @DisplayName("Should login successfully as PET_OWNER and return 200")
        void shouldLoginSuccessfullyAsPetOwner() {
            // Arrange
            LoginRequest request = new LoginRequest();
            request.setUsername("owner_user");
            request.setPassword("Password123");

            AuthResponse authResponse = AuthResponse.builder()
                    .accessToken("access-token")
                    .userId(UUID.randomUUID())
                    .username("owner_user")
                    .role("PET_OWNER")
                    .build();

            when(authService.login(any(LoginRequest.class))).thenReturn(authResponse);

            // Act
            ResponseEntity<AuthResponse> response = authController.login(request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().getRole()).isEqualTo("PET_OWNER");
        }

        @Test
        @DisplayName("Should login successfully as VET and return 200")
        void shouldLoginSuccessfullyAsVet() {
            // Arrange
            LoginRequest request = new LoginRequest();
            request.setUsername("vet_user");
            request.setPassword("Password123");

            AuthResponse authResponse = AuthResponse.builder()
                    .accessToken("access-token")
                    .userId(UUID.randomUUID())
                    .username("vet_user")
                    .role("VET")
                    .build();

            when(authService.login(any(LoginRequest.class))).thenReturn(authResponse);

            // Act
            ResponseEntity<AuthResponse> response = authController.login(request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().getRole()).isEqualTo("VET");
        }

        @Test
        @DisplayName("Should login successfully as CLINIC_MANAGER and return 200")
        void shouldLoginSuccessfullyAsClinicManager() {
            // Arrange
            LoginRequest request = new LoginRequest();
            request.setUsername("admin_user");
            request.setPassword("Password123");

            AuthResponse authResponse = AuthResponse.builder()
                    .accessToken("access-token")
                    .userId(UUID.randomUUID())
                    .username("admin_user")
                    .role("CLINIC_MANAGER")
                    .build();

            when(authService.login(any(LoginRequest.class))).thenReturn(authResponse);

            // Act
            ResponseEntity<AuthResponse> response = authController.login(request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().getRole()).isEqualTo("CLINIC_MANAGER");
        }
    }

    @Nested
    @DisplayName("POST /auth/register/send-otp")
    class RegistrationOtpTests {
        @Test
        @DisplayName("Should send registration OTP and return 200")
        void shouldSendRegistrationOtpSuccessfully() {
            // Arrange
            SendOtpRequest request = new SendOtpRequest();
            request.setEmail("newuser@example.com");

            SendOtpResponse responseMock = SendOtpResponse.builder()
                    .email("newuser@example.com")
                    .message("OTP sent")
                    .expiryMinutes(5)
                    .build();

            when(registrationOtpService.sendRegistrationOtp(any(SendOtpRequest.class)))
                    .thenReturn(responseMock);

            // Act
            ResponseEntity<SendOtpResponse> response = authController.sendRegistrationOtp(request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().getEmail()).isEqualTo("newuser@example.com");
            verify(registrationOtpService).sendRegistrationOtp(any(SendOtpRequest.class));
        }

        @Test
        @DisplayName("Should verify OTP and complete registration return 201")
        void shouldVerifyOtpAndRegisterSuccessfully() {
            // Arrange
            VerifyOtpRequest request = new VerifyOtpRequest();
            request.setEmail("newuser@example.com");
            request.setOtpCode("123456");

            AuthResponse authResponse = AuthResponse.builder()
                    .accessToken("access-token")
                    .userId(UUID.randomUUID())
                    .username("testuser")
                    .build();

            when(registrationOtpService.verifyOtpAndRegister(any(VerifyOtpRequest.class)))
                    .thenReturn(authResponse);

            // Act
            ResponseEntity<AuthResponse> response = authController.verifyOtpAndRegister(request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            assertThat(response.getBody().getAccessToken()).isEqualTo("access-token");
            verify(registrationOtpService).verifyOtpAndRegister(any(VerifyOtpRequest.class));
        }
    }

    @Nested
    @DisplayName("POST /auth/google")
    class GoogleSignInTests {
        @Test
        @DisplayName("Should sign in with Google and return 200")
        void shouldGoogleSignInSuccessfully() {
            // Arrange
            GoogleSignInRequest request = new GoogleSignInRequest();
            request.setIdToken("google-token");

            AuthResponse authResponse = AuthResponse.builder()
                    .accessToken("access-token")
                    .userId(UUID.randomUUID())
                    .build();

            when(authService.loginWithGoogle(any(GoogleSignInRequest.class))).thenReturn(authResponse);

            // Act
            ResponseEntity<AuthResponse> response = authController.googleSignIn(request);

            // Assert
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            verify(authService).loginWithGoogle(any(GoogleSignInRequest.class));
        }
    }
}
