package com.petties.petties.service;

import com.petties.petties.model.VaccineTemplate;
import com.petties.petties.model.enums.TargetSpecies;
import com.petties.petties.repository.VaccineTemplateRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("VaccineTemplateService Unit Tests")
class VaccineTemplateServiceUnitTest {

    @Mock
    private VaccineTemplateRepository vaccineTemplateRepository;

    @InjectMocks
    private VaccineTemplateService vaccineTemplateService;

    @Test
    @DisplayName("Get All Templates - Returns List")
    void getAllTemplates_returnsList() {
        // Arrange
        VaccineTemplate t1 = new VaccineTemplate();
        t1.setName("Vaccine 1");
        when(vaccineTemplateRepository.findAll()).thenReturn(List.of(t1));

        // Act
        List<VaccineTemplate> result = vaccineTemplateService.getAllTemplates();

        // Assert
        assertNotNull(result);
        assertEquals(1, result.size());
    }

    @Test
    @DisplayName("Create Template - Success")
    void createTemplate_success() {
        // Arrange
        VaccineTemplate input = new VaccineTemplate();
        input.setName("New Vaccine");
        input.setTargetSpecies(TargetSpecies.CAT);

        when(vaccineTemplateRepository.save(any(VaccineTemplate.class))).thenAnswer(i -> {
            VaccineTemplate t = i.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        // Act
        VaccineTemplate result = vaccineTemplateService.createTemplate(input);

        // Assert
        assertNotNull(result);
        assertNotNull(result.getId());
        assertEquals("New Vaccine", result.getName());
        assertEquals(TargetSpecies.CAT, result.getTargetSpecies());
    }

    @Test
    @DisplayName("Get Template By Id - Found")
    void getTemplateById_found_returnsTemplate() {
        // Arrange
        UUID id = UUID.randomUUID();
        VaccineTemplate t = new VaccineTemplate();
        t.setId(id);
        when(vaccineTemplateRepository.findById(id)).thenReturn(Optional.of(t));

        // Act
        VaccineTemplate result = vaccineTemplateService.getTemplateById(id);

        // Assert
        assertNotNull(result);
        assertEquals(id, result.getId());
    }

    @Test
    @DisplayName("Get Template By Id - Not Found - Throws Exception")
    void getTemplateById_notFound_throwsException() {
        // Arrange
        UUID id = UUID.randomUUID();
        when(vaccineTemplateRepository.findById(id)).thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(RuntimeException.class, () -> vaccineTemplateService.getTemplateById(id));
    }
}
