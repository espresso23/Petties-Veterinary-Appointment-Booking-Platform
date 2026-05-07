package com.petties.petties.service;

import com.petties.petties.dto.booking.AvailableStaffResponse;
import com.petties.petties.dto.booking.StaffAvailabilityCheckResponse;
import com.petties.petties.dto.booking.StaffOptionDTO;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.*;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.ServiceCategory;
import com.petties.petties.model.enums.SlotStatus;
import com.petties.petties.model.enums.StaffSpecialty;
import com.petties.petties.repository.*;
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
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class StaffAssignmentServiceUnitTest {

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
        private ClinicServiceRepository clinicServiceRepository;
        @Mock
        private BookingServiceItemRepository bookingServiceItemRepository;

        @InjectMocks
        private StaffAssignmentService staffAssignmentService;

        private UUID clinicId;
        private LocalDate testDate;
        private LocalTime testTime;
        private User staff1;
        private User staff2;
        private User staff3;
        private UUID staff1Id;
        private UUID staff2Id;
        private UUID staff3Id;

        @BeforeEach
        void setUp() {
                clinicId = UUID.randomUUID();
                testDate = LocalDate.now().plusDays(1);
                testTime = LocalTime.of(10, 0);

                staff1Id = UUID.randomUUID();
                staff1 = new User();
                staff1.setUserId(staff1Id);
                staff1.setFullName("Staff One");
                staff1.setRole(Role.STAFF);
                staff1.setSpecialty(StaffSpecialty.VET);

                staff2Id = UUID.randomUUID();
                staff2 = new User();
                staff2.setUserId(staff2Id);
                staff2.setFullName("Staff Two");
                staff2.setRole(Role.STAFF);
                staff2.setSpecialty(StaffSpecialty.GROOMER);

                staff3Id = UUID.randomUUID();
                staff3 = new User();
                staff3.setUserId(staff3Id);
                staff3.setFullName("Staff Three");
                staff3.setRole(Role.STAFF);
                staff3.setSpecialty(StaffSpecialty.VET);
        }

        private StaffShift createMockShift(User staff, LocalDate date, LocalTime start, LocalTime end) {
                StaffShift shift = new StaffShift();
                shift.setShiftId(UUID.randomUUID());
                shift.setStaff(staff);
                shift.setWorkDate(date);
                shift.setStartTime(start);
                shift.setEndTime(end);
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

        @Nested
        @DisplayName("getAvailableStaffForReassign")
        class GetAvailableStaffForReassignTests {

                @Test
                @DisplayName("TC-UNIT-STAFF-REASSIGN-001: Should return all staff except current staff")
                void shouldExcludeCurrentlyAssignedStaff() {
                        // Arrange
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1, staff2));

                        // Act
                        List<AvailableStaffResponse> result = staffAssignmentService.getAvailableStaffForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET, 1, staff1Id);

                        // Assert
                        assertEquals(1, result.size());
                        assertEquals(staff2Id, result.get(0).getStaffId());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-REASSIGN-002: Should mark staff as unavailable when no shift")
                void shouldMarkStaffAsUnavailableWhenNoShift() {
                        // Arrange
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(Collections.emptyList());

                        // Act
                        List<AvailableStaffResponse> result = staffAssignmentService.getAvailableStaffForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.VET, 1, null);

                        // Assert
                        assertFalse(result.get(0).isAvailable());
                        assertEquals("Không có ca làm việc", result.get(0).getUnavailableReason());
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-REASSIGN-003: Should find VET for GROOMER requested (Vets are versatile)")
                void shouldAllowVetForGroomerSpecialty() {
                        // Arrange
                        when(userRepository.findByWorkingClinicIdAndRole(eq(clinicId), eq(Role.STAFF)))
                                        .thenReturn(List.of(staff1)); // staff1 is VET
                        
                        StaffShift shift1 = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift1));

                        List<Slot> availableSlots = List.of(createMockSlot(shift1.getShiftId(), testTime, testTime.plusMinutes(30), SlotStatus.AVAILABLE));
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift1.getShiftId(), SlotStatus.AVAILABLE))
                                        .thenReturn(availableSlots);

                        // Act
                        List<AvailableStaffResponse> result = staffAssignmentService.getAvailableStaffForReassign(
                                        clinicId, testDate, testTime, StaffSpecialty.GROOMER, 1, null);

                        // Assert
                        assertTrue(result.get(0).isAvailable(), "VET should be available for GROOMER service");
                }
        }

        @Nested
        @DisplayName("reserveSlotsForBooking")
        class ReserveSlotsForBookingTests {
                @Test
                @DisplayName("Should save BookingSlot with correct booking_id")
                void shouldSaveBookingSlotWithCorrectBookingId() {
                        // Arrange
                        Booking booking = new Booking();
                        booking.setBookingId(UUID.randomUUID());
                        booking.setBookingCode("BK001");
                        booking.setBookingDate(testDate);
                        booking.setBookingTime(testTime);

                        com.petties.petties.model.ClinicService service = new com.petties.petties.model.ClinicService();
                        service.setDurationTime(30);

                        BookingServiceItem item = new BookingServiceItem();
                        item.setBooking(booking);
                        item.setService(service);
                        item.setAssignedStaff(staff1);
                        booking.setBookingServices(List.of(item));

                        StaffShift shift = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate))
                                        .thenReturn(List.of(shift));

                        Slot slot = createMockSlot(shift.getShiftId(), testTime, testTime.plusMinutes(30), SlotStatus.AVAILABLE);
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift.getShiftId(), SlotStatus.AVAILABLE))
                                        .thenReturn(List.of(slot));

                        // Act
                        staffAssignmentService.reserveSlotsForBooking(booking);

                        // Assert
                        verify(bookingSlotRepository).save(argThat(bs -> 
                                bs.getBooking() != null && 
                                bs.getBooking().getBookingId().equals(booking.getBookingId()) &&
                                bs.getSlot().getSlotId().equals(slot.getSlotId())
                        ));
                }
        }

        @Nested
        @DisplayName("reassignStaffForService - Specialty Validation")
        class SpecialtyValidationTests {
                private UUID serviceItemId;
                private com.petties.petties.model.ClinicService vaccinationService;
                private com.petties.petties.model.ClinicService groomingService;
                private BookingServiceItem vaccinationItem;
                private BookingServiceItem groomingItem;

                @BeforeEach
                void setUp() {
                        serviceItemId = UUID.randomUUID();
                        Clinic clinic = new Clinic();
                        clinic.setClinicId(clinicId);

                        Booking booking = new Booking();
                        booking.setBookingId(UUID.randomUUID());
                        booking.setClinic(clinic);
                        booking.setBookingDate(testDate);
                        booking.setBookingTime(testTime);

                        ServiceCategory vaccCat = ServiceCategory.VACCINATION;
                        vaccinationService = new com.petties.petties.model.ClinicService();
                        vaccinationService.setName("Vaccination");
                        vaccinationService.setServiceCategory(vaccCat);

                        ServiceCategory groomCat = ServiceCategory.GROOMING_SPA;
                        groomingService = new com.petties.petties.model.ClinicService();
                        groomingService.setName("Grooming");
                        groomingService.setServiceCategory(groomCat);

                        vaccinationItem = new BookingServiceItem();
                        vaccinationItem.setBookingServiceId(serviceItemId);
                        vaccinationItem.setService(vaccinationService);
                        vaccinationItem.setBooking(booking);

                        groomingItem = new BookingServiceItem();
                        groomingItem.setBookingServiceId(serviceItemId);
                        groomingItem.setService(groomingService);
                        groomingItem.setBooking(booking);
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-VAL-001: Should reject GROOMER for VET service")
                void shouldRejectGroomerForVaccination() {
                        // Arrange
                        when(bookingServiceItemRepository.findById(serviceItemId)).thenReturn(Optional.of(vaccinationItem));
                        when(userRepository.findById(staff2Id)).thenReturn(Optional.of(staff2)); // staff2 is GROOMER

                        // Act & Assert
                        BadRequestException ex = assertThrows(BadRequestException.class, () -> 
                                staffAssignmentService.reassignStaffForService(serviceItemId, staff2Id, bookingServiceItemRepository));

                        assertTrue(ex.getMessage().contains("không có chuyên môn phù hợp"));
                        assertTrue(ex.getMessage().contains(staff2.getFullName()));
                }

                @Test
                @DisplayName("TC-UNIT-STAFF-VAL-002: Should allow VET for GROOMING")
                void shouldAllowVetForGrooming() {
                        // Arrange
                        when(bookingServiceItemRepository.findById(serviceItemId)).thenReturn(Optional.of(groomingItem));
                        when(userRepository.findById(staff1Id)).thenReturn(Optional.of(staff1)); // staff1 is VET

                        StaffShift shift = createMockShift(staff1, testDate, LocalTime.of(8, 0), LocalTime.of(17, 0));
                        when(staffShiftRepository.findByStaff_UserIdAndWorkDate(staff1Id, testDate)).thenReturn(List.of(shift));
                        
                        List<Slot> slots = List.of(createMockSlot(shift.getShiftId(), testTime, testTime.plusMinutes(30), SlotStatus.AVAILABLE));
                        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(shift.getShiftId(), SlotStatus.AVAILABLE)).thenReturn(slots);

                        // Act
                        assertDoesNotThrow(() -> staffAssignmentService.reassignStaffForService(serviceItemId, staff1Id, bookingServiceItemRepository));
                }
        }
}
