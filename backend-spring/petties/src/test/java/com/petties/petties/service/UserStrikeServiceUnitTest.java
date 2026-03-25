package com.petties.petties.service;

import com.petties.petties.model.Report;
import com.petties.petties.model.User;
import com.petties.petties.model.UserStrikeConfig;
import com.petties.petties.model.enums.ReportStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.ReportRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.repository.UserStrikeConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserStrikeService Unit Tests")
class UserStrikeServiceUnitTest {

    @Mock
    private UserStrikeConfigRepository configRepository;

    @Mock
    private ReportRepository reportRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private UserStrikeService userStrikeService;

    private User user;
    private Report report;
    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        user = User.builder()
                .userId(userId)
                .role(Role.PET_OWNER)
                .strikeUntil(null)
                .build();

        report = Report.builder()
                .reportedUser(user)
                .status(ReportStatus.APPROVED)
                .build();
    }

    @Nested
    @DisplayName("checkAndApplyStrike")
    class CheckAndApplyStrike {

        @Test
        void whenReportedUserIsNull_shouldNotApplyStrike() {
            report.setReportedUser(null);

            userStrikeService.checkAndApplyStrike(report);

            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        void whenUserNotFound_shouldNotApplyStrike() {
            when(userRepository.findById(userId)).thenReturn(Optional.empty());

            userStrikeService.checkAndApplyStrike(report);

            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        void whenCountBelowThreshold_shouldNotApplyStrike() {
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(configRepository.findById("user_strike_threshold")).thenReturn(Optional.of(config("3")));
            when(configRepository.findById("user_strike_permanent_threshold")).thenReturn(Optional.of(config("7")));
            when(configRepository.findById("user_strike_window_days")).thenReturn(Optional.of(config("90")));
            when(configRepository.findById("user_strike_duration_days")).thenReturn(Optional.of(config("7")));
            when(reportRepository.countApprovedReportsByUserInWindow(eq(userId), any(LocalDateTime.class), eq(ReportStatus.APPROVED)))
                    .thenReturn(2L);

            userStrikeService.checkAndApplyStrike(report);

            verify(userRepository, never()).save(any(User.class));
        }

        @Test
        void whenCountAtThreshold_shouldApplyTemporaryStrike() {
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(configRepository.findById("user_strike_threshold")).thenReturn(Optional.of(config("3")));
            when(configRepository.findById("user_strike_permanent_threshold")).thenReturn(Optional.of(config("7")));
            when(configRepository.findById("user_strike_window_days")).thenReturn(Optional.of(config("90")));
            when(configRepository.findById("user_strike_duration_days")).thenReturn(Optional.of(config("7")));
            when(reportRepository.countApprovedReportsByUserInWindow(eq(userId), any(LocalDateTime.class), eq(ReportStatus.APPROVED)))
                    .thenReturn(3L);

            userStrikeService.checkAndApplyStrike(report);

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(captor.capture());
            User saved = captor.getValue();
            assertNotNull(saved.getStrikeUntil());
            assertTrue(saved.getStrikeUntil().isBefore(LocalDateTime.of(9999, 12, 31, 23, 59)));
        }

        @Test
        void whenCountAtPermanentThreshold_shouldApplyPermanentStrike() {
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(configRepository.findById("user_strike_threshold")).thenReturn(Optional.of(config("3")));
            when(configRepository.findById("user_strike_permanent_threshold")).thenReturn(Optional.of(config("7")));
            when(configRepository.findById("user_strike_window_days")).thenReturn(Optional.of(config("90")));
            when(configRepository.findById("user_strike_duration_days")).thenReturn(Optional.of(config("7")));
            when(reportRepository.countApprovedReportsByUserInWindow(eq(userId), any(LocalDateTime.class), eq(ReportStatus.APPROVED)))
                    .thenReturn(7L);

            userStrikeService.checkAndApplyStrike(report);

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(captor.capture());
            User saved = captor.getValue();
            assertEquals(LocalDateTime.of(9999, 12, 31, 23, 59), saved.getStrikeUntil());
        }
    }

    @Nested
    @DisplayName("clearExpiredStrikes")
    class ClearExpiredStrikes {

        @Test
        void whenNoExpiredStrikes_shouldReturnZero() {
            when(userRepository.findUsersWithExpiredStrike()).thenReturn(List.of());

            int cleared = userStrikeService.clearExpiredStrikes();

            assertEquals(0, cleared);
            verify(userRepository).findUsersWithExpiredStrike();
        }

        @Test
        void whenExpiredStrikesExist_shouldClearThem() {
            User expired = User.builder().userId(UUID.randomUUID()).strikeUntil(LocalDateTime.now().minusDays(1)).build();
            when(userRepository.findUsersWithExpiredStrike()).thenReturn(List.of(expired));
            when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

            int cleared = userStrikeService.clearExpiredStrikes();

            assertEquals(1, cleared);
            assertNull(expired.getStrikeUntil());
        }
    }

    private static UserStrikeConfig config(String value) {
        UserStrikeConfig c = new UserStrikeConfig();
        c.setConfigValue(value);
        return c;
    }
}
