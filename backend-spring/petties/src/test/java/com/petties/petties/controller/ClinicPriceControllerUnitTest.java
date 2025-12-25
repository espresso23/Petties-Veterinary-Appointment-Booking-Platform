package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.clinic.ClinicPriceRequest;
import com.petties.petties.service.AuthService;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.ClinicPriceService;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ClinicPriceController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ClinicPriceController Unit Tests")
public class ClinicPriceControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ClinicPriceService clinicPriceService;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private ClinicRepository clinicRepository;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private UserDetailsServiceImpl userDetailsServiceImpl;

    @MockitoBean
    private BlacklistedTokenRepository blacklistedTokenRepository;

    private UUID clinicId;
    private User mockUser;

    @BeforeEach
    void setUp() {
        clinicId = UUID.randomUUID();
        mockUser = new User();
        mockUser.setUserId(UUID.randomUUID());
    }

    @Test
    @DisplayName("TC-PRICE-001: Success - update price per km")
    void updatePricePerKm_success_returns200() throws Exception {
        when(authService.getCurrentUser()).thenReturn(mockUser);
        when(clinicRepository.existsByClinicIdAndOwnerUserId(eq(clinicId), eq(mockUser.getUserId()))).thenReturn(true);
        when(clinicPriceService.upsertPricePerKm(eq(clinicId), any(BigDecimal.class))).thenReturn(new BigDecimal("5000"));

        ClinicPriceRequest req = new ClinicPriceRequest();
        req.setPricePerKm(new BigDecimal("5000"));

        mockMvc.perform(patch("/clinics/{id}/price-per-km", clinicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clinicId").value(clinicId.toString()))
                .andExpect(jsonPath("$.pricePerKm").value(5000));
    }

    @Test
    @DisplayName("TC-PRICE-002: Forbidden - not owner")
    void updatePricePerKm_forbidden_returns403() throws Exception {
        when(authService.getCurrentUser()).thenReturn(mockUser);
        when(clinicRepository.existsByClinicIdAndOwnerUserId(eq(clinicId), eq(mockUser.getUserId()))).thenReturn(false);

        ClinicPriceRequest req = new ClinicPriceRequest();
        req.setPricePerKm(new BigDecimal("1000"));

        mockMvc.perform(patch("/clinics/{id}/price-per-km", clinicId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("TC-PRICE-003: Bad Request - empty body")
    void updatePricePerKm_emptyBody_returns400() throws Exception {
        when(authService.getCurrentUser()).thenReturn(mockUser);
        when(clinicRepository.existsByClinicIdAndOwnerUserId(eq(clinicId), eq(mockUser.getUserId()))).thenReturn(true);

        mockMvc.perform(patch("/clinics/{id}/price-per-km", clinicId)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-PRICE-004: Delete price per km - success")
    void deletePricePerKm_success_returns200() throws Exception {
        when(authService.getCurrentUser()).thenReturn(mockUser);
        when(clinicRepository.existsByClinicIdAndOwnerUserId(eq(clinicId), eq(mockUser.getUserId()))).thenReturn(true);
        doReturn(null).when(clinicPriceService).upsertPricePerKm(eq(clinicId), isNull());

        mockMvc.perform(delete("/clinics/{id}/price-per-km", clinicId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Price per km removed"));

        verify(clinicPriceService, times(1)).upsertPricePerKm(eq(clinicId), isNull());
    }
}
