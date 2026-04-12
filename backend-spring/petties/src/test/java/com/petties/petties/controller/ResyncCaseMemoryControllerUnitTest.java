package com.petties.petties.controller;

import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.emr.CaseMemoryResyncResponse;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.CloudinaryService;
import com.petties.petties.service.EmrService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(EmrController.class)
@org.springframework.context.annotation.Import(com.petties.petties.config.SecurityConfig.class)
@org.springframework.test.context.ActiveProfiles({ "test", "dev" })
@DisplayName("Resync Case Memory - POST /emr/admin/case-memory/resync - Unit Tests")
class ResyncCaseMemoryControllerUnitTest {

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

    private UserDetailsServiceImpl.UserPrincipal createAdmin() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setRole(Role.ADMIN);
        return UserDetailsServiceImpl.UserPrincipal.create(user);
    }

    private UserDetailsServiceImpl.UserPrincipal createStaff() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setRole(Role.STAFF);
        return UserDetailsServiceImpl.UserPrincipal.create(user);
    }

    @Test
    @DisplayName("POST /emr/admin/case-memory/resync - Admin triggers resync - Returns 200")
    void resyncCaseMemory_admin_returns200() throws Exception {
        when(emrService.resyncConfirmedCaseMemory(eq(50))).thenReturn(
                CaseMemoryResyncResponse.builder()
                        .success(true)
                        .totalEligible(120)
                        .processedCount(50)
                        .syncedCount(50)
                        .failedCount(0)
                        .message("Đã đồng bộ 50/50 bệnh án đủ điều kiện vào Case Memory")
                        .build());

        mockMvc.perform(post("/emr/admin/case-memory/resync")
                        .with(user(createAdmin()))
                        .with(csrf())
                        .queryParam("limit", "50")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.processedCount").value(50));
    }

    @Test
    @DisplayName("POST /emr/admin/case-memory/resync - Staff forbidden - Returns 403")
    void resyncCaseMemory_staff_returns403() throws Exception {
        mockMvc.perform(post("/emr/admin/case-memory/resync")
                        .with(user(createStaff()))
                        .with(csrf())
                        .queryParam("limit", "50")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }
}
