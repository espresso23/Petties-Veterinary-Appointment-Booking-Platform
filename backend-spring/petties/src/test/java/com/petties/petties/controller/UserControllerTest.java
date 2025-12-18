package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.auth.UserResponse;
import com.petties.petties.dto.user.ChangePasswordRequest;
import com.petties.petties.dto.user.UpdateProfileRequest;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for UserController API endpoints.
 *
 * Tests run independently:
 * - No database connection
 * - No internet connection
 * - No Spring context loaded
 * - All dependencies mocked with Mockito
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("UserController API Tests")
class UserControllerTest {

        @Mock
        private UserService userService;

        @Mock
        private AuthService authService;

        @InjectMocks
        private UserController userController;

        @Spy
        private ObjectMapper objectMapper = new ObjectMapper();

        private User testUser;
        private UUID testUserId;
        private UserResponse testUserResponse;

        @BeforeEach
        void setUp() {
                testUserId = UUID.randomUUID();

                testUser = new User();
                testUser.setUserId(testUserId);
                testUser.setUsername("testuser");
                testUser.setEmail("test@example.com");
                testUser.setFullName("Test User");
                testUser.setPhone("0901234567");
                testUser.setRole(Role.PET_OWNER);

                testUserResponse = UserResponse.builder()
                                .userId(testUserId)
                                .username("testuser")
                                .email("test@example.com")
                                .fullName("Test User")
                                .phone("0901234567")
                                .avatar(null)
                                .role(Role.PET_OWNER)
                                .createdAt(LocalDateTime.now())
                                .updatedAt(LocalDateTime.now())
                                .build();
        }

        @Nested
        @DisplayName("GET /api/users/profile")
        class GetProfileTests {

                @Test
                @DisplayName("Should return profile with status 200")
                void shouldReturnProfileSuccessfully() {
                        // Arrange
                        when(authService.getCurrentUser()).thenReturn(testUser);
                        when(userService.getUserById(testUserId)).thenReturn(testUserResponse);

                        // Act
                        ResponseEntity<UserResponse> response = userController.getProfile();

                        // Assert
                        assertThat(response.getStatusCode().value()).isEqualTo(200);
                        assertThat(response.getBody()).isNotNull();
                        assertThat(response.getBody().getUserId()).isEqualTo(testUserId);
                        assertThat(response.getBody().getUsername()).isEqualTo("testuser");
                        assertThat(response.getBody().getEmail()).isEqualTo("test@example.com");
                        assertThat(response.getBody().getFullName()).isEqualTo("Test User");

                        verify(authService).getCurrentUser();
                        verify(userService).getUserById(testUserId);
                }
        }

        @Nested
        @DisplayName("PUT /api/users/profile")
        class UpdateProfileTests {

                @Test
                @DisplayName("Should update profile and return status 200")
                void shouldUpdateProfileSuccessfully() {
                        // Arrange
                        UpdateProfileRequest request = UpdateProfileRequest.builder()
                                        .fullName("Updated Name")
                                        .phone("0987654321")
                                        .build();

                        UserResponse updatedResponse = UserResponse.builder()
                                        .userId(testUserId)
                                        .username("testuser")
                                        .email("test@example.com")
                                        .fullName("Updated Name")
                                        .phone("0987654321")
                                        .role(Role.PET_OWNER)
                                        .build();

                        when(authService.getCurrentUser()).thenReturn(testUser);
                        when(userService.updateProfile(eq(testUserId), any(UpdateProfileRequest.class)))
                                        .thenReturn(updatedResponse);

                        // Act
                        ResponseEntity<UserResponse> response = userController.updateProfile(request);

                        // Assert
                        assertThat(response.getStatusCode().value()).isEqualTo(200);
                        assertThat(response.getBody()).isNotNull();
                        assertThat(response.getBody().getFullName()).isEqualTo("Updated Name");
                        assertThat(response.getBody().getPhone()).isEqualTo("0987654321");

                        verify(authService).getCurrentUser();
                        verify(userService).updateProfile(eq(testUserId), any(UpdateProfileRequest.class));
                }

