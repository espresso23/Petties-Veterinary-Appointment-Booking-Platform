package com.petties.petties.service;

import com.petties.petties.dto.sos.SosConfirmRequest;
import com.petties.petties.dto.sos.SosMatchRequest;
import com.petties.petties.dto.sos.SosMatchResponse;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.exception.SosMatchingException;
import com.petties.petties.model.*;
import com.petties.petties.model.enums.*;
import com.petties.petties.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit Tests for SOS Auto-Match Service
 * 
 * Tests cover:
 * 1. Starting SOS matching process
 * 2. Clinic confirmation/decline handling
 * 3. Escalation to next clinic
 * 4. Timeout handling
 * 5. Edge cases (no clinics, all decline, etc.)
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("SOS Auto-Match Service - Unit Tests")
class SosMatchingServiceUnitTest {

    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private ClinicRepository clinicRepository;
    @Mock
    private PetRepository petRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ClinicPriceService clinicPriceService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private LocationService locationService;
    @Mock
    private SosSessionManager sessionManager;
    @Mock
    private SosNotificationService sosNotificationService;
    @Mock
    private BookingNotificationService bookingNotificationService;

    @InjectMocks
    private SosMatchingService sosMatchingService;

    private UUID petOwnerId;
    private UUID petId;
    private UUID clinicId1;
    private UUID clinicId2;
    private UUID bookingId;
    private UUID managerId;
    private UUID staffId;

    private User petOwner;
    private Pet pet;
    private Clinic clinic1;
    private Clinic clinic2;
    private Booking booking;
    private User manager;
    private User staff;

    @BeforeEach
    void setUp() {
        petOwnerId = UUID.randomUUID();
        petId = UUID.randomUUID();
        clinicId1 = UUID.randomUUID();
        clinicId2 = UUID.randomUUID();
        bookingId = UUID.randomUUID();
        managerId = UUID.randomUUID();
        staffId = UUID.randomUUID();

        // Pet Owner
        petOwner = new User();
        petOwner.setUserId(petOwnerId);
        petOwner.setFullName("Pet Owner");
        petOwner.setRole(Role.PET_OWNER);

        // Pet
        pet = new Pet();
        pet.setId(petId);
        pet.setName("Buddy");
        pet.setUser(petOwner);

        // Clinics
        clinic1 = new Clinic();
        clinic1.setClinicId(clinicId1);
        clinic1.setName("Clinic 1");
        clinic1.setPhone("0901234567");
        clinic1.setAddress("123 Street");
        clinic1.setLatitude(new BigDecimal("10.762622"));
        clinic1.setLongitude(new BigDecimal("106.660172"));

        clinic2 = new Clinic();
        clinic2.setClinicId(clinicId2);
        clinic2.setName("Clinic 2");
        clinic2.setPhone("0909876543");
        clinic2.setAddress("456 Avenue");
        clinic2.setLatitude(new BigDecimal("10.771234"));
        clinic2.setLongitude(new BigDecimal("106.668765"));

        // Manager
        manager = new User();
        manager.setUserId(managerId);
        manager.setRole(Role.CLINIC_MANAGER);
        manager.setWorkingClinic(clinic1);

        // Staff
        staff = new User();
        staff.setUserId(staffId);
        staff.setRole(Role.STAFF);
        staff.setFullName("SOS Staff");

        // Booking
        booking = new Booking();
        booking.setBookingId(bookingId);
        booking.setType(BookingType.SOS);
        booking.setStatus(BookingStatus.PENDING_CLINIC_CONFIRM);
        booking.setPet(pet);
        booking.setPetOwner(petOwner);
        booking.setBookingServices(new ArrayList<>());

        // Global config mocks
        lenient().when(sessionManager.getMaxClinicsToTry()).thenReturn(5);
        lenient().when(sessionManager.getClinicTimeoutSeconds()).thenReturn(60);
        lenient().when(sessionManager.acquireUserLock(any())).thenReturn(true);
        lenient().when(sessionManager.acquireBookingLock(any())).thenReturn(true); // Default to true
    }

    @Nested
    @DisplayName("1. Start Matching Process")
    class StartMatchingTests {

