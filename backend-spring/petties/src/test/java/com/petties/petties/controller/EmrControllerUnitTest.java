package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.emr.CreateEmrRequest;
import com.petties.petties.dto.emr.EmrResponse;
import com.petties.petties.model.User;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.CloudinaryService;
import com.petties.petties.service.EmrService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(EmrController.class)
@DisplayName("EmrController Unit Tests")
class EmrControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

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

        @Autowired
        private ObjectMapper objectMapper;

        @Test
        @DisplayName("POST /emr - Create EMR as VET returns 200")
        @WithMockUser(username = "vet", roles = "VET")
        void createEmr_asVet_returns200() throws Exception {
                // Arrange
                CreateEmrRequest request = new CreateEmrRequest();
                request.setPetId(UUID.randomUUID());
                request.setSubjective("Test subjective");
                request.setObjective("Test objective");
                request.setAssessment("Test assessment");
                request.setPlan("Test plan");
                request.setTemperatureC(new BigDecimal("38.5"));
                request.setWeightKg(new BigDecimal("10.5"));

                User vetUser = new User();
                vetUser.setUserId(UUID.randomUUID());

                EmrResponse response = new EmrResponse();
                response.setId(UUID.randomUUID().toString());
                response.setVetName("Dr. Vet");

                when(authService.getCurrentUser()).thenReturn(vetUser);
                when(emrService.createEmr(any(CreateEmrRequest.class), eq(vetUser.getUserId()))).thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/emr")
                                .with(csrf()) // Handled by SecurityConfig but good to be explicit
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.id").exists());
        }

        @Test
        @DisplayName("PUT /emr/{id} - Update EMR as VET returns 200")
        @WithMockUser(username = "vet", roles = "VET")
        void updateEmr_asVet_returns200() throws Exception {
                // Arrange
                String emrId = UUID.randomUUID().toString();
                CreateEmrRequest request = new CreateEmrRequest();
                request.setPetId(UUID.randomUUID());
                request.setSubjective("Updated subjective");
                request.setAssessment("Updated assessment");
                request.setPlan("Updated plan");

                User vetUser = new User();
                vetUser.setUserId(UUID.randomUUID());

                EmrResponse response = new EmrResponse();
                response.setId(emrId);
                response.setSubjective("Updated subjective");

                when(authService.getCurrentUser()).thenReturn(vetUser);
                when(emrService.updateEmr(eq(emrId), any(CreateEmrRequest.class), eq(vetUser.getUserId())))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(put("/emr/{id}", emrId)
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.subjective").value("Updated subjective"));
        }

        @Test
        @DisplayName("GET /emr/pet/{petId} - Get EMRs by Pet returns 200")
        @WithMockUser(username = "owner", roles = "PET_OWNER")
        void getEmrsByPetId_validId_returns200() throws Exception {
                // Arrange
                UUID petId = UUID.randomUUID();
                EmrResponse res = new EmrResponse();
                res.setId(UUID.randomUUID().toString());

                when(emrService.getEmrsByPetId(petId)).thenReturn(List.of(res));

                // Act & Assert
                mockMvc.perform(get("/emr/pet/{petId}", petId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$[0].id").exists());
        }

        @Test
        @DisplayName("GET /emr/booking/{bookingId} - Get EMR by Booking returns 200")
        @WithMockUser(username = "vet", roles = "VET")
        void getEmrByBookingId_validId_returns200() throws Exception {
                // Arrange
                UUID bookingId = UUID.randomUUID();
                EmrResponse res = new EmrResponse();
                res.setId(UUID.randomUUID().toString());

                when(emrService.getEmrByBookingId(bookingId)).thenReturn(res);

                // Act & Assert
                mockMvc.perform(get("/emr/booking/{bookingId}", bookingId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.id").exists());
        }
}
