package com.petties.petties.service;

import com.petties.petties.dto.booking.AvailableStaffResponse;
import com.petties.petties.exception.BadRequestException;
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
 * - getAvailableStaffForReassign: filtering, availability check, slot
 * validation
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

        @Mock
        private BookingServiceItemRepository bookingServiceItemRepository;

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
                staff1 = createMockStaff(staff1Id, "BS. Nguyễn Văn A", StaffSpecialty.VET);
                staff2 = createMockStaff(staff2Id, "BS. Trần Văn B", StaffSpecialty.VET);
                staff3 = createMockStaff(staff3Id, "BS. Lê Văn C", StaffSpecialty.VET);
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
                                        clinicId, testDate, testTime, StaffSpecialty.VET, 1, staff1Id);

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
                                        clinicId, testDate, testTime, StaffSpecialty.VET, 1, null);

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
                                        clinicId, testDate, testTime, StaffSpecialty.VET, 1, null);

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
                                        clinicId, testDate, testTime, StaffSpecialty.VET, 2, null);

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
                                        clinicId, testDate, testTime, StaffSpecialty.VET, 1, null);

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
                        // Arrange: Only staff3 with VET specialty, looking for GROOMER
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff3)); // staff3 has VET

                        // Act: Looking for GROOMER
                        List<AvailableStaffResponse> result = staffAssignmentService.getAvailableStaffForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.GROOMER, 1, null);

                        // Assert: Empty because staff3 has VET, not GROOMER
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
                                        clinicId, testDate, testTime, StaffSpecialty.VET, 1, null);

                        // Assert
                        assertEquals(1, result.size());
                        assertEquals("https://example.com/avatar.jpg", result.get(0).getAvatarUrl());
                        assertEquals("VET", result.get(0).getSpecialty());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-015: Should include VET for VET specialty")
                void shouldIncludeVetForVetSpecialty() {
                        // Arrange: staff1 is VET
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1)); // staff1 is VET

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        List<Slot> availableSlots = List.of(
                                        createMockSlot(shift1.getShiftId(), LocalTime.of(9, 0), LocalTime.of(9, 30),
                                                        SlotStatus.AVAILABLE));
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots);

                        // Act: ask for VET
                        List<AvailableStaffResponse> result = staffAssignmentService.getAvailableStaffForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET, 1, null);

                        // Assert: Should find staff1 because exact match
                        assertEquals(1, result.size());
                        assertEquals(staff1Id, result.get(0).getStaffId());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-016: Should NOT include VET for GROOMER specialty")
                void shouldNotIncludeVetForGroomerSpecialty() {
                        // Arrange: staff1 is VET
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1)); // staff1 is VET

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

                        // Assert: Should NOT find staff1 because VET is NOT valid for GROOMER
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
                        if (result.get(0).getAvailableServiceItemIds() != null) {
                                assertEquals(2, result.get(0).getAvailableServiceItemIds().size());
                        }
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
                        // Partial availability: staff with 1 slot can cover at least service1
                        if (result.get(0).getAvailableServiceItemIds() != null) {
                                assertTrue(result.get(0).getAvailableServiceItemIds().size() >= 1);
                        } else {
                                assertTrue(result.get(0).isHasAvailableSlots() || result.get(0).getUnavailableReason() != null);
                        }
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-011: Should include VET staff for VET-required service")
                void shouldIncludeVetStaffForVetService() {
                        // Arrange
                        Booking booking = createMockBooking();
                        BookingServiceItem serviceItem = createMockServiceItem(booking, "Phẫu thuật", 60);
                        serviceItem.getService().setServiceCategory(ServiceCategory.SURGERY);
                        booking.setBookingServices(List.of(serviceItem));

                        // staff1 and staff3 are both VET
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

                        // Assert - Both VET staff should be included
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
                        assertNotNull(result.getServices().get(0).getSuggestedStaffId(),
                                        "Should have suggested staff ID");
                }
        }

        // ==================== SOS Assignment Tests ====================

        @Nested
        @DisplayName("SOS Assignment Tests")
        class SosAssignmentTests {

                @Test
                @DisplayName("TC-UNIT-STAFF-SOS-001: autoAssignStaff should pick any available staff for SOS booking")
                void autoAssignStaff_shouldIgnoreSpecialtyForSos() {
                        // Arrange
                        Booking booking = new Booking();
                        booking.setBookingCode("SOS-001");
                        booking.setType(com.petties.petties.model.enums.BookingType.SOS);
                        booking.setBookingDate(testDate);
                        booking.setBookingTime(testTime);

                        Clinic clinic = new Clinic();
                        clinic.setClinicId(clinicId);
                        booking.setClinic(clinic);

                        // Mock 2 staff in clinic: staff1 (VET), staff3 (VET)
                        when(userRepository.findByWorkingClinicIdAndRole(clinicId, Role.STAFF))
                                        .thenReturn(List.of(staff1, staff3));

                        // staff1 has shift
                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        // staff3 has no shift
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff3Id, testDate))
                                        .thenReturn(Collections.emptyList());

                        // Mock available slots for staff1
                        List<Slot> slots1 = List.of(createMockSlot(shift1.getShiftId(), testTime,
                                        testTime.plusMinutes(30), SlotStatus.AVAILABLE));
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(slots1);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.BOOKED))
                                        .thenReturn(Collections.emptyList());

                        // Act
                        User result = staffAssignmentService.autoAssignStaff(booking);

                        // Assert: Should find staff1 even though we didn't specify a specialty
                        assertNotNull(result);
                        assertEquals(staff1Id, result.getUserId());
                        verify(userRepository, times(1)).findByWorkingClinicIdAndRole(clinicId, Role.STAFF);
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-SOS-002: assignStaffToAllServices should bypass specialty for SOS")
                void assignStaffToAllServices_shouldBypassSpecialtyForSos() {
                        // Arrange
                        Booking booking = new Booking();
                        booking.setBookingCode("SOS-002");
                        booking.setType(com.petties.petties.model.enums.BookingType.SOS);
                        booking.setBookingDate(testDate);
                        booking.setBookingTime(testTime);

                        Clinic clinic = new Clinic();
                        clinic.setClinicId(clinicId);
                        booking.setClinic(clinic);

                        BookingServiceItem item = new BookingServiceItem();
                        item.setBookingServiceId(UUID.randomUUID());
                        item.setBooking(booking);

                        com.petties.petties.model.ClinicService service = new com.petties.petties.model.ClinicService();
                        service.setServiceId(UUID.randomUUID());
                        service.setName("Phẫu thuật khẩn cấp");
                        service.setDurationTime(30);
                        service.setServiceCategory(ServiceCategory.SURGERY); // Requires VET
                        item.setService(service);

                        booking.setBookingServices(List.of(item));

                        // staff1 is VET, staff3 is VET
                        // In SOS mode, it should be able to pick staff1 even for SURGERY
                        when(userRepository.findByWorkingClinicIdAndRole(clinicId, Role.STAFF))
                                        .thenReturn(List.of(staff1, staff3));

                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        // staff3 has no shift
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff3Id, testDate))
                                        .thenReturn(Collections.emptyList());

                        List<Slot> slots1 = List.of(createMockSlot(shift1.getShiftId(), testTime,
                                        testTime.plusMinutes(30), SlotStatus.AVAILABLE));
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(slots1);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(),
                                        SlotStatus.BOOKED))
                                        .thenReturn(Collections.emptyList());

                        // Act
                        Map<UUID, User> result = staffAssignmentService.assignStaffToAllServices(booking);

                        // Assert
                        assertEquals(1, result.size());
                        assertEquals(staff1Id, result.get(item.getBookingServiceId()).getUserId());
                }
        }

        // ==================== Specialty Validation Tests ====================

        @Nested
        @DisplayName("reassignStaffForService - Specialty Validation")
        class SpecialtyValidationTests {

                private UUID bookingId;
                private UUID serviceItemId;
                private UUID groomerId;
                private UUID vetGeneralId;
                private UUID vetSurgeryId;
                private User groomer;
                private User vetGeneral;
                private User vetSurgery;
                private Booking booking;
                private BookingServiceItem vaccinationItem;
                private BookingServiceItem groomingItem;
                private com.petties.petties.model.ClinicService vaccinationService;
                private com.petties.petties.model.ClinicService groomingService;

                @BeforeEach
                void setUp() {
                        bookingId = UUID.randomUUID();
                        serviceItemId = UUID.randomUUID();
                        groomerId = UUID.randomUUID();
                        vetGeneralId = UUID.randomUUID();
                        vetSurgeryId = UUID.randomUUID();

                        // Create staff with different specialties
                        groomer = createMockStaff(groomerId, "Nguyễn Văn Groomer", StaffSpecialty.GROOMER);
                        vetGeneral = createMockStaff(vetGeneralId, "BS. Nguyễn Văn A", StaffSpecialty.VET);
                        vetSurgery = createMockStaff(vetSurgeryId, "BS. Trịnh Phẫu Thuật", StaffSpecialty.VET);

                        // Create services
                        vaccinationService = new com.petties.petties.model.ClinicService();
                        vaccinationService.setServiceId(UUID.randomUUID());
                        vaccinationService.setName("Tiêm phòng dại");
                        vaccinationService.setServiceCategory(ServiceCategory.VACCINATION);
                        vaccinationService.setDurationTime(30);

                        groomingService = new com.petties.petties.model.ClinicService();
                        groomingService.setServiceId(UUID.randomUUID());
                        groomingService.setName("Tắm và chăm sóc lông");
                        groomingService.setServiceCategory(ServiceCategory.GROOMING_SPA);
                        groomingService.setDurationTime(60);

                        // Create booking
                        booking = new Booking();
                        booking.setBookingId(bookingId);
                        booking.setBookingDate(testDate);
                        booking.setBookingTime(testTime);

                        Clinic clinic = new Clinic();
                        clinic.setClinicId(clinicId);
                        booking.setClinic(clinic);

                        // Create service items
                        vaccinationItem = BookingServiceItem.builder()
                                        .bookingServiceId(serviceItemId)
                                        .booking(booking)
                                        .service(vaccinationService)
                                        .build();

                        groomingItem = BookingServiceItem.builder()
                                        .bookingServiceId(serviceItemId)
                                        .booking(booking)
                                        .service(groomingService)
                                        .build();
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-VAL-001: Should reject GROOMER for VACCINATION service")
                void shouldRejectGroomerForVaccination() {
                        // Arrange
                        when(bookingServiceItemRepository.findById(serviceItemId))
                                        .thenReturn(Optional.of(vaccinationItem));
                        when(userRepository.findById(groomerId))
                                        .thenReturn(Optional.of(groomer));

                        // Act & Assert
                        BadRequestException exception = assertThrows(BadRequestException.class, () -> {
                                staffAssignmentService.reassignStaffForService(
                                                serviceItemId,
                                                groomerId,
                                                bookingServiceItemRepository);
                        });

                        // Verify error message
                        assertTrue(exception.getMessage().contains("không có chuyên môn phù hợp"),
                                        "Error message should mention specialty incompatibility");
                        assertTrue(exception.getMessage().contains(groomer.getFullName()),
                                        "Error message should contain staff name");
                        assertTrue(exception.getMessage().contains(vaccinationService.getName()),
                                        "Error message should contain service name");

                        // Verify no changes were saved
                        verify(bookingServiceItemRepository, never()).save(any());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-VAL-002: Should allow VET for VACCINATION service")
                void shouldAllowVetGeneralForVaccination() {
                        // Arrange
                        when(bookingServiceItemRepository.findById(serviceItemId))
                                        .thenReturn(Optional.of(vaccinationItem));
                        when(userRepository.findById(vetGeneralId))
                                        .thenReturn(Optional.of(vetGeneral));

                        // Mock shift and slots for successful reassignment
                        StaffShift shift = createMockShift(vetGeneral, testDate, LocalTime.of(8, 0),
                                        LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(vetGeneralId, testDate))
                                        .thenReturn(List.of(shift));

                        Slot slot1 = createMockSlot(shift.getShiftId(), LocalTime.of(9, 0), LocalTime.of(9, 30),
                                        SlotStatus.AVAILABLE);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(List.of(slot1));

                        when(bookingSlotRepository.findByBookingServiceItem_BookingServiceId(serviceItemId))
                                        .thenReturn(Collections.emptyList());

                        // Act - Should not throw
                        assertDoesNotThrow(() -> {
                                staffAssignmentService.reassignStaffForService(
                                                serviceItemId,
                                                vetGeneralId,
                                                bookingServiceItemRepository);
                        });

                        // Verify service item was saved with new staff
                        verify(bookingServiceItemRepository).save(any(BookingServiceItem.class));
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-VAL-003: Should reject VET for GROOMING service")
                void shouldRejectVetSurgeryForGrooming() {
                        // Arrange
                        when(bookingServiceItemRepository.findById(serviceItemId))
                                        .thenReturn(Optional.of(groomingItem));
                        when(userRepository.findById(vetSurgeryId))
                                        .thenReturn(Optional.of(vetSurgery));

                        // Act & Assert
                        BadRequestException exception = assertThrows(BadRequestException.class, () -> {
                                staffAssignmentService.reassignStaffForService(
                                                serviceItemId,
                                                vetSurgeryId,
                                                bookingServiceItemRepository);
                        });

                        // Verify error message
                        assertTrue(exception.getMessage().contains("không có chuyên môn phù hợp"),
                                        "Error message should mention specialty incompatibility");

                        // Verify no changes were saved
                        verify(bookingServiceItemRepository, never()).save(any());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-VAL-004: Should allow GROOMER for GROOMING service (exact match)")
                void shouldAllowGroomerForGrooming() {
                        // Arrange
                        when(bookingServiceItemRepository.findById(serviceItemId))
                                        .thenReturn(Optional.of(groomingItem));
                        when(userRepository.findById(groomerId))
                                        .thenReturn(Optional.of(groomer));

                        // Mock shift and slots
                        StaffShift shift = createMockShift(groomer, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(groomerId, testDate))
                                        .thenReturn(List.of(shift));

                        Slot slot1 = createMockSlot(shift.getShiftId(), LocalTime.of(9, 0), LocalTime.of(9, 30),
                                        SlotStatus.AVAILABLE);
                        Slot slot2 = createMockSlot(shift.getShiftId(), LocalTime.of(9, 30), LocalTime.of(10, 0),
                                        SlotStatus.AVAILABLE);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(List.of(slot1, slot2));

                        when(bookingSlotRepository.findByBookingServiceItem_BookingServiceId(serviceItemId))
                                        .thenReturn(Collections.emptyList());

                        // Act - Should not throw
                        assertDoesNotThrow(() -> {
                                staffAssignmentService.reassignStaffForService(
                                                serviceItemId,
                                                groomerId,
                                                bookingServiceItemRepository);
                        });

                        // Verify service item was saved
                        verify(bookingServiceItemRepository).save(any(BookingServiceItem.class));
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-VAL-005: Should allow VET for all medical services")
                void shouldAllowVetForAllMedicalServices() {
                        // Test VET can handle SURGERY service
                        com.petties.petties.model.ClinicService surgeryService = new com.petties.petties.model.ClinicService();
                        surgeryService.setServiceId(UUID.randomUUID());
                        surgeryService.setName("Phẫu thuật thiến");
                        surgeryService.setServiceCategory(ServiceCategory.SURGERY);
                        surgeryService.setDurationTime(120);

                        BookingServiceItem surgeryItem = BookingServiceItem.builder()
                                        .bookingServiceId(serviceItemId)
                                        .booking(booking)
                                        .service(surgeryService)
                                        .build();

                        // Arrange
                        when(bookingServiceItemRepository.findById(serviceItemId))
                                        .thenReturn(Optional.of(surgeryItem));
                        when(userRepository.findById(vetGeneralId))
                                        .thenReturn(Optional.of(vetGeneral));

                        // Mock shift and slots
                        StaffShift shift = createMockShift(vetGeneral, testDate, LocalTime.of(8, 0),
                                        LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(vetGeneralId, testDate))
                                        .thenReturn(List.of(shift));

                        List<Slot> slots = new ArrayList<>();
                        for (int i = 0; i < 4; i++) { // 120 minutes = 4 slots
                                slots.add(createMockSlot(shift.getShiftId(), testTime.plusMinutes(i * 30),
                                                testTime.plusMinutes((i + 1) * 30), SlotStatus.AVAILABLE));
                        }
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift.getShiftId(),
                                        SlotStatus.AVAILABLE))
                                        .thenReturn(slots);

                        when(bookingSlotRepository.findByBookingServiceItem_BookingServiceId(serviceItemId))
                                        .thenReturn(Collections.emptyList());

                        // Act - Should not throw (VET can handle SURGERY)
                        assertDoesNotThrow(() -> {
                                staffAssignmentService.reassignStaffForService(
                                                serviceItemId,
                                                vetGeneralId,
                                                bookingServiceItemRepository);
                        });

                        // Verify
                        verify(bookingServiceItemRepository).save(any(BookingServiceItem.class));
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-VAL-006: Should reject staff with null specialty")
                void shouldRejectStaffWithNullSpecialty() {
                        // Arrange
                        User staffWithoutSpecialty = createMockStaff(UUID.randomUUID(), "Nhân viên không chuyên môn",
                                        null);

                        when(bookingServiceItemRepository.findById(serviceItemId))
                                        .thenReturn(Optional.of(vaccinationItem));
                        when(userRepository.findById(staffWithoutSpecialty.getUserId()))
                                        .thenReturn(Optional.of(staffWithoutSpecialty));

                        // Act & Assert
                        BadRequestException exception = assertThrows(BadRequestException.class, () -> {
                                staffAssignmentService.reassignStaffForService(
                                                serviceItemId,
                                                staffWithoutSpecialty.getUserId(),
                                                bookingServiceItemRepository);
                        });

                        assertTrue(exception.getMessage().contains("không có chuyên môn phù hợp"));
                }
        }
}
