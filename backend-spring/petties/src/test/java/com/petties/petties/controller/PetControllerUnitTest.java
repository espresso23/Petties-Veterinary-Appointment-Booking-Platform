package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.pet.PetRequest;
import com.petties.petties.dto.pet.PetResponse;
import com.petties.petties.service.PetService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.repository.BlacklistedTokenRepository;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PetController.class)
@DisplayName("PetController Unit Tests")
class PetControllerUnitTest {

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

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("GET /pets - Get all pets returns 200")
    @WithMockUser(username = "admin", roles = "ADMIN")
    void getPets_returns200() throws Exception {
        // Arrange
        PetResponse pet = new PetResponse();
        pet.setId(UUID.randomUUID());
        pet.setName("Kiki");
        Page<PetResponse> page = new PageImpl<>(List.of(pet));

        when(petService.getPets(any(), any(), any(Pageable.class))).thenReturn(page);

        // Act & Assert
        mockMvc.perform(get("/pets"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("Kiki"));
    }

    @Test
    @DisplayName("GET /pets/me - Get my pets returns 200")
    @WithMockUser(username = "owner", roles = "PET_OWNER")
    void getMyPets_returns200() throws Exception {
        // Arrange
        PetResponse pet = new PetResponse();
        pet.setId(UUID.randomUUID());
        pet.setName("Lulu");

        when(petService.getMyPets()).thenReturn(List.of(pet));

        // Act & Assert
        mockMvc.perform(get("/pets/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Lulu"));
    }

    @Test
    @DisplayName("GET /pets/{id} - Get pet by ID returns 200")
    @WithMockUser(username = "owner", roles = "PET_OWNER")
    void getPet_validId_returns200() throws Exception {
        // Arrange
        UUID id = UUID.randomUUID();
        PetResponse pet = new PetResponse();
        pet.setId(id);

        when(petService.getPet(id)).thenReturn(pet);

        // Act & Assert
        mockMvc.perform(get("/pets/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").exists());
    }

    @Test
    @DisplayName("POST /pets - Create pet with image returns 200")
    @WithMockUser(username = "owner", roles = "PET_OWNER")
    void createPet_withImage_returns200() throws Exception {
        // Arrange
        MockMultipartFile image = new MockMultipartFile("image", "test.jpg", "image/jpeg", "content".getBytes());

        PetResponse response = new PetResponse();
        response.setId(UUID.randomUUID());
        response.setName("NewPet");

        when(petService.createPet(any(PetRequest.class), any())).thenReturn(response);

        // Act & Assert
        mockMvc.perform(multipart("/pets")
                .file(image)
                .param("name", "NewPet")
                .param("species", "DOG")
                .param("breed", "Poodle")
                .param("dateOfBirth", "2024-01-01")
                .param("weight", "5.0")
                .param("gender", "MALE")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("NewPet"));
    }

    @Test
    @DisplayName("DELETE /pets/{id} - Delete pet returns 204")
    @WithMockUser(username = "owner", roles = "PET_OWNER")
    void deletePet_validId_returns204() throws Exception {
        // Arrange
        UUID id = UUID.randomUUID();
        doNothing().when(petService).deletePet(id);

        // Act & Assert
        mockMvc.perform(delete("/pets/{id}", id)
                .with(csrf()))
                .andExpect(status().isNoContent());
    }
}
