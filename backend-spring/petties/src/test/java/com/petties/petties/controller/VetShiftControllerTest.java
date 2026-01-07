package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.vetshift.SlotResponse;
import com.petties.petties.dto.vetshift.VetShiftRequest;
import com.petties.petties.dto.vetshift.VetShiftResponse;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.enums.SlotStatus;
import com.petties.petties.service.VetShiftService;
import com.petties.petties.service.AuthService;
import com.petties.petties.model.User;
// Security mocks needed for context loading even with filters disabled
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.repository.BlacklistedTokenRepository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit Tests for VetShiftController
 *
 * Tests cover:
 * - Create shift (single/multiple dates, overnight, repeat weeks, force update)
 * - Get shifts by clinic and date range
 * - Get my shifts (for VET)
 * - Get shift detail with slots
 * - Delete shift (single and bulk)
 * - Block/Unblock slots
 * - Validation errors
 */
@WebMvcTest(VetShiftController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("VetShiftController Unit Tests")
class VetShiftControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private VetShiftService vetShiftService;

    @MockitoBean
    private AuthService authService;

    // Security Mocks
    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;
    @MockitoBean
    private UserDetailsServiceImpl userDetailsService;
    @MockitoBean
    private BlacklistedTokenRepository blacklistedTokenRepository;

    // ========== CREATE SHIFT TESTS ==========

    @Test
    @DisplayName("TC-UNIT-SHIFT-001: Create Shift Valid Request Returns 201")
    void createShift_validRequest_returns201() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID shiftId = UUID.randomUUID();
        UUID vetId = UUID.randomUUID();

        VetShiftRequest request = new VetShiftRequest();
        request.setVetId(vetId);
        request.setWorkDates(List.of(LocalDate.now().plusDays(1)));
        request.setStartTime(LocalTime.of(8, 0));
        request.setEndTime(LocalTime.of(17, 0));

        VetShiftResponse response = VetShiftResponse.builder()
                .shiftId(shiftId)
                .vetId(vetId)
                .vetName("Dr. Test")
                .workDate(LocalDate.now().plusDays(1))
                .startTime(LocalTime.of(8, 0))
                .endTime(LocalTime.of(17, 0))
                .totalSlots(16)
                .availableSlots(16)
                .build();

        when(vetShiftService.createShifts(eq(clinicId), any(VetShiftRequest.class)))
                .thenReturn(List.of(response));

        mockMvc.perform(post("/clinics/{clinicId}/shifts", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].shiftId").value(shiftId.toString()))
                .andExpect(jsonPath("$[0].vetName").value("Dr. Test"))
                .andExpect(jsonPath("$[0].totalSlots").value(16));
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-002: Create Overnight Shift Returns 201")
    void createShift_overnightShift_returns201() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID shiftId = UUID.randomUUID();
        UUID vetId = UUID.randomUUID();

        VetShiftRequest request = new VetShiftRequest();
        request.setVetId(vetId);
        request.setWorkDates(List.of(LocalDate.now().plusDays(1)));
        request.setStartTime(LocalTime.of(22, 0));
        request.setEndTime(LocalTime.of(5, 0));
        request.setIsOvernight(true);

        VetShiftResponse response = VetShiftResponse.builder()
                .shiftId(shiftId)
                .vetId(vetId)
                .vetName("Dr. Night")
                .workDate(LocalDate.now().plusDays(1))
                .startTime(LocalTime.of(22, 0))
                .endTime(LocalTime.of(5, 0))
                .isOvernight(true)
                .totalSlots(14)
                .availableSlots(14)
                .build();

        when(vetShiftService.createShifts(eq(clinicId), any(VetShiftRequest.class)))
                .thenReturn(List.of(response));

        mockMvc.perform(post("/clinics/{clinicId}/shifts", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].isOvernight").value(true));
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-003: Create Shift Invalid Vet Returns 400")
    void createShift_invalidVet_returns400() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID vetId = UUID.randomUUID();

        VetShiftRequest request = new VetShiftRequest();
        request.setVetId(vetId);
        request.setWorkDates(List.of(LocalDate.now().plusDays(1)));
        request.setStartTime(LocalTime.of(8, 0));
        request.setEndTime(LocalTime.of(17, 0));

        when(vetShiftService.createShifts(eq(clinicId), any(VetShiftRequest.class)))
                .thenThrow(new BadRequestException("Bác sĩ không thuộc phòng khám này"));

        mockMvc.perform(post("/clinics/{clinicId}/shifts", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-004: Create Shift Past Date Returns 400")
    void createShift_pastDate_returns400() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID vetId = UUID.randomUUID();

        VetShiftRequest request = new VetShiftRequest();
        request.setVetId(vetId);
        request.setWorkDates(List.of(LocalDate.now().minusDays(1)));
        request.setStartTime(LocalTime.of(8, 0));
        request.setEndTime(LocalTime.of(17, 0));

        when(vetShiftService.createShifts(eq(clinicId), any(VetShiftRequest.class)))
                .thenThrow(new BadRequestException("Không thể tạo ca làm việc cho ngày đã qua"));

        mockMvc.perform(post("/clinics/{clinicId}/shifts", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ========== GET SHIFTS TESTS ==========

    @Test
    @DisplayName("TC-UNIT-SHIFT-005: Get Shifts By Clinic Returns List")
    void getShiftsByClinic_validRequest_returnsList() throws Exception {
        UUID clinicId = UUID.randomUUID();
        LocalDate startDate = LocalDate.now();
        LocalDate endDate = LocalDate.now().plusDays(6);

        VetShiftResponse shift1 = VetShiftResponse.builder()
                .shiftId(UUID.randomUUID())
                .vetName("Dr. A")
                .workDate(startDate)
                .totalSlots(16)
                .build();

        VetShiftResponse shift2 = VetShiftResponse.builder()
                .shiftId(UUID.randomUUID())
                .vetName("Dr. B")
                .workDate(startDate.plusDays(1))
                .totalSlots(14)
                .build();

        when(vetShiftService.getShiftsByClinic(clinicId, startDate, endDate))
                .thenReturn(List.of(shift1, shift2));

        mockMvc.perform(get("/clinics/{clinicId}/shifts", clinicId)
                .param("startDate", startDate.toString())
                .param("endDate", endDate.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].vetName").value("Dr. A"));
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-006: Get Shifts Empty Range Returns Empty List")
    void getShiftsByClinic_noShifts_returnsEmptyList() throws Exception {
        UUID clinicId = UUID.randomUUID();
        LocalDate startDate = LocalDate.now().plusMonths(6);
        LocalDate endDate = LocalDate.now().plusMonths(6).plusDays(6);

        when(vetShiftService.getShiftsByClinic(clinicId, startDate, endDate))
                .thenReturn(List.of());

        mockMvc.perform(get("/clinics/{clinicId}/shifts", clinicId)
                .param("startDate", startDate.toString())
                .param("endDate", endDate.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    // ========== GET SHIFT DETAIL TESTS ==========

    @Test
    @DisplayName("TC-UNIT-SHIFT-007: Get Shift Detail Returns Shift With Slots")
    void getShiftDetail_validId_returnsShiftWithSlots() throws Exception {
        UUID shiftId = UUID.randomUUID();

        SlotResponse slot1 = SlotResponse.builder()
                .slotId(UUID.randomUUID())
                .startTime(LocalTime.of(8, 0))
                .endTime(LocalTime.of(8, 30))
                .status(SlotStatus.AVAILABLE)
                .build();

        SlotResponse slot2 = SlotResponse.builder()
                .slotId(UUID.randomUUID())
                .startTime(LocalTime.of(8, 30))
                .endTime(LocalTime.of(9, 0))
                .status(SlotStatus.BLOCKED)
                .build();

        VetShiftResponse response = VetShiftResponse.builder()
                .shiftId(shiftId)
                .vetName("Dr. Test")
                .totalSlots(16)
                .availableSlots(15)
                .blockedSlots(1)
                .slots(List.of(slot1, slot2))
                .build();

        when(vetShiftService.getShiftDetail(shiftId)).thenReturn(response);

        mockMvc.perform(get("/shifts/{shiftId}", shiftId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shiftId").value(shiftId.toString()))
                .andExpect(jsonPath("$.slots.length()").value(2))
                .andExpect(jsonPath("$.slots[0].status").value("AVAILABLE"))
                .andExpect(jsonPath("$.slots[1].status").value("BLOCKED"));
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-008: Get Shift Detail Not Found Returns 404")
    void getShiftDetail_notFound_returns404() throws Exception {
        UUID shiftId = UUID.randomUUID();

        when(vetShiftService.getShiftDetail(shiftId))
                .thenThrow(new ResourceNotFoundException("Shift not found"));

        mockMvc.perform(get("/shifts/{shiftId}", shiftId))
                .andExpect(status().isNotFound());
    }

    // ========== DELETE SHIFT TESTS ==========

    @Test
    @DisplayName("TC-UNIT-SHIFT-009: Delete Shift Valid ID Returns 204")
    void deleteShift_validId_returns204() throws Exception {
        UUID shiftId = UUID.randomUUID();
        doNothing().when(vetShiftService).deleteShift(shiftId);

        mockMvc.perform(delete("/shifts/{shiftId}", shiftId))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-010: Delete Shift With Bookings Returns 400")
    void deleteShift_hasBookings_returns400() throws Exception {
        UUID shiftId = UUID.randomUUID();
        doThrow(new BadRequestException("Không thể xóa ca có lịch hẹn"))
                .when(vetShiftService).deleteShift(shiftId);

        mockMvc.perform(delete("/shifts/{shiftId}", shiftId))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-011: Bulk Delete Shifts Returns 204")
    void bulkDeleteShifts_validIds_returns204() throws Exception {
        List<UUID> shiftIds = List.of(UUID.randomUUID(), UUID.randomUUID());
        doNothing().when(vetShiftService).bulkDeleteShifts(shiftIds);

        mockMvc.perform(delete("/shifts/bulk")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(shiftIds)))
                .andExpect(status().isNoContent());
    }

    // ========== SLOT BLOCK/UNBLOCK TESTS ==========

    @Test
    @DisplayName("TC-UNIT-SHIFT-012: Block Slot Returns Updated Slot")
    void blockSlot_validId_returnsBlockedSlot() throws Exception {
        UUID slotId = UUID.randomUUID();

        SlotResponse response = SlotResponse.builder()
                .slotId(slotId)
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(10, 30))
                .status(SlotStatus.BLOCKED)
                .build();

        when(vetShiftService.blockSlot(slotId)).thenReturn(response);

        mockMvc.perform(patch("/slots/{slotId}/block", slotId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slotId").value(slotId.toString()))
                .andExpect(jsonPath("$.status").value("BLOCKED"));
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-013: Block Already Booked Slot Returns 400")
    void blockSlot_alreadyBooked_returns400() throws Exception {
        UUID slotId = UUID.randomUUID();

        when(vetShiftService.blockSlot(slotId))
                .thenThrow(new BadRequestException("Không thể khóa slot đã có lịch hẹn"));

        mockMvc.perform(patch("/slots/{slotId}/block", slotId))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-014: Unblock Slot Returns Available Slot")
    void unblockSlot_validId_returnsAvailableSlot() throws Exception {
        UUID slotId = UUID.randomUUID();

        SlotResponse response = SlotResponse.builder()
                .slotId(slotId)
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(10, 30))
                .status(SlotStatus.AVAILABLE)
                .build();

        when(vetShiftService.unblockSlot(slotId)).thenReturn(response);

        mockMvc.perform(patch("/slots/{slotId}/unblock", slotId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slotId").value(slotId.toString()))
                .andExpect(jsonPath("$.status").value("AVAILABLE"));
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-015: Unblock Non-Blocked Slot Returns 400")
    void unblockSlot_notBlocked_returns400() throws Exception {
        UUID slotId = UUID.randomUUID();

        when(vetShiftService.unblockSlot(slotId))
                .thenThrow(new BadRequestException("Slot không ở trạng thái BLOCKED"));

        mockMvc.perform(patch("/slots/{slotId}/unblock", slotId))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-016: Block Slot Not Found Returns 404")
    void blockSlot_notFound_returns404() throws Exception {
        UUID slotId = UUID.randomUUID();

        when(vetShiftService.blockSlot(slotId))
                .thenThrow(new ResourceNotFoundException("Slot not found"));

        mockMvc.perform(patch("/slots/{slotId}/block", slotId))
                .andExpect(status().isNotFound());
    }

    // ========== GET MY SHIFTS (VET) TESTS ==========

    @Test
    @DisplayName("TC-UNIT-SHIFT-017: Get My Shifts Returns Vet's Shifts")
    void getMyShifts_validVet_returnsShiftsList() throws Exception {
        UUID vetId = UUID.randomUUID();
        LocalDate startDate = LocalDate.now();
        LocalDate endDate = LocalDate.now().plusDays(6);

        User currentUser = new User();
        currentUser.setUserId(vetId);
        currentUser.setFullName("Dr. Vet");

        VetShiftResponse shift1 = VetShiftResponse.builder()
                .shiftId(UUID.randomUUID())
                .vetId(vetId)
                .vetName("Dr. Vet")
                .workDate(startDate)
                .totalSlots(16)
                .build();

        when(authService.getCurrentUser()).thenReturn(currentUser);
        when(vetShiftService.getShiftsByVet(vetId, startDate, endDate))
                .thenReturn(List.of(shift1));

        mockMvc.perform(get("/shifts/me")
                .param("startDate", startDate.toString())
                .param("endDate", endDate.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].vetName").value("Dr. Vet"));
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-018: Get My Shifts Empty Returns Empty List")
    void getMyShifts_noShifts_returnsEmptyList() throws Exception {
        UUID vetId = UUID.randomUUID();
        LocalDate startDate = LocalDate.now().plusMonths(6);
        LocalDate endDate = LocalDate.now().plusMonths(6).plusDays(6);

        User currentUser = new User();
        currentUser.setUserId(vetId);

        when(authService.getCurrentUser()).thenReturn(currentUser);
        when(vetShiftService.getShiftsByVet(vetId, startDate, endDate))
                .thenReturn(List.of());

        mockMvc.perform(get("/shifts/me")
                .param("startDate", startDate.toString())
                .param("endDate", endDate.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    // ========== REPEAT WEEKS & FORCE UPDATE TESTS ==========

    @Test
    @DisplayName("TC-UNIT-SHIFT-019: Create Shift With Repeat Weeks Returns Multiple Weeks")
    void createShift_withRepeatWeeks_returnsMultipleShifts() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID vetId = UUID.randomUUID();

        VetShiftRequest request = new VetShiftRequest();
        request.setVetId(vetId);
        request.setWorkDates(List.of(LocalDate.now().plusDays(1)));
        request.setStartTime(LocalTime.of(8, 0));
        request.setEndTime(LocalTime.of(17, 0));
        request.setRepeatWeeks(4);

        // Simulate 4 weeks of shifts created
        List<VetShiftResponse> responses = List.of(
                VetShiftResponse.builder().shiftId(UUID.randomUUID()).workDate(LocalDate.now().plusDays(1)).build(),
                VetShiftResponse.builder().shiftId(UUID.randomUUID()).workDate(LocalDate.now().plusDays(8)).build(),
                VetShiftResponse.builder().shiftId(UUID.randomUUID()).workDate(LocalDate.now().plusDays(15)).build(),
                VetShiftResponse.builder().shiftId(UUID.randomUUID()).workDate(LocalDate.now().plusDays(22)).build());

        when(vetShiftService.createShifts(eq(clinicId), any(VetShiftRequest.class)))
                .thenReturn(responses);

        mockMvc.perform(post("/clinics/{clinicId}/shifts", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.length()").value(4));
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-020: Create Shift With Force Update Overwrites Existing")
    void createShift_withForceUpdate_overwritesExisting() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID vetId = UUID.randomUUID();
        UUID newShiftId = UUID.randomUUID();

        VetShiftRequest request = new VetShiftRequest();
        request.setVetId(vetId);
        request.setWorkDates(List.of(LocalDate.now().plusDays(1)));
        request.setStartTime(LocalTime.of(9, 0));
        request.setEndTime(LocalTime.of(18, 0));
        request.setForceUpdate(true);

        VetShiftResponse response = VetShiftResponse.builder()
                .shiftId(newShiftId)
                .vetId(vetId)
                .vetName("Dr. Test")
                .workDate(LocalDate.now().plusDays(1))
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(18, 0))
                .totalSlots(16)
                .build();

        when(vetShiftService.createShifts(eq(clinicId), any(VetShiftRequest.class)))
                .thenReturn(List.of(response));

        mockMvc.perform(post("/clinics/{clinicId}/shifts", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].shiftId").value(newShiftId.toString()))
                .andExpect(jsonPath("$[0].startTime").value("09:00:00"));
    }

    // ========== VALIDATION TESTS ==========

    @Test
    @DisplayName("TC-UNIT-SHIFT-021: Create Shift Without VetId Returns 400")
    void createShift_missingVetId_returns400() throws Exception {
        UUID clinicId = UUID.randomUUID();

        VetShiftRequest request = new VetShiftRequest();
        // vetId is null
        request.setWorkDates(List.of(LocalDate.now().plusDays(1)));
        request.setStartTime(LocalTime.of(8, 0));
        request.setEndTime(LocalTime.of(17, 0));

        mockMvc.perform(post("/clinics/{clinicId}/shifts", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-022: Create Shift Without WorkDates Returns 400")
    void createShift_missingWorkDates_returns400() throws Exception {
        UUID clinicId = UUID.randomUUID();

        VetShiftRequest request = new VetShiftRequest();
        request.setVetId(UUID.randomUUID());
        // workDates is null
        request.setStartTime(LocalTime.of(8, 0));
        request.setEndTime(LocalTime.of(17, 0));

        mockMvc.perform(post("/clinics/{clinicId}/shifts", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-023: Delete Shift Not Found Returns 404")
    void deleteShift_notFound_returns404() throws Exception {
        UUID shiftId = UUID.randomUUID();

        doThrow(new ResourceNotFoundException("Shift not found"))
                .when(vetShiftService).deleteShift(shiftId);

        mockMvc.perform(delete("/shifts/{shiftId}", shiftId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-024: Create Shift Closed Day Returns 400")
    void createShift_clinicClosedDay_returns400() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID vetId = UUID.randomUUID();

        VetShiftRequest request = new VetShiftRequest();
        request.setVetId(vetId);
        request.setWorkDates(List.of(LocalDate.now().plusDays(1)));
        request.setStartTime(LocalTime.of(8, 0));
        request.setEndTime(LocalTime.of(17, 0));

        when(vetShiftService.createShifts(eq(clinicId), any(VetShiftRequest.class)))
                .thenThrow(new BadRequestException("Phòng khám đóng cửa vào Chủ Nhật"));

        mockMvc.perform(post("/clinics/{clinicId}/shifts", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-UNIT-SHIFT-025: Create Shift Outside Operating Hours Returns 400")
    void createShift_outsideOperatingHours_returns400() throws Exception {
        UUID clinicId = UUID.randomUUID();
        UUID vetId = UUID.randomUUID();

        VetShiftRequest request = new VetShiftRequest();
        request.setVetId(vetId);
        request.setWorkDates(List.of(LocalDate.now().plusDays(1)));
        request.setStartTime(LocalTime.of(6, 0));
        request.setEndTime(LocalTime.of(22, 0));

        when(vetShiftService.createShifts(eq(clinicId), any(VetShiftRequest.class)))
                .thenThrow(new BadRequestException("Ca làm việc phải trong giờ mở cửa của phòng khám (08:00 - 18:00)"));

        mockMvc.perform(post("/clinics/{clinicId}/shifts", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}
