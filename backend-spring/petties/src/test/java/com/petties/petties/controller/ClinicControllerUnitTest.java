package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.clinic.ClinicRequest;
import com.petties.petties.dto.clinic.ClinicResponse;
import com.petties.petties.dto.clinic.DistanceResponse;
import com.petties.petties.dto.clinic.GeocodeResponse;
import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.ClinicService;
import com.petties.petties.service.CloudinaryService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for ClinicController using @WebMvcTest and MockMvc.
 * Follows CONTROLLER_TESTING_GUIDE.md standards (Flat structure).
 */
@WebMvcTest(ClinicController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ClinicController Unit Tests")
class ClinicControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private ClinicService clinicService;

        @MockitoBean
        private AuthService authService;

        @MockitoBean
        private CloudinaryService cloudinaryService;

        // Security-related dependencies for JwtAuthenticationFilter
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

        // --- Helper Methods ---

        private User mockUser() {
                User u = new User();
                u.setUserId(UUID.randomUUID());
                return u;
        }

        private ClinicResponse mockClinic(UUID id, String name) {
                return ClinicResponse.builder()
                                .clinicId(id)
                                .name(name)
                                .status(ClinicStatus.PENDING)
                                .address("123 Street")
                                .phone("0900000000")
                                .build();
        }

        // ==================== GET ALL CLINICS TESTS ====================

        @Test
        @DisplayName("TC-UNIT-CLINIC-001: Success - returns paged clinics")
        void getAllClinics_validFilters_returns200() throws Exception {
                Page<ClinicResponse> page = new PageImpl<>(List.of(
                                mockClinic(UUID.randomUUID(), "Clinic A"),
                                mockClinic(UUID.randomUUID(), "Clinic B")));

                when(clinicService.getAllClinics(any(), any(), any())).thenReturn(page);

                mockMvc.perform(get("/clinics")
                                .param("status", "PENDING")
                                .param("name", "Clinic")
                                .param("page", "0")
                                .param("size", "20"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content", hasSize(2)))
                                .andExpect(jsonPath("$.content[0].name").value("Clinic A"));
        }

        @Test
        @DisplayName("TC-UNIT-CLINIC-002: Success - empty result")
        void getAllClinics_emptyResult_returns200() throws Exception {
                Page<ClinicResponse> emptyPage = new PageImpl<>(List.of());
                when(clinicService.getAllClinics(any(), any(), any())).thenReturn(emptyPage);

                mockMvc.perform(get("/clinics"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content", hasSize(0)));
        }

        @Test
        @DisplayName("TC-UNIT-CLINIC-021: Success - with status filter")
        void getAllClinics_withStatusFilter_returns200() throws Exception {
                Page<ClinicResponse> page = new PageImpl<>(List.of(
                                mockClinic(UUID.randomUUID(), "Approved Clinic")));
                when(clinicService.getAllClinics(eq(ClinicStatus.APPROVED), any(), any())).thenReturn(page);

                mockMvc.perform(get("/clinics")
                                .param("status", "APPROVED"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content", hasSize(1)));
        }

        // ==================== GET BY ID TESTS ====================

        @Test
        @DisplayName("TC-UNIT-CLINIC-003: Success - returns clinic detail")
        void getClinicById_validId_returns200() throws Exception {
                UUID id = UUID.randomUUID();
                when(clinicService.getClinicById(id)).thenReturn(mockClinic(id, "Clinic Detail"));

                mockMvc.perform(get("/clinics/{id}", id))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.name").value("Clinic Detail"));
        }

        @Test
        @DisplayName("TC-UNIT-CLINIC-043: Fail - clinic not found")
        void getClinicById_notFound_returns404() throws Exception {
                UUID id = UUID.randomUUID();
                when(clinicService.getClinicById(id))
                                .thenThrow(new ResourceNotFoundException("Clinic not found"));

                mockMvc.perform(get("/clinics/{id}", id))
                                .andExpect(status().isNotFound());
        }

        // ==================== CREATE CLINIC TESTS ====================

        @Test
        @DisplayName("TC-UNIT-CLINIC-035: Success - create clinic")
        void createClinic_validData_returns201() throws Exception {
                ClinicRequest request = ClinicRequest.builder()
                                .name("New Clinic")
                                .address("123 Street")
                                .district("Dist 1")
                                .province("City")
                                .phone("0900000000")
                                .build();

                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);
                when(clinicService.createClinic(any(ClinicRequest.class), eq(user.getUserId())))
                                .thenReturn(mockClinic(UUID.randomUUID(), "New Clinic"));

                mockMvc.perform(post("/clinics")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.name").value("New Clinic"));
        }

        @Test
        @DisplayName("TC-UNIT-CLINIC-004: Fail - blank name")
        void createClinic_blankName_returns400() throws Exception {
                ClinicRequest request = ClinicRequest.builder()
                                .name("")
                                .address("123 Street")
                                .phone("0900000000")
                                .build();

                mockMvc.perform(post("/clinics")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());
        }

        // ==================== UPDATE CLINIC TESTS ====================

        @Test
        @DisplayName("TC-UNIT-CLINIC-011: Success - update clinic")
        void updateClinic_validData_returns200() throws Exception {
                UUID clinicId = UUID.randomUUID();
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);

                ClinicRequest request = ClinicRequest.builder()
                                .name("Updated Clinic")
                                .address("456 Street")
                                .phone("0911111111")
                                .build();

                ClinicResponse response = mockClinic(clinicId, "Updated Clinic");
                when(clinicService.updateClinic(eq(clinicId), any(ClinicRequest.class), eq(user.getUserId())))
                                .thenReturn(response);

                mockMvc.perform(put("/clinics/{id}", clinicId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.name").value("Updated Clinic"));
        }

        @Test
        @DisplayName("TC-UNIT-CLINIC-013: Fail - not owner")
        void updateClinic_notOwner_returns403() throws Exception {
                UUID clinicId = UUID.randomUUID();
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);

                ClinicRequest request = ClinicRequest.builder()
                                .name("Updated Clinic")
                                .address("456 Street")
                                .phone("0911111111")
                                .build();

                when(clinicService.updateClinic(eq(clinicId), any(ClinicRequest.class), eq(user.getUserId())))
                                .thenThrow(new ForbiddenException("You can only update your own clinic"));

                mockMvc.perform(put("/clinics/{id}", clinicId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isForbidden());
        }

        // ==================== DELETE CLINIC TESTS ====================

        @Test
        @DisplayName("TC-UNIT-CLINIC-015: Success - delete clinic")
        void deleteClinic_validRequest_returns200() throws Exception {
                UUID clinicId = UUID.randomUUID();
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);
                doNothing().when(clinicService).deleteClinic(eq(clinicId), eq(user.getUserId()));

                mockMvc.perform(delete("/clinics/{id}", clinicId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.message").value("Clinic deleted successfully"));
        }

        // ==================== SEARCH & NEARBY TESTS ====================

        @Test
        @DisplayName("TC-UNIT-CLINIC-018: Success - search clinics")
        void searchClinics_validName_returns200() throws Exception {
                Page<ClinicResponse> page = new PageImpl<>(List.of(
                                mockClinic(UUID.randomUUID(), "Clinic Search Result")));
                when(clinicService.searchClinics(eq("Clinic"), any())).thenReturn(page);

                mockMvc.perform(get("/clinics/search")
                                .param("name", "Clinic"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content", hasSize(1)));
        }

        @Test
        @DisplayName("TC-UNIT-CLINIC-020: Success - find nearby")
        void findNearbyClinics_validCoords_returns200() throws Exception {
                Page<ClinicResponse> page = new PageImpl<>(List.of(
                                mockClinic(UUID.randomUUID(), "Nearby Clinic")));
                when(clinicService.findNearbyClinics(any(BigDecimal.class), any(BigDecimal.class), anyDouble(), any()))
                                .thenReturn(page);

                mockMvc.perform(get("/clinics/nearby")
                                .param("latitude", "10.762622")
                                .param("longitude", "106.660172")
                                .param("radius", "5.0"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content", hasSize(1)));
        }

        // ==================== IMAGE & LOGO TESTS ====================

        @Test
        @DisplayName("TC-UNIT-CLINIC-038: Success - upload clinic image")
        void uploadClinicImage_validFile_returns201() throws Exception {
                UUID clinicId = UUID.randomUUID();
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);

                MockMultipartFile file = new MockMultipartFile(
                                "file",
                                "image.jpg",
                                MediaType.IMAGE_JPEG_VALUE,
                                "fake-image".getBytes());

                UploadResponse uploadResponse = UploadResponse.builder()
                                .url("http://cloudinary.com/image.jpg")
                                .publicId("publicId")
                                .build();
                given(cloudinaryService.uploadClinicImage(any())).willReturn(uploadResponse);

                ClinicResponse resp = mockClinic(clinicId, "With Image");
                resp.setImages(List.of("http://cloudinary.com/image.jpg"));
                when(clinicService.uploadClinicImage(eq(clinicId), anyString(), any(), any(), any(),
                                eq(user.getUserId())))
                                .thenReturn(resp);

                mockMvc.perform(multipart("/clinics/{id}/images", clinicId)
                                .file(file)
                                .param("isPrimary", "true"))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.images", hasSize(1)));
        }

        @Test
        @DisplayName("TC-UNIT-CLINIC-041: Success - upload logo")
        void uploadClinicLogo_validFile_returns200() throws Exception {
                UUID clinicId = UUID.randomUUID();
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);

                MockMultipartFile file = new MockMultipartFile(
                                "file",
                                "logo.jpg",
                                MediaType.IMAGE_JPEG_VALUE,
                                "fake-logo".getBytes());

                given(cloudinaryService.uploadClinicImage(any()))
                                .willReturn(UploadResponse.builder().url("url").build());

                ClinicResponse resp = mockClinic(clinicId, "With Logo");
                resp.setLogo("url");
                when(clinicService.updateClinicLogo(eq(clinicId), anyString(), eq(user.getUserId())))
                                .thenReturn(resp);

                mockMvc.perform(multipart("/clinics/{id}/logo", clinicId)
                                .file(file))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.logo").value("url"));
        }

        // ==================== ADMIN ACTIONS ====================

        @Test
        @DisplayName("TC-UNIT-CLINIC-029: Success - approve clinic")
        void approveClinic_validRequest_returns200() throws Exception {
                UUID clinicId = UUID.randomUUID();
                ClinicResponse response = mockClinic(clinicId, "Approved Clinic");
                response.setStatus(ClinicStatus.APPROVED);

                when(clinicService.approveClinic(clinicId)).thenReturn(response);

                mockMvc.perform(post("/clinics/{id}/approve", clinicId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value("APPROVED"));
        }

        @Test
        @DisplayName("TC-UNIT-CLINIC-032: Success - reject clinic")
        void rejectClinic_validReason_returns200() throws Exception {
                UUID clinicId = UUID.randomUUID();
                ClinicResponse response = mockClinic(clinicId, "Rejected Clinic");
                response.setStatus(ClinicStatus.REJECTED);

                when(clinicService.rejectClinic(eq(clinicId), eq("Invalid information"))).thenReturn(response);

                mockMvc.perform(post("/clinics/{id}/reject", clinicId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("reason", "Invalid information"))))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value("REJECTED"));
        }
}
