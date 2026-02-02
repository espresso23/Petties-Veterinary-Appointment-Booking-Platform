package com.petties.petties.service;

import com.petties.petties.dto.emr.CreateEmrRequest;
import com.petties.petties.dto.emr.EmrResponse;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.model.EmrRecord;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.EmrRecordRepository;
import com.petties.petties.repository.PetRepository;
import com.petties.petties.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("EmrService Unit Tests")
class EmrServiceUnitTest {

    @Mock
    private EmrRecordRepository emrRecordRepository;

    @Mock
    private PetRepository petRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private BookingRepository bookingRepository;

    @InjectMocks
    private EmrService emrService;

    @Test
    @DisplayName("Create EMR - Success")
    void createEmr_validData_success() {
        // Arrange
        UUID vetId = UUID.randomUUID();
        UUID petId = UUID.randomUUID();
        UUID bookingId = UUID.randomUUID();

        CreateEmrRequest request = new CreateEmrRequest();
        request.setPetId(petId);
        request.setBookingId(bookingId);
        request.setSubjective("S");
        request.setObjective("O");
        request.setAssessment("A");
        request.setPlan("P");

        User vet = new User();
        vet.setUserId(vetId);
        vet.setFullName("Dr. Vet");

        Pet pet = new Pet();
        pet.setId(petId);
        pet.setName("Pet Name");

        when(userRepository.findById(vetId)).thenReturn(Optional.of(vet));
        when(emrRecordRepository.existsByBookingId(bookingId)).thenReturn(false);
        when(petRepository.findById(petId)).thenReturn(Optional.of(pet));
        when(emrRecordRepository.save(any(EmrRecord.class))).thenAnswer(i -> {
            EmrRecord r = i.getArgument(0);
            r.setId(UUID.randomUUID().toString());
            r.setCreatedAt(LocalDateTime.now());
            return r;
        });

        // Act
        EmrResponse response = emrService.createEmr(request, vetId);

        // Assert
        assertNotNull(response);
        assertEquals("S", response.getSubjective());
        assertEquals("Dr. Vet", response.getStaffName());
        verify(emrRecordRepository).save(any(EmrRecord.class));
    }

    @Test
    @DisplayName("Update EMR - Not Owner - Throws Forbidden")
    void updateEmr_notOwner_throwsForbidden() {
        // Arrange
        String emrId = UUID.randomUUID().toString();
        UUID creatorId = UUID.randomUUID();
        UUID updaterId = UUID.randomUUID(); // Different vet

        EmrRecord emr = new EmrRecord();
        emr.setId(emrId);
        emr.setStaffId(creatorId);
        emr.setCreatedAt(LocalDateTime.now()); // Recent

        when(emrRecordRepository.findById(emrId)).thenReturn(Optional.of(emr));

        // Act & Assert
        assertThrows(ForbiddenException.class, () -> emrService.updateEmr(emrId, new CreateEmrRequest(), updaterId));
    }

    @Test
    @DisplayName("Update EMR - After 24h - Throws BadRequest")
    void updateEmr_after24h_throwsBadRequest() {
        // Arrange
        String emrId = UUID.randomUUID().toString();
        UUID vetId = UUID.randomUUID();

        EmrRecord emr = new EmrRecord();
        emr.setId(emrId);
        emr.setStaffId(vetId);
        emr.setCreatedAt(LocalDateTime.now().minusHours(25)); // Expired

        when(emrRecordRepository.findById(emrId)).thenReturn(Optional.of(emr));

        // Act & Assert
        assertThrows(BadRequestException.class, () -> emrService.updateEmr(emrId, new CreateEmrRequest(), vetId));
    }
}