                @Test
                @DisplayName("Should update only fullName when phone is null")
                void shouldUpdateOnlyFullName() {
                        // Arrange
                        UpdateProfileRequest request = UpdateProfileRequest.builder()
                                        .fullName("New Name Only")
                                        .phone(null)
                                        .build();

                        UserResponse updatedResponse = UserResponse.builder()
                                        .userId(testUserId)
                                        .fullName("New Name Only")
                                        .phone("0901234567") // unchanged
                                        .build();

                        when(authService.getCurrentUser()).thenReturn(testUser);
                        when(userService.updateProfile(eq(testUserId), any(UpdateProfileRequest.class)))
                                        .thenReturn(updatedResponse);

                        // Act
                        ResponseEntity<UserResponse> response = userController.updateProfile(request);

                        // Assert
                        assertThat(response.getBody().getFullName()).isEqualTo("New Name Only");
                        assertThat(response.getBody().getPhone()).isEqualTo("0901234567");
                }
        }

        @Nested
        @DisplayName("POST /api/users/profile/avatar")
        class UploadAvatarTests {

                @Test
                @DisplayName("Should upload avatar and return status 200")
                void shouldUploadAvatarSuccessfully() {
                        // Arrange
                        MockMultipartFile mockFile = new MockMultipartFile(
                                        "file",
                                        "avatar.jpg",
                                        "image/jpeg",
                                        "test image content".getBytes());

                        UserResponse avatarResponse = UserResponse.builder()
                                        .userId(testUserId)
                                        .username("testuser")
                                        .avatar("https://res.cloudinary.com/test/petties/avatars/abc123.jpg")
                                        .build();

                        when(authService.getCurrentUser()).thenReturn(testUser);
                        when(userService.uploadAvatar(eq(testUserId), any())).thenReturn(avatarResponse);

                        // Act
                        ResponseEntity<UserResponse> response = userController.uploadAvatar(mockFile);

                        // Assert
                        assertThat(response.getStatusCode().value()).isEqualTo(200);
                        assertThat(response.getBody()).isNotNull();
                        assertThat(response.getBody().getAvatar())
                                        .isEqualTo("https://res.cloudinary.com/test/petties/avatars/abc123.jpg");

                        verify(authService).getCurrentUser();
                        verify(userService).uploadAvatar(eq(testUserId), any());

                        verify(authService).getCurrentUser();
                        verify(userService).uploadAvatar(eq(testUserId), any());
                }

                @Test
                @DisplayName("Should throw BadRequestException when file is empty")
                void shouldThrowExceptionWhenFileEmpty() {
                        // Arrange
                        MockMultipartFile emptyFile = new MockMultipartFile(
                                        "file",
                                        "empty.jpg",
                                        "image/jpeg",
                                        new byte[0]);

                        when(authService.getCurrentUser()).thenReturn(testUser);
                        when(userService.uploadAvatar(eq(testUserId), any()))
                                        .thenThrow(new BadRequestException("File không được để trống."));

                        // Act & Assert
                        assertThatThrownBy(() -> userController.uploadAvatar(emptyFile))
                                        .isInstanceOf(BadRequestException.class)
                                        .hasMessage("File không được để trống.");

                        verify(userService).uploadAvatar(eq(testUserId), any());
                }
        }

        @Nested
        @DisplayName("DELETE /api/users/profile/avatar")
        class DeleteAvatarTests {

                @Test
                @DisplayName("Should delete avatar and return status 200")
                void shouldDeleteAvatarSuccessfully() {
                        // Arrange
                        UserResponse avatarResponse = UserResponse.builder()
                                        .userId(testUserId)
                                        .avatar(null)
                                        .build();

                        when(authService.getCurrentUser()).thenReturn(testUser);
                        when(userService.deleteAvatar(testUserId)).thenReturn(avatarResponse);

                        // Act
                        ResponseEntity<UserResponse> response = userController.deleteAvatar();

                        // Assert
                        assertThat(response.getStatusCode().value()).isEqualTo(200);
                        assertThat(response.getBody()).isNotNull();
                        assertThat(response.getBody().getAvatar()).isNull();

                        verify(authService).getCurrentUser();
                        verify(userService).deleteAvatar(testUserId);

                        verify(authService).getCurrentUser();
                        verify(userService).deleteAvatar(testUserId);
                }

