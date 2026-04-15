package com.petties.petties.controller;

import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.clinic.ClinicResponse;
import com.petties.petties.model.User;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.SandboxService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SandboxController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("SandboxController Unit Tests")
class SandboxControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SandboxService sandboxService;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockitoBean
    private UserDetailsServiceImpl userDetailsService;

    @MockitoBean
    private BlacklistedTokenRepository blacklistedTokenRepository;

    @Test
    @DisplayName("POST /sandbox/enter - enter sandbox mode thành công")
    void enterSandboxMode_validFeature_returns200() throws Exception {
        UUID userId = UUID.randomUUID();

        User currentUser = new User();
        currentUser.setUserId(userId);
        currentUser.setFullName("Clinic Owner A");

        ClinicResponse response = ClinicResponse.builder()
                .clinicId(UUID.randomUUID())
                .name("Sandbox - clinic_info (Clinic Owner A)")
                .build();

        when(authService.getCurrentUser()).thenReturn(currentUser);
        when(sandboxService.enterSandboxMode("clinic_info", userId)).thenReturn(response);

        mockMvc.perform(post("/sandbox/enter").param("feature", "clinic_info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", containsString("Sandbox - clinic_info")));
    }

    @Test
    @DisplayName("GET /sandbox/current - có sandbox active trả về 200")
    void getCurrentSandbox_found_returns200() throws Exception {
        UUID userId = UUID.randomUUID();

        User currentUser = new User();
        currentUser.setUserId(userId);

        ClinicResponse response = ClinicResponse.builder()
                .clinicId(UUID.randomUUID())
                .name("Sandbox - services (Clinic Owner A)")
                .build();

        when(authService.getCurrentUser()).thenReturn(currentUser);
        when(sandboxService.getCurrentSandbox(userId)).thenReturn(response);

        mockMvc.perform(get("/sandbox/current"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", containsString("Sandbox - services")));
    }

    @Test
    @DisplayName("GET /sandbox/current - không có sandbox active trả về 404")
    void getCurrentSandbox_notFound_returns404() throws Exception {
        UUID userId = UUID.randomUUID();

        User currentUser = new User();
        currentUser.setUserId(userId);

        when(authService.getCurrentUser()).thenReturn(currentUser);
        when(sandboxService.getCurrentSandbox(userId)).thenReturn(null);

        mockMvc.perform(get("/sandbox/current"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("DELETE /sandbox/exit/{clinicId} - xóa sandbox thành công trả về 204")
    void exitSandboxMode_validRequest_returns204() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID clinicId = UUID.randomUUID();

        User currentUser = new User();
        currentUser.setUserId(userId);
        currentUser.setFullName("Clinic Manager A");

        when(authService.getCurrentUser()).thenReturn(currentUser);
        doNothing().when(sandboxService).exitSandboxMode(clinicId, userId);

        mockMvc.perform(delete("/sandbox/exit/{clinicId}", clinicId))
                .andExpect(status().isNoContent());

        verify(sandboxService).exitSandboxMode(clinicId, userId);
    }
}