        @Test
        @DisplayName("TC-SOS-MATCH-001: Should create booking and find nearby clinics")
        void startMatching_Success_FindsNearbyClinics() {
            // Arrange
            SosMatchRequest request = new SosMatchRequest();
            request.setPetId(petId);
            request.setLatitude(new BigDecimal("10.762622"));
            request.setLongitude(new BigDecimal("106.660172"));
            request.setSymptoms("Vomiting, lethargy");

            // Mock no active SOS booking
            when(bookingRepository.findActiveSosBookingsByPetOwner(petOwnerId)).thenReturn(Collections.emptyList());
            when(petRepository.findById(petId)).thenReturn(Optional.of(pet));
            when(clinicRepository.findNearbyClinics(any(), any(), anyDouble()))
                    .thenReturn(List.of(clinic1, clinic2));
            when(userRepository.findById(petOwnerId)).thenReturn(Optional.of(petOwner));
            when(bookingRepository.existsByBookingCode(anyString())).thenReturn(false);
            when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> {
                Booking b = inv.getArgument(0);
                b.setBookingId(bookingId);
                return b;
            });
            when(userRepository.findByWorkingClinicIdAndRole(clinicId1, Role.CLINIC_MANAGER))
                    .thenReturn(List.of(manager));
            when(locationService.calculateDistance(any(), any(), any(), any()))
                    .thenReturn(2.5);

            // Act
            SosMatchResponse response = sosMatchingService.startMatching(request, petOwnerId);

            // Assert
            assertNotNull(response);
            assertEquals(BookingStatus.PENDING_CLINIC_CONFIRM, response.getStatus());
            assertEquals(clinicId1, response.getClinicId());
            assertEquals("Clinic 1", response.getClinicName());
            assertNotNull(response.getWsTopicUrl());
            assertTrue(response.getWsTopicUrl().contains("/topic/sos-matching/"));

            // Verify session creation
            verify(sessionManager).acquireUserLock(petOwnerId);
            verify(sessionManager).createSession(eq(bookingId), anyList());
            verify(sessionManager).releaseUserLock(petOwnerId);

            // Verify notification
            verify(sosNotificationService).alertClinic(any(), any(), anyInt(), anyInt());
            verify(sosNotificationService).notifyOwnerClinicContacted(any(), any(), anyInt(), anyInt(), anyDouble());
        }

        @Test
        @DisplayName("TC-SOS-MATCH-002: Should return NO_CLINIC when no clinics found")
        void startMatching_NoClinicFound_ReturnsCancelled() {
            // Arrange
            SosMatchRequest request = new SosMatchRequest();
            request.setPetId(petId);
            request.setLatitude(new BigDecimal("10.762622"));
            request.setLongitude(new BigDecimal("106.660172"));

            when(bookingRepository.findActiveSosBookingsByPetOwner(petOwnerId)).thenReturn(Collections.emptyList());
            when(petRepository.findById(petId)).thenReturn(Optional.of(pet));
            when(clinicRepository.findNearbyClinics(any(), any(), anyDouble()))
                    .thenReturn(Collections.emptyList());

            // Act
            SosMatchResponse response = sosMatchingService.startMatching(request, petOwnerId);

            // Assert
            assertNotNull(response);
            assertEquals(BookingStatus.CANCELLED, response.getStatus());
            assertTrue(response.getMessage().contains("Không tìm thấy phòng khám"));
        }

        @Test
        @DisplayName("TC-SOS-MATCH-003: Should throw exception for invalid pet ownership")
        void startMatching_InvalidPetOwnership_ThrowsException() {
            // Arrange
            SosMatchRequest request = new SosMatchRequest();
            request.setPetId(petId);
            request.setLatitude(new BigDecimal("10.762622"));
            request.setLongitude(new BigDecimal("106.660172"));

            User anotherOwner = new User();
            anotherOwner.setUserId(UUID.randomUUID());
            pet.setUser(anotherOwner);

            when(bookingRepository.findActiveSosBookingsByPetOwner(petOwnerId)).thenReturn(Collections.emptyList());
            when(petRepository.findById(petId)).thenReturn(Optional.of(pet));

            // Act & Assert
            assertThrows(SosMatchingException.class, () -> sosMatchingService.startMatching(request, petOwnerId));
        }

