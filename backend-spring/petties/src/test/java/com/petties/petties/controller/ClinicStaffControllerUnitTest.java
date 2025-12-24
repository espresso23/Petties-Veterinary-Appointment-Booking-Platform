package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.clinic.QuickAddStaffRequest;
import com.petties.petties.dto.clinic.StaffResponse;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceAlreadyExistsException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.service.ClinicStaffService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ClinicStaffController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ClinicStaffController Unit Tests")
class ClinicStaffControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ClinicStaffService clinicStaffService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockitoBean
    private UserDetailsServiceImpl userDetailsService;

    @MockitoBean
    private BlacklistedTokenRepository blacklistedTokenRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private UUID clinicId;
    private UUID staffId;

    @BeforeEach
    void setUp() {
        clinicId = UUID.randomUUID();
        staffId = UUID.randomUUID();
    }

    @Test
    @DisplayName("TC-UNIT-STF-001: Get Staff List Success")
    void getStaff_Success() throws Exception {
        List<StaffResponse> staffList = Arrays.asList(
                StaffResponse.builder().userId(staffId).fullName("Vet A").role(Role.VET).build());

        when(clinicStaffService.getClinicStaff(clinicId)).thenReturn(staffList);

        mockMvc.perform(get("/clinics/{clinicId}/staff", clinicId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].fullName").value("Vet A"));
    }

    @Test
    @DisplayName("TC-UNIT-STF-002: Quick Add Staff Success")
    void quickAddStaff_Success() throws Exception {
        QuickAddStaffRequest request = new QuickAddStaffRequest();
        request.setFullName("New Manager");
        request.setPhone("0912345678");
        request.setRole(Role.CLINIC_MANAGER);

        doNothing().when(clinicStaffService).quickAddStaff(eq(clinicId), any(QuickAddStaffRequest.class));

        mockMvc.perform(post("/clinics/{clinicId}/staff/quick-add", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(content().string("Staff account created and assigned successfully"));
    }

    @Test
    @DisplayName("TC-UNIT-STF-003: Assign Manager Success")
    void assignManager_Success() throws Exception {
        String identifier = "manager@example.com";

        doNothing().when(clinicStaffService).assignManager(clinicId, identifier);

        mockMvc.perform(post("/clinics/{clinicId}/staff/manager/{identifier}", clinicId, identifier))
                .andExpect(status().isOk())
                .andExpect(content().string("Clinic Manager assigned successfully"));
    }

    @Test
    @DisplayName("TC-UNIT-STF-004: Remove Staff Success")
    void removeStaff_Success() throws Exception {
        doNothing().when(clinicStaffService).removeStaff(clinicId, staffId);

        mockMvc.perform(delete("/clinics/{clinicId}/staff/{staffId}", clinicId, staffId))
                .andExpect(status().isOk())
                .andExpect(content().string("Staff removed successfully"));
    }

    // --- QUICK ADD NEGATIVE TESTS ---

    @Test
    @DisplayName("TC-UNIT-STF-005: Quick Add Staff - Duplicate Phone Fail")
    void quickAddStaff_DuplicatePhone_Fail() throws Exception {
        QuickAddStaffRequest request = new QuickAddStaffRequest();
        request.setFullName("Duplicate User");
        request.setPhone("0987654321");
        request.setRole(Role.VET);

        doThrow(new ResourceAlreadyExistsException("Số điện thoại này đã được đăng ký tài khoản"))
                .when(clinicStaffService).quickAddStaff(eq(clinicId), any(QuickAddStaffRequest.class));

        mockMvc.perform(post("/clinics/{clinicId}/staff/quick-add", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Số điện thoại này đã được đăng ký tài khoản"));
    }

    @Test
    @DisplayName("TC-UNIT-STF-006: Quick Add Staff - Invalid Phone Format Fail")
    void quickAddStaff_InvalidPhone_Fail() throws Exception {
        QuickAddStaffRequest request = new QuickAddStaffRequest();
        request.setFullName("Tester");
        request.setPhone("123"); // Too short, not matching 10-11 digits
        request.setRole(Role.VET);

        mockMvc.perform(post("/clinics/{clinicId}/staff/quick-add", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Số điện thoại không hợp lệ"));
    }

    @Test
    @DisplayName("TC-UNIT-STF-007: Quick Add Staff - Empty Name Fail")
    void quickAddStaff_EmptyName_Fail() throws Exception {
        QuickAddStaffRequest request = new QuickAddStaffRequest();
        request.setFullName("");
        request.setPhone("0912345678");
        request.setRole(Role.VET);

        mockMvc.perform(post("/clinics/{clinicId}/staff/quick-add", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Họ tên không được để trống"));
    }

    @Test
    @DisplayName("TC-UNIT-STF-008: Quick Add Staff - Invalid Role Fail")
    void quickAddStaff_InvalidRole_Fail() throws Exception {
        String invalidJson = "{\"fullName\":\"A\",\"phone\":\"0912345678\",\"role\":\"INVALID\"}";

        mockMvc.perform(post("/clinics/{clinicId}/staff/quick-add", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidJson))
                .andExpect(status().isBadRequest())
                .andExpect(
                        jsonPath("$.message").value("Dữ liệu đầu vào không đúng định dạng hoặc giá trị không hợp lệ"));
    }

    @Test
    @DisplayName("TC-UNIT-STF-009: Quick Add Staff - Forbidden Add ADMIN Fail")
    void quickAddStaff_AddAdmin_Forbidden_Fail() throws Exception {
        QuickAddStaffRequest request = new QuickAddStaffRequest();
        request.setFullName("Fake Admin");
        request.setPhone("0912345678");
        request.setRole(Role.ADMIN);

        doThrow(new ForbiddenException("Không thể tạo tài khoản ADMIN qua chức năng này"))
                .when(clinicStaffService).quickAddStaff(eq(clinicId), any(QuickAddStaffRequest.class));

        mockMvc.perform(post("/clinics/{clinicId}/staff/quick-add", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Không thể tạo tài khoản ADMIN qua chức năng này"));
    }

    @Test
    @DisplayName("TC-UNIT-STF-010: Quick Add Staff - Manager Add Manager Forbidden Fail")
    void quickAddStaff_ManagerAddManager_Forbidden_Fail() throws Exception {
        QuickAddStaffRequest request = new QuickAddStaffRequest();
        request.setFullName("New Manager");
        request.setPhone("0912345678");
        request.setRole(Role.CLINIC_MANAGER);

        doThrow(new ForbiddenException("Quản lý phòng khám chỉ có quyền thêm Bác sĩ"))
                .when(clinicStaffService).quickAddStaff(eq(clinicId), any(QuickAddStaffRequest.class));

        mockMvc.perform(post("/clinics/{clinicId}/staff/quick-add", clinicId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Quản lý phòng khám chỉ có quyền thêm Bác sĩ"));
    }

    // --- ASSIGNMENT NEGATIVE TESTS ---

    @Test
    @DisplayName("TC-UNIT-STF-011: Assign Vet - Forbidden Access Fail")
    void assignVet_Forbidden_Fail() throws Exception {
        String identifier = "vet@test.com";
        doThrow(new ForbiddenException("Bạn không có quyền quản lý phòng khám này"))
                .when(clinicStaffService).assignVet(clinicId, identifier);

        mockMvc.perform(post("/clinics/{clinicId}/staff/vet/{identifier}", clinicId, identifier))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Bạn không có quyền quản lý phòng khám này"));
    }

    @Test
    @DisplayName("TC-UNIT-STF-012: Assign Manager - User Not Found Fail")
    void assignManager_NotFound_Fail() throws Exception {
        String identifier = "nonexistent";
        doThrow(new ResourceNotFoundException("User not found"))
                .when(clinicStaffService).assignManager(clinicId, identifier);

        mockMvc.perform(post("/clinics/{clinicId}/staff/manager/{identifier}", clinicId, identifier))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("User not found"));
    }
}
