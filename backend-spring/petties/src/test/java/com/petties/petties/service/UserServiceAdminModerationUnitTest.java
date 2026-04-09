package com.petties.petties.service;

import com.petties.petties.dto.response.AdminUserSummaryResponse;
import com.petties.petties.dto.user.AdminRestrictUserRequest;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.ChatConversationRepository;
import com.petties.petties.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserService Admin Moderation Unit Tests")
class UserServiceAdminModerationUnitTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private CloudinaryService cloudinaryService;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private ChatConversationRepository chatConversationRepository;
    @Mock
    private UserStrikeService userStrikeService;

    @InjectMocks
    private UserService userService;

    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        user = User.builder()
                .userId(userId)
                .username("test-user")
                .role(Role.PET_OWNER)
                .createdAt(LocalDateTime.now().minusDays(2))
                .build();
    }

    @Test
    @DisplayName("TC-UNIT-USER-SERVICE-ADMIN-001: restrict user success")
    void restrictUserForAdmin_validRequest_success() {
        AdminRestrictUserRequest request = AdminRestrictUserRequest.builder()
                .reason("Vi phạm nội quy cộng đồng nghiêm trọng")
                .isPermanent(false)
                .days(14)
                .build();
        LocalDateTime strikeUntil = LocalDateTime.now().plusDays(14);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userStrikeService.isPermanentStrike(user.getStrikeUntil())).thenReturn(false);
        when(userStrikeService.calculateManualStrikeUntil(false, 14)).thenReturn(strikeUntil);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminUserSummaryResponse response = userService.restrictUserForAdmin(userId, request);

        assertEquals(strikeUntil, response.getStrikeUntil());
        verify(userRepository).save(any(User.class));
    }

    @Test
    @DisplayName("TC-UNIT-USER-SERVICE-ADMIN-002: restrict user not found")
    void restrictUserForAdmin_userNotFound_throwException() {
        AdminRestrictUserRequest request = AdminRestrictUserRequest.builder()
                .reason("Lý do hợp lệ trên 10 ký tự")
                .isPermanent(true)
                .build();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> userService.restrictUserForAdmin(userId, request));
    }

    @Test
    @DisplayName("TC-UNIT-USER-SERVICE-ADMIN-003: lift strike when no active strike")
    void liftUserStrikeForAdmin_whenNoActiveStrike_throwException() {
        user.setStrikeUntil(null);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        assertThrows(BadRequestException.class, () -> userService.liftUserStrikeForAdmin(userId));
    }
}