        @Test
        @DisplayName("TC-SOS-MATCH-004: Should throw exception for non-existent pet")
        void startMatching_PetNotFound_ThrowsException() {
            // Arrange
            SosMatchRequest request = new SosMatchRequest();
            request.setPetId(petId);
            request.setLatitude(new BigDecimal("10.762622"));
            request.setLongitude(new BigDecimal("106.660172"));

            when(bookingRepository.findActiveSosBookingsByPetOwner(petOwnerId)).thenReturn(Collections.emptyList());
            when(petRepository.findById(petId)).thenReturn(Optional.empty());

            // Act & Assert
            assertThrows(SosMatchingException.class, () -> sosMatchingService.startMatching(request, petOwnerId));
        }

        @Test
        @DisplayName("TC-SOS-START-004: Should resume existing active SOS booking")
        void startMatching_ActiveBookingExists_ReturnsResumeResponse() {
            // Arrange
            SosMatchRequest request = new SosMatchRequest();
            request.setPetId(petId);
            request.setLatitude(new BigDecimal("10.762622"));
            request.setLongitude(new BigDecimal("106.660172"));

            // Existing active booking
            Booking existingBooking = new Booking();
            existingBooking.setBookingId(UUID.randomUUID());
            existingBooking.setBookingCode("SOS-12345");
            existingBooking.setStatus(BookingStatus.PENDING_CLINIC_CONFIRM);
            existingBooking.setType(BookingType.SOS);

            when(bookingRepository.findActiveSosBookingsByPetOwner(petOwnerId))
                    .thenReturn(List.of(existingBooking));

            // Act
            SosMatchResponse response = sosMatchingService.startMatching(request, petOwnerId);

            // Assert
            assertNotNull(response);
            assertEquals(existingBooking.getBookingId(), response.getBookingId());
            assertEquals(BookingStatus.PENDING_CLINIC_CONFIRM, response.getStatus());
            assertTrue(response.getMessage().contains("SOS"));
            verify(bookingRepository, never()).save(any(Booking.class));
        }
    }

    @Nested
    @DisplayName("2. Clinic Confirmation/Decline")
    class ConfirmationTests {

        @Test
        @DisplayName("TC-SOS-CONF-001: Should confirm SOS and assign clinic")
        void processConfirmation_Accept_Success() {
            // Arrange
            SosConfirmRequest request = new SosConfirmRequest();
            request.setBookingId(bookingId);
            request.setAccepted(true);
            request.setAssignedStaffId(staffId);

            // IMPORTANT: Booking must have the same clinic as manager for security check
            booking.setClinic(clinic1);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));
            when(clinicPriceService.getSosFee(clinicId1)).thenReturn(Optional.of(BigDecimal.valueOf(100000)));
            when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            SosMatchResponse response = sosMatchingService.processConfirmation(request, managerId);

            // Assert
            assertNotNull(response);
            assertEquals(BookingStatus.CONFIRMED, response.getStatus());
            assertEquals(clinicId1, response.getClinicId());
            assertEquals("Clinic 1", response.getClinicName());

            // Verify booking updated
            ArgumentCaptor<Booking> bookingCaptor = ArgumentCaptor.forClass(Booking.class);
            verify(bookingRepository).save(bookingCaptor.capture());
            assertEquals(BookingStatus.CONFIRMED, bookingCaptor.getValue().getStatus());
            assertEquals(clinic1, bookingCaptor.getValue().getClinic());
            assertEquals(new BigDecimal("100000"), bookingCaptor.getValue().getSosFee());
            assertEquals(new BigDecimal("100000"), bookingCaptor.getValue().getTotalPrice());

            // Verify session cleared
            verify(sessionManager).clearSession(bookingId);
            verify(sosNotificationService)
                    .notifyOwnerConfirmed(any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("TC-SOS-CONF-002: Should decline and escalate to next clinic")
        void processConfirmation_Decline_EscalatesToNext() {
            // Arrange
            SosConfirmRequest request = new SosConfirmRequest();
            request.setBookingId(bookingId);
            request.setAccepted(false);
            request.setDeclineReason("Too busy");

            // IMPORTANT: Booking must have the same clinic as manager for security check
            booking.setClinic(clinic1);

            List<String> clinicIds = List.of(clinicId1.toString(), clinicId2.toString());

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
            when(sessionManager.getClinicIds(bookingId)).thenReturn(Optional.of(clinicIds));
            when(sessionManager.getCurrentIndex(bookingId)).thenReturn(Optional.of(0));
            lenient().when(clinicRepository.findById(clinicId2)).thenReturn(Optional.of(clinic2));
            lenient().when(userRepository.findByWorkingClinicIdAndRole(clinicId2, Role.CLINIC_MANAGER))
                    .thenReturn(Collections.emptyList());

            // Act
            SosMatchResponse response = sosMatchingService.processConfirmation(request, managerId);

            // Assert
            assertNotNull(response);
            assertEquals(BookingStatus.PENDING_CLINIC_CONFIRM, response.getStatus());
            assertEquals(clinicId2, response.getClinicId());

            // Verify escalation
            verify(sessionManager).updateIndex(eq(bookingId), eq(1));
            verify(sosNotificationService).notifyOwnerWaitingNext(any(), any(), anyInt(), anyInt());
        }

        @Test
        @DisplayName("TC-SOS-CONF-003: Should throw exception for invalid booking status")
        void processConfirmation_InvalidStatus_ThrowsException() {
            // Arrange
            booking.setStatus(BookingStatus.CONFIRMED); // Already confirmed
            SosConfirmRequest request = new SosConfirmRequest();
            request.setBookingId(bookingId);
            request.setAccepted(true);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));

            // Act & Assert
            assertThrows(SosMatchingException.class, () -> sosMatchingService.processConfirmation(request, managerId));
        }

        @Test
        @DisplayName("TC-SOS-CONF-004: Should throw exception when manager tries to confirm booking from another clinic")
        void processConfirmation_WrongClinic_ThrowsException() {
            // Arrange
            SosConfirmRequest request = new SosConfirmRequest();
            request.setBookingId(bookingId);
            request.setAccepted(true);

            // Booking is assigned to clinic2, but manager belongs to clinic1
            booking.setClinic(clinic2);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));

            // Act & Assert
            SosMatchingException exception = assertThrows(SosMatchingException.class,
                    () -> sosMatchingService.processConfirmation(request, managerId));
            assertTrue(exception.getMessage().contains("không có quyền xác nhận"));
        }

        @Test
        @DisplayName("TC-SOS-CONF-005: Should throw exception when booking lock cannot be acquired")
        void processConfirmation_LockAcquisitionFailed_ThrowsException() {
            // Arrange
            SosConfirmRequest request = new SosConfirmRequest();
            request.setBookingId(bookingId);
            request.setAccepted(true);

            // Mock lock failure
            when(sessionManager.acquireBookingLock(bookingId)).thenReturn(false);

            // Act & Assert
            SosMatchingException exception = assertThrows(SosMatchingException.class,
                    () -> sosMatchingService.processConfirmation(request, managerId));
            assertTrue(exception.getMessage().contains("Yêu cầu đang được xử lý"));
            verify(bookingRepository, never()).findById(any());
        }
    }

    @Nested
    @DisplayName("3. Escalation Logic")
    class EscalationTests {

        @Test
        @DisplayName("TC-SOS-ESC-001: Should handle NO_CLINIC when all clinics exhausted")
        void escalateToNextClinic_AllExhausted_CancelsBooking() {
            // Arrange
            List<String> clinicIds = List.of(clinicId1.toString());

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(sessionManager.getClinicIds(bookingId)).thenReturn(Optional.of(clinicIds));
            when(sessionManager.getCurrentIndex(bookingId)).thenReturn(Optional.of(0)); // Already at last clinic
            when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            SosMatchResponse response = sosMatchingService.escalateToNextClinic(bookingId);

            // Assert
            assertNotNull(response);
            assertEquals(BookingStatus.CANCELLED, response.getStatus());
            assertTrue(response.getMessage().contains("Không tìm thấy phòng khám"));

            // Verify booking cancelled
            ArgumentCaptor<Booking> bookingCaptor = ArgumentCaptor.forClass(Booking.class);
            verify(bookingRepository).save(bookingCaptor.capture());
            assertEquals(BookingStatus.CANCELLED, bookingCaptor.getValue().getStatus());
        }
    }

    @Nested
    @DisplayName("4. Timeout Checking")
    class TimeoutTests {

        @Test
        @DisplayName("TC-SOS-TIMEOUT-001: Should escalate timed out bookings based on notifiedAt")
        void checkTimeouts_EscalatesTimedOutBookings() {
            // Arrange
            long oldTimestamp = System.currentTimeMillis() - 70000; // 70 seconds ago

            when(bookingRepository.findByStatusAndBookingType(
                    BookingStatus.PENDING_CLINIC_CONFIRM, BookingType.SOS))
                    .thenReturn(List.of(booking));
            when(sessionManager.sessionExists(bookingId)).thenReturn(true);
            when(sessionManager.hasCurrentClinicTimedOut(bookingId)).thenReturn(true);
            when(sessionManager.getClinicIds(bookingId))
                    .thenReturn(Optional.of(List.of(clinicId1.toString(), clinicId2.toString())));
            when(sessionManager.getCurrentIndex(bookingId)).thenReturn(Optional.of(0));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            lenient().when(clinicRepository.findById(clinicId2)).thenReturn(Optional.of(clinic2));

            // Act
            sosMatchingService.checkTimeouts();

            // Assert - Should escalate to next clinic
            verify(sessionManager).updateIndex(eq(bookingId), eq(1));
            verify(sosNotificationService).notifyOwnerWaitingNext(any(), any(), anyInt(), anyInt());
        }

        @Test
        @DisplayName("TC-SOS-TIMEOUT-002: Should not escalate non-timed-out bookings using notifiedAt")
        void checkTimeouts_DoesNotEscalateActive() {
            // Arrange
            long recentTimestamp = System.currentTimeMillis() - 30000; // 30 seconds ago

            when(bookingRepository.findByStatusAndBookingType(
                    BookingStatus.PENDING_CLINIC_CONFIRM, BookingType.SOS))
                    .thenReturn(List.of(booking));
            when(sessionManager.hasCurrentClinicTimedOut(bookingId)).thenReturn(false);

            // Act
            sosMatchingService.checkTimeouts();

            // Assert - Should NOT escalate
            verify(sessionManager, never()).updateIndex(any(), anyInt());
        }

        @Test
        @DisplayName("TC-SOS-TIMEOUT-003: Should skip escalation if booking lock cannot be acquired")
        void checkTimeouts_LockAcquisitionFailed_SkipsEscalation() {
            // Arrange
            when(bookingRepository.findByStatusAndBookingType(
                    BookingStatus.PENDING_CLINIC_CONFIRM, BookingType.SOS))
                    .thenReturn(List.of(booking));
            when(sessionManager.sessionExists(bookingId)).thenReturn(true);
            when(sessionManager.hasCurrentClinicTimedOut(bookingId)).thenReturn(true);

            // Mock lock failure
            when(sessionManager.acquireBookingLock(bookingId)).thenReturn(false);

            // Act
            sosMatchingService.checkTimeouts();

            // Assert - Should NOT call escalateToNextClinic or modify repository
            verify(bookingRepository, never()).save(any());
            verify(sessionManager, never()).updateIndex(any(), anyInt());
        }
    }

    @Nested
    @DisplayName("5. Get Matching Status")
    class StatusTests {

        @Test
        @DisplayName("TC-SOS-STATUS-001: Should return current matching status")
        void getMatchingStatus_ReturnsCurrentStatus() {
            // Arrange
            booking.setClinic(clinic1);

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(sessionManager.getCurrentIndex(bookingId)).thenReturn(Optional.of(0));
            when(sessionManager.getClinicIds(bookingId))
                    .thenReturn(Optional.of(List.of(clinicId1.toString())));
            when(clinicRepository.findById(clinicId1)).thenReturn(Optional.of(clinic1));

            // Act
            SosMatchResponse response = sosMatchingService.getMatchingStatus(bookingId);

            // Assert
            assertNotNull(response);
            assertEquals(bookingId, response.getBookingId());
            assertEquals(BookingStatus.PENDING_CLINIC_CONFIRM, response.getStatus());
            assertEquals("Clinic 1", response.getClinicName());
        }

        @Test
        @DisplayName("TC-SOS-STATUS-002: Should throw exception for non-existent booking")
        void getMatchingStatus_BookingNotFound_ThrowsException() {
            // Arrange
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.empty());

            // Act & Assert
            assertThrows(ResourceNotFoundException.class, () -> sosMatchingService.getMatchingStatus(bookingId));
        }
    }
}