                @Test
                @DisplayName("Should throw BadRequestException when user has no avatar")
                void shouldThrowExceptionWhenNoAvatar() {
                        // Arrange
                        when(authService.getCurrentUser()).thenReturn(testUser);
                        when(userService.deleteAvatar(testUserId))
                                        .thenThrow(new BadRequestException("Người dùng chưa có avatar"));

                        // Act & Assert
                        assertThatThrownBy(() -> userController.deleteAvatar())
                                        .isInstanceOf(BadRequestException.class)
                                        .hasMessage("Người dùng chưa có avatar");

                        verify(userService).deleteAvatar(testUserId);
                }
        }

        @Nested
        @DisplayName("PUT /api/users/profile/password")
        class ChangePasswordTests {

                @Test
                @DisplayName("Should change password and return status 200")
                void shouldChangePasswordSuccessfully() {
                        // Arrange
                        ChangePasswordRequest request = ChangePasswordRequest.builder()
                                        .currentPassword("OldPass123")
                                        .newPassword("NewPass456")
                                        .confirmPassword("NewPass456")
                                        .build();

                        when(authService.getCurrentUser()).thenReturn(testUser);
                        doNothing().when(userService).changePassword(eq(testUserId), any(ChangePasswordRequest.class));

                        // Act
                        ResponseEntity<Map<String, String>> response = userController.changePassword(request);

                        // Assert
                        assertThat(response.getStatusCode().value()).isEqualTo(200);
                        assertThat(response.getBody()).isNotNull();
                        assertThat(response.getBody().get("message")).isEqualTo("Đổi mật khẩu thành công");

                        verify(authService).getCurrentUser();
                        verify(userService).changePassword(eq(testUserId), any(ChangePasswordRequest.class));
                }

                @Test
                @DisplayName("Should throw BadRequestException when current password incorrect")
                void shouldThrowExceptionWhenCurrentPasswordIncorrect() {
                        // Arrange
                        ChangePasswordRequest request = ChangePasswordRequest.builder()
                                        .currentPassword("WrongPass")
                                        .newPassword("NewPass456")
                                        .confirmPassword("NewPass456")
                                        .build();

                        when(authService.getCurrentUser()).thenReturn(testUser);
                        doThrow(new BadRequestException("Mật khẩu hiện tại không chính xác"))
                                        .when(userService)
                                        .changePassword(eq(testUserId), any(ChangePasswordRequest.class));

                        // Act & Assert
                        assertThatThrownBy(() -> userController.changePassword(request))
                                        .isInstanceOf(BadRequestException.class)
                                        .hasMessage("Mật khẩu hiện tại không chính xác");

                        verify(userService).changePassword(eq(testUserId), any(ChangePasswordRequest.class));
                }

                @Test
                @DisplayName("Should throw BadRequestException when confirm password not match")
                void shouldThrowExceptionWhenConfirmPasswordNotMatch() {
                        // Arrange
                        ChangePasswordRequest request = ChangePasswordRequest.builder()
                                        .currentPassword("OldPass123")
                                        .newPassword("NewPass456")
                                        .confirmPassword("DifferentPass")
                                        .build();

                        when(authService.getCurrentUser()).thenReturn(testUser);
                        doThrow(new BadRequestException("Xác nhận mật khẩu không khớp"))
                                        .when(userService)
                                        .changePassword(eq(testUserId), any(ChangePasswordRequest.class));

                        // Act & Assert
                        assertThatThrownBy(() -> userController.changePassword(request))
                                        .isInstanceOf(BadRequestException.class)
                                        .hasMessage("Xác nhận mật khẩu không khớp");
                }

                @Test
                @DisplayName("Should throw BadRequestException when new password same as current")
                void shouldThrowExceptionWhenNewPasswordSameAsCurrent() {
                        // Arrange
                        ChangePasswordRequest request = ChangePasswordRequest.builder()
                                        .currentPassword("SamePass123")
                                        .newPassword("SamePass123")
                                        .confirmPassword("SamePass123")
                                        .build();

                        when(authService.getCurrentUser()).thenReturn(testUser);
                        doThrow(new BadRequestException("Mật khẩu mới không được trùng với mật khẩu hiện tại"))
                                        .when(userService)
                                        .changePassword(eq(testUserId), any(ChangePasswordRequest.class));

                        // Act & Assert
                        assertThatThrownBy(() -> userController.changePassword(request))
                                        .isInstanceOf(BadRequestException.class)
                                        .hasMessage("Mật khẩu mới không được trùng với mật khẩu hiện tại");
                }
        }
}
