package com.petties.petties.service;

import com.petties.petties.dto.staffshift.StaffShiftRequest;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Slot;
import com.petties.petties.model.StaffShift;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.SlotStatus;
import com.petties.petties.repository.BookingSlotRepository;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.SlotRepository;
import com.petties.petties.repository.StaffShiftRepository;
import com.petties.petties.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("StaffShiftService Unit Tests - Overwrite Logic")
class StaffShiftServiceUnitTest {

    @Mock
    private StaffShiftRepository staffShiftRepository;

    @Mock
    private SlotRepository slotRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ClinicRepository clinicRepository;

    @Mock
    private BookingSlotRepository bookingSlotRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private StaffShiftService staffShiftService;

    @Test
    @DisplayName("CreateShifts - No existing shift - Create new shift successfully")
    void createShifts_noExistingShift_createsNewShift() {
        UUID clinicId = UUID.randomUUID();
        UUID staffId = UUID.randomUUID();

        StaffShiftRequest request = new StaffShiftRequest();
        request.setStaffId(staffId);
        request.setWorkDates(List.of(LocalDate.now().plusDays(1)));
        request.setStartTime(LocalTime.of(8, 0));
        request.setEndTime(LocalTime.of(17, 0));
        request.setForceUpdate(false);

        User staff = new User();
        staff.setUserId(staffId);
        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);
        staff.setWorkingClinic(clinic);

        when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));
        when(clinicRepository.findById(clinicId)).thenReturn(Optional.of(clinic));
        when(staffShiftRepository.findOneByStaff_UserIdAndWorkDate(eq(staffId), any(LocalDate.class)))
                .thenReturn(Optional.empty());
        when(staffShiftRepository.save(any(StaffShift.class))).thenAnswer(invocation -> {
            StaffShift shift = invocation.getArgument(0);
            shift.setShiftId(UUID.randomUUID());
            return shift;
        });

        List<?> responses = staffShiftService.createShifts(clinicId, request);

        assertEquals(1, responses.size());
        verify(staffShiftRepository, times(1)).save(any(StaffShift.class));
        verify(slotRepository, never()).findByShift_ShiftIdAndStatusOrderByStartTime(any(), any());
    }

    @Test
    @DisplayName("CreateShifts - Force update existing shift without booking conflict - Update in-place")
    void createShifts_forceUpdate_updatesExistingShiftInPlace() {
        UUID clinicId = UUID.randomUUID();
        UUID staffId = UUID.randomUUID();
        LocalDate workDate = LocalDate.now().plusDays(1);

        StaffShiftRequest request = new StaffShiftRequest();
        request.setStaffId(staffId);
        request.setWorkDates(List.of(workDate));
        request.setStartTime(LocalTime.of(9, 0));
        request.setEndTime(LocalTime.of(18, 0));
        request.setForceUpdate(true);

        User staff = new User();
        staff.setUserId(staffId);
        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);
        staff.setWorkingClinic(clinic);

        StaffShift existingShift = StaffShift.builder()
                .shiftId(UUID.randomUUID())
                .staff(staff)
                .clinic(clinic)
                .workDate(workDate)
                .startTime(LocalTime.of(8, 0))
                .endTime(LocalTime.of(17, 0))
                .build();

        when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));
        when(clinicRepository.findById(clinicId)).thenReturn(Optional.of(clinic));
        when(staffShiftRepository.findOneByStaff_UserIdAndWorkDate(staffId, workDate))
                .thenReturn(Optional.of(existingShift));
        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(existingShift.getShiftId(), SlotStatus.BOOKED))
                .thenReturn(Collections.emptyList());

        when(staffShiftRepository.save(any(StaffShift.class))).thenAnswer(invocation -> invocation.getArgument(0));

        staffShiftService.createShifts(clinicId, request);

        ArgumentCaptor<StaffShift> captor = ArgumentCaptor.forClass(StaffShift.class);
        verify(staffShiftRepository, times(1)).save(captor.capture());

        StaffShift saved = captor.getValue();
        assertEquals(workDate, saved.getWorkDate());
        assertEquals(LocalTime.of(9, 0), saved.getStartTime());
        assertEquals(LocalTime.of(18, 0), saved.getEndTime());
        assertNotNull(saved.getSlots());
    }

    @Test
    @DisplayName("CreateShifts - Force update existing shift with booked slot conflict - Throws BadRequestException")
    void createShifts_forceUpdate_withBookedSlotConflict_throwsBadRequest() {
        UUID clinicId = UUID.randomUUID();
        UUID staffId = UUID.randomUUID();
        LocalDate workDate = LocalDate.now().plusDays(1);

        StaffShiftRequest request = new StaffShiftRequest();
        request.setStaffId(staffId);
        request.setWorkDates(List.of(workDate));
        request.setStartTime(LocalTime.of(11, 0)); // Conflict: starts after booked slot (10:00)
        request.setEndTime(LocalTime.of(18, 0));
        request.setForceUpdate(true);

        User staff = new User();
        staff.setUserId(staffId);
        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);
        staff.setWorkingClinic(clinic);

        StaffShift existingShift = StaffShift.builder()
                .shiftId(UUID.randomUUID())
                .staff(staff)
                .clinic(clinic)
                .workDate(workDate)
                .startTime(LocalTime.of(8, 0))
                .endTime(LocalTime.of(17, 0))
                .build();

        Slot bookedSlot = new Slot();
        bookedSlot.setStartTime(LocalTime.of(10, 0));
        bookedSlot.setEndTime(LocalTime.of(10, 30));
        bookedSlot.setStatus(SlotStatus.BOOKED);

        when(userRepository.findById(staffId)).thenReturn(Optional.of(staff));
        when(clinicRepository.findById(clinicId)).thenReturn(Optional.of(clinic));
        when(staffShiftRepository.findOneByStaff_UserIdAndWorkDate(staffId, workDate))
                .thenReturn(Optional.of(existingShift));
        when(slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(existingShift.getShiftId(), SlotStatus.BOOKED))
                .thenReturn(List.of(bookedSlot));

        assertThrows(BadRequestException.class, () -> staffShiftService.createShifts(clinicId, request));

        verify(staffShiftRepository, never()).save(any(StaffShift.class));
    }
}

