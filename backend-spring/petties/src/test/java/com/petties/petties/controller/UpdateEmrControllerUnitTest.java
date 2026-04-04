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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(EmrController.class)
@org.springframework.context.annotation.Import(com.petties.petties.config.SecurityConfig.class)
@org.springframework.test.context.ActiveProfiles({ "test", "dev" })
@DisplayName("Update Pet's Medical Record - PUT /emr/{emrId} - Unit Tests")
public class UpdateEmrControllerUnitTest {

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
                                .assessment("Initial Assessment")
                                .plan("Initial Plan")
                                .build();
        }

        // UTCID01 (N): Valid update by creator within 24h
        @Test
        @DisplayName("PUT /emr/{emrId} - UTCID01 - Valid update - Returns 200")
        void updateEmr_valid_returns200() throws Exception {
                String emrId = UUID.randomUUID().toString();
                CreateEmrRequest request = createValidRequest();

                EmrResponse response = EmrResponse.builder().id(emrId).assessment("Updated Assessment").build();
                when(emrService.updateEmr(eq(emrId), any(CreateEmrRequest.class), any())).thenReturn(response);

                mockMvc.perform(put("/emr/" + emrId)
                                .with(user(createStaff()))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.id").value(emrId));
        }

        // UTCID02 (A): Unauthenticated
        @Test
        @DisplayName("PUT /emr/{emrId} - UTCID02 - Unauthenticated - Returns 401")
        void updateEmr_unauthenticated_returns401() throws Exception {
                mockMvc.perform(put("/emr/" + UUID.randomUUID())
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                                .andExpect(status().isUnauthorized());
        }

        // UTCID03 (A): Unauthorized Role (PET_OWNER)
        @Test
        @DisplayName("PUT /emr/{emrId} - UTCID03 - PET_OWNER - Returns 403")
        void updateEmr_petOwner_returns403() throws Exception {
                mockMvc.perform(put("/emr/" + UUID.randomUUID())
                                .with(user(createPetOwner()))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(createValidRequest())))
                                .andExpect(status().isForbidden());
        }

        // UTCID04 (A): Service exception (Defect 009 Fixed)
        @Test
        @DisplayName("PUT /emr/{emrId} - UTCID04 - Service exception - Returns 500 with detail")
        void updateEmr_serviceException_returns500WithDetail() throws Exception {
                String emrId = UUID.randomUUID().toString();
                when(emrService.updateEmr(eq(emrId), any(), any())).thenThrow(new RuntimeException("Update failed"));

                mockMvc.perform(put("/emr/" + emrId)
                                .with(user(createStaff()))
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(createValidRequest())))
                                .andExpect(status().isInternalServerError())
                                .andExpect(jsonPath("$.message",
                                                org.hamcrest.Matchers
                                                                .containsString("RuntimeException: Update failed")));
        }

        // UTCID05 (A): Not Found
        @Test
        @DisplayName("PUT /emr/{emrId} - UTCID05 - EMR not found - Returns 404")
        void updateEmr_notFound_returns404() throws Exception {
                String emrId = "non-existent-id";
                CreateEmrRequest request = createValidRequest();

                when(emrService.updateEmr(eq(emrId), any(), any()))
                                .thenThrow(new com.petties.petties.exception.ResourceNotFoundException(
                                                "EMR not found"));

                mockMvc.perform(put("/emr/" + emrId)
                                .with(csrf())
                                .with(user(createStaff()))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isNotFound());
        }

        // UTCID06 (A): Ownership Violation (Rule 1)
        @Test
        @DisplayName("PUT /emr/{emrId} - UTCID06 - Different staff trying to edit - Returns 403")
        void updateEmr_otherStaff_returns403() throws Exception {
                String emrId = UUID.randomUUID().toString();
                CreateEmrRequest request = createValidRequest();

                when(emrService.updateEmr(eq(emrId), any(), any()))
                                .thenThrow(new com.petties.petties.exception.ForbiddenException(
                                                "Chỉ người tạo mới được sửa"));

                mockMvc.perform(put("/emr/" + emrId)
                                .with(csrf())
                                .with(user(createStaff()))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isForbidden());
        }

        // UTCID07 (A): Time Limit Violation (Rule 2)
        @Test
        @DisplayName("PUT /emr/{emrId} - UTCID07 - Edit after 24 hours - Returns 400")
        void updateEmr_after24h_returns400() throws Exception {
                String emrId = UUID.randomUUID().toString();
                CreateEmrRequest request = createValidRequest();

                when(emrService.updateEmr(eq(emrId), any(), any()))
                                .thenThrow(new com.petties.petties.exception.BadRequestException("Bệnh án đã quá 24h"));

                mockMvc.perform(put("/emr/" + emrId)
                                .with(csrf())
                                .with(user(createStaff()))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());
        }

        // UTCID08 (A): Validation Error - Missing Assessment
        @Test
        @DisplayName("PUT /emr/{emrId} - UTCID08 - Missing Assessment - Returns 400")
        void updateEmr_missingAssessment_returns400() throws Exception {
                String emrId = UUID.randomUUID().toString();
                CreateEmrRequest request = createValidRequest();
                request.setAssessment(""); // Required

                mockMvc.perform(put("/emr/" + emrId)
                                .with(csrf())
                                .with(user(createStaff()))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.errors.assessment").exists());
        }
}
