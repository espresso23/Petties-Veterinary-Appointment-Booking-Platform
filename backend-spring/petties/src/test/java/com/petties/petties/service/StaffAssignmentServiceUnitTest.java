package com.petties.petties.service;

import com.petties.petties.dto.booking.AvailableStaffResponse;
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
 * Unit tests for StaffAssignmentService
 *
 * Tests cover:
 * - getAvailableStaffForReassign: filtering, availability check, slot validation
 * - findStaffWithSpecialty: specialty matching logic
 * - Slot availability calculations
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("StaffAssignmentService Unit Tests")
class StaffAssignmentServiceUnitTest {

        @Mock
        private UserRepository userRepository;

        @Mock
        private StaffShiftRepository staffShiftRepository;

        @Mock
        private SlotRepository slotRepository;

        @Mock
        private BookingRepository bookingRepository;

        @Mock
        private BookingSlotRepository bookingSlotRepository;

        @InjectMocks
        private StaffAssignmentService staffAssignmentService;

        // Test data
        private UUID clinicId;
        private UUID staff1Id;
        private UUID staff2Id;
        private UUID staff3Id;
        private User staff1;
        private User staff2;
        private User staff3;
        private LocalDate testDate;
        private LocalTime testTime;

        @BeforeEach
        void setUp() {
                clinicId = UUID.randomUUID();
                staff1Id = UUID.randomUUID();
                staff2Id = UUID.randomUUID();
                staff3Id = UUID.randomUUID();
                testDate = LocalDate.now().plusDays(1);
                testTime = LocalTime.of(9, 0);

                // Create mock staff
                staff1 = createMockStaff(staff1Id, "BS. Nguyễn Văn A", StaffSpecialty.VET_GENERAL);
                staff2 = createMockStaff(staff2Id, "BS. Trần Văn B", StaffSpecialty.VET_GENERAL);
                staff3 = createMockStaff(staff3Id, "BS. Lê Văn C", StaffSpecialty.VET_SURGERY);
        }

        private User createMockStaff(UUID id, String name, StaffSpecialty specialty) {
                User staff = new User();
                staff.setUserId(id);
                staff.setFullName(name);
                staff.setSpecialty(specialty);
                staff.setRole(Role.STAFF);
                return staff;
        }

        private StaffShift createMockShift(User staff, LocalDate date, LocalTime start, LocalTime end) {
                StaffShift shift = StaffShift.builder()
                                .shiftId(UUID.randomUUID())
                                .staff(staff)
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

        // ==================== getAvailableStaffForReassign Tests ====================

        @Nested
        @DisplayName("getAvailableStaffForReassign")
        class GetAvailableStaffForReassignTests {

                @Test
                @DisplayName("TC-UNIT-STAFF-001: Should exclude currently assigned staff from results")
                void shouldExcludeCurrentlyAssignedStaff() {
                        // Arrange: 2 staff with VET_GENERAL specialty, staff1 is currently assigned
                        // findStaffWithSpecialty internally calls findByWorkingClinicIdAndRole then
                        // filters
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1, staff2));

                        StaffShift shift2 = createMockShift(staff2, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff2Id, testDate))
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

