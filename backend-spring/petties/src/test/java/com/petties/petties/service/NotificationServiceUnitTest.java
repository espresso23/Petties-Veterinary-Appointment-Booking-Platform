package com.petties.petties.service;

import com.petties.petties.dto.sse.SseEventDto;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Pet;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Notification;
import com.petties.petties.model.User;
import com.petties.petties.model.StaffShift;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.model.enums.NotificationType;
import com.petties.petties.model.enums.Role;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.repository.NotificationRepository;
import com.petties.petties.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
    @DisplayName("Create Clinic Notification - Duplicate Exists -> Return null and skip save")
    void createClinicNotification_duplicateExists_returnsNull() {
        UUID clinicId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(UUID.randomUUID());

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);
        clinic.setName("Test Clinic");
        clinic.setOwner(owner);

        when(notificationRepository.existsByClinicClinicIdAndType(clinicId, NotificationType.APPROVED))
                .thenReturn(true);

        Notification result = notificationService.createClinicNotification(clinic, NotificationType.APPROVED, null);

        assertNull(result);
        verify(notificationRepository, never()).save(any(Notification.class));
        verify(sseEmitterService, never()).pushToUser(any(), any(SseEventDto.class));
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

    @Test
    @DisplayName("Send Booking Notification To Clinic - Deduplicate managers")
    void sendBookingNotificationToClinic_deduplicatesManagers() {
        UUID clinicId = UUID.randomUUID();
        UUID managerId = UUID.randomUUID();
        UUID secondManagerId = UUID.randomUUID();

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);

        User petOwner = new User();
        petOwner.setFullName("Nguyễn Văn A");

        Pet pet = new Pet();
        pet.setName("Milu");

        Booking booking = new Booking();
        booking.setClinic(clinic);
        booking.setBookingCode("BK-001");
        booking.setPetOwner(petOwner);
        booking.setPet(pet);

        User duplicatedManager = new User();
        duplicatedManager.setUserId(managerId);
        duplicatedManager.setRole(Role.CLINIC_MANAGER);

        User duplicatedManagerSameId = new User();
        duplicatedManagerSameId.setUserId(managerId);
        duplicatedManagerSameId.setRole(Role.CLINIC_MANAGER);

        User secondManager = new User();
        secondManager.setUserId(secondManagerId);
        secondManager.setRole(Role.CLINIC_MANAGER);

        when(userRepository.findByWorkingClinicIdAndRole(clinicId, Role.CLINIC_MANAGER))
                .thenReturn(List.of(duplicatedManager, duplicatedManagerSameId, secondManager));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification notification = invocation.getArgument(0);
            notification.setNotificationId(UUID.randomUUID());
            return notification;
        });

        notificationService.sendBookingNotificationToClinic(booking);

        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, times(2)).save(notificationCaptor.capture());

        List<Notification> savedNotifications = notificationCaptor.getAllValues();
        assertEquals(2, savedNotifications.size());
        assertEquals(2, savedNotifications.stream().map(n -> n.getUser().getUserId()).distinct().count());
    }

    @Test
    @DisplayName("Send Staff On Way Notification - Skip non home service booking")
    void sendStaffOnWayNotification_nonHomeServiceBooking_skipsNotification() {
        Booking booking = new Booking();
        booking.setType(BookingType.IN_CLINIC);
        booking.setBookingCode("BK-002");
        booking.setTotalPrice(BigDecimal.ZERO);
        booking.setBookingDate(LocalDate.now());
        booking.setBookingTime(LocalTime.NOON);

        notificationService.sendStaffOnWayNotification(booking);

        verify(notificationRepository, never()).save(any(Notification.class));
        verify(userRepository, never()).findByWorkingClinicIdAndRole(any(), any());
    }

    @Test
    @DisplayName("Send Staff Reassigned Notification - should notify new and old staff when different")
    void sendStaffReassignedNotification_shouldNotifyBothSides() {
        Clinic clinic = new Clinic();
        clinic.setClinicId(UUID.randomUUID());

        Pet pet = new Pet();
        pet.setName("Milu");

        Booking booking = new Booking();
        booking.setClinic(clinic);
        booking.setPet(pet);
        booking.setBookingCode("BK-003");
        booking.setBookingDate(LocalDate.now());
        booking.setBookingTime(LocalTime.of(9, 30));

        User newStaff = new User();
        newStaff.setUserId(UUID.randomUUID());

        User oldStaff = new User();
        oldStaff.setUserId(UUID.randomUUID());

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification notification = invocation.getArgument(0);
            notification.setNotificationId(UUID.randomUUID());
            return notification;
        });

        notificationService.sendStaffReassignedNotification(booking, newStaff, oldStaff, "Tiêm phòng");

        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, times(2)).save(notificationCaptor.capture());
        List<Notification> notifications = notificationCaptor.getAllValues();

        assertEquals(2, notifications.size());
        assertTrue(notifications.stream().anyMatch(n -> n.getUser().getUserId().equals(newStaff.getUserId())
                && n.getType() == NotificationType.BOOKING_CONFIRMED));
        assertTrue(notifications.stream().anyMatch(n -> n.getUser().getUserId().equals(oldStaff.getUserId())
                && n.getType() == NotificationType.BOOKING_CANCELLED));
    }

    @Test
    @DisplayName("Send Staff Reassigned Notification - should skip old staff notification when same user")
    void sendStaffReassignedNotification_sameStaff_shouldOnlyNotifyOnce() {
        Clinic clinic = new Clinic();
        clinic.setClinicId(UUID.randomUUID());

        Pet pet = new Pet();
        pet.setName("Milu");

        User sameStaff = new User();
        sameStaff.setUserId(UUID.randomUUID());

        Booking booking = new Booking();
        booking.setClinic(clinic);
        booking.setPet(pet);
        booking.setBookingCode("BK-004");
        booking.setBookingDate(LocalDate.now());
        booking.setBookingTime(LocalTime.of(10, 0));

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification notification = invocation.getArgument(0);
            notification.setNotificationId(UUID.randomUUID());
            return notification;
        });

        notificationService.sendStaffReassignedNotification(booking, sameStaff, sameStaff, "Khám tổng quát");

        verify(notificationRepository, times(1)).save(any(Notification.class));
    }

    @Test
    @DisplayName("Mark As Read - should update when notification belongs to user")
    void markAsRead_shouldUpdateWhenOwnedByUser() {
        UUID userId = UUID.randomUUID();
        UUID notificationId = UUID.randomUUID();

        User user = new User();
        user.setUserId(userId);

        Notification notification = new Notification();
        notification.setNotificationId(notificationId);
        notification.setUser(user);

        when(notificationRepository.findById(notificationId)).thenReturn(Optional.of(notification));

        notificationService.markAsRead(notificationId, userId);

        verify(notificationRepository).markAsRead(notificationId);
    }

    @Test
    @DisplayName("Mark As Read - should throw when notification belongs to another user")
    void markAsRead_shouldThrowWhenNotOwnedByUser() {
        UUID ownerId = UUID.randomUUID();
        UUID requestUserId = UUID.randomUUID();
        UUID notificationId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(ownerId);

        Notification notification = new Notification();
        notification.setNotificationId(notificationId);
        notification.setUser(owner);

        when(notificationRepository.findById(notificationId)).thenReturn(Optional.of(notification));

        assertThrows(ForbiddenException.class, () -> notificationService.markAsRead(notificationId, requestUserId));
        verify(notificationRepository, never()).markAsRead(any());
    }

    @Test
    @DisplayName("Notify Admins New Clinic Registration - should skip existing duplicate per admin")
    void notifyAdminsNewClinicRegistration_shouldSkipExistingDuplicatePerAdmin() {
        UUID clinicId = UUID.randomUUID();
        UUID adminOneId = UUID.randomUUID();
        UUID adminTwoId = UUID.randomUUID();

        User owner = new User();
        owner.setFullName("Chủ phòng khám");

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);
        clinic.setName("Clinic A");
        clinic.setOwner(owner);

        User adminOne = new User();
        adminOne.setUserId(adminOneId);
        adminOne.setRole(Role.ADMIN);

        User adminTwo = new User();
        adminTwo.setUserId(adminTwoId);
        adminTwo.setRole(Role.ADMIN);

        when(userRepository.findByRoleAndDeletedAtIsNull(Role.ADMIN)).thenReturn(List.of(adminOne, adminTwo));
        when(notificationRepository.existsByUserUserIdAndClinicClinicIdAndType(adminOneId, clinicId,
                NotificationType.CLINIC_PENDING_APPROVAL)).thenReturn(true);
        when(notificationRepository.existsByUserUserIdAndClinicClinicIdAndType(adminTwoId, clinicId,
                NotificationType.CLINIC_PENDING_APPROVAL)).thenReturn(false);
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification notification = invocation.getArgument(0);
            notification.setNotificationId(UUID.randomUUID());
            return notification;
        });

        notificationService.notifyAdminsNewClinicRegistration(clinic);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, times(1)).save(captor.capture());
        assertEquals(adminTwoId, captor.getValue().getUser().getUserId());
    }

    @Test
    @DisplayName("Get Notifications By User - clinic manager should filter owner-facing notification types")
    void getNotificationsByUser_clinicManager_shouldFilterOwnerFacingTypes() {
        UUID managerId = UUID.randomUUID();
        User manager = new User();
        manager.setUserId(managerId);
        manager.setRole(Role.CLINIC_MANAGER);

        when(notificationRepository.findByUserUserIdAndTypeInOrderByCreatedAtDesc(
                eq(managerId), any(), any()))
                .thenReturn(new PageImpl<>(List.of()));

        notificationService.getNotificationsByUser(manager, PageRequest.of(0, 20));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<NotificationType>> typesCaptor = ArgumentCaptor.forClass(Collection.class);
        verify(notificationRepository).findByUserUserIdAndTypeInOrderByCreatedAtDesc(
                eq(managerId),
                typesCaptor.capture(),
                any());
        verify(notificationRepository, never()).findByUserUserIdOrderByCreatedAtDesc(any(), any());

        Collection<NotificationType> visibleTypes = typesCaptor.getValue();
        assertTrue(visibleTypes.contains(NotificationType.BOOKING_CREATED));
        assertTrue(visibleTypes.contains(NotificationType.BOOKING_CANCELLED));
        assertFalse(visibleTypes.contains(NotificationType.BOOKING_COMPLETED));
        assertFalse(visibleTypes.contains(NotificationType.BOOKING_CHECKIN));
        assertFalse(visibleTypes.contains(NotificationType.STAFF_ON_WAY));
        assertFalse(visibleTypes.contains(NotificationType.STAFF_ARRIVED));
    }

    @Test
    @DisplayName("Send Checkin Notification - should notify owner only")
    void sendCheckinNotification_shouldNotifyOwnerOnly() {
        UUID clinicId = UUID.randomUUID();

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);

        User owner = new User();
        owner.setUserId(UUID.randomUUID());

        User staff = new User();
        staff.setUserId(UUID.randomUUID());
        staff.setFullName("Bác sĩ B");

        Pet pet = new Pet();
        pet.setName("Milu");

        Booking booking = new Booking();
        booking.setClinic(clinic);
        booking.setPetOwner(owner);
        booking.setAssignedStaff(staff);
        booking.setPet(pet);
        booking.setBookingCode("BK-005");

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification notification = invocation.getArgument(0);
            notification.setNotificationId(UUID.randomUUID());
            return notification;
        });

        notificationService.sendCheckinNotification(booking);

        verify(notificationRepository, times(1)).save(any(Notification.class));
        verify(userRepository, never()).findByWorkingClinicIdAndRole(clinicId, Role.CLINIC_MANAGER);
    }

    @Test
    @DisplayName("Send Completed Notification - should notify owner only")
    void sendCompletedNotification_shouldNotifyOwnerOnly() {
        UUID clinicId = UUID.randomUUID();

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);

        User owner = new User();
        owner.setUserId(UUID.randomUUID());

        Pet pet = new Pet();
        pet.setName("Milu");

        Booking booking = new Booking();
        booking.setClinic(clinic);
        booking.setPetOwner(owner);
        booking.setPet(pet);
        booking.setBookingCode("BK-006");

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification notification = invocation.getArgument(0);
            notification.setNotificationId(UUID.randomUUID());
            return notification;
        });

        notificationService.sendCompletedNotification(booking);

        verify(notificationRepository, times(1)).save(any(Notification.class));
        verify(userRepository, never()).findByWorkingClinicIdAndRole(clinicId, Role.CLINIC_MANAGER);
    }
}
