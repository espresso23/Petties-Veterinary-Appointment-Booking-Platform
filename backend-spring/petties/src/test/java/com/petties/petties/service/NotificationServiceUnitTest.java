package com.petties.petties.service;

import com.petties.petties.dto.sse.SseEventDto;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Notification;
import com.petties.petties.model.User;
import com.petties.petties.model.StaffShift;
import com.petties.petties.model.enums.NotificationType;
import com.petties.petties.repository.NotificationRepository;
import com.petties.petties.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationService Unit Tests")
class NotificationServiceUnitTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SseEmitterService sseEmitterService;

    @Mock
    private FcmService fcmService;

    @InjectMocks
    private NotificationService notificationService;

    @Test
    @DisplayName("Create Clinic Notification - Success")
    void createClinicNotification_success() {
        // Arrange
        UUID clinicId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(ownerId);

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);
        clinic.setName("Test Clinic");
        clinic.setOwner(owner);

        when(notificationRepository.existsByClinicClinicIdAndType(clinicId, NotificationType.APPROVED))
                .thenReturn(false);
        when(sseEmitterService.isUserConnected(ownerId)).thenReturn(true);

        when(notificationRepository.save(any(Notification.class))).thenAnswer(i -> {
            Notification n = i.getArgument(0);
            n.setNotificationId(UUID.randomUUID());
            return n;
        });

        // Act
        Notification result = notificationService.createClinicNotification(
                clinic, NotificationType.APPROVED, "Legal");

        // Assert
        assertNotNull(result);
        assertEquals(NotificationType.APPROVED, result.getType());
        verify(sseEmitterService).pushToUser(eq(ownerId), any(SseEventDto.class));
    }

    @Test
    @DisplayName("Notify Vet Shift Assigned - Success")
    void notifyVetShiftAssigned_success() {
        // Arrange
        UUID vetId = UUID.randomUUID();
        User vet = new User();
        vet.setUserId(vetId);

        Clinic clinic = new Clinic();
        clinic.setName("Clinic A");

        StaffShift shift = new StaffShift();
        shift.setShiftId(UUID.randomUUID());
        shift.setWorkDate(LocalDate.now());
        shift.setStartTime(LocalTime.of(8, 0));
        shift.setEndTime(LocalTime.of(12, 0));
        shift.setClinic(clinic);

        when(sseEmitterService.isUserConnected(vetId)).thenReturn(true);

        when(notificationRepository.save(any(Notification.class))).thenAnswer(i -> {
            Notification n = i.getArgument(0);
            n.setNotificationId(UUID.randomUUID());
            return n;
        });

        // Act
        Notification result = notificationService.notifyStaffShiftAssigned(vet, shift);

        // Assert
        assertNotNull(result);
        assertTrue(result.getMessage().contains("Clinic A"));
        verify(sseEmitterService).pushToUser(eq(vetId), any(SseEventDto.class));
    }
}
