package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.clinic.InviteByEmailRequest;
import com.petties.petties.dto.clinic.StaffResponse;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.StaffSpecialty;
import com.petties.petties.service.ClinicStaffService;
import com.petties.petties.exception.ResourceAlreadyExistsException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.repository.BlacklistedTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for ClinicStaffController
 * Tests invite-by-email, get staff, remove staff, and update specialty
 * endpoints
 */
@WebMvcTest(ClinicStaffController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ClinicStaffController Unit Tests")
class ClinicStaffControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private ClinicStaffService staffService;

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
        private UUID userId;

        @BeforeEach
        void setUp() {
                clinicId = UUID.randomUUID();
                userId = UUID.randomUUID();
        }

        // ==================== GET CLINIC STAFF TESTS ====================

        @Test
        @WithMockUser(roles = "CLINIC_OWNER")
        @DisplayName("TC-UNIT-STAFF-001: Success - return staff list for owner")
        void getClinicStaff_asOwner_returns200() throws Exception {
                // Arrange
                List<StaffResponse> staffList = Arrays.asList(
                                StaffResponse.builder()
                                                .userId(UUID.randomUUID())
                                                .fullName("Dr. Nguyen")
                                                .email("dr.nguyen@gmail.com")
                                                .role(Role.STAFF)
                                                .specialty(StaffSpecialty.VET_GENERAL)
                                                .build(),
                                StaffResponse.builder()
                                                .userId(UUID.randomUUID())
                                                .fullName("Manager Tran")
                                                .email("manager.tran@gmail.com")
                                                .role(Role.CLINIC_MANAGER)
                                                .build());
                when(staffService.getClinicStaff(clinicId)).thenReturn(staffList);

                // Act & Assert
                mockMvc.perform(get("/clinics/{clinicId}/staff", clinicId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.length()").value(2))
                                .andExpect(jsonPath("$[0].fullName").value("Dr. Nguyen"))
                                .andExpect(jsonPath("$[0].role").value("STAFF"))
                                .andExpect(jsonPath("$[1].role").value("CLINIC_MANAGER"));
        }

        @Test
        @WithMockUser(roles = "CLINIC_MANAGER")
        @DisplayName("TC-UNIT-STAFF-002: Success - return staff list for manager")
        void getClinicStaff_asManager_returns200() throws Exception {
                when(staffService.getClinicStaff(clinicId)).thenReturn(List.of());

                mockMvc.perform(get("/clinics/{clinicId}/staff", clinicId))
                                .andExpect(status().isOk());
        }

        // ==================== INVITE STAFF TESTS ====================

        @Test
        @WithMockUser(roles = "CLINIC_OWNER")
        @DisplayName("TC-UNIT-STAFF-003: Success - invite VET successfully")
        void inviteByEmail_validVetRequest_returns200() throws Exception {
                // Arrange
                InviteByEmailRequest request = new InviteByEmailRequest();
                request.setEmail("vet@gmail.com");
                request.setRole(Role.STAFF);
                request.setSpecialty(StaffSpecialty.VET_SURGERY);

                doNothing().when(staffService).inviteByEmail(eq(clinicId), any(InviteByEmailRequest.class));

                // Act & Assert
                mockMvc.perform(post("/clinics/{clinicId}/staff/invite-by-email", clinicId)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(content().string("Staff invited successfully"));

                verify(staffService).inviteByEmail(eq(clinicId), any(InviteByEmailRequest.class));
        }

        @Test
        @WithMockUser(roles = "CLINIC_MANAGER")
        @DisplayName("TC-UNIT-STAFF-004: Success - invite VET as manager")
        void inviteByEmail_asManager_returns200() throws Exception {
                InviteByEmailRequest request = new InviteByEmailRequest();
                request.setEmail("newvet@gmail.com");
                request.setRole(Role.STAFF);
                request.setSpecialty(StaffSpecialty.VET_GENERAL);

                doNothing().when(staffService).inviteByEmail(eq(clinicId), any(InviteByEmailRequest.class));

                mockMvc.perform(post("/clinics/{clinicId}/staff/invite-by-email", clinicId)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk());
        }

        @Test
        @WithMockUser(roles = "CLINIC_OWNER")
        @DisplayName("TC-UNIT-STAFF-005: Success - invite CLINIC_MANAGER successfully")
        void inviteByEmail_managerRole_returns200() throws Exception {
                InviteByEmailRequest request = new InviteByEmailRequest();
                request.setEmail("manager@gmail.com");
                request.setRole(Role.CLINIC_MANAGER);

                doNothing().when(staffService).inviteByEmail(eq(clinicId), any(InviteByEmailRequest.class));

                mockMvc.perform(post("/clinics/{clinicId}/staff/invite-by-email", clinicId)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk());
        }

        @Test
        @WithMockUser(roles = "CLINIC_OWNER")
        @DisplayName("TC-UNIT-STAFF-006: Conflict - email already assigned")
        void inviteByEmail_alreadyAssigned_returns409() throws Exception {
                InviteByEmailRequest request = new InviteByEmailRequest();
                request.setEmail("existing@gmail.com");
                request.setRole(Role.STAFF);

                doThrow(new ResourceAlreadyExistsException("User is already assigned to another clinic"))
                                .when(staffService)
                                .inviteByEmail(eq(clinicId), any(InviteByEmailRequest.class));

                mockMvc.perform(post("/clinics/{clinicId}/staff/invite-by-email", clinicId)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isConflict());
        }

        @Test
        @WithMockUser(roles = "CLINIC_MANAGER")
        @DisplayName("TC-UNIT-STAFF-007: Forbidden - manager adds another manager")
        void inviteByEmail_managerAddingManager_returns403() throws Exception {
                InviteByEmailRequest request = new InviteByEmailRequest();
                request.setEmail("newmanager@gmail.com");
                request.setRole(Role.CLINIC_MANAGER);

                doThrow(new ForbiddenException("Quản lý phòng khám chỉ có quyền thêm Bác sĩ"))
                                .when(staffService)
                                .inviteByEmail(eq(clinicId), any(InviteByEmailRequest.class));

                mockMvc.perform(post("/clinics/{clinicId}/staff/invite-by-email", clinicId)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isForbidden());
        }

        @Test
        @WithMockUser(roles = "CLINIC_OWNER")
        @DisplayName("TC-UNIT-STAFF-008: Bad Request - email is blank")
        void inviteByEmail_blankEmail_returns400() throws Exception {
                InviteByEmailRequest request = new InviteByEmailRequest();
                request.setEmail("");
                request.setRole(Role.STAFF);

                mockMvc.perform(post("/clinics/{clinicId}/staff/invite-by-email", clinicId)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());
        }

        @Test
        @WithMockUser(roles = "CLINIC_OWNER")
        @DisplayName("TC-UNIT-STAFF-009: Bad Request - invalid email format")
        void inviteByEmail_invalidEmail_returns400() throws Exception {
                InviteByEmailRequest request = new InviteByEmailRequest();
                request.setEmail("not-an-email");
                request.setRole(Role.STAFF);

                mockMvc.perform(post("/clinics/{clinicId}/staff/invite-by-email", clinicId)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());
        }

        // ==================== UPDATE SPECIALTY TESTS ====================

        @Test
        @WithMockUser(roles = "CLINIC_OWNER")
        @DisplayName("TC-UNIT-STAFF-010: Success - update specialty")
        void updateStaffSpecialty_validRequest_returns200() throws Exception {
                doNothing().when(staffService).updateStaffSpecialty(eq(clinicId), eq(userId),
                                eq("VET_SURGERY"));

                mockMvc.perform(patch("/clinics/{clinicId}/staff/{userId}/specialty", clinicId, userId)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"specialty\": \"VET_SURGERY\"}"))
                                .andExpect(status().isOk())
                                .andExpect(content().string("Staff specialty updated successfully"));
        }

        @Test
        @WithMockUser(roles = "CLINIC_MANAGER")
        @DisplayName("TC-UNIT-STAFF-011: Success - update specialty as manager")
        void updateStaffSpecialty_asManager_returns200() throws Exception {
                doNothing().when(staffService).updateStaffSpecialty(eq(clinicId), eq(userId),
                                eq("VET_GENERAL"));

                mockMvc.perform(patch("/clinics/{clinicId}/staff/{userId}/specialty", clinicId, userId)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"specialty\": \"VET_GENERAL\"}"))
                                .andExpect(status().isOk());
        }

        // ==================== REMOVE STAFF TESTS ====================

        @Test
        @WithMockUser(roles = "CLINIC_OWNER")
        @DisplayName("TC-UNIT-STAFF-012: Success - remove staff successfully")
        void removeStaff_validRequest_returns200() throws Exception {
                doNothing().when(staffService).removeStaff(clinicId, userId);

                mockMvc.perform(delete("/clinics/{clinicId}/staff/{userId}", clinicId, userId)
                                .with(csrf()))
                                .andExpect(status().isOk())
                                .andExpect(content().string("Staff removed successfully"));

                verify(staffService).removeStaff(clinicId, userId);
        }

        @Test
        @WithMockUser(roles = "CLINIC_MANAGER")
        @DisplayName("TC-UNIT-STAFF-013: Success - remove staff as manager")
        void removeStaff_asManager_returns200() throws Exception {
                doNothing().when(staffService).removeStaff(clinicId, userId);

                mockMvc.perform(delete("/clinics/{clinicId}/staff/{userId}", clinicId, userId)
                                .with(csrf()))
                                .andExpect(status().isOk());
        }

        // ==================== HAS MANAGER TESTS ====================

        @Test
        @WithMockUser(roles = "CLINIC_OWNER")
        @DisplayName("TC-UNIT-STAFF-014: Success - clinic has manager")
        void hasManager_exists_returnsTrue() throws Exception {
                when(staffService.hasManager(clinicId)).thenReturn(true);

                mockMvc.perform(get("/clinics/{clinicId}/staff/has-manager", clinicId))
                                .andExpect(status().isOk())
                                .andExpect(content().string("true"));
        }

        @Test
        @WithMockUser(roles = "CLINIC_OWNER")
        @DisplayName("TC-UNIT-STAFF-015: Success - clinic has no manager")
        void hasManager_notExists_returnsFalse() throws Exception {
                when(staffService.hasManager(clinicId)).thenReturn(false);

                mockMvc.perform(get("/clinics/{clinicId}/staff/has-manager", clinicId))
                                .andExpect(status().isOk())
                                .andExpect(content().string("false"));
        }
}
