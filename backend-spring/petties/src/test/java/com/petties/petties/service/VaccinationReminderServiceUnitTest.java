package com.petties.petties.service;

import com.petties.petties.model.Notification;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.VaccinationRecord;
import com.petties.petties.model.enums.NotificationType;
import com.petties.petties.repository.NotificationRepository;
import com.petties.petties.repository.PetRepository;
import com.petties.petties.repository.VaccinationRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("VaccinationReminderService Unit Tests")
class VaccinationReminderServiceUnitTest {

    @Mock
    private VaccinationRecordRepository vaccinationRecordRepository;

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private PetRepository petRepository;

    @Mock
    private SseEmitterService sseEmitterService;

    @Mock
    private FcmService fcmService;

    @InjectMocks
    private VaccinationReminderService vaccinationReminderService;

    private User owner;
    private Pet pet;
    private VaccinationRecord record;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setUserId(UUID.randomUUID());
        owner.setFcmToken("test-fcm-token");

        pet = new Pet();
        pet.setId(UUID.randomUUID());
        pet.setName("Lu");
        pet.setUser(owner);

        record = new VaccinationRecord();
        record.setId(UUID.randomUUID().toString());
        record.setPetId(pet.getId());
        record.setVaccineName("Rabies");
        record.setDoseNumber(1);
    }

    @Test
    @DisplayName("UTCID01 - Send Reminders - Found records for all intervals - Success")
    void sendDailyVaccinationReminders_allIntervals_success() {
        // Arrange
        LocalDate today = LocalDate.now();
        record.setNextDueDate(today.plusDays(1)); // For 1 day reminder

        when(vaccinationRecordRepository.findByNextDueDate(today.plusDays(30))).thenReturn(Collections.emptyList());
        when(vaccinationRecordRepository.findByNextDueDate(today.plusDays(7))).thenReturn(Collections.emptyList());
        when(vaccinationRecordRepository.findByNextDueDate(today.plusDays(1))).thenReturn(List.of(record));

        when(petRepository.findById(pet.getId())).thenReturn(Optional.of(pet));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(i -> {
            Notification n = i.getArgument(0);
            n.setNotificationId(UUID.randomUUID());
            return n;
        });

        // Act
        vaccinationReminderService.sendDailyVaccinationReminders();

        // Assert
        verify(notificationRepository, times(1)).save(any(Notification.class));
        verify(fcmService, times(1)).sendToUser(any(User.class), anyString(), anyString(), anyMap());
    }

    @Test
    @DisplayName("UTCID02 - Send Reminders - No records due - No notifications sent")
    void sendDailyVaccinationReminders_noRecords_nothingSent() {
        // Arrange
        when(vaccinationRecordRepository.findByNextDueDate(any(LocalDate.class))).thenReturn(Collections.emptyList());

        // Act
        vaccinationReminderService.sendDailyVaccinationReminders();

        // Assert
        verify(notificationRepository, never()).save(any());
        verify(fcmService, never()).sendToUser(any(User.class), any(), any(), any());
    }

    @Test
    @DisplayName("UTCID03 - Send Reminders - Pet not found - Skip record")
    void sendDailyVaccinationReminders_petNotFound_skip() {
        // Arrange
        LocalDate today = LocalDate.now();
        record.setNextDueDate(today.plusDays(1));
        lenient().when(vaccinationRecordRepository.findByNextDueDate(any(LocalDate.class)))
                .thenReturn(Collections.emptyList());
        when(vaccinationRecordRepository.findByNextDueDate(today.plusDays(1))).thenReturn(List.of(record));
        when(petRepository.findById(pet.getId())).thenReturn(Optional.empty());

        // Act
        vaccinationReminderService.sendDailyVaccinationReminders();

        // Assert
        verify(notificationRepository, never()).save(any());
    }
}
