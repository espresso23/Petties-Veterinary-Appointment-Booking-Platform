package com.petties.petties.service;

import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.dto.pet.PetRequest;
import com.petties.petties.dto.pet.PetResponse;
import com.petties.petties.dto.pet.VetPatientDTO;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.EmrRecordRepository;
import com.petties.petties.repository.PetRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("PetService Unit Tests")
class PetServiceUnitTest {

    @Mock
    private PetRepository petRepository;

    @Mock
    private AuthService authService;

    @Mock
    private CloudinaryService cloudinaryService;

    @Mock
    private EmrRecordRepository emrRecordRepository;

    @Mock
    private BookingRepository bookingRepository;

    @InjectMocks
    private PetService petService;

    @Test
    @DisplayName("Create Pet - Valid - Success")
    void createPet_valid_success() {
        // Arrange
        PetRequest request = new PetRequest();
        request.setName("Buddy");
        request.setSpecies("DOG");

        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setUsername("owner");

        when(authService.getCurrentUser()).thenReturn(user);
        when(petRepository.save(any(Pet.class))).thenAnswer(i -> {
            Pet p = i.getArgument(0);
            p.setId(UUID.randomUUID());
            return p;
        });

        // Act
        PetResponse response = petService.createPet(request, null);

        // Assert
        assertNotNull(response);
        assertEquals("Buddy", response.getName());
        verify(petRepository).save(any(Pet.class));
    }

    @Test
    @DisplayName("Update Pet - Not Owner - Throws Forbidden")
    void updatePet_notOwner_throwsForbidden() {
        // Arrange
        UUID petId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(ownerId);

        User otherUser = new User();
        otherUser.setUserId(otherUserId);
        otherUser.setRole(Role.PET_OWNER);

        Pet pet = new Pet();
        pet.setId(petId);
        pet.setUser(owner);

        when(authService.getCurrentUser()).thenReturn(otherUser);
        when(petRepository.findById(petId)).thenReturn(Optional.of(pet));

        // Act & Assert
        assertThrows(ForbiddenException.class, () -> petService.updatePet(petId, new PetRequest(), null));
    }

    @Test
    @DisplayName("Get Patients For Vet - Returns Sorted and Mapped List")
    void getPatientsForVet_returnsSortedList() {
        // Arrange
        UUID clinicId = UUID.randomUUID();
        UUID vetId = UUID.randomUUID();

        // 1. Mock Booking for Vet (My Patient)
        Pet pet1 = new Pet();
        pet1.setId(UUID.randomUUID());
        pet1.setName("My Patient");

        Booking myBooking = new Booking();
        myBooking.setPet(pet1);
        myBooking.setAssignedVet(new User()); // Just needs object
        myBooking.getAssignedVet().setUserId(vetId);
        myBooking.setBookingDate(LocalDate.now());
        myBooking.setBookingTime(LocalTime.of(10, 0));
        myBooking.setStatus(com.petties.petties.model.enums.BookingStatus.ASSIGNED);

        when(bookingRepository.findByAssignedVetIdAndBookingDateBetweenAndStatusIn(
                eq(vetId), any(LocalDate.class), any(LocalDate.class), anyList()))
                .thenReturn(List.of(myBooking));

        // 2. Mock Clinic Booking (Clinic Patient)
        when(bookingRepository.findByClinicIdAndDate(eq(clinicId), any(LocalDate.class)))
                .thenReturn(Collections.emptyList());

        // 3. Mock Clinic EMRs
        when(emrRecordRepository.findByClinicIdOrderByExaminationDateDesc(clinicId))
                .thenReturn(Collections.emptyList());

        // Act
        List<VetPatientDTO> patients = petService.getPatientsForVet(clinicId, vetId);

        // Assert
        assertNotNull(patients);
        assertEquals(1, patients.size());
        assertEquals("My Patient", patients.get(0).getPetName());
        assertTrue(patients.get(0).isAssignedToMe());
    }
}
