package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.auth.UserResponse;
import com.petties.petties.dto.user.ChangePasswordRequest;
import com.petties.petties.dto.user.EmailChangeRequest;
import com.petties.petties.dto.user.EmailChangeVerifyRequest;
import com.petties.petties.dto.user.UpdateProfileRequest;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.UnauthorizedException;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.CloudinaryService;
import com.petties.petties.service.EmailChangeService;
import com.petties.petties.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for UserController using @WebMvcTest and MockMvc.
 *
 * Tests cover:
 * - Get user profile
 * - Update user profile
 * - Upload/Delete avatar
 * - Change password
 * - Email change with OTP verification
 */
@WebMvcTest(UserController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("UserController Unit Tests")
class UserControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private UserService userService;

        @MockitoBean
        private AuthService authService;

        @MockitoBean
        private CloudinaryService cloudinaryService;

        @MockitoBean
        private EmailChangeService emailChangeService;

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

        private User testUser;
        private UUID testUserId;

        @BeforeEach
        void setUp() {
                testUserId = UUID.randomUUID();
                testUser = new User();
                testUser.setUserId(testUserId);
                testUser.setUsername("testuser");
                testUser.setEmail("test@example.com");
                testUser.setFullName("Test User");
                testUser.setRole(Role.PET_OWNER);
        }

        // ==================== GET PROFILE TESTS ====================

        @Test
        @DisplayName("TC-UNIT-USER-001: Get Profile Success")
        void getProfile_authenticatedUser_returns200() throws Exception {
                // Arrange
                UserResponse response = UserResponse.builder()
                                .userId(testUserId)
                                .username("testuser")
                                .email("test@example.com")
                                .fullName("Test User")
                                .role(Role.PET_OWNER)
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                when(userService.getUserById(testUserId)).thenReturn(response);

                // Act & Assert
                mockMvc.perform(get("/users/profile"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.username").value("testuser"))
                                .andExpect(jsonPath("$.email").value("test@example.com"))
                                .andExpect(jsonPath("$.fullName").value("Test User"))
                                .andExpect(jsonPath("$.role").value("PET_OWNER"));

                verify(userService).getUserById(testUserId);
        }

        @Test
        @DisplayName("TC-UNIT-USER-002: Get Profile Unauthorized")
        void getProfile_unauthenticatedUser_returns401() throws Exception {
                // Arrange
                when(authService.getCurrentUser())
                                .thenThrow(new UnauthorizedException("User not authenticated"));

                // Act & Assert
                mockMvc.perform(get("/users/profile"))
                                .andExpect(status().isUnauthorized());

                verify(userService, never()).getUserById(any());
        }

        @Test
        @DisplayName("TC-UNIT-USER-003: Get Profile Not Found")
        void getProfile_userNotFound_returns400() throws Exception {
                // Arrange
                when(authService.getCurrentUser()).thenReturn(testUser);
                when(userService.getUserById(testUserId))
                                .thenThrow(new BadRequestException("User not found"));

                // Act & Assert
                mockMvc.perform(get("/users/profile"))
                                .andExpect(status().isBadRequest());
        }

        // ==================== UPDATE PROFILE TESTS ====================

        @Test
        @DisplayName("TC-UNIT-USER-004: Update Profile Success")
        void updateProfile_validRequest_returns200() throws Exception {
                // Arrange
                UpdateProfileRequest request = UpdateProfileRequest.builder()
                                .fullName("Updated Name")
                                .phone("0123456789")
                                .build();

                UserResponse response = UserResponse.builder()
                                .userId(testUserId)
                                .fullName("Updated Name")
                                .phone("0123456789")
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                when(userService.updateProfile(eq(testUserId), any(UpdateProfileRequest.class)))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(put("/users/profile")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.fullName").value("Updated Name"))
                                .andExpect(jsonPath("$.phone").value("0123456789"));

                verify(userService).updateProfile(eq(testUserId), any(UpdateProfileRequest.class));
        }

        @Test
        @DisplayName("TC-UNIT-USER-005: Update Profile Blank Name")
        void updateProfile_blankFullName_returns400() throws Exception {
                // Arrange
                UpdateProfileRequest request = UpdateProfileRequest.builder()
                                .fullName("")
                                .build();

                // Act & Assert
                mockMvc.perform(put("/users/profile")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(userService, never()).updateProfile(any(), any());
        }

        @Test
        @DisplayName("TC-UNIT-USER-006: Update Profile Invalid Phone")
        void updateProfile_invalidPhoneNumber_returns400() throws Exception {
                // Arrange
                UpdateProfileRequest request = UpdateProfileRequest.builder()
                                .fullName("Test User")
                                .phone("not-a-number")
                                .build();

                // Act & Assert
                mockMvc.perform(put("/users/profile")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("TC-UNIT-USER-007: Update Profile Unauthorized")
        void updateProfile_unauthenticatedUser_returns401() throws Exception {
                // Arrange
                UpdateProfileRequest request = UpdateProfileRequest.builder()
                                .fullName("Updated Name")
                                .build();

                when(authService.getCurrentUser())
                                .thenThrow(new UnauthorizedException("User not authenticated"));

                // Act & Assert
                mockMvc.perform(put("/users/profile")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isUnauthorized());

                verify(userService, never()).updateProfile(any(), any());
        }

        // ==================== UPLOAD AVATAR TESTS ====================

        @Test
        @DisplayName("TC-UNIT-USER-008: Upload Avatar Success")
        void uploadAvatar_validFile_returns200() throws Exception {
                // Arrange
                MockMultipartFile file = new MockMultipartFile(
                                "file",
                                "avatar.jpg",
                                MediaType.IMAGE_JPEG_VALUE,
                                "fake image content".getBytes());

                UserResponse response = UserResponse.builder()
                                .userId(testUserId)
                                .avatar("http://cloudinary.com/avatar.jpg")
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                when(userService.uploadAvatar(eq(testUserId), any())).thenReturn(response);

                // Act & Assert
                mockMvc.perform(multipart("/users/profile/avatar")
                                .file(file))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.avatar").value("http://cloudinary.com/avatar.jpg"));

                verify(userService).uploadAvatar(eq(testUserId), any());
        }

        @Test
        @DisplayName("TC-UNIT-USER-009: Upload Avatar Empty File")
        void uploadAvatar_emptyFile_returns400() throws Exception {
                // Arrange
                MockMultipartFile file = new MockMultipartFile(
                                "file",
                                "empty.jpg",
                                MediaType.IMAGE_JPEG_VALUE,
                                new byte[0]);

                when(authService.getCurrentUser()).thenReturn(testUser);
                doThrow(new BadRequestException("File is empty"))
                                .when(userService).uploadAvatar(eq(testUserId), any());

                // Act & Assert
                mockMvc.perform(multipart("/users/profile/avatar")
                                .file(file))
                                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("TC-UNIT-USER-010: Upload Avatar Unauthorized")
        void uploadAvatar_unauthenticatedUser_returns401() throws Exception {
                // Arrange
                MockMultipartFile file = new MockMultipartFile(
                                "file",
                                "avatar.jpg",
                                MediaType.IMAGE_JPEG_VALUE,
                                "fake image content".getBytes());

                when(authService.getCurrentUser())
                                .thenThrow(new UnauthorizedException("User not authenticated"));

                // Act & Assert
                mockMvc.perform(multipart("/users/profile/avatar")
                                .file(file))
                                .andExpect(status().isUnauthorized());

                verify(userService, never()).uploadAvatar(any(), any());
        }

        // ==================== DELETE AVATAR TESTS ====================

        @Test
        @DisplayName("TC-UNIT-USER-011: Delete Avatar Success")
        void deleteAvatar_authenticatedUser_returns200() throws Exception {
                // Arrange
                UserResponse response = UserResponse.builder()
                                .userId(testUserId)
                                .avatar(null)
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                when(userService.deleteAvatar(testUserId)).thenReturn(response);

                // Act & Assert
                mockMvc.perform(delete("/users/profile/avatar"))
                                .andExpect(status().isOk());

                verify(userService).deleteAvatar(testUserId);
        }

        @Test
        @DisplayName("TC-UNIT-USER-012: Delete Avatar Unauthorized")
        void deleteAvatar_unauthenticatedUser_returns401() throws Exception {
                // Arrange
                when(authService.getCurrentUser())
                                .thenThrow(new UnauthorizedException("User not authenticated"));

                // Act & Assert
                mockMvc.perform(delete("/users/profile/avatar"))
                                .andExpect(status().isUnauthorized());

                verify(userService, never()).deleteAvatar(any());
        }

        // ==================== CHANGE PASSWORD TESTS ====================

        @Test
        @DisplayName("TC-UNIT-USER-013: Change Password Success")
        void changePassword_validRequest_returns200() throws Exception {
                // Arrange
                ChangePasswordRequest request = ChangePasswordRequest.builder()
                                .currentPassword("OldPass123A!")
                                .newPassword("NewPass456A!")
                                .confirmPassword("NewPass456A!")
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                doNothing().when(userService).changePassword(eq(testUserId), any(ChangePasswordRequest.class));

                // Act & Assert
                mockMvc.perform(put("/users/profile/password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk());

                verify(userService).changePassword(eq(testUserId), any(ChangePasswordRequest.class));
        }

        @Test
        @DisplayName("TC-UNIT-USER-014: Change Password Wrong Current Pass")
        void changePassword_wrongCurrentPassword_returns400() throws Exception {
                // Arrange
                ChangePasswordRequest request = ChangePasswordRequest.builder()
                                .currentPassword("WrongPass123A!")
                                .newPassword("NewPass456A!")
                                .confirmPassword("NewPass456A!")
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                doThrow(new BadRequestException("Mật khẩu hiện tại không chính xác"))
                                .when(userService)
                                .changePassword(eq(testUserId), any(ChangePasswordRequest.class));

                // Act & Assert
                mockMvc.perform(put("/users/profile/password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(userService).changePassword(eq(testUserId), any(ChangePasswordRequest.class));
        }

        @Test
        @DisplayName("TC-UNIT-USER-015: Change Password Unauthorized")
        void changePassword_unauthenticatedUser_returns401() throws Exception {
                // Arrange
                ChangePasswordRequest request = ChangePasswordRequest.builder()
                                .currentPassword("OldPass123A!")
                                .newPassword("NewPass456A!")
                                .confirmPassword("NewPass456A!")
                                .build();

                when(authService.getCurrentUser())
                                .thenThrow(new UnauthorizedException("User not authenticated"));

                // Act & Assert
                mockMvc.perform(put("/users/profile/password")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isUnauthorized());

                verify(userService, never()).changePassword(any(), any());
        }

        // ==================== REQUEST EMAIL CHANGE TESTS ====================

        @Test
        @DisplayName("TC-UNIT-USER-016: Request Email Change Success")
        void requestEmailChange_validRequest_returns200() throws Exception {
                // Arrange
                EmailChangeRequest request = EmailChangeRequest.builder()
                                .newEmail("newemail@example.com")
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                when(emailChangeService.requestEmailChange(eq(testUserId), eq("newemail@example.com")))
                                .thenReturn("OTP da duoc gui den email moi");

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/request-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.message").value("OTP da duoc gui den email moi"));

                verify(emailChangeService).requestEmailChange(eq(testUserId), eq("newemail@example.com"));
        }

        @Test
        @DisplayName("TC-UNIT-USER-017: Request Email Change Blank Email")
        void requestEmailChange_blankEmail_returns400() throws Exception {
                // Arrange
                EmailChangeRequest request = EmailChangeRequest.builder()
                                .newEmail("")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/request-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService, never()).requestEmailChange(any(), any());
        }

        @Test
        @DisplayName("TC-UNIT-USER-018: Request Email Change Invalid Email Format")
        void requestEmailChange_invalidEmailFormat_returns400() throws Exception {
                // Arrange
                EmailChangeRequest request = EmailChangeRequest.builder()
                                .newEmail("not-an-email")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/request-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService, never()).requestEmailChange(any(), any());
        }

        @Test
        @DisplayName("TC-UNIT-USER-019: Request Email Change Email Already Used")
        void requestEmailChange_emailAlreadyUsed_returns400() throws Exception {
                // Arrange
                EmailChangeRequest request = EmailChangeRequest.builder()
                                .newEmail("existing@example.com")
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                when(emailChangeService.requestEmailChange(eq(testUserId), eq("existing@example.com")))
                                .thenThrow(new BadRequestException("Email da duoc su dung boi tai khoan khac"));

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/request-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService).requestEmailChange(eq(testUserId), eq("existing@example.com"));
        }

        @Test
        @DisplayName("TC-UNIT-USER-020: Request Email Change Same As Current")
        void requestEmailChange_sameAsCurrent_returns400() throws Exception {
                // Arrange
                EmailChangeRequest request = EmailChangeRequest.builder()
                                .newEmail("test@example.com")
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                when(emailChangeService.requestEmailChange(eq(testUserId), eq("test@example.com")))
                                .thenThrow(new BadRequestException("Email moi phai khac email hien tai"));

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/request-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService).requestEmailChange(eq(testUserId), eq("test@example.com"));
        }

        @Test
        @DisplayName("TC-UNIT-USER-021: Request Email Change Unauthorized")
        void requestEmailChange_unauthenticatedUser_returns401() throws Exception {
                // Arrange
                EmailChangeRequest request = EmailChangeRequest.builder()
                                .newEmail("newemail@example.com")
                                .build();

                when(authService.getCurrentUser())
                                .thenThrow(new UnauthorizedException("User not authenticated"));

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/request-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isUnauthorized());

                verify(emailChangeService, never()).requestEmailChange(any(), any());
        }

        @Test
        @DisplayName("TC-UNIT-USER-022: Request Email Change Cooldown Active")
        void requestEmailChange_cooldownActive_returns400() throws Exception {
                // Arrange
                EmailChangeRequest request = EmailChangeRequest.builder()
                                .newEmail("newemail@example.com")
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                when(emailChangeService.requestEmailChange(eq(testUserId), eq("newemail@example.com")))
                                .thenThrow(new BadRequestException("Vui long doi 45 giay truoc khi gui lai ma OTP"));

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/request-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService).requestEmailChange(eq(testUserId), eq("newemail@example.com"));
        }

        // ==================== VERIFY EMAIL CHANGE TESTS ====================

        @Test
        @DisplayName("TC-UNIT-USER-023: Verify Email Change Success")
        void verifyEmailChange_validRequest_returns200() throws Exception {
                // Arrange
                EmailChangeVerifyRequest request = EmailChangeVerifyRequest.builder()
                                .newEmail("newemail@example.com")
                                .otp("123456")
                                .build();

                UserResponse response = UserResponse.builder()
                                .userId(testUserId)
                                .username("testuser")
                                .email("newemail@example.com")
                                .role(Role.PET_OWNER)
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                when(emailChangeService.verifyAndChangeEmail(eq(testUserId), eq("newemail@example.com"), eq("123456")))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/verify-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.email").value("newemail@example.com"))
                                .andExpect(jsonPath("$.username").value("testuser"));

                verify(emailChangeService).verifyAndChangeEmail(eq(testUserId), eq("newemail@example.com"), eq("123456"));
        }

        @Test
        @DisplayName("TC-UNIT-USER-024: Verify Email Change Blank Email")
        void verifyEmailChange_blankEmail_returns400() throws Exception {
                // Arrange
                EmailChangeVerifyRequest request = EmailChangeVerifyRequest.builder()
                                .newEmail("")
                                .otp("123456")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/verify-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService, never()).verifyAndChangeEmail(any(), any(), any());
        }

        @Test
        @DisplayName("TC-UNIT-USER-025: Verify Email Change Invalid Email Format")
        void verifyEmailChange_invalidEmailFormat_returns400() throws Exception {
                // Arrange
                EmailChangeVerifyRequest request = EmailChangeVerifyRequest.builder()
                                .newEmail("not-an-email")
                                .otp("123456")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/verify-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService, never()).verifyAndChangeEmail(any(), any(), any());
        }

        @Test
        @DisplayName("TC-UNIT-USER-026: Verify Email Change Blank OTP")
        void verifyEmailChange_blankOtp_returns400() throws Exception {
                // Arrange
                EmailChangeVerifyRequest request = EmailChangeVerifyRequest.builder()
                                .newEmail("newemail@example.com")
                                .otp("")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/verify-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService, never()).verifyAndChangeEmail(any(), any(), any());
        }

        @Test
        @DisplayName("TC-UNIT-USER-027: Verify Email Change OTP Too Short")
        void verifyEmailChange_otpTooShort_returns400() throws Exception {
                // Arrange - OTP must be exactly 6 digits
                EmailChangeVerifyRequest request = EmailChangeVerifyRequest.builder()
                                .newEmail("newemail@example.com")
                                .otp("12345")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/verify-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService, never()).verifyAndChangeEmail(any(), any(), any());
        }

        @Test
        @DisplayName("TC-UNIT-USER-028: Verify Email Change OTP Too Long")
        void verifyEmailChange_otpTooLong_returns400() throws Exception {
                // Arrange - OTP must be exactly 6 digits
                EmailChangeVerifyRequest request = EmailChangeVerifyRequest.builder()
                                .newEmail("newemail@example.com")
                                .otp("1234567")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/verify-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService, never()).verifyAndChangeEmail(any(), any(), any());
        }

        @Test
        @DisplayName("TC-UNIT-USER-029: Verify Email Change OTP Contains Letters")
        void verifyEmailChange_otpContainsLetters_returns400() throws Exception {
                // Arrange - OTP must be only digits
                EmailChangeVerifyRequest request = EmailChangeVerifyRequest.builder()
                                .newEmail("newemail@example.com")
                                .otp("abc123")
                                .build();

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/verify-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService, never()).verifyAndChangeEmail(any(), any(), any());
        }

        @Test
        @DisplayName("TC-UNIT-USER-030: Verify Email Change Wrong OTP")
        void verifyEmailChange_wrongOtp_returns400() throws Exception {
                // Arrange
                EmailChangeVerifyRequest request = EmailChangeVerifyRequest.builder()
                                .newEmail("newemail@example.com")
                                .otp("999999")
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                when(emailChangeService.verifyAndChangeEmail(eq(testUserId), eq("newemail@example.com"), eq("999999")))
                                .thenThrow(new BadRequestException("Ma OTP khong dung. Ban con 4 lan thu."));

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/verify-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService).verifyAndChangeEmail(eq(testUserId), eq("newemail@example.com"), eq("999999"));
        }

        @Test
        @DisplayName("TC-UNIT-USER-031: Verify Email Change Expired OTP")
        void verifyEmailChange_expiredOtp_returns400() throws Exception {
                // Arrange
                EmailChangeVerifyRequest request = EmailChangeVerifyRequest.builder()
                                .newEmail("newemail@example.com")
                                .otp("123456")
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                when(emailChangeService.verifyAndChangeEmail(eq(testUserId), eq("newemail@example.com"), eq("123456")))
                                .thenThrow(new BadRequestException("Ma OTP khong chinh xac hoac da het han"));

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/verify-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService).verifyAndChangeEmail(eq(testUserId), eq("newemail@example.com"), eq("123456"));
        }

        @Test
        @DisplayName("TC-UNIT-USER-032: Verify Email Change Max Attempts Reached")
        void verifyEmailChange_maxAttemptsReached_returns400() throws Exception {
                // Arrange
                EmailChangeVerifyRequest request = EmailChangeVerifyRequest.builder()
                                .newEmail("newemail@example.com")
                                .otp("999999")
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                when(emailChangeService.verifyAndChangeEmail(eq(testUserId), eq("newemail@example.com"), eq("999999")))
                                .thenThrow(new BadRequestException("Ban da nhap sai ma OTP qua nhieu lan. Vui long yeu cau gui ma OTP moi."));

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/verify-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService).verifyAndChangeEmail(eq(testUserId), eq("newemail@example.com"), eq("999999"));
        }

        @Test
        @DisplayName("TC-UNIT-USER-033: Verify Email Change Email Mismatch")
        void verifyEmailChange_emailMismatch_returns400() throws Exception {
                // Arrange
                EmailChangeVerifyRequest request = EmailChangeVerifyRequest.builder()
                                .newEmail("different@example.com")
                                .otp("123456")
                                .build();

                when(authService.getCurrentUser()).thenReturn(testUser);
                when(emailChangeService.verifyAndChangeEmail(eq(testUserId), eq("different@example.com"), eq("123456")))
                                .thenThrow(new BadRequestException("Email moi khong khop voi yeu cau truoc do"));

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/verify-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService).verifyAndChangeEmail(eq(testUserId), eq("different@example.com"), eq("123456"));
        }

        @Test
        @DisplayName("TC-UNIT-USER-034: Verify Email Change Unauthorized")
        void verifyEmailChange_unauthenticatedUser_returns401() throws Exception {
                // Arrange
                EmailChangeVerifyRequest request = EmailChangeVerifyRequest.builder()
                                .newEmail("newemail@example.com")
                                .otp("123456")
                                .build();

                when(authService.getCurrentUser())
                                .thenThrow(new UnauthorizedException("User not authenticated"));

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/verify-change")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isUnauthorized());

                verify(emailChangeService, never()).verifyAndChangeEmail(any(), any(), any());
        }

        // ==================== RESEND EMAIL CHANGE OTP TESTS ====================

        @Test
        @DisplayName("TC-UNIT-USER-035: Resend Email Change OTP Success")
        void resendEmailChangeOtp_validRequest_returns200() throws Exception {
                // Arrange
                when(authService.getCurrentUser()).thenReturn(testUser);
                when(emailChangeService.resendEmailChangeOtp(testUserId))
                                .thenReturn("Ma OTP moi da duoc gui den email moi");

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/resend-otp"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.message").value("Ma OTP moi da duoc gui den email moi"));

                verify(emailChangeService).resendEmailChangeOtp(testUserId);
        }

        @Test
        @DisplayName("TC-UNIT-USER-036: Resend Email Change OTP No Pending Request")
        void resendEmailChangeOtp_noPendingRequest_returns400() throws Exception {
                // Arrange
                when(authService.getCurrentUser()).thenReturn(testUser);
                when(emailChangeService.resendEmailChangeOtp(testUserId))
                                .thenThrow(new BadRequestException("Khong co yeu cau thay doi email. Vui long tao yeu cau moi."));

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/resend-otp"))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService).resendEmailChangeOtp(testUserId);
        }

        @Test
        @DisplayName("TC-UNIT-USER-037: Resend Email Change OTP Cooldown Active")
        void resendEmailChangeOtp_cooldownActive_returns400() throws Exception {
                // Arrange
                when(authService.getCurrentUser()).thenReturn(testUser);
                when(emailChangeService.resendEmailChangeOtp(testUserId))
                                .thenThrow(new BadRequestException("Vui long doi 30 giay truoc khi gui lai ma OTP"));

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/resend-otp"))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService).resendEmailChangeOtp(testUserId);
        }

        @Test
        @DisplayName("TC-UNIT-USER-038: Resend Email Change OTP Unauthorized")
        void resendEmailChangeOtp_unauthenticatedUser_returns401() throws Exception {
                // Arrange
                when(authService.getCurrentUser())
                                .thenThrow(new UnauthorizedException("User not authenticated"));

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/resend-otp"))
                                .andExpect(status().isUnauthorized());

                verify(emailChangeService, never()).resendEmailChangeOtp(any());
        }

        @Test
        @DisplayName("TC-UNIT-USER-039: Resend Email Change OTP Email Already Taken")
        void resendEmailChangeOtp_emailAlreadyTaken_returns400() throws Exception {
                // Arrange
                when(authService.getCurrentUser()).thenReturn(testUser);
                when(emailChangeService.resendEmailChangeOtp(testUserId))
                                .thenThrow(new BadRequestException("Email da duoc su dung boi tai khoan khac"));

                // Act & Assert
                mockMvc.perform(post("/users/profile/email/resend-otp"))
                                .andExpect(status().isBadRequest());

                verify(emailChangeService).resendEmailChangeOtp(testUserId);
        }
}