                        // Act: Call with staff1Id as currentStaffId (should be excluded)
                        List<AvailableStaffResponse> result = staffAssignmentService.getAvailableStaffForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_GENERAL, 1, staff1Id);

                        // Assert: Only staff2 should be in results
                        assertEquals(1, result.size());
                        assertEquals(staff2Id, result.get(0).getStaffId());
                        assertEquals("BS. Trần Văn B", result.get(0).getStaffName());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-002: Should return all staff when currentStaffId is null")
                void shouldReturnAllStaffWhenCurrentStaffIdIsNull() {
                        // Arrange: 2 staff with VET_GENERAL specialty
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1, staff2));

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        StaffShift shift2 = createMockShift(staff2, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));

                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift1));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff2Id, testDate))
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

                        // Act: Call with null currentStaffId
                        List<AvailableStaffResponse> result = staffAssignmentService.getAvailableStaffForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_GENERAL, 1, null);

                        // Assert: Both staff should be in results
                        assertEquals(2, result.size());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-003: Should mark staff as unavailable when no shift exists")
                void shouldMarkStaffAsUnavailableWhenNoShift() {
                        // Arrange: staff1 has no shift on testDate
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1));

                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(Collections.emptyList());

                        // Act
                        List<AvailableStaffResponse> result = staffAssignmentService.getAvailableStaffForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_GENERAL, 1, null);

                        // Assert
                        assertEquals(1, result.size());
                        assertFalse(result.get(0).isAvailable());
                        assertEquals("Không có ca làm việc", result.get(0).getUnavailableReason());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-004: Should mark staff as unavailable when not enough consecutive slots")
                void shouldMarkStaffAsUnavailableWhenNotEnoughSlots() {
                        // Arrange: staff1 has shift but only 1 slot available (need 2)
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1));

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
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
                        List<AvailableStaffResponse> result = staffAssignmentService.getAvailableStaffForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_GENERAL, 2, null);

                        // Assert
                        assertEquals(1, result.size());
                        assertFalse(result.get(0).isAvailable());
                        assertTrue(result.get(0).getUnavailableReason().contains("Không đủ slot"));
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-005: Should sort results by availability then by booked count")
                void shouldSortByAvailabilityThenByBookedCount() {
                        // Arrange: 2 staff, staff1 has more bookings than staff2
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1, staff2));

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        StaffShift shift2 = createMockShift(staff2, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));

                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift1));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff2Id, testDate))
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

                        // staff1 has 5 booked slots, staff2 has 2 booked slots
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
                        List<AvailableStaffResponse> result = staffAssignmentService.getAvailableStaffForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_GENERAL, 1, null);

                        // Assert: staff2 (less bookings) should come first
                        assertEquals(2, result.size());
                        assertEquals(staff2Id, result.get(0).getStaffId()); // Less booked = first
                        assertEquals(2, result.get(0).getBookedCount());
                        assertEquals(staff1Id, result.get(1).getStaffId());
                        assertEquals(5, result.get(1).getBookedCount());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-006: Should return empty list when no staff with matching specialty")
                void shouldReturnEmptyListWhenNoMatchingSpecialty() {
                        // Arrange: Only staff3 with VET_SURGERY specialty, looking for VET_DENTAL
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff3)); // staff3 has VET_SURGERY

                        // Act: Looking for VET_DENTAL
                        List<AvailableStaffResponse> result = staffAssignmentService.getAvailableStaffForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_DENTAL, 1, null);

                        // Assert: Empty because staff3 has VET_SURGERY, not VET_DENTAL
                        assertTrue(result.isEmpty());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-007: Should include avatar and specialty in response")
                void shouldIncludeAvatarAndSpecialtyInResponse() {
                        // Arrange
                        staff1.setAvatar("https://example.com/avatar.jpg");
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1));

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
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
                        List<AvailableStaffResponse> result = staffAssignmentService.getAvailableStaffForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_GENERAL, 1, null);

                        // Assert
                        assertEquals(1, result.size());
                        assertEquals("https://example.com/avatar.jpg", result.get(0).getAvatarUrl());
                        assertEquals("VET_GENERAL", result.get(0).getSpecialty());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-015: Should include VET_GENERAL for non-GROOMER specialty")
                void shouldIncludeVetGeneralForNonGroomerSpecialty() {
                        // Arrange: staff1 is VET_GENERAL
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1)); // staff1 is VET_GENERAL

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        List<Slot> availableSlots = List.of(
                                        createMockSlot(shift1.getShiftId(), LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots);

                        // Act: ask for VET_DENTAL
                        List<AvailableStaffResponse> result = staffAssignmentService.getAvailableStaffForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET_DENTAL, 1, null);

                        // Assert: Should find staff1 because VET_GENERAL is fallback for VET_DENTAL
                        assertEquals(1, result.size());
                        assertEquals(staff1Id, result.get(0).getStaffId());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-016: Should NOT include VET_GENERAL for GROOMER specialty")
                void shouldNotIncludeVetGeneralForGroomerSpecialty() {
                        // Arrange: staff1 is VET_GENERAL
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1)); // staff1 is VET_GENERAL

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        List<Slot> availableSlots = List.of(
                                        createMockSlot(shift1.getShiftId(), LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots);

                        // Act: ask for GROOMER
                        List<AvailableStaffResponse> result = staffAssignmentService.getAvailableStaffForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.GROOMER, 1, null);

                        // Assert: Should NOT find staff1 because VET_GENERAL is NOT fallback for GROOMER
                        assertTrue(result.isEmpty());
                }
        }

        // ==================== getAvailableStaffForBookingConfirm Tests
        // ====================

        @Nested
        @DisplayName("getAvailableStaffForBookingConfirm")
        class GetAvailableStaffForBookingConfirmTests {

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
                @DisplayName("TC-UNIT-STAFF-008: Should return all matching staff for booking confirmation")
                void shouldReturnAllMatchingStaffForBookingConfirmation() {
                        // Arrange
                        Booking booking = createMockBooking();
                        BookingServiceItem serviceItem = createMockServiceItem(booking, "Khám tổng quát", 30);
                        booking.setBookingServices(List.of(serviceItem));

                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1, staff2));

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        StaffShift shift2 = createMockShift(staff2, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));

                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift1));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff2Id, testDate))
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
                        var result = staffAssignmentService.getAvailableStaffForBookingConfirm(booking);

                        // Assert
                        assertNotNull(result);
                        assertEquals(2, result.size());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-009: Should mark suggested staff with isSuggested=true")
                void shouldMarkSuggestedStaffWithIsSuggestedTrue() {
                        // Arrange
                        Booking booking = createMockBooking();
                        BookingServiceItem serviceItem = createMockServiceItem(booking, "Khám tổng quát", 30);
                        booking.setBookingServices(List.of(serviceItem));

                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1, staff2));

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        StaffShift shift2 = createMockShift(staff2, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));

                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift1));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff2Id, testDate))
                                        .thenReturn(List.of(shift2));

                        // staff1 has more slots = suggested
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
                        var result = staffAssignmentService.getAvailableStaffForBookingConfirm(booking);

                        // Assert
                        assertNotNull(result);
                        // At least one staff should be marked as suggested
                        boolean hasSuggested = result.stream().anyMatch(v -> v.isSuggested());
                        assertTrue(hasSuggested, "Should have at least one suggested staff");
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-010: Should handle booking with multiple services requiring different durations")
                void shouldHandleBookingWithMultipleServices() {
                        // Arrange
                        Booking booking = createMockBooking();
                        BookingServiceItem service1 = createMockServiceItem(booking, "Khám tổng quát", 30);
                        BookingServiceItem service2 = createMockServiceItem(booking, "Tiêm vaccine", 30);
                        booking.setBookingServices(List.of(service1, service2));

                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1));

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
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
                        var result = staffAssignmentService.getAvailableStaffForBookingConfirm(booking);

                        // Assert
                        assertNotNull(result);
                        assertEquals(1, result.size());
                        assertTrue(result.get(0).isHasAvailableSlots());
                        assertEquals(2, result.get(0).getAvailableServiceItemIds().size());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-017: Should mark staff available for partial services")
                void shouldMarkStaffAvailableForPartialServices() {
                        // Arrange
                        Booking booking = createMockBooking();
                        BookingServiceItem service1 = createMockServiceItem(booking, "Khám tổng quát", 30);
                        BookingServiceItem service2 = createMockServiceItem(booking, "Tiêm vaccine", 30);
                        booking.setBookingServices(List.of(service1, service2));

                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1));

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        // Only 1 slot available (enough for service1, but service2 starts at 9:30 and 9:30 slot is missing)
                        List<Slot> availableSlots = List.of(
                                        createMockSlot(null, LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));

                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(any(),
                                        eq(SlotStatus.AVAILABLE)))
                                        .thenReturn(availableSlots);

                        // Act
                        var result = staffAssignmentService.getAvailableStaffForBookingConfirm(booking);

                        // Assert
                        assertNotNull(result);
                        assertEquals(1, result.size());
                        assertTrue(result.get(0).isHasAvailableSlots(), "Should be available if at least one service fits");
                        assertEquals(1, result.get(0).getAvailableServiceItemIds().size());
                        assertEquals(service1.getBookingServiceId(), result.get(0).getAvailableServiceItemIds().get(0));
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-011: Should include VET_GENERAL as fallback when specialty staff not found")
                void shouldIncludeVetGeneralAsFallback() {
                        // Arrange
                        Booking booking = createMockBooking();
                        BookingServiceItem serviceItem = createMockServiceItem(booking, "Phẫu thuật", 60);
                        serviceItem.getService().setServiceCategory(ServiceCategory.SURGERY);
                        booking.setBookingServices(List.of(serviceItem));

                        // staff1 is VET_GENERAL, staff3 is VET_SURGERY
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1, staff3));

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        StaffShift shift3 = createMockShift(staff3, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));

                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift1));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff3Id, testDate))
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
                        var result = staffAssignmentService.getAvailableStaffForBookingConfirm(booking);

                        // Assert - Both VET_SURGERY and VET_GENERAL should be included
                        assertNotNull(result);
                        assertTrue(result.size() >= 1, "Should include at least one staff");
                }
        }

        // ==================== checkStaffAvailabilityForBooking Tests
        // ====================

        @Nested
        @DisplayName("checkStaffAvailabilityForBooking")
        class CheckStaffAvailabilityTests {

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
                @DisplayName("TC-UNIT-STAFF-012: Should return allServicesHaveStaff=true when staff available for all services")
                void shouldReturnTrueWhenStaffAvailableForAllServices() {
                        // Arrange
                        Booking booking = createMockBookingWithServices();

                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1));

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        List<Slot> availableSlots = List.of(
                                        createMockSlot(null, LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));

                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(any(),
                                        eq(SlotStatus.AVAILABLE)))
                                        .thenReturn(availableSlots);

                        // Act
                        var result = staffAssignmentService.checkStaffAvailabilityForBooking(booking);

                        // Assert
                        assertNotNull(result);
                        assertTrue(result.isAllServicesHaveStaff(), "All services should have available staff");
                        assertFalse(result.getServices().isEmpty());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-013: Should return allServicesHaveStaff=false when no staff available")
                void shouldReturnFalseWhenNoStaffAvailable() {
                        // Arrange
                        Booking booking = createMockBookingWithServices();

                        // No staff in clinic
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(Collections.emptyList());

                        // Act
                        var result = staffAssignmentService.checkStaffAvailabilityForBooking(booking);

                        // Assert
                        assertNotNull(result);
                        assertFalse(result.isAllServicesHaveStaff(), "Should return false when no staff available");
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-014: Should return suggestedStaffId for each service")
                void shouldReturnSuggestedStaffIdForEachService() {
                        // Arrange
                        Booking booking = createMockBookingWithServices();

                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1));

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        List<Slot> availableSlots = List.of(
                                        createMockSlot(null, LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));

                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(any(),
                                        eq(SlotStatus.AVAILABLE)))
                                        .thenReturn(availableSlots);

                        // Act
                        var result = staffAssignmentService.checkStaffAvailabilityForBooking(booking);

                        // Assert
                        assertNotNull(result);
                        assertFalse(result.getServices().isEmpty());
                        assertNotNull(result.getServices().get(0).getSuggestedStaffId(), "Should have suggested staff ID");
                }
        }
}
