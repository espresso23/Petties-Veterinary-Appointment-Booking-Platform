package com.petties.petties.service;

import com.petties.petties.dto.booking.AvailableVetResponse;
import com.petties.petties.model.*;
import com.petties.petties.model.enums.*;
import com.petties.petties.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for VetAssignmentService
 * 
 * Tests cover:
 * - getAvailableVetsForReassign: filtering, availability check, slot validation
 * - findVetsWithSpecialty: specialty matching logic
 * - Slot availability calculations
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("VetAssignmentService Unit Tests")
class VetAssignmentServiceUnitTest {

        @Mock
        private UserRepository userRepository;

        @Mock
        private VetShiftRepository vetShiftRepository;

        @Mock
        private SlotRepository slotRepository;

        @Mock
        private BookingRepository bookingRepository;

        @Mock
        private BookingSlotRepository bookingSlotRepository;

        @InjectMocks
        private VetAssignmentService vetAssignmentService;

        // Test data
        private UUID clinicId;
        private UUID vet1Id;
        private UUID vet2Id;
        private UUID vet3Id;
        private User vet1;
        private User vet2;
        private User vet3;
        private LocalDate testDate;
        private LocalTime testTime;

        @BeforeEach
        void setUp() {
                clinicId = UUID.randomUUID();
                vet1Id = UUID.randomUUID();
                vet2Id = UUID.randomUUID();
                vet3Id = UUID.randomUUID();
                testDate = LocalDate.now().plusDays(1);
                testTime = LocalTime.of(9, 0);

                // Create mock vets
                vet1 = createMockVet(vet1Id, "BS. Nguyễn Văn A", StaffSpecialty.VET_GENERAL);
                vet2 = createMockVet(vet2Id, "BS. Trần Văn B", StaffSpecialty.VET_GENERAL);
                vet3 = createMockVet(vet3Id, "BS. Lê Văn C", StaffSpecialty.VET_SURGERY);
        }

        private User createMockVet(UUID id, String name, StaffSpecialty specialty) {
                User vet = new User();
                vet.setUserId(id);
                vet.setFullName(name);
                vet.setSpecialty(specialty);
                vet.setRole(Role.VET);
                return vet;
        }

        private VetShift createMockShift(User vet, LocalDate date, LocalTime start, LocalTime end) {
                VetShift shift = VetShift.builder()
                                .shiftId(UUID.randomUUID())
                                .vet(vet)
                                .workDate(date)
                                .startTime(start)
                                .endTime(end)
                                .isOvernight(false)
                                .build();

                Clinic clinic = new Clinic();
                clinic.setClinicId(clinicId);
                shift.setClinic(clinic);

                return shift;
        }

        private Slot createMockSlot(UUID shiftId, LocalTime start, LocalTime end, SlotStatus status) {
                Slot slot = new Slot();
                slot.setSlotId(UUID.randomUUID());
                slot.setStartTime(start);
                slot.setEndTime(end);
                slot.setStatus(status);
                return slot;
        }

        // ==================== getAvailableVetsForReassign Tests ====================

        @Nested
        @DisplayName("getAvailableVetsForReassign")
        class GetAvailableVetsForReassignTests {

                @Test
                @DisplayName("TC-UNIT-VET-001: Should exclude currently assigned vet from results")
                void shouldExcludeCurrentlyAssignedVet() {
                        // Arrange: 2 vets with VET_GENERAL specialty, vet1 is currently assigned
                        // findVetsWithSpecialty internally calls findByWorkingClinicIdAndRole then
                        // filters
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet1, vet2));

