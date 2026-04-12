package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.model.VaccineTemplate;
import com.petties.petties.model.enums.TargetSpecies;
import com.petties.petties.service.VaccineTemplateService;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(VaccineTemplateController.class)
@DisplayName("VaccineTemplateController Unit Tests")
class VaccineTemplateControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private VaccineTemplateService vaccineTemplateService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private BlacklistedTokenRepository blacklistedTokenRepository;

    @MockitoBean
    private UserDetailsServiceImpl userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("GET /vaccine-templates - Get all templates returns 200")
    @WithMockUser(username = "admin", roles = "ADMIN")
    void getAllTemplates_returns200() throws Exception {
        // Arrange
        VaccineTemplate template = new VaccineTemplate();
        template.setId(UUID.randomUUID());
        template.setName("Rabies");
        template.setTargetSpecies(TargetSpecies.DOG);

        when(vaccineTemplateService.getAllTemplates()).thenReturn(List.of(template));

        // Act & Assert
        mockMvc.perform(get("/vaccine-templates"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Rabies"));
    }

    @Test
    @DisplayName("GET /vaccine-templates/{id} - Get by ID returns 200")
    @WithMockUser(username = "admin", roles = "ADMIN")
    void getTemplateById_validId_returns200() throws Exception {
        // Arrange
        UUID id = UUID.randomUUID();
        VaccineTemplate template = new VaccineTemplate();
        template.setId(id);
        template.setName("Distemper");

        when(vaccineTemplateService.getTemplateById(id)).thenReturn(template);

        // Act & Assert
        mockMvc.perform(get("/vaccine-templates/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Distemper"));
    }

    @Test
    @DisplayName("POST /vaccine-templates - Create template returns 200")
    @WithMockUser(username = "admin", roles = "ADMIN")
    void createTemplate_validData_returns200() throws Exception {
        // Arrange
        VaccineTemplate request = new VaccineTemplate();
        request.setName("New Vaccine");
        request.setTargetSpecies(TargetSpecies.CAT);

        VaccineTemplate response = new VaccineTemplate();
        response.setId(UUID.randomUUID());
        response.setName("New Vaccine");

        when(vaccineTemplateService.createTemplate(any(VaccineTemplate.class))).thenReturn(response);

        // Act & Assert
        mockMvc.perform(post("/vaccine-templates")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("New Vaccine"));
    }
}
