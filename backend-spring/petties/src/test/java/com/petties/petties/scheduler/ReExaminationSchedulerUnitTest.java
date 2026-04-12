package com.petties.petties.scheduler;

import com.petties.petties.model.EmrRecord;
import com.petties.petties.model.Notification;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.repository.EmrRecordRepository;
import com.petties.petties.repository.NotificationRepository;
import com.petties.petties.repository.PetRepository;
import com.petties.petties.service.FcmService;
import com.petties.petties.service.SseEmitterService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ReExaminationScheduler Unit Tests")
class ReExaminationSchedulerUnitTest {

    @Mock
    private EmrRecordRepository emrRecordRepository;
    @Mock
    private NotificationRepository notificationRepository;
    @Mock
    private PetRepository petRepository;
    @Mock
    private SseEmitterService sseEmitterService;
    @Mock
    private FcmService fcmService;

    @InjectMocks
    private ReExaminationScheduler reExaminationScheduler;

    private User owner;
    private Pet pet;
    private EmrRecord emr;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setUserId(UUID.randomUUID());
        owner.setFcmToken("test-token");

        pet = new Pet();
        pet.setId(UUID.randomUUID());
        pet.setName("Kitty");
        pet.setUser(owner);

        emr = new EmrRecord();
        emr.setId(UUID.randomUUID().toString());
        emr.setPetId(pet.getId());
        emr.setReExaminationDate(LocalDateTime.now().plusDays(1));
    }

    @Test
    @DisplayName("UTCID01 - checkReExaminations - Found records - Success")
    void checkReExaminations_found_success() {
        // Arrange
        when(emrRecordRepository.findByReExaminationDateBetween(any(), any()))
                .thenReturn(Collections.emptyList()) // 30 days
                .thenReturn(Collections.emptyList()) // 7 days
                .thenReturn(List.of(emr)); // 1 day

        when(petRepository.findById(pet.getId())).thenReturn(Optional.of(pet));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(i -> {
            Notification n = i.getArgument(0);
            n.setNotificationId(UUID.randomUUID());
            return n;
        });

        // Act
        reExaminationScheduler.checkReExaminations();

        // Assert
        verify(notificationRepository, times(1)).save(any(Notification.class));
        verify(fcmService, times(1)).sendToUser(any(User.class), anyString(), anyString(), anyMap());
    }

    @Test
    @DisplayName("UTCID02 - checkReExaminations - No records - Skip")
    void checkReExaminations_none_skip() {
        when(emrRecordRepository.findByReExaminationDateBetween(any(), any())).thenReturn(Collections.emptyList());
        reExaminationScheduler.checkReExaminations();
        verify(notificationRepository, never()).save(any());
    }
}
