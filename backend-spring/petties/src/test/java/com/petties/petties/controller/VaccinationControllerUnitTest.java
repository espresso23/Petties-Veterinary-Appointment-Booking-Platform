package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.dto.vaccination.CreateVaccinationRequest;
import com.petties.petties.dto.vaccination.VaccinationResponse;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.service.VaccinationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(VaccinationController.class)
@DisplayName("VaccinationController Unit Tests")
class VaccinationControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private VaccinationService vaccinationService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private BlacklistedTokenRepository blacklistedTokenRepository;

    @MockitoBean
    private UserDetailsServiceImpl userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    // Helper to create a UserPrincipal similar to actual auth
    private UserDetailsServiceImpl.UserPrincipal createMockPrincipal() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setUsername("testvet");
        user.setEmail("testvet@example.com");
        user.setRole(Role.VET);
        return UserDetailsServiceImpl.UserPrincipal.create(user);
    }

    @Test
    @DisplayName("POST /vaccinations - Create vaccination with valid data")
    void createVaccination_validData_returns200() throws Exception {
        // Arrange
        CreateVaccinationRequest request = new CreateVaccinationRequest();
        request.setPetId(UUID.randomUUID());
        request.setVaccineTemplateId(UUID.randomUUID());
        request.setVaccineName("Rabies");
        request.setVaccinationDate(LocalDate.of(2026, 1, 29));
        request.setNextDueDate(LocalDate.of(2027, 1, 29));
        request.setDoseSequence("1");
        request.setNotes("Test Notes");

        VaccinationResponse mockResponse = new VaccinationResponse();
        mockResponse.setId(UUID.randomUUID().toString());
        // mockResponse.setPetName("Buddy"); // Removed as per DTO definition check

        when(vaccinationService.createVaccination(any(CreateVaccinationRequest.class), any(UUID.class)))
                .thenReturn(mockResponse);

        UserDetailsServiceImpl.UserPrincipal principal = createMockPrincipal();

        // Act & Assert
        mockMvc.perform(post("/vaccinations")
                .with(user(principal))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").exists());
    }

    @Test
    @DisplayName("GET /vaccinations/pet/{petId} - Get vaccinations by pet")
    @WithMockUser(username = "owner", roles = "PET_OWNER")
    void getVaccinationsByPet_validId_returns200() throws Exception {
        // Arrange
        UUID petId = UUID.randomUUID();
        VaccinationResponse res1 = new VaccinationResponse();
        res1.setId(UUID.randomUUID().toString());

        when(vaccinationService.getVaccinationsByPet(petId)).thenReturn(List.of(res1));

        // Act & Assert
        mockMvc.perform(get("/vaccinations/pet/{petId}", petId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").exists());
    }

    @Test
    @DisplayName("GET /vaccinations/pet/{petId}/upcoming - Get upcoming vaccinations")
    @WithMockUser(username = "owner", roles = "PET_OWNER")
    void getUpcomingVaccinations_validId_returns200() throws Exception {
        // Arrange
        UUID petId = UUID.randomUUID();
        VaccinationResponse res1 = new VaccinationResponse();
        res1.setId(UUID.randomUUID().toString());

        when(vaccinationService.getUpcomingVaccinations(petId)).thenReturn(List.of(res1));

        // Act & Assert
        mockMvc.perform(get("/vaccinations/pet/{petId}/upcoming", petId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").exists());
    }

    @Test
    @DisplayName("DELETE /vaccinations/{id} - Delete vaccination")
    @WithMockUser(username = "admin", roles = "ADMIN")
    void deleteVaccination_validId_returns204() throws Exception {
        // Arrange
        String vacId = UUID.randomUUID().toString();
        doNothing().when(vaccinationService).deleteVaccination(vacId);

        // Act & Assert
        mockMvc.perform(delete("/vaccinations/{id}", vacId)
                .with(csrf()))
                .andExpect(status().isNoContent());
    }
}
