package com.petties.petties.service;

import com.petties.petties.dto.vaccination.CreateVaccinationRequest;
import com.petties.petties.dto.vaccination.VaccinationResponse;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.VaccinationRecord;
import com.petties.petties.model.VaccineTemplate;
import com.petties.petties.model.enums.TargetSpecies;
import com.petties.petties.repository.PetRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.repository.VaccinationRecordRepository;
import com.petties.petties.repository.VaccineTemplateRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("VaccinationService Unit Tests")
class VaccinationServiceUnitTest {

    @Mock
    private VaccinationRecordRepository vaccinationRecordRepository;

    @Mock
    private PetRepository petRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private VaccineTemplateRepository vaccineTemplateRepository;

    @InjectMocks
    private VaccinationService vaccinationService;

    @Test
    @DisplayName("Create Vaccination - Valid Data - Success")
    void createVaccination_validData_success() {
        // Arrange
        UUID petId = UUID.randomUUID();
        UUID vetId = UUID.randomUUID();
        UUID templateId = UUID.randomUUID();

        CreateVaccinationRequest request = new CreateVaccinationRequest();
        request.setPetId(petId);
        request.setVaccineName("Rabies Vaccine");
        request.setVaccineTemplateId(templateId);
        request.setVaccinationDate(LocalDate.now());

        User vet = new User();
        vet.setUserId(vetId);
        vet.setFullName("Dr. Smith");
        Clinic clinic = new Clinic();
        clinic.setClinicId(UUID.randomUUID());
        clinic.setName("Pet Clinic");
        vet.setWorkingClinic(clinic);

        Pet pet = new Pet();
        pet.setId(petId);
        pet.setName("Buddy");

        VaccineTemplate template = new VaccineTemplate();
        template.setId(templateId);
        template.setName("Rabies Vaccine");
        template.setSeriesDoses(1);

        when(userRepository.findById(vetId)).thenReturn(Optional.of(vet));
        when(petRepository.findById(petId)).thenReturn(Optional.of(pet));
        when(vaccineTemplateRepository.findById(templateId)).thenReturn(Optional.of(template));
        when(vaccinationRecordRepository.findByPetIdOrderByVaccinationDateDesc(petId))
                .thenReturn(Collections.emptyList());
        when(vaccinationRecordRepository.save(any(VaccinationRecord.class))).thenAnswer(invocation -> {
            VaccinationRecord r = invocation.getArgument(0);
            r.setId(UUID.randomUUID().toString());
            return r;
        });

        // Act
        VaccinationResponse response = vaccinationService.createVaccination(request, vetId);

        // Assert
        assertNotNull(response);
        assertEquals("Rabies Vaccine", response.getVaccineName());
        assertEquals("COMPLETED", response.getStatus());
        verify(vaccinationRecordRepository, times(1)).save(any(VaccinationRecord.class));
    }

    @Test
    @DisplayName("Create Vaccination - Future Date - Throws Exception")
    void createVaccination_futureDate_throwsException() {
        // Arrange
        CreateVaccinationRequest request = new CreateVaccinationRequest();
        request.setPetId(UUID.randomUUID());
        request.setVaccinationDate(LocalDate.now().plusDays(1)); // Future date

        User vet = new User();
        when(userRepository.findById(any())).thenReturn(Optional.of(vet));
        when(petRepository.findById(any())).thenReturn(Optional.of(new Pet()));

        // Act & Assert
        assertThrows(IllegalArgumentException.class, () -> {
            vaccinationService.createVaccination(request, UUID.randomUUID());
        });
    }

    @Test
    @DisplayName("Get Upcoming Vaccinations - Predicts Next Dose")
    void getUpcomingVaccinations_returnsPredictedDoses() {
        // Arrange
        UUID petId = UUID.randomUUID();
        Pet pet = new Pet();
        pet.setId(petId);
        pet.setSpecies("DOG");

        VaccineTemplate template = new VaccineTemplate();
        template.setId(UUID.randomUUID());
        template.setName("DHPPi");
        template.setTargetSpecies(TargetSpecies.DOG);
        template.setSeriesDoses(3);
        template.setRepeatIntervalDays(21);

        VaccinationRecord historyRecord = new VaccinationRecord();
        historyRecord.setVaccineName("DHPPi");
        historyRecord.setDoseNumber(1);
        historyRecord.setStatus("COMPLETED");
        historyRecord.setVaccinationDate(LocalDate.now().minusDays(21));

        when(petRepository.findById(petId)).thenReturn(Optional.of(pet));
        when(vaccineTemplateRepository.findAll()).thenReturn(List.of(template));
        when(vaccinationRecordRepository.findByPetIdOrderByVaccinationDateDesc(petId))
                .thenReturn(List.of(historyRecord));

        // Act
        List<VaccinationResponse> upcoming = vaccinationService.getUpcomingVaccinations(petId);

        // Assert
        assertNotNull(upcoming);
        assertFalse(upcoming.isEmpty());
        assertEquals(2, upcoming.get(0).getDoseNumber()); // Should suggest Dose 2
        assertEquals("PLANNED", upcoming.get(0).getStatus());
    }
}