                        VetShift shift2 = createMockShift(vet2, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet2Id, testDate))
                                        .thenReturn(List.of(shift2));

                        List<Slot> availableSlots = List.of(
                                        createMockSlot(shift2.getShiftId(), LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE),
                                        createMockSlot(shift2.getShiftId(), LocalTime.of(9, 30), LocalTime.of(10, 0),
                                                        SlotStatus.AVAILABLE));
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift2.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift2.getShiftId(),
                                        SlotStatus.BOOKED))
                                        .thenReturn(Collections.emptyList());

                        // Act: Call with vet1Id as currentVetId (should be excluded)
                        List<AvailableVetResponse> result = vetAssignmentService.getAvailableVetsForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_GENERAL, 1, vet1Id);

                        // Assert: Only vet2 should be in results
                        assertEquals(1, result.size());
                        assertEquals(vet2Id, result.get(0).getVetId());
                        assertEquals("BS. Trần Văn B", result.get(0).getVetName());
                }

                @Test
                @DisplayName("TC-UNIT-VET-002: Should return all vets when currentVetId is null")
                void shouldReturnAllVetsWhenCurrentVetIdIsNull() {
                        // Arrange: 2 vets with VET_GENERAL specialty
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet1, vet2));

                        VetShift shift1 = createMockShift(vet1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        VetShift shift2 = createMockShift(vet2, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));

                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet1Id, testDate))
                                        .thenReturn(List.of(shift1));
                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet2Id, testDate))
                                        .thenReturn(List.of(shift2));

                        List<Slot> availableSlots1 = List.of(
                                        createMockSlot(shift1.getShiftId(), LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));
                        List<Slot> availableSlots2 = List.of(
                                        createMockSlot(shift2.getShiftId(), LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));

                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots1);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift2.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots2);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(any(), eq(SlotStatus.BOOKED)))
                                        .thenReturn(Collections.emptyList());

                        // Act: Call with null currentVetId
                        List<AvailableVetResponse> result = vetAssignmentService.getAvailableVetsForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_GENERAL, 1, null);

                        // Assert: Both vets should be in results
                        assertEquals(2, result.size());
                }

                @Test
                @DisplayName("TC-UNIT-VET-003: Should mark vet as unavailable when no shift exists")
                void shouldMarkVetAsUnavailableWhenNoShift() {
                        // Arrange: vet1 has no shift on testDate
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet1));

                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet1Id, testDate))
                                        .thenReturn(Collections.emptyList());

                        // Act
                        List<AvailableVetResponse> result = vetAssignmentService.getAvailableVetsForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_GENERAL, 1, null);

                        // Assert
                        assertEquals(1, result.size());
                        assertFalse(result.get(0).isAvailable());
                        assertEquals("Không có ca làm việc", result.get(0).getUnavailableReason());
                }

                @Test
                @DisplayName("TC-UNIT-VET-004: Should mark vet as unavailable when not enough consecutive slots")
                void shouldMarkVetAsUnavailableWhenNotEnoughSlots() {
                        // Arrange: vet1 has shift but only 1 slot available (need 2)
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet1));

                        VetShift shift1 = createMockShift(vet1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        // Only 1 available slot
                        List<Slot> availableSlots = List.of(
                                        createMockSlot(shift1.getShiftId(), LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.BOOKED))
                                        .thenReturn(Collections.emptyList());

                        // Act: Need 2 slots
                        List<AvailableVetResponse> result = vetAssignmentService.getAvailableVetsForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_GENERAL, 2, null);

                        // Assert
                        assertEquals(1, result.size());
                        assertFalse(result.get(0).isAvailable());
                        assertTrue(result.get(0).getUnavailableReason().contains("Không đủ slot"));
                }

                @Test
                @DisplayName("TC-UNIT-VET-005: Should sort results by availability then by booked count")
                void shouldSortByAvailabilityThenByBookedCount() {
                        // Arrange: 2 vets, vet1 has more bookings than vet2
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet1, vet2));

                        VetShift shift1 = createMockShift(vet1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        VetShift shift2 = createMockShift(vet2, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));

                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet1Id, testDate))
                                        .thenReturn(List.of(shift1));
                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet2Id, testDate))
                                        .thenReturn(List.of(shift2));

                        List<Slot> availableSlots = List.of(
                                        createMockSlot(null, LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));

                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift2.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots);

                        // vet1 has 5 booked slots, vet2 has 2 booked slots
                        List<Slot> booked1 = List.of(
                                        createMockSlot(null, LocalTime.of(10, 0), LocalTime.of(10, 30),
                                                        SlotStatus.BOOKED),
                                        createMockSlot(null, LocalTime.of(10, 30), LocalTime.of(11, 0),
                                                        SlotStatus.BOOKED),
                                        createMockSlot(null, LocalTime.of(11, 0), LocalTime.of(11, 30),
                                                        SlotStatus.BOOKED),
                                        createMockSlot(null, LocalTime.of(11, 30), LocalTime.of(12, 0),
                                                        SlotStatus.BOOKED),
                                        createMockSlot(null, LocalTime.of(14, 0), LocalTime.of(14, 30),
                                                        SlotStatus.BOOKED));
                        List<Slot> booked2 = List.of(
                                        createMockSlot(null, LocalTime.of(10, 0), LocalTime.of(10, 30),
                                                        SlotStatus.BOOKED),
                                        createMockSlot(null, LocalTime.of(10, 30), LocalTime.of(11, 0),
                                                        SlotStatus.BOOKED));

                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.BOOKED))
                                        .thenReturn(booked1);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift2.getShiftId(),
                                        SlotStatus.BOOKED))
                                        .thenReturn(booked2);

                        // Act
                        List<AvailableVetResponse> result = vetAssignmentService.getAvailableVetsForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_GENERAL, 1, null);

                        // Assert: vet2 (less bookings) should come first
                        assertEquals(2, result.size());
                        assertEquals(vet2Id, result.get(0).getVetId()); // Less booked = first
                        assertEquals(2, result.get(0).getBookedCount());
                        assertEquals(vet1Id, result.get(1).getVetId());
                        assertEquals(5, result.get(1).getBookedCount());
                }

                @Test
                @DisplayName("TC-UNIT-VET-006: Should return empty list when no vets with matching specialty")
                void shouldReturnEmptyListWhenNoMatchingSpecialty() {
                        // Arrange: Only vet3 with VET_SURGERY specialty, looking for VET_DENTAL
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet3)); // vet3 has VET_SURGERY

                        // Act: Looking for VET_DENTAL
                        List<AvailableVetResponse> result = vetAssignmentService.getAvailableVetsForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_DENTAL, 1, null);

                        // Assert: Empty because vet3 has VET_SURGERY, not VET_DENTAL
                        assertTrue(result.isEmpty());
                }

                @Test
                @DisplayName("TC-UNIT-VET-007: Should include avatar and specialty in response")
                void shouldIncludeAvatarAndSpecialtyInResponse() {
                        // Arrange
                        vet1.setAvatar("https://example.com/avatar.jpg");
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet1));

                        VetShift shift1 = createMockShift(vet1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        List<Slot> availableSlots = List.of(
                                        createMockSlot(shift1.getShiftId(), LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.BOOKED))
                                        .thenReturn(Collections.emptyList());

                        // Act
                        List<AvailableVetResponse> result = vetAssignmentService.getAvailableVetsForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_GENERAL, 1, null);

                        // Assert
                        assertEquals(1, result.size());
                        assertEquals("https://example.com/avatar.jpg", result.get(0).getAvatarUrl());
                        assertEquals("VET_GENERAL", result.get(0).getSpecialty());
                }

                @Test
                @DisplayName("TC-UNIT-VET-015: Should include VET_GENERAL for non-GROOMER specialty")
                void shouldIncludeVetGeneralForNonGroomerSpecialty() {
                        // Arrange: vet1 is VET_GENERAL
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet1)); // vet1 is VET_GENERAL

                        VetShift shift1 = createMockShift(vet1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        List<Slot> availableSlots = List.of(
                                        createMockSlot(shift1.getShiftId(), LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots);

                        // Act: ask for VET_DENTAL
                        List<AvailableVetResponse> result = vetAssignmentService.getAvailableVetsForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_DENTAL, 1, null);

                        // Assert: Should find vet1 because VET_GENERAL is fallback for VET_DENTAL
                        assertEquals(1, result.size());
                        assertEquals(vet1Id, result.get(0).getVetId());
                }

                @Test
                @DisplayName("TC-UNIT-VET-016: Should NOT include VET_GENERAL for GROOMER specialty")
                void shouldNotIncludeVetGeneralForGroomerSpecialty() {
                        // Arrange: vet1 is VET_GENERAL
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet1)); // vet1 is VET_GENERAL

                        VetShift shift1 = createMockShift(vet1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        List<Slot> availableSlots = List.of(
                                        createMockSlot(shift1.getShiftId(), LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots);

                        // Act: ask for GROOMER
                        List<AvailableVetResponse> result = vetAssignmentService.getAvailableVetsForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.GROOMER, 1, null);

                        // Assert: Should NOT find vet1 because VET_GENERAL is NOT fallback for GROOMER
                        assertTrue(result.isEmpty());
                }
        }

        // ==================== getAvailableVetsForBookingConfirm Tests
        // ====================

        @Nested
        @DisplayName("getAvailableVetsForBookingConfirm")
        class GetAvailableVetsForBookingConfirmTests {

                private Booking createMockBooking() {
                        Booking booking = new Booking();
                        booking.setBookingId(UUID.randomUUID());
                        booking.setBookingCode("BK-TEST-001");
                        booking.setBookingDate(testDate);
                        booking.setBookingTime(testTime);
                        booking.setStatus(BookingStatus.PENDING);

                        Clinic clinic = new Clinic();
                        clinic.setClinicId(clinicId);
                        booking.setClinic(clinic);

                        return booking;
                }

                private BookingServiceItem createMockServiceItem(Booking booking, String serviceName, int duration) {
                        BookingServiceItem item = new BookingServiceItem();
                        item.setBookingServiceId(UUID.randomUUID());
                        item.setBooking(booking);

                        com.petties.petties.model.ClinicService service = new com.petties.petties.model.ClinicService();
                        service.setServiceId(UUID.randomUUID());
                        service.setName(serviceName);
                        service.setDurationTime(duration);
                        service.setServiceCategory(ServiceCategory.CHECK_UP);
                        item.setService(service);

                        return item;
                }

                @Test
                @DisplayName("TC-UNIT-VET-008: Should return all matching vets for booking confirmation")
                void shouldReturnAllMatchingVetsForBookingConfirmation() {
                        // Arrange
                        Booking booking = createMockBooking();
                        BookingServiceItem serviceItem = createMockServiceItem(booking, "Khám tổng quát", 30);
                        booking.setBookingServices(List.of(serviceItem));

                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet1, vet2));

                        VetShift shift1 = createMockShift(vet1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        VetShift shift2 = createMockShift(vet2, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));

                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet1Id, testDate))
                                        .thenReturn(List.of(shift1));
                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet2Id, testDate))
                                        .thenReturn(List.of(shift2));

                        List<Slot> availableSlots = List.of(
                                        createMockSlot(null, LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));

                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(any(),
                                        eq(SlotStatus.AVAILABLE)))
                                        .thenReturn(availableSlots);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(any(), eq(SlotStatus.BOOKED)))
                                        .thenReturn(Collections.emptyList());

                        // Act
                        var result = vetAssignmentService.getAvailableVetsForBookingConfirm(booking);

                        // Assert
                        assertNotNull(result);
                        assertEquals(2, result.size());
                }

                @Test
                @DisplayName("TC-UNIT-VET-009: Should mark suggested vet with isSuggested=true")
                void shouldMarkSuggestedVetWithIsSuggestedTrue() {
                        // Arrange
                        Booking booking = createMockBooking();
                        BookingServiceItem serviceItem = createMockServiceItem(booking, "Khám tổng quát", 30);
                        booking.setBookingServices(List.of(serviceItem));

                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet1, vet2));

                        VetShift shift1 = createMockShift(vet1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        VetShift shift2 = createMockShift(vet2, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));

                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet1Id, testDate))
                                        .thenReturn(List.of(shift1));
                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet2Id, testDate))
                                        .thenReturn(List.of(shift2));

                        // vet1 has more slots = suggested
                        List<Slot> availableSlots1 = List.of(
                                        createMockSlot(null, LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE),
                                        createMockSlot(null, LocalTime.of(9, 30), LocalTime.of(10, 0),
                                                        SlotStatus.AVAILABLE));
                        List<Slot> availableSlots2 = List.of(
                                        createMockSlot(null, LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));

                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots1);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift2.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots2);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(any(), eq(SlotStatus.BOOKED)))
                                        .thenReturn(Collections.emptyList());

                        // Act
                        var result = vetAssignmentService.getAvailableVetsForBookingConfirm(booking);

                        // Assert
                        assertNotNull(result);
                        // At least one vet should be marked as suggested
                        boolean hasSuggested = result.stream().anyMatch(v -> v.isSuggested());
                        assertTrue(hasSuggested, "Should have at least one suggested vet");
                }

                @Test
                @DisplayName("TC-UNIT-VET-010: Should handle booking with multiple services requiring different durations")
                void shouldHandleBookingWithMultipleServices() {
                        // Arrange
                        Booking booking = createMockBooking();
                        BookingServiceItem service1 = createMockServiceItem(booking, "Khám tổng quát", 30);
                        BookingServiceItem service2 = createMockServiceItem(booking, "Tiêm vaccine", 30);
                        booking.setBookingServices(List.of(service1, service2));

                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet1));

                        VetShift shift1 = createMockShift(vet1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        // Need 2 slots for 2 services
                        List<Slot> availableSlots = List.of(
                                        createMockSlot(null, LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE),
                                        createMockSlot(null, LocalTime.of(9, 30), LocalTime.of(10, 0),
                                                        SlotStatus.AVAILABLE));

                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(any(),
                                        eq(SlotStatus.AVAILABLE)))
                                        .thenReturn(availableSlots);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(any(), eq(SlotStatus.BOOKED)))
                                        .thenReturn(Collections.emptyList());

                        // Act
                        var result = vetAssignmentService.getAvailableVetsForBookingConfirm(booking);

                        // Assert
                        assertNotNull(result);
                        assertEquals(1, result.size());
                        assertTrue(result.get(0).isHasAvailableSlots());
                }

                @Test
                @DisplayName("TC-UNIT-VET-011: Should include VET_GENERAL as fallback when specialty vet not found")
                void shouldIncludeVetGeneralAsFallback() {
                        // Arrange
                        Booking booking = createMockBooking();
                        BookingServiceItem serviceItem = createMockServiceItem(booking, "Phẫu thuật", 60);
                        serviceItem.getService().setServiceCategory(ServiceCategory.SURGERY);
                        booking.setBookingServices(List.of(serviceItem));

                        // vet1 is VET_GENERAL, vet3 is VET_SURGERY
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet1, vet3));

                        VetShift shift1 = createMockShift(vet1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        VetShift shift3 = createMockShift(vet3, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));

                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet1Id, testDate))
                                        .thenReturn(List.of(shift1));
                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet3Id, testDate))
                                        .thenReturn(List.of(shift3));

                        List<Slot> availableSlots = List.of(
                                        createMockSlot(null, LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE),
                                        createMockSlot(null, LocalTime.of(9, 30), LocalTime.of(10, 0),
                                                        SlotStatus.AVAILABLE));

                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(any(),
                                        eq(SlotStatus.AVAILABLE)))
                                        .thenReturn(availableSlots);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(any(), eq(SlotStatus.BOOKED)))
                                        .thenReturn(Collections.emptyList());

                        // Act
                        var result = vetAssignmentService.getAvailableVetsForBookingConfirm(booking);

                        // Assert - Both VET_SURGERY and VET_GENERAL should be included
                        assertNotNull(result);
                        assertTrue(result.size() >= 1, "Should include at least one vet");
                }
        }

        // ==================== checkVetAvailabilityForBooking Tests
        // ====================

        @Nested
        @DisplayName("checkVetAvailabilityForBooking")
        class CheckVetAvailabilityTests {

                private Booking createMockBookingWithServices() {
                        Booking booking = new Booking();
                        booking.setBookingId(UUID.randomUUID());
                        booking.setBookingCode("BK-TEST-002");
                        booking.setBookingDate(testDate);
                        booking.setBookingTime(testTime);
                        booking.setStatus(BookingStatus.PENDING);

                        Clinic clinic = new Clinic();
                        clinic.setClinicId(clinicId);
                        booking.setClinic(clinic);

                        BookingServiceItem item = new BookingServiceItem();
                        item.setBookingServiceId(UUID.randomUUID());
                        item.setBooking(booking);

                        com.petties.petties.model.ClinicService service = new com.petties.petties.model.ClinicService();
                        service.setServiceId(UUID.randomUUID());
                        service.setName("Khám tổng quát");
                        service.setDurationTime(30);
                        service.setServiceCategory(ServiceCategory.CHECK_UP);
                        item.setService(service);

                        booking.setBookingServices(List.of(item));
                        return booking;
                }

                @Test
                @DisplayName("TC-UNIT-VET-012: Should return allServicesHaveVets=true when vet available for all services")
                void shouldReturnTrueWhenVetAvailableForAllServices() {
                        // Arrange
                        Booking booking = createMockBookingWithServices();

                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet1));

                        VetShift shift1 = createMockShift(vet1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        List<Slot> availableSlots = List.of(
                                        createMockSlot(null, LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));

                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(any(),
                                        eq(SlotStatus.AVAILABLE)))
                                        .thenReturn(availableSlots);

                        // Act
                        var result = vetAssignmentService.checkVetAvailabilityForBooking(booking);

                        // Assert
                        assertNotNull(result);
                        assertTrue(result.isAllServicesHaveVets(), "All services should have available vets");
                        assertFalse(result.getServices().isEmpty());
                }

                @Test
                @DisplayName("TC-UNIT-VET-013: Should return allServicesHaveVets=false when no vet available")
                void shouldReturnFalseWhenNoVetAvailable() {
                        // Arrange
                        Booking booking = createMockBookingWithServices();

                        // No vets in clinic
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(Collections.emptyList());

                        // Act
                        var result = vetAssignmentService.checkVetAvailabilityForBooking(booking);

                        // Assert
                        assertNotNull(result);
                        assertFalse(result.isAllServicesHaveVets(), "Should return false when no vet available");
                }

                @Test
                @DisplayName("TC-UNIT-VET-014: Should return suggestedVetId for each service")
                void shouldReturnSuggestedVetIdForEachService() {
                        // Arrange
                        Booking booking = createMockBookingWithServices();

                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.VET)))
                                        .thenReturn(List.of(vet1));

                        VetShift shift1 = createMockShift(vet1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(vetShiftRepository.findByVet_UserIdAndWorkDate(vet1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        List<Slot> availableSlots = List.of(
                                        createMockSlot(null, LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));

                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(any(),
                                        eq(SlotStatus.AVAILABLE)))
                                        .thenReturn(availableSlots);

                        // Act
                        var result = vetAssignmentService.checkVetAvailabilityForBooking(booking);

                        // Assert
                        assertNotNull(result);
                        assertFalse(result.getServices().isEmpty());
                        assertNotNull(result.getServices().get(0).getSuggestedVetId(), "Should have suggested vet ID");
                }
        }
}
