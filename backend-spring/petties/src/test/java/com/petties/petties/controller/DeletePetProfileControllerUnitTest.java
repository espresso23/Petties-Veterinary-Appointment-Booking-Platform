package com.petties.petties.controller;

import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.PetService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PetController.class)
@org.springframework.test.context.ActiveProfiles({ "test", "dev" })
@DisplayName("Delete Pet Profile - DELETE /pets/{id} - Unit Tests")
public class DeletePetProfileControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PetService petService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private BlacklistedTokenRepository blacklistedTokenRepository;

    @MockitoBean
    private UserDetailsServiceImpl userDetailsService;

    private UserDetailsServiceImpl.UserPrincipal createOwner() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setRole(Role.PET_OWNER);
        return UserDetailsServiceImpl.UserPrincipal.create(user);
    }

    // UTCID01 (N, P): Valid delete
    @Test
    @DisplayName("DELETE /pets/{id} - UTCID01 - Authorized owner deletes existing pet - Returns 204")
    void deletePet_authorized_returns204() throws Exception {
        UUID petId = UUID.randomUUID();
        mockMvc.perform(delete("/pets/" + petId)
                .with(csrf())
                .with(user(createOwner())))
                .andExpect(status().isNoContent());
    }

    // UTCID02 (A, P): Unauthenticated
    @Test
    @DisplayName("DELETE /pets/{id} - UTCID02 - Unauthenticated - Returns 401")
    void deletePet_unauthenticated_returns401() throws Exception {
        mockMvc.perform(delete("/pets/" + UUID.randomUUID())
                .with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    // UTCID03 (A, P): Non-existent ID
    @Test
    @DisplayName("DELETE /pets/{id} - UTCID03 - Pet not found - Returns 404")
    void deletePet_notFound_returns404() throws Exception {
        UUID petId = UUID.randomUUID();
        doThrow(new ResourceNotFoundException("Pet not found")).when(petService).deletePet(petId);

        mockMvc.perform(delete("/pets/" + petId)
                .with(csrf())
                .with(user(createOwner())))
                .andExpect(status().isNotFound());
    }

    // UTCID04 (A, F): Service exception (Defect 007)
    @Test
    @DisplayName("DELETE /pets/{id} - UTCID04 - Database failure - 500 lacks detail [F - DEFECT-007]")
    void deletePet_serviceException_errorBodyLacksDetail() throws Exception {
        UUID petId = UUID.randomUUID();
        doThrow(new RuntimeException("Database error during delete")).when(petService).deletePet(petId);

        mockMvc.perform(delete("/pets/" + petId)
                .with(csrf())
                .with(user(createOwner())))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message",
                        org.hamcrest.Matchers.containsString("RuntimeException: Database error during delete")));
    }
}
