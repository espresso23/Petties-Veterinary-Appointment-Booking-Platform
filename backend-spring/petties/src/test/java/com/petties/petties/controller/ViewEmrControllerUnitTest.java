package com.petties.petties.controller;

import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.emr.EmrResponse;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(EmrController.class)
@DisplayName("View Pet's Medical Record (EMR) - GET /emr/pet/{petId} - Unit Tests")
public class ViewEmrControllerUnitTest {

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

    private UserDetailsServiceImpl.UserPrincipal createPrincipal(Role role) {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setRole(role);
        return UserDetailsServiceImpl.UserPrincipal.create(user);
    }

    // UTCID01 (N, P): PET_OWNER views pet's EMR list
    @Test
    @DisplayName("GET /emr/pet/{petId} - UTCID01 - Authorized PET_OWNER - Returns 200 with list")
    void getEmrsByPetId_authorizedOwner_returns200() throws Exception {
        UUID petId = UUID.randomUUID();
        EmrResponse res1 = EmrResponse.builder().id("emr1").petName("Rex").build();
        EmrResponse res2 = EmrResponse.builder().id("emr2").petName("Rex").build();
        when(emrService.getEmrsByPetId(petId)).thenReturn(List.of(res1, res2));

        mockMvc.perform(get("/emr/pet/" + petId)
                .with(user(createPrincipal(Role.PET_OWNER)))
                .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value("emr1"))
                .andExpect(jsonPath("$[1].id").value("emr2"));
    }

    // UTCID02 (N, P): STAFF views pet's EMR list
    @Test
    @DisplayName("GET /emr/pet/{petId} - UTCID02 - Authorized STAFF - Returns 200")
    void getEmrsByPetId_authorizedStaff_returns200() throws Exception {
        UUID petId = UUID.randomUUID();
        when(emrService.getEmrsByPetId(petId)).thenReturn(List.of(new EmrResponse()));

        mockMvc.perform(get("/emr/pet/" + petId)
                .with(user(createPrincipal(Role.STAFF)))
                .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    // UTCID03 (B, P): Empty EMR list
    @Test
    @DisplayName("GET /emr/pet/{petId} - UTCID03 - No records found - Returns 200 with empty list")
    void getEmrsByPetId_emptyList_returns200() throws Exception {
        UUID petId = UUID.randomUUID();
        when(emrService.getEmrsByPetId(petId)).thenReturn(List.of());

        mockMvc.perform(get("/emr/pet/" + petId)
                .with(user(createPrincipal(Role.PET_OWNER)))
                .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    // UTCID04 (A, P): Unauthenticated
    @Test
    @DisplayName("GET /emr/pet/{petId} - UTCID04 - Unauthenticated - Returns 401")
    void getEmrsByPetId_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/emr/pet/" + UUID.randomUUID())
                .with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    // UTCID05 (A, F): Service exception (Defect 008)
    @Test
    @DisplayName("GET /emr/pet/{petId} - UTCID05 - Service exception - 500 lacks detail [F - DEFECT-008]")
    void getEmrsByPetId_serviceException_errorBodyLacksDetail() throws Exception {
        UUID petId = UUID.randomUUID();
        when(emrService.getEmrsByPetId(petId)).thenThrow(new RuntimeException("Fetch failed"));

        mockMvc.perform(get("/emr/pet/" + petId)
                .with(user(createPrincipal(Role.PET_OWNER)))
                .with(csrf()))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message",
                        org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("Fetch failed"))));
    }
}
