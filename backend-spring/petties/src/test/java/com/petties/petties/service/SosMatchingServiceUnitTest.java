package com.petties.petties.service;

import com.petties.petties.dto.sos.SosConfirmRequest;
import com.petties.petties.dto.sos.SosMatchRequest;
import com.petties.petties.dto.sos.SosMatchResponse;
import com.petties.petties.dto.sos.SosMatchingStatusMessage;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
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
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;

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
    private ClinicPricePerKmRepository pricePerKmRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private LocationService locationService;
    @Mock
    private SimpMessagingTemplate messagingTemplate;
    @Mock
    private RedisTemplate<String, Object> redisTemplate;
    @Mock
    private ValueOperations<String, Object> valueOperations;

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

        // Redis mock setup
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        // Mock distributed lock acquisition
        lenient().when(valueOperations.setIfAbsent(anyString(), anyString(), anyLong(), any(TimeUnit.class)))
                .thenReturn(true);
        // Mock lock release
        lenient().when(redisTemplate.delete(anyString())).thenReturn(true);
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

            // Verify Redis storage (4 now: clinics, index, createdAt, notifiedAt)
            verify(valueOperations, times(4)).set(anyString(), any(), anyLong(), eq(TimeUnit.SECONDS));

            // Verify WebSocket broadcast
            verify(messagingTemplate, atLeastOnce()).convertAndSend(anyString(), any(SosMatchingStatusMessage.class));
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
            assertThrows(BadRequestException.class, () -> sosMatchingService.startMatching(request, petOwnerId));
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
            assertThrows(ResourceNotFoundException.class, () -> sosMatchingService.startMatching(request, petOwnerId));
        }

        @Test
        @DisplayName("TC-SOS-MATCH-005: Should throw 409 when user has active SOS booking")
        void startMatching_ActiveBookingExists_ThrowsBadRequest() {
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

            // Act & Assert
            BadRequestException exception = assertThrows(BadRequestException.class,
                    () -> sosMatchingService.startMatching(request, petOwnerId));
            assertTrue(exception.getMessage().contains("đã có một yêu cầu SOS"));
            assertTrue(exception.getMessage().contains("SOS-12345"));
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

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
            when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));
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

            // Verify Redis cleared (4 keys now: clinics, index, createdAt, notifiedAt)
            verify(redisTemplate, times(4)).delete(anyString());
        }

        @Test
        @DisplayName("TC-SOS-CONF-002: Should decline and escalate to next clinic")
        void processConfirmation_Decline_EscalatesToNext() {
            // Arrange
            SosConfirmRequest request = new SosConfirmRequest();
            request.setBookingId(bookingId);
            request.setAccepted(false);
            request.setDeclineReason("Too busy");

            List<String> clinicIds = List.of(clinicId1.toString(), clinicId2.toString());

            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
            when(valueOperations.get(contains(":clinics"))).thenReturn(clinicIds);
            when(valueOperations.get(contains(":index"))).thenReturn(0);
            when(clinicRepository.findById(clinicId2)).thenReturn(Optional.of(clinic2));
            when(userRepository.findByWorkingClinicIdAndRole(clinicId2, Role.CLINIC_MANAGER))
                    .thenReturn(Collections.emptyList());

            // Act
            SosMatchResponse response = sosMatchingService.processConfirmation(request, managerId);

            // Assert
            assertNotNull(response);
            assertEquals(BookingStatus.PENDING_CLINIC_CONFIRM, response.getStatus());
            assertEquals(clinicId2, response.getClinicId());

            // Verify escalation broadcast
            verify(messagingTemplate, atLeastOnce()).convertAndSend(
                    contains("/topic/sos-matching/"),
                    any(SosMatchingStatusMessage.class));
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
            assertThrows(BadRequestException.class, () -> sosMatchingService.processConfirmation(request, managerId));
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
            when(valueOperations.get(contains(":clinics"))).thenReturn(clinicIds);
            when(valueOperations.get(contains(":index"))).thenReturn(0); // Already at last clinic
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
            // Now uses notifiedAt for timeout, fallback to createdAt
            when(valueOperations.get("sos:matching:" + bookingId + ":notifiedAt")).thenReturn(null);
            when(valueOperations.get("sos:matching:" + bookingId + ":createdAt")).thenReturn(oldTimestamp);
            when(valueOperations.get("sos:matching:" + bookingId + ":index")).thenReturn(0);
            when(valueOperations.get("sos:matching:" + bookingId + ":clinics"))
                    .thenReturn(List.of(clinicId1.toString(), clinicId2.toString()));
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
            when(clinicRepository.findById(clinicId2)).thenReturn(Optional.of(clinic2));
            when(userRepository.findByWorkingClinicIdAndRole(clinicId2, Role.CLINIC_MANAGER))
                    .thenReturn(Collections.emptyList());

            // Act
            sosMatchingService.checkTimeouts();

            // Assert - Should escalate to next clinic
            verify(valueOperations, atLeastOnce()).set(
                    eq("sos:matching:" + bookingId + ":index"),
                    eq(1),
                    anyLong(),
                    eq(TimeUnit.SECONDS));
        }

        @Test
        @DisplayName("TC-SOS-TIMEOUT-002: Should not escalate non-timed-out bookings using notifiedAt")
        void checkTimeouts_DoesNotEscalateActive() {
            // Arrange
            long recentTimestamp = System.currentTimeMillis() - 30000; // 30 seconds ago

            when(bookingRepository.findByStatusAndBookingType(
                    BookingStatus.PENDING_CLINIC_CONFIRM, BookingType.SOS))
                    .thenReturn(List.of(booking));
            // Use notifiedAt for accurate timeout
            when(valueOperations.get("sos:matching:" + bookingId + ":notifiedAt")).thenReturn(recentTimestamp);
            when(valueOperations.get("sos:matching:" + bookingId + ":index")).thenReturn(0);

            // Act
            sosMatchingService.checkTimeouts();

            // Assert - Should NOT escalate
            verify(clinicRepository, never()).findById(any());
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
            when(valueOperations.get(contains(":index"))).thenReturn(0);
            when(valueOperations.get(contains(":clinics")))
                    .thenReturn(List.of(clinicId1.toString()));
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
