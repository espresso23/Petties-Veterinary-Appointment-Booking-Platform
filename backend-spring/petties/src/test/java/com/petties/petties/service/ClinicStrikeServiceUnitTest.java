package com.petties.petties.service;

import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicStrikeConfig;
import com.petties.petties.model.Report;
import com.petties.petties.model.enums.ReportStatus;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.ClinicStrikeConfigRepository;
import com.petties.petties.repository.ReportRepository;
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
@DisplayName("ClinicStrikeService Unit Tests")
class ClinicStrikeServiceUnitTest {

    @Mock
    private ClinicStrikeConfigRepository configRepository;

    @Mock
    private ReportRepository reportRepository;

    @Mock
    private ClinicRepository clinicRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private ClinicStrikeService clinicStrikeService;

    private Clinic clinic;
    private Report report;
    private UUID clinicId;

    @BeforeEach
    void setUp() {
        clinicId = UUID.randomUUID();
        clinic = Clinic.builder()
                .clinicId(clinicId)
                .strikeUntil(null)
                .build();

        report = Report.builder()
                .reportedClinic(clinic)
                .status(ReportStatus.APPROVED)
                .build();
    }

    @Nested
    @DisplayName("checkAndApplyStrike")
    class CheckAndApplyStrike {

        @Test
        void whenReportedClinicIsNull_shouldNotApplyStrike() {
            report.setReportedClinic(null);

            clinicStrikeService.checkAndApplyStrike(report);

            verify(clinicRepository, never()).save(any(Clinic.class));
        }

        @Test
        void whenClinicNotFound_shouldNotApplyStrike() {
            when(clinicRepository.findByIdAndNotDeleted(clinicId)).thenReturn(Optional.empty());

            clinicStrikeService.checkAndApplyStrike(report);

            verify(clinicRepository, never()).save(any(Clinic.class));
        }

        @Test
        void whenCountBelowThreshold_shouldNotApplyStrike() {
            when(clinicRepository.findByIdAndNotDeleted(clinicId)).thenReturn(Optional.of(clinic));
            when(configRepository.findById("strike_threshold")).thenReturn(Optional.of(config("3")));
            when(configRepository.findById("strike_permanent_threshold")).thenReturn(Optional.of(config("7")));
            when(configRepository.findById("strike_window_days")).thenReturn(Optional.of(config("90")));
            when(configRepository.findById("strike_duration_days")).thenReturn(Optional.of(config("7")));
            when(reportRepository.countApprovedReportsByClinicInWindow(eq(clinicId), any(LocalDateTime.class), eq(ReportStatus.APPROVED)))
                    .thenReturn(2L);

            clinicStrikeService.checkAndApplyStrike(report);

            verify(clinicRepository, never()).save(any(Clinic.class));
        }

        @Test
        void whenCountAtThreshold_shouldApplyTemporaryStrike() {
            when(clinicRepository.findByIdAndNotDeleted(clinicId)).thenReturn(Optional.of(clinic));
            when(configRepository.findById("strike_threshold")).thenReturn(Optional.of(config("3")));
            when(configRepository.findById("strike_permanent_threshold")).thenReturn(Optional.of(config("7")));
            when(configRepository.findById("strike_window_days")).thenReturn(Optional.of(config("90")));
            when(configRepository.findById("strike_duration_days")).thenReturn(Optional.of(config("7")));
            when(reportRepository.countApprovedReportsByClinicInWindow(eq(clinicId), any(LocalDateTime.class), eq(ReportStatus.APPROVED)))
                    .thenReturn(3L);

            clinicStrikeService.checkAndApplyStrike(report);

            ArgumentCaptor<Clinic> captor = ArgumentCaptor.forClass(Clinic.class);
            verify(clinicRepository).save(captor.capture());
            Clinic saved = captor.getValue();
            assertNotNull(saved.getStrikeUntil());
            assertTrue(saved.getStrikeUntil().isBefore(LocalDateTime.of(9999, 12, 31, 23, 59)));
        }

        @Test
        void whenCountAtPermanentThreshold_shouldApplyPermanentStrike() {
            when(clinicRepository.findByIdAndNotDeleted(clinicId)).thenReturn(Optional.of(clinic));
            when(configRepository.findById("strike_threshold")).thenReturn(Optional.of(config("3")));
            when(configRepository.findById("strike_permanent_threshold")).thenReturn(Optional.of(config("7")));
            when(configRepository.findById("strike_window_days")).thenReturn(Optional.of(config("90")));
            when(configRepository.findById("strike_duration_days")).thenReturn(Optional.of(config("7")));
            when(reportRepository.countApprovedReportsByClinicInWindow(eq(clinicId), any(LocalDateTime.class), eq(ReportStatus.APPROVED)))
                    .thenReturn(7L);

            clinicStrikeService.checkAndApplyStrike(report);

            ArgumentCaptor<Clinic> captor = ArgumentCaptor.forClass(Clinic.class);
            verify(clinicRepository).save(captor.capture());
            Clinic saved = captor.getValue();
            assertEquals(LocalDateTime.of(9999, 12, 31, 23, 59), saved.getStrikeUntil());
        }
    }

    @Nested
    @DisplayName("clearExpiredStrikes")
    class ClearExpiredStrikes {

        @Test
        void whenNoExpiredStrikes_shouldReturnZero() {
            when(clinicRepository.findClinicsWithExpiredStrike()).thenReturn(List.of());

            int cleared = clinicStrikeService.clearExpiredStrikes();

            assertEquals(0, cleared);
            verify(clinicRepository).findClinicsWithExpiredStrike();
        }

        @Test
        void whenExpiredStrikesExist_shouldClearThem() {
            Clinic expired = Clinic.builder().clinicId(UUID.randomUUID()).strikeUntil(LocalDateTime.now().minusDays(1)).build();
            when(clinicRepository.findClinicsWithExpiredStrike()).thenReturn(List.of(expired));
            when(clinicRepository.save(any(Clinic.class))).thenAnswer(i -> i.getArgument(0));

            int cleared = clinicStrikeService.clearExpiredStrikes();

            assertEquals(1, cleared);
            assertNull(expired.getStrikeUntil());
        }
    }

    private static ClinicStrikeConfig config(String value) {
        ClinicStrikeConfig c = new ClinicStrikeConfig();
        c.setConfigValue(value);
        return c;
    }
}
