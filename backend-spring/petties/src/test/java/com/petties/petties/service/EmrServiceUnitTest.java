package com.petties.petties.service;

import com.petties.petties.dto.emr.CreateEmrRequest;
import com.petties.petties.dto.emr.EmrResponse;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.model.Clinic;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    @Mock
    private AiCaseMemorySyncService aiCaseMemorySyncService;

    @InjectMocks
    private EmrService emrService;

    @Test
    @DisplayName("Create EMR - Success")
    void createEmr_validData_success() {
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

        Clinic clinic = new Clinic();
        clinic.setClinicId(UUID.randomUUID());
        clinic.setName("Test Clinic");

        User vet = new User();
        vet.setUserId(vetId);
        vet.setFullName("Dr. Vet");
        vet.setWorkingClinic(clinic);

        Pet pet = new Pet();
        pet.setId(petId);
        pet.setName("Pet Name");

        com.petties.petties.model.Booking booking = new com.petties.petties.model.Booking();
        booking.setBookingId(bookingId);
        booking.setStatus(com.petties.petties.model.enums.BookingStatus.IN_PROGRESS);
        booking.setClinic(clinic);

        when(userRepository.findById(vetId)).thenReturn(Optional.of(vet));
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(petRepository.findById(petId)).thenReturn(Optional.of(pet));
        when(emrRecordRepository.save(any(EmrRecord.class))).thenAnswer(invocation -> {
            EmrRecord emr = invocation.getArgument(0);
            emr.setId(UUID.randomUUID().toString());
            emr.setCreatedAt(LocalDateTime.now());
            return emr;
        });

        EmrResponse response = emrService.createEmr(request, vetId);

        assertNotNull(response);
        assertEquals("S", response.getSubjective());
        assertEquals("Dr. Vet", response.getStaffName());
        verify(emrRecordRepository).save(any(EmrRecord.class));
        verify(aiCaseMemorySyncService).syncConfirmedEmr(any());
    }

    @Test
    @DisplayName("Create EMR - Khong goi AI sync neu chua co chan doan cuoi")
    void createEmr_withoutAssessment_doesNotTriggerAiSync() {
        UUID vetId = UUID.randomUUID();
        UUID petId = UUID.randomUUID();
        UUID bookingId = UUID.randomUUID();

        CreateEmrRequest request = new CreateEmrRequest();
        request.setPetId(petId);
        request.setBookingId(bookingId);
        request.setSubjective("S");
        request.setObjective("O");
        request.setPlan("P");

        Clinic clinic = new Clinic();
        clinic.setClinicId(UUID.randomUUID());
        clinic.setName("Test Clinic");

        User vet = new User();
        vet.setUserId(vetId);
        vet.setFullName("Dr. Vet");
        vet.setWorkingClinic(clinic);

        Pet pet = new Pet();
        pet.setId(petId);
        pet.setName("Pet Name");

        com.petties.petties.model.Booking booking = new com.petties.petties.model.Booking();
        booking.setBookingId(bookingId);
        booking.setStatus(com.petties.petties.model.enums.BookingStatus.IN_PROGRESS);
        booking.setClinic(clinic);

        when(userRepository.findById(vetId)).thenReturn(Optional.of(vet));
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(petRepository.findById(petId)).thenReturn(Optional.of(pet));
        when(emrRecordRepository.save(any(EmrRecord.class))).thenAnswer(invocation -> {
            EmrRecord emr = invocation.getArgument(0);
            emr.setId(UUID.randomUUID().toString());
            emr.setCreatedAt(LocalDateTime.now());
            return emr;
        });

        emrService.createEmr(request, vetId);

        verify(aiCaseMemorySyncService, never()).syncConfirmedEmr(any());
    }

    @Test
    @DisplayName("Update EMR - Not Owner - Throws Forbidden")
    void updateEmr_notOwner_throwsForbidden() {
        String emrId = UUID.randomUUID().toString();
        UUID creatorId = UUID.randomUUID();
        UUID updaterId = UUID.randomUUID();

        EmrRecord emr = new EmrRecord();
        emr.setId(emrId);
        emr.setStaffId(creatorId);
        emr.setCreatedAt(LocalDateTime.now());

        when(emrRecordRepository.findById(emrId)).thenReturn(Optional.of(emr));

        assertThrows(ForbiddenException.class, () -> emrService.updateEmr(emrId, new CreateEmrRequest(), updaterId));
    }

    @Test
    @DisplayName("Update EMR - After 24h - Throws BadRequest")
    void updateEmr_after24h_throwsBadRequest() {
        String emrId = UUID.randomUUID().toString();
        UUID vetId = UUID.randomUUID();

        EmrRecord emr = new EmrRecord();
        emr.setId(emrId);
        emr.setStaffId(vetId);
        emr.setCreatedAt(LocalDateTime.now().minusHours(25));

        when(emrRecordRepository.findById(emrId)).thenReturn(Optional.of(emr));

        assertThrows(BadRequestException.class, () -> emrService.updateEmr(emrId, new CreateEmrRequest(), vetId));
    }
}
