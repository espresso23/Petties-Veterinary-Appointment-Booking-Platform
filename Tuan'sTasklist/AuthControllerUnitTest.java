package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.auth.*;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.UnauthorizedException;
import com.petties.petties.model.enums.Role;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.PasswordResetService;
import com.petties.petties.service.RegistrationOtpService;
import com.petties.petties.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for AuthController using @WebMvcTest and MockMvc.
 *
 * Tests cover:
 * - Login endpoint
 * - Registration OTP flow (send-otp, verify-otp, resend-otp)
 * - Google Sign-In
 * - Password Reset flow (forgot-password, reset-password, resend-otp)
 *
 * Each endpoint tests:
 * - Happy path (200/201)
 * - Validation errors (400)
 * - Business logic errors from service layer
 */
@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("AuthController Unit Tests")
class AuthControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private AuthService authService;

        @MockitoBean
        private UserService userService;

        @MockitoBean
        private RegistrationOtpService registrationOtpService;

        @MockitoBean
        private PasswordResetService passwordResetService;

        // Security-related dependencies for JwtAuthenticationFilter
        @MockitoBean
        private JwtTokenProvider jwtTokenProvider;

        @MockitoBean
        private JwtAuthenticationFilter jwtAuthenticationFilter;

        @MockitoBean
        private UserDetailsServiceImpl userDetailsService;

        @MockitoBean
        private BlacklistedTokenRepository blacklistedTokenRepository;

        @Autowired
        private ObjectMapper objectMapper;

        // ==================== LOGIN TESTS ====================

        @Test
        @DisplayName("login_validCredentials_returns200")
        void login_validCredentials_returns200() throws Exception {
                // Arrange
                LoginRequest request = new LoginRequest();
                request.setUsername("testuser");
                request.setPassword("Password123");

                AuthResponse response = AuthResponse.builder()
                                .accessToken("jwt-access-token")
                                .refreshToken("jwt-refresh-token")
                                .tokenType("Bearer")
                                .userId(UUID.randomUUID())
                                .username("testuser")
                                .email("test@example.com")
                                .role("PET_OWNER")
                                .build();

                when(authService.login(any(LoginRequest.class))).thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.accessToken").value("jwt-access-token"))
                                .andExpect(jsonPath("$.refreshToken").value("jwt-refresh-token"))
                                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                                .andExpect(jsonPath("$.username").value("testuser"))
                                .andExpect(jsonPath("$.role").value("PET_OWNER"));

                verify(authService).login(any(LoginRequest.class));
        }

        @Test
        @DisplayName("login_asPetOwner_returns200WithRolePetOwner")
        void login_asPetOwner_returns200WithRolePetOwner() throws Exception {
                // Arrange
                LoginRequest request = new LoginRequest("owner_user", "Password123");

                AuthResponse response = AuthResponse.builder()
                                .accessToken("access-token")
                                .userId(UUID.randomUUID())
                                .username("owner_user")
                                .role("PET_OWNER")
                                .build();

                when(authService.login(any(LoginRequest.class))).thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.role").value("PET_OWNER"));
        }

        @Test
        @DisplayName("login_asVet_returns200WithRoleVet")
        void login_asVet_returns200WithRoleVet() throws Exception {
                // Arrange
                LoginRequest request = new LoginRequest("vet_user", "Password123");

                AuthResponse response = AuthResponse.builder()
                                .accessToken("access-token")
                                .userId(UUID.randomUUID())
                                .username("vet_user")
                                .role("VET")
                                .build();

                when(authService.login(any(LoginRequest.class))).thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.role").value("VET"));
        }

        @Test
        @DisplayName("login_asClinicManager_returns200WithRoleClinicManager")
        void login_asClinicManager_returns200WithRoleClinicManager() throws Exception {
                // Arrange
                LoginRequest request = new LoginRequest("manager_user", "Password123");

                AuthResponse response = AuthResponse.builder()
                                .accessToken("access-token")
                                .userId(UUID.randomUUID())
                                .username("manager_user")
                                .role("CLINIC_MANAGER")
                                .build();

                when(authService.login(any(LoginRequest.class))).thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.role").value("CLINIC_MANAGER"));
        }

        @Test
        @DisplayName("login_blankUsername_returns400")
        void login_blankUsername_returns400() throws Exception {
                // Arrange
                LoginRequest request = new LoginRequest();
                request.setUsername("");
                request.setPassword("Password123");

                // Act & Assert
                mockMvc.perform(post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(authService, never()).login(any());
        }

        @Test
        @DisplayName("login_nullUsername_returns400")
        void login_nullUsername_returns400() throws Exception {
                // Arrange
                LoginRequest request = new LoginRequest();
                request.setUsername(null);
                request.setPassword("Password123");

                // Act & Assert
                mockMvc.perform(post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(authService, never()).login(any());
        }

        @Test
        @DisplayName("login_blankPassword_returns400")
        void login_blankPassword_returns400() throws Exception {
                // Arrange
                LoginRequest request = new LoginRequest();
                request.setUsername("testuser");
                request.setPassword("");

                // Act & Assert
                mockMvc.perform(post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(authService, never()).login(any());
        }

        @Test
        @DisplayName("login_nullPassword_returns400")
        void login_nullPassword_returns400() throws Exception {
                // Arrange
                LoginRequest request = new LoginRequest();
                request.setUsername("testuser");
                request.setPassword(null);

                // Act & Assert
                mockMvc.perform(post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(authService, never()).login(any());
        }

        @Test
        @DisplayName("login_invalidCredentials_returns401")
        void login_invalidCredentials_returns401() throws Exception {
                // Arrange
                LoginRequest request = new LoginRequest("testuser", "wrongpassword");

                when(authService.login(any(LoginRequest.class)))
                                .thenThrow(new UnauthorizedException("Invalid username or password"));

                // Act & Assert
                mockMvc.perform(post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isUnauthorized());

                verify(authService).login(any(LoginRequest.class));
        }

        // ==================== REGISTRATION OTP TESTS ====================

        @Test
        @DisplayName("sendRegistrationOtp_validRequest_returns200")
        void sendRegistrationOtp_validRequest_returns200() throws Exception {
                // Arrange
                SendOtpRequest request = new SendOtpRequest();
                request.setUsername("newuser");
                request.setEmail("newuser@example.com");
                request.setPassword("Password123");
                request.setFullName("New User");
                request.setRole(Role.PET_OWNER);

                SendOtpResponse response = SendOtpResponse.builder()
                                .email("newuser@example.com")
                                .message("OTP sent successfully")
                                .expiryMinutes(5)
                                .resendCooldownSeconds(60)
                                .build();

                when(registrationOtpService.sendRegistrationOtp(any(SendOtpRequest.class)))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/auth/register/send-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.email").value("newuser@example.com"))
                                .andExpect(jsonPath("$.message").value("OTP sent successfully"))
                                .andExpect(jsonPath("$.expiryMinutes").value(5))
                                .andExpect(jsonPath("$.resendCooldownSeconds").value(60));

                verify(registrationOtpService).sendRegistrationOtp(any(SendOtpRequest.class));
        }

        @Test
        @DisplayName("sendRegistrationOtp_blankUsername_returns400")
        void sendRegistrationOtp_blankUsername_returns400() throws Exception {
                // Arrange
                SendOtpRequest request = new SendOtpRequest();
                request.setUsername("");
                request.setEmail("test@example.com");
                request.setPassword("Password123");
                request.setFullName("Test User");
                request.setRole(Role.PET_OWNER);

                // Act & Assert
                mockMvc.perform(post("/auth/register/send-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService, never()).sendRegistrationOtp(any());
        }

        @Test
        @DisplayName("sendRegistrationOtp_usernameTooShort_returns400")
        void sendRegistrationOtp_usernameTooShort_returns400() throws Exception {
                // Arrange - username min is 3 characters
                SendOtpRequest request = new SendOtpRequest();
                request.setUsername("ab");
                request.setEmail("test@example.com");
                request.setPassword("Password123");
                request.setFullName("Test User");
                request.setRole(Role.PET_OWNER);

                // Act & Assert
                mockMvc.perform(post("/auth/register/send-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService, never()).sendRegistrationOtp(any());
        }

        @Test
        @DisplayName("sendRegistrationOtp_blankEmail_returns400")
        void sendRegistrationOtp_blankEmail_returns400() throws Exception {
                // Arrange
                SendOtpRequest request = new SendOtpRequest();
                request.setUsername("newuser");
                request.setEmail("");
                request.setPassword("Password123");
                request.setFullName("Test User");
                request.setRole(Role.PET_OWNER);

                // Act & Assert
                mockMvc.perform(post("/auth/register/send-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService, never()).sendRegistrationOtp(any());
        }

        @Test
        @DisplayName("sendRegistrationOtp_invalidEmailFormat_returns400")
        void sendRegistrationOtp_invalidEmailFormat_returns400() throws Exception {
                // Arrange
                SendOtpRequest request = new SendOtpRequest();
                request.setUsername("newuser");
                request.setEmail("not-an-email");
                request.setPassword("Password123");
                request.setFullName("Test User");
                request.setRole(Role.PET_OWNER);

                // Act & Assert
                mockMvc.perform(post("/auth/register/send-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService, never()).sendRegistrationOtp(any());
        }

        @Test
        @DisplayName("sendRegistrationOtp_blankPassword_returns400")
        void sendRegistrationOtp_blankPassword_returns400() throws Exception {
                // Arrange
                SendOtpRequest request = new SendOtpRequest();
                request.setUsername("newuser");
                request.setEmail("test@example.com");
                request.setPassword("");
                request.setFullName("Test User");
                request.setRole(Role.PET_OWNER);

                // Act & Assert
                mockMvc.perform(post("/auth/register/send-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService, never()).sendRegistrationOtp(any());
        }

        @Test
        @DisplayName("sendRegistrationOtp_passwordTooShort_returns400")
        void sendRegistrationOtp_passwordTooShort_returns400() throws Exception {
                // Arrange - password min is 6 characters
                SendOtpRequest request = new SendOtpRequest();
                request.setUsername("newuser");
                request.setEmail("test@example.com");
                request.setPassword("12345");
                request.setFullName("Test User");
                request.setRole(Role.PET_OWNER);

                // Act & Assert
                mockMvc.perform(post("/auth/register/send-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService, never()).sendRegistrationOtp(any());
        }

        @Test
        @DisplayName("sendRegistrationOtp_blankFullName_returns400")
        void sendRegistrationOtp_blankFullName_returns400() throws Exception {
                // Arrange
                SendOtpRequest request = new SendOtpRequest();
                request.setUsername("newuser");
                request.setEmail("test@example.com");
                request.setPassword("Password123");
                request.setFullName("");
                request.setRole(Role.PET_OWNER);

                // Act & Assert
                mockMvc.perform(post("/auth/register/send-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService, never()).sendRegistrationOtp(any());
        }

        @Test
        @DisplayName("sendRegistrationOtp_nullRole_returns400")
        void sendRegistrationOtp_nullRole_returns400() throws Exception {
                // Arrange
                SendOtpRequest request = new SendOtpRequest();
                request.setUsername("newuser");
                request.setEmail("test@example.com");
                request.setPassword("Password123");
                request.setFullName("Test User");
                request.setRole(null);

                // Act & Assert
                mockMvc.perform(post("/auth/register/send-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService, never()).sendRegistrationOtp(any());
        }

        @Test
        @DisplayName("sendRegistrationOtp_emailAlreadyExists_returns400")
        void sendRegistrationOtp_emailAlreadyExists_returns400() throws Exception {
                // Arrange
                SendOtpRequest request = new SendOtpRequest();
                request.setUsername("newuser");
                request.setEmail("existing@example.com");
                request.setPassword("Password123");
                request.setFullName("Test User");
                request.setRole(Role.PET_OWNER);

                when(registrationOtpService.sendRegistrationOtp(any(SendOtpRequest.class)))
                                .thenThrow(new BadRequestException("Email already exists"));

                // Act & Assert
                mockMvc.perform(post("/auth/register/send-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService).sendRegistrationOtp(any(SendOtpRequest.class));
        }

        @Test
        @DisplayName("verifyOtpAndRegister_validRequest_returns201")
        void verifyOtpAndRegister_validRequest_returns201() throws Exception {
                // Arrange
                VerifyOtpRequest request = new VerifyOtpRequest();
                request.setEmail("newuser@example.com");
                request.setOtpCode("123456");

                AuthResponse response = AuthResponse.builder()
                                .accessToken("jwt-access-token")
                                .refreshToken("jwt-refresh-token")
                                .userId(UUID.randomUUID())
                                .username("newuser")
                                .email("newuser@example.com")
                                .role("PET_OWNER")
                                .build();

                when(registrationOtpService.verifyOtpAndRegister(any(VerifyOtpRequest.class)))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/auth/register/verify-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.accessToken").value("jwt-access-token"))
                                .andExpect(jsonPath("$.username").value("newuser"))
                                .andExpect(jsonPath("$.role").value("PET_OWNER"));

                verify(registrationOtpService).verifyOtpAndRegister(any(VerifyOtpRequest.class));
        }

        @Test
        @DisplayName("verifyOtpAndRegister_blankEmail_returns400")
        void verifyOtpAndRegister_blankEmail_returns400() throws Exception {
                // Arrange
                VerifyOtpRequest request = new VerifyOtpRequest();
                request.setEmail("");
                request.setOtpCode("123456");

                // Act & Assert
                mockMvc.perform(post("/auth/register/verify-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService, never()).verifyOtpAndRegister(any());
        }

        @Test
        @DisplayName("verifyOtpAndRegister_invalidEmailFormat_returns400")
        void verifyOtpAndRegister_invalidEmailFormat_returns400() throws Exception {
                // Arrange
                VerifyOtpRequest request = new VerifyOtpRequest();
                request.setEmail("not-an-email");
                request.setOtpCode("123456");

                // Act & Assert
                mockMvc.perform(post("/auth/register/verify-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService, never()).verifyOtpAndRegister(any());
        }

        @Test
        @DisplayName("verifyOtpAndRegister_blankOtpCode_returns400")
        void verifyOtpAndRegister_blankOtpCode_returns400() throws Exception {
                // Arrange
                VerifyOtpRequest request = new VerifyOtpRequest();
                request.setEmail("test@example.com");
                request.setOtpCode("");

                // Act & Assert
                mockMvc.perform(post("/auth/register/verify-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService, never()).verifyOtpAndRegister(any());
        }

        @Test
        @DisplayName("verifyOtpAndRegister_otpCodeTooShort_returns400")
        void verifyOtpAndRegister_otpCodeTooShort_returns400() throws Exception {
                // Arrange - OTP must be exactly 6 digits
                VerifyOtpRequest request = new VerifyOtpRequest();
                request.setEmail("test@example.com");
                request.setOtpCode("12345");

                // Act & Assert
                mockMvc.perform(post("/auth/register/verify-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService, never()).verifyOtpAndRegister(any());
        }

        @Test
        @DisplayName("verifyOtpAndRegister_otpCodeTooLong_returns400")
        void verifyOtpAndRegister_otpCodeTooLong_returns400() throws Exception {
                // Arrange - OTP must be exactly 6 digits
                VerifyOtpRequest request = new VerifyOtpRequest();
                request.setEmail("test@example.com");
                request.setOtpCode("1234567");

                // Act & Assert
                mockMvc.perform(post("/auth/register/verify-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService, never()).verifyOtpAndRegister(any());
        }

        @Test
        @DisplayName("verifyOtpAndRegister_invalidOtpCode_returns400")
        void verifyOtpAndRegister_invalidOtpCode_returns400() throws Exception {
                // Arrange
                VerifyOtpRequest request = new VerifyOtpRequest();
                request.setEmail("test@example.com");
                request.setOtpCode("123456");

                when(registrationOtpService.verifyOtpAndRegister(any(VerifyOtpRequest.class)))
                                .thenThrow(new BadRequestException("Invalid OTP code"));

                // Act & Assert
                mockMvc.perform(post("/auth/register/verify-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService).verifyOtpAndRegister(any(VerifyOtpRequest.class));
        }

        @Test
        @DisplayName("verifyOtpAndRegister_expiredOtpCode_returns400")
        void verifyOtpAndRegister_expiredOtpCode_returns400() throws Exception {
                // Arrange
                VerifyOtpRequest request = new VerifyOtpRequest();
                request.setEmail("test@example.com");
                request.setOtpCode("123456");

                when(registrationOtpService.verifyOtpAndRegister(any(VerifyOtpRequest.class)))
                                .thenThrow(new BadRequestException("OTP has expired"));

                // Act & Assert
                mockMvc.perform(post("/auth/register/verify-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService).verifyOtpAndRegister(any(VerifyOtpRequest.class));
        }

        @Test
        @DisplayName("resendOtp_validEmail_returns200")
        void resendOtp_validEmail_returns200() throws Exception {
                // Arrange
                String email = "test@example.com";

                SendOtpResponse response = SendOtpResponse.builder()
                                .email(email)
                                .message("OTP resent successfully")
                                .expiryMinutes(5)
                                .resendCooldownSeconds(60)
                                .build();

                when(registrationOtpService.resendOtp(email)).thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/auth/register/resend-otp")
                                .param("email", email))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.email").value(email))
                                .andExpect(jsonPath("$.message").value("OTP resent successfully"));

                verify(registrationOtpService).resendOtp(email);
        }

        @Test
        @DisplayName("resendOtp_noPendingRegistration_returns400")
        void resendOtp_noPendingRegistration_returns400() throws Exception {
                // Arrange
                String email = "nonexistent@example.com";

                when(registrationOtpService.resendOtp(email))
                                .thenThrow(new BadRequestException("No pending registration found"));

                // Act & Assert
                mockMvc.perform(post("/auth/register/resend-otp")
                                .param("email", email))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService).resendOtp(email);
        }

        @Test
        @DisplayName("resendOtp_cooldownNotExpired_returns400")
        void resendOtp_cooldownNotExpired_returns400() throws Exception {
                // Arrange
                String email = "test@example.com";

                when(registrationOtpService.resendOtp(email))
                                .thenThrow(new BadRequestException("Please wait before resending OTP"));

                // Act & Assert
                mockMvc.perform(post("/auth/register/resend-otp")
                                .param("email", email))
                                .andExpect(status().isBadRequest());

                verify(registrationOtpService).resendOtp(email);
        }

        // ==================== GOOGLE SIGN-IN TESTS ====================

        @Test
        @DisplayName("googleSignIn_validTokenMobile_returns200WithPetOwnerRole")
        void googleSignIn_validTokenMobile_returns200WithPetOwnerRole() throws Exception {
                // Arrange
                GoogleSignInRequest request = new GoogleSignInRequest();
                request.setIdToken("valid-google-id-token");
                request.setPlatform("mobile");

                AuthResponse response = AuthResponse.builder()
                                .accessToken("jwt-access-token")
                                .refreshToken("jwt-refresh-token")
                                .userId(UUID.randomUUID())
                                .email("googleuser@gmail.com")
                                .role("PET_OWNER")
                                .build();

                when(authService.loginWithGoogle(any(GoogleSignInRequest.class))).thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/auth/google")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.accessToken").value("jwt-access-token"))
                                .andExpect(jsonPath("$.role").value("PET_OWNER"));

                verify(authService).loginWithGoogle(any(GoogleSignInRequest.class));
        }

        @Test
        @DisplayName("googleSignIn_validTokenWeb_returns200WithClinicOwnerRole")
        void googleSignIn_validTokenWeb_returns200WithClinicOwnerRole() throws Exception {
                // Arrange
                GoogleSignInRequest request = new GoogleSignInRequest();
                request.setIdToken("valid-google-id-token");
                request.setPlatform("web");

                AuthResponse response = AuthResponse.builder()
                                .accessToken("jwt-access-token")
                                .refreshToken("jwt-refresh-token")
                                .userId(UUID.randomUUID())
                                .email("googleuser@gmail.com")
                                .role("CLINIC_OWNER")
                                .build();

                when(authService.loginWithGoogle(any(GoogleSignInRequest.class))).thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/auth/google")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.accessToken").value("jwt-access-token"))
                                .andExpect(jsonPath("$.role").value("CLINIC_OWNER"));

                verify(authService).loginWithGoogle(any(GoogleSignInRequest.class));
        }

        @Test
        @DisplayName("googleSignIn_blankIdToken_returns400")
        void googleSignIn_blankIdToken_returns400() throws Exception {
                // Arrange
                GoogleSignInRequest request = new GoogleSignInRequest();
                request.setIdToken("");
                request.setPlatform("mobile");

                // Act & Assert
                mockMvc.perform(post("/auth/google")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(authService, never()).loginWithGoogle(any());
        }

        @Test
        @DisplayName("googleSignIn_blankPlatform_returns400")
        void googleSignIn_blankPlatform_returns400() throws Exception {
                // Arrange
                GoogleSignInRequest request = new GoogleSignInRequest();
                request.setIdToken("valid-token");
                request.setPlatform("");

                // Act & Assert
                mockMvc.perform(post("/auth/google")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(authService, never()).loginWithGoogle(any());
        }

        @Test
        @DisplayName("googleSignIn_invalidIdToken_returns401")
        void googleSignIn_invalidIdToken_returns401() throws Exception {
                // Arrange
                GoogleSignInRequest request = new GoogleSignInRequest();
                request.setIdToken("invalid-google-token");
                request.setPlatform("mobile");

                when(authService.loginWithGoogle(any(GoogleSignInRequest.class)))
                                .thenThrow(new UnauthorizedException("Invalid Google ID token"));

                // Act & Assert
                mockMvc.perform(post("/auth/google")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isUnauthorized());

                verify(authService).loginWithGoogle(any(GoogleSignInRequest.class));
        }

        // ==================== PASSWORD RESET TESTS ====================

        @Test
        @DisplayName("forgotPassword_validEmail_returns200")
        void forgotPassword_validEmail_returns200() throws Exception {
                // Arrange
                ForgotPasswordRequest request = ForgotPasswordRequest.builder()
                                .email("test@example.com")
                                .build();

                SendOtpResponse response = SendOtpResponse.builder()
                                .email("test@example.com")
                                .message("OTP sent successfully")
                                .expiryMinutes(5)
                                .resendCooldownSeconds(60)
                                .build();

                when(passwordResetService.sendPasswordResetOtp(any(ForgotPasswordRequest.class)))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/auth/forgot-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.email").value("test@example.com"))
                                .andExpect(jsonPath("$.message").value("OTP sent successfully"))
                                .andExpect(jsonPath("$.expiryMinutes").value(5))
                                .andExpect(jsonPath("$.resendCooldownSeconds").value(60));

                verify(passwordResetService).sendPasswordResetOtp(any(ForgotPasswordRequest.class));
        }

        @Test
        @DisplayName("forgotPassword_blankEmail_returns400")
        void forgotPassword_blankEmail_returns400() throws Exception {
                // Arrange
                ForgotPasswordRequest request = ForgotPasswordRequest.builder()
                                .email("")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/auth/forgot-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService, never()).sendPasswordResetOtp(any());
        }

        @Test
        @DisplayName("forgotPassword_invalidEmailFormat_returns400")
        void forgotPassword_invalidEmailFormat_returns400() throws Exception {
                // Arrange
                ForgotPasswordRequest request = ForgotPasswordRequest.builder()
                                .email("not-an-email")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/auth/forgot-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService, never()).sendPasswordResetOtp(any());
        }

        @Test
        @DisplayName("forgotPassword_emailNotFound_returns400")
        void forgotPassword_emailNotFound_returns400() throws Exception {
                // Arrange
                ForgotPasswordRequest request = ForgotPasswordRequest.builder()
                                .email("nonexistent@example.com")
                                .build();

                when(passwordResetService.sendPasswordResetOtp(any(ForgotPasswordRequest.class)))
                                .thenThrow(new BadRequestException("Email not found"));

                // Act & Assert
                mockMvc.perform(post("/auth/forgot-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService).sendPasswordResetOtp(any(ForgotPasswordRequest.class));
        }

        @Test
        @DisplayName("resetPassword_validRequest_returns200")
        void resetPassword_validRequest_returns200() throws Exception {
                // Arrange
                ResetPasswordRequest request = ResetPasswordRequest.builder()
                                .email("test@example.com")
                                .otpCode("123456")
                                .newPassword("NewPassword123")
                                .confirmPassword("NewPassword123")
                                .build();

                MessageResponse response = MessageResponse.builder()
                                .message("Password reset successfully")
                                .build();

                when(passwordResetService.verifyOtpAndResetPassword(any(ResetPasswordRequest.class)))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/auth/reset-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.message").value("Password reset successfully"));

                verify(passwordResetService).verifyOtpAndResetPassword(any(ResetPasswordRequest.class));
        }

        @Test
        @DisplayName("resetPassword_blankEmail_returns400")
        void resetPassword_blankEmail_returns400() throws Exception {
                // Arrange
                ResetPasswordRequest request = ResetPasswordRequest.builder()
                                .email("")
                                .otpCode("123456")
                                .newPassword("NewPassword123")
                                .confirmPassword("NewPassword123")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/auth/reset-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService, never()).verifyOtpAndResetPassword(any());
        }

        @Test
        @DisplayName("resetPassword_invalidEmailFormat_returns400")
        void resetPassword_invalidEmailFormat_returns400() throws Exception {
                // Arrange
                ResetPasswordRequest request = ResetPasswordRequest.builder()
                                .email("not-an-email")
                                .otpCode("123456")
                                .newPassword("NewPassword123")
                                .confirmPassword("NewPassword123")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/auth/reset-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService, never()).verifyOtpAndResetPassword(any());
        }

        @Test
        @DisplayName("resetPassword_blankOtpCode_returns400")
        void resetPassword_blankOtpCode_returns400() throws Exception {
                // Arrange
                ResetPasswordRequest request = ResetPasswordRequest.builder()
                                .email("test@example.com")
                                .otpCode("")
                                .newPassword("NewPassword123")
                                .confirmPassword("NewPassword123")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/auth/reset-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService, never()).verifyOtpAndResetPassword(any());
        }

        @Test
        @DisplayName("resetPassword_invalidOtpCodeFormat_returns400")
        void resetPassword_invalidOtpCodeFormat_returns400() throws Exception {
                // Arrange - OTP must be 6 digits
                ResetPasswordRequest request = ResetPasswordRequest.builder()
                                .email("test@example.com")
                                .otpCode("abc123")
                                .newPassword("NewPassword123")
                                .confirmPassword("NewPassword123")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/auth/reset-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService, never()).verifyOtpAndResetPassword(any());
        }

        @Test
        @DisplayName("resetPassword_blankNewPassword_returns400")
        void resetPassword_blankNewPassword_returns400() throws Exception {
                // Arrange
                ResetPasswordRequest request = ResetPasswordRequest.builder()
                                .email("test@example.com")
                                .otpCode("123456")
                                .newPassword("")
                                .confirmPassword("NewPassword123")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/auth/reset-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService, never()).verifyOtpAndResetPassword(any());
        }

        @Test
        @DisplayName("resetPassword_newPasswordTooShort_returns400")
        void resetPassword_newPasswordTooShort_returns400() throws Exception {
                // Arrange - password min is 8 characters
                ResetPasswordRequest request = ResetPasswordRequest.builder()
                                .email("test@example.com")
                                .otpCode("123456")
                                .newPassword("Pass1")
                                .confirmPassword("Pass1")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/auth/reset-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService, never()).verifyOtpAndResetPassword(any());
        }

        @Test
        @DisplayName("resetPassword_blankConfirmPassword_returns400")
        void resetPassword_blankConfirmPassword_returns400() throws Exception {
                // Arrange
                ResetPasswordRequest request = ResetPasswordRequest.builder()
                                .email("test@example.com")
                                .otpCode("123456")
                                .newPassword("NewPassword123")
                                .confirmPassword("")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/auth/reset-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService, never()).verifyOtpAndResetPassword(any());
        }

        @Test
        @DisplayName("resetPassword_passwordMismatch_returns400")
        void resetPassword_passwordMismatch_returns400() throws Exception {
                // Arrange
                ResetPasswordRequest request = ResetPasswordRequest.builder()
                                .email("test@example.com")
                                .otpCode("123456")
                                .newPassword("NewPassword123")
                                .confirmPassword("DifferentPassword123")
                                .build();

                when(passwordResetService.verifyOtpAndResetPassword(any(ResetPasswordRequest.class)))
                                .thenThrow(new BadRequestException("Passwords do not match"));

                // Act & Assert
                mockMvc.perform(post("/auth/reset-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService).verifyOtpAndResetPassword(any(ResetPasswordRequest.class));
        }

        @Test
        @DisplayName("resetPassword_invalidOtpCode_returns400")
        void resetPassword_invalidOtpCode_returns400() throws Exception {
                // Arrange
                ResetPasswordRequest request = ResetPasswordRequest.builder()
                                .email("test@example.com")
                                .otpCode("123456")
                                .newPassword("NewPassword123")
                                .confirmPassword("NewPassword123")
                                .build();

                when(passwordResetService.verifyOtpAndResetPassword(any(ResetPasswordRequest.class)))
                                .thenThrow(new BadRequestException("Invalid OTP code"));

                // Act & Assert
                mockMvc.perform(post("/auth/reset-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService).verifyOtpAndResetPassword(any(ResetPasswordRequest.class));
        }

        @Test
        @DisplayName("resetPassword_expiredOtpCode_returns400")
        void resetPassword_expiredOtpCode_returns400() throws Exception {
                // Arrange
                ResetPasswordRequest request = ResetPasswordRequest.builder()
                                .email("test@example.com")
                                .otpCode("123456")
                                .newPassword("NewPassword123")
                                .confirmPassword("NewPassword123")
                                .build();

                when(passwordResetService.verifyOtpAndResetPassword(any(ResetPasswordRequest.class)))
                                .thenThrow(new BadRequestException("OTP has expired"));

                // Act & Assert
                mockMvc.perform(post("/auth/reset-password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService).verifyOtpAndResetPassword(any(ResetPasswordRequest.class));
        }

        @Test
        @DisplayName("resendPasswordResetOtp_validEmail_returns200")
        void resendPasswordResetOtp_validEmail_returns200() throws Exception {
                // Arrange
                String email = "test@example.com";

                SendOtpResponse response = SendOtpResponse.builder()
                                .email(email)
                                .message("OTP resent successfully")
                                .expiryMinutes(5)
                                .resendCooldownSeconds(60)
                                .build();

                when(passwordResetService.resendPasswordResetOtp(email)).thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/auth/forgot-password/resend-otp")
                                .param("email", email))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.email").value(email))
                                .andExpect(jsonPath("$.message").value("OTP resent successfully"));

                verify(passwordResetService).resendPasswordResetOtp(email);
        }

        @Test
        @DisplayName("resendPasswordResetOtp_noPendingReset_returns400")
        void resendPasswordResetOtp_noPendingReset_returns400() throws Exception {
                // Arrange
                String email = "nonexistent@example.com";

                when(passwordResetService.resendPasswordResetOtp(email))
                                .thenThrow(new BadRequestException("No pending password reset found"));

                // Act & Assert
                mockMvc.perform(post("/auth/forgot-password/resend-otp")
                                .param("email", email))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService).resendPasswordResetOtp(email);
        }

        @Test
        @DisplayName("resendPasswordResetOtp_cooldownNotExpired_returns400")
        void resendPasswordResetOtp_cooldownNotExpired_returns400() throws Exception {
                // Arrange
                String email = "test@example.com";

                when(passwordResetService.resendPasswordResetOtp(email))
                                .thenThrow(new BadRequestException("Please wait before resending OTP"));

                // Act & Assert
                mockMvc.perform(post("/auth/forgot-password/resend-otp")
                                .param("email", email))
                                .andExpect(status().isBadRequest());

                verify(passwordResetService).resendPasswordResetOtp(email);
        }
}
