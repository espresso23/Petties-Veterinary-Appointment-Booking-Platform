package com.petties.petties.service;

import com.petties.petties.dto.booking.BookingResponse;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.EmrRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for BookingService status transition methods
 * Tests: checkIn, complete, notifyOnWay
 */
@ExtendWith(MockitoExtension.class)
class BookingStatusTransitionTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private EmrRecordRepository emrRecordRepository;

    @InjectMocks
    private BookingService bookingService;

    private UUID bookingId;
    private Booking testBooking;
    private User vet;
    private User petOwner;
    private Pet pet;
    private Clinic clinic;

    @BeforeEach
    void setUp() {
        bookingId = UUID.randomUUID();

        // Setup mock entities using setters (not builder)
        vet = new User();
        vet.setUserId(UUID.randomUUID());
        vet.setFullName("Dr. Test Vet");

        petOwner = new User();
        petOwner.setUserId(UUID.randomUUID());
        petOwner.setFullName("Test Owner");

        pet = new Pet();
        pet.setId(UUID.randomUUID());
        pet.setName("Buddy");

        clinic = new Clinic();
        clinic.setClinicId(UUID.randomUUID());
        clinic.setName("Test Clinic");

        testBooking = new Booking();
        testBooking.setBookingId(bookingId);
        testBooking.setBookingCode("BK-TEST-001");
        testBooking.setPet(pet);
        testBooking.setPetOwner(petOwner);
        testBooking.setClinic(clinic);
        testBooking.setAssignedStaff(vet);
        testBooking.setBookingDate(LocalDate.now());
        testBooking.setBookingTime(LocalTime.of(10, 0));
        testBooking.setType(BookingType.HOME_VISIT);
        testBooking.setStatus(BookingStatus.ASSIGNED);
        testBooking.setBookingServices(new ArrayList<>());
    }

    // ========== CHECK-IN TESTS ==========

    @Nested
    @DisplayName("Check-in Tests")
    class CheckInTests {

        @Test
        @DisplayName("TC-UNIT-BOOKING-001: Check-in từ ASSIGNED thành công")
        void checkIn_fromAssigned_success() {
            // Given
            testBooking.setStatus(BookingStatus.ASSIGNED);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(bookingRepository.save(any(Booking.class))).thenAnswer(i -> i.getArgument(0));

            // When
            BookingResponse response = bookingService.checkIn(bookingId);

            // Then
            assertThat(response).isNotNull();
            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.IN_PROGRESS);
            verify(bookingRepository).save(testBooking);
            verify(notificationService).sendCheckinNotification(testBooking);
        }

        @Test
        @DisplayName("TC-UNIT-BOOKING-002: Check-in từ PENDING thất bại")
        void checkIn_fromPending_shouldFail() {
            // Given
            testBooking.setStatus(BookingStatus.PENDING);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            // When/Then
            assertThatThrownBy(() -> bookingService.checkIn(bookingId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("ASSIGNED");
        }

        @Test
        @DisplayName("TC-UNIT-BOOKING-003: Check-in từ IN_PROGRESS thất bại")
        void checkIn_fromInProgress_shouldFail() {
            // Given
            testBooking.setStatus(BookingStatus.IN_PROGRESS);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            // When/Then
            assertThatThrownBy(() -> bookingService.checkIn(bookingId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("ASSIGNED");
        }

        @Test
        @DisplayName("TC-UNIT-BOOKING-004: Check-in booking không tồn tại")
        void checkIn_bookingNotFound_shouldFail() {
            // Given
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.empty());

            // When/Then
            assertThatThrownBy(() -> bookingService.checkIn(bookingId))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ========== COMPLETE TESTS ==========

    @Nested
    @DisplayName("Complete Tests")
    class CompleteTests {

        @Test
        @DisplayName("TC-UNIT-BOOKING-005: Complete từ IN_PROGRESS thành công")
        void complete_fromInProgress_success() {
            // Given
            testBooking.setStatus(BookingStatus.IN_PROGRESS);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
            when(bookingRepository.save(any(Booking.class))).thenAnswer(i -> i.getArgument(0));

            // When
            BookingResponse response = bookingService.complete(bookingId);

            // Then
            assertThat(response).isNotNull();
            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.COMPLETED);
            verify(bookingRepository).save(testBooking);
            verify(notificationService).sendCompletedNotification(testBooking);
        }

        @Test
        @DisplayName("TC-UNIT-BOOKING-006: Complete từ ASSIGNED thất bại")
        void complete_fromAssigned_shouldFail() {
            // Given
            testBooking.setStatus(BookingStatus.ASSIGNED);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            // When/Then
            assertThatThrownBy(() -> bookingService.complete(bookingId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("IN_PROGRESS");
        }

        @Test
        @DisplayName("TC-UNIT-BOOKING-007: Complete từ COMPLETED thất bại (đã hoàn thành)")
        void complete_fromCompleted_shouldFail() {
            // Given
            testBooking.setStatus(BookingStatus.COMPLETED);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            // When/Then
            assertThatThrownBy(() -> bookingService.complete(bookingId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("IN_PROGRESS");
        }
    }

    // ========== NOTIFY ON WAY TESTS ==========

    @Nested
    @DisplayName("Notify On Way Tests")
    class NotifyOnWayTests {

        @Test
        @DisplayName("TC-UNIT-BOOKING-008: Notify on way cho HOME_VISIT thành công")
        void notifyOnWay_homeVisit_success() {
            // Given
            testBooking.setStatus(BookingStatus.ASSIGNED);
            testBooking.setType(BookingType.HOME_VISIT);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            // When
            BookingResponse response = bookingService.notifyOnWay(bookingId);

            // Then
            assertThat(response).isNotNull();
            verify(notificationService).sendStaffOnWayNotification(testBooking);
            // Status should NOT change
            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.ASSIGNED);
        }

        @Test
        @DisplayName("TC-UNIT-BOOKING-009: Notify on way cho SOS thành công")
        void notifyOnWay_sos_success() {
            // Given
            testBooking.setStatus(BookingStatus.ASSIGNED);
            testBooking.setType(BookingType.SOS);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            // When
            BookingResponse response = bookingService.notifyOnWay(bookingId);

            // Then
            assertThat(response).isNotNull();
            verify(notificationService).sendStaffOnWayNotification(testBooking);
        }

        @Test
        @DisplayName("TC-UNIT-BOOKING-010: Notify on way cho IN_CLINIC thất bại")
        void notifyOnWay_inClinic_shouldFail() {
            // Given
            testBooking.setStatus(BookingStatus.ASSIGNED);
            testBooking.setType(BookingType.IN_CLINIC);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            // When/Then
            assertThatThrownBy(() -> bookingService.notifyOnWay(bookingId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("tại nhà hoặc SOS");
        }

        @Test
        @DisplayName("TC-UNIT-BOOKING-011: Notify on way từ IN_PROGRESS thất bại")
        void notifyOnWay_fromInProgress_shouldFail() {
            // Given
            testBooking.setStatus(BookingStatus.IN_PROGRESS);
            testBooking.setType(BookingType.HOME_VISIT);
            when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));

            // When/Then
            assertThatThrownBy(() -> bookingService.notifyOnWay(bookingId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("ASSIGNED");
        }
    }
}
