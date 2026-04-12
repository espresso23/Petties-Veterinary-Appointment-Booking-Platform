package com.petties.petties.controller;

import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.emr.CreateEmrRequest;
import com.petties.petties.dto.emr.EmrResponse;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.CloudinaryService;
import com.petties.petties.service.EmrService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(EmrController.class)
@org.springframework.context.annotation.Import(com.petties.petties.config.SecurityConfig.class)
@org.springframework.test.context.ActiveProfiles({ "test", "dev" })
@DisplayName("Create Pet's Medical Record - POST /emr - Unit Tests")
public class CreateEmrControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private EmrService emrService;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private CloudinaryService cloudinaryService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private BlacklistedTokenRepository blacklistedTokenRepository;

    @MockitoBean
    private UserDetailsServiceImpl userDetailsService;

    private UserDetailsServiceImpl.UserPrincipal createStaff() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setRole(Role.STAFF);
        when(authService.getCurrentUser()).thenReturn(user);
        return UserDetailsServiceImpl.UserPrincipal.create(user);
    }

    private UserDetailsServiceImpl.UserPrincipal createPetOwner() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setRole(Role.PET_OWNER);
        when(authService.getCurrentUser()).thenReturn(user);
        return UserDetailsServiceImpl.UserPrincipal.create(user);
    }

    private CreateEmrRequest createValidRequest() {
        return CreateEmrRequest.builder()
                .petId(UUID.randomUUID())
                .bookingId(UUID.randomUUID())
                .assessment("Diagnosis")
                .plan("Treatment Plan")
                .build();
    }

    // UTCID01 (N): Valid creation
    @Test
    @DisplayName("POST /emr - UTCID01 - Staff creates valid EMR - Returns 200")
    void createEmr_valid_returns200() throws Exception {
        CreateEmrRequest request = createValidRequest();
        EmrResponse response = EmrResponse.builder().id(UUID.randomUUID().toString()).build();

        when(emrService.createEmr(any(CreateEmrRequest.class), any(UUID.class))).thenReturn(response);

        mockMvc.perform(post("/emr")
                .with(user(createStaff()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").exists());
    }

    // UTCID02 (A): Unauthenticated
    @Test
    @DisplayName("POST /emr - UTCID02 - Unauthenticated - Returns 401")
    void createEmr_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/emr")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createValidRequest())))
                .andExpect(status().isUnauthorized());
    }

    // UTCID03 (A): Unauthorized Role
    @Test
    @DisplayName("POST /emr - UTCID03 - Pet owner violates @PreAuthorize - Returns 403")
    void createEmr_petOwner_returns403() throws Exception {
        mockMvc.perform(post("/emr")
                .with(user(createPetOwner()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createValidRequest())))
                .andExpect(status().isForbidden());
    }

    // UTCID04 (A): Staff not assigned to clinic
    @Test
    @DisplayName("POST /emr - UTCID04 - Staff not in clinic - Returns 400")
    void createEmr_noClinic_returns400() throws Exception {
        CreateEmrRequest request = createValidRequest();
        when(emrService.createEmr(any(), any()))
                .thenThrow(
                        new com.petties.petties.exception.BadRequestException("Bạn chưa được gán vào phòng khám nào"));

        mockMvc.perform(post("/emr")
                .with(user(createStaff()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Bạn chưa được gán vào phòng khám nào"));
    }

    // UTCID05 (A): Booking not in IN_PROGRESS
    @Test
    @DisplayName("POST /emr - UTCID05 - Booking not IN_PROGRESS - Returns 400")
    void createEmr_wrongBookingStatus_returns400() throws Exception {
        CreateEmrRequest request = createValidRequest();
        when(emrService.createEmr(any(), any()))
                .thenThrow(new com.petties.petties.exception.BadRequestException(
                        "Chỉ có thể thêm bệnh án khi lịch hẹn đang ở trạng thái 'Đang khám'"));

        mockMvc.perform(post("/emr")
                .with(user(createStaff()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // UTCID06 (A): Staff different clinic from booking
    @Test
    @DisplayName("POST /emr - UTCID06 - Different clinic booking - Returns 403")
    void createEmr_differentClinic_returns403() throws Exception {
        CreateEmrRequest request = createValidRequest();
        when(emrService.createEmr(any(), any()))
                .thenThrow(new com.petties.petties.exception.ForbiddenException(
                        "Bạn không có quyền thêm bệnh án cho lịch hẹn của phòng khám khác"));

        mockMvc.perform(post("/emr")
                .with(user(createStaff()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    // UTCID07 (A): Validation failure - Missing assessment
    @Test
    @DisplayName("POST /emr - UTCID07 - Missing assessment - Returns 400")
    void createEmr_missingAssessment_returns400() throws Exception {
        CreateEmrRequest request = createValidRequest();
        request.setAssessment(""); // Blank

        mockMvc.perform(post("/emr")
                .with(user(createStaff()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.assessment").exists());
    }

    // UTCID08 (A): Service Exception
    @Test
    @DisplayName("POST /emr - UTCID08 - Service error - Returns 500 with DEBUG")
    void createEmr_serviceError_returns500() throws Exception {
        when(emrService.createEmr(any(), any())).thenThrow(new RuntimeException("Database down"));

        mockMvc.perform(post("/emr")
                .with(user(createStaff()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createValidRequest())))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message")
                        .value(org.hamcrest.Matchers.containsString("RuntimeException: Database down")));
    }
}
