package com.petties.petties.service;

import com.petties.petties.dto.clinic.ClinicDeletionRequestResponse;
import com.petties.petties.dto.clinic.ClinicDeletionReviewAction;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicDeletionRequest;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ClinicDeletionRequestStatus;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.repository.ClinicDeletionRequestRepository;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ClinicDeletionRequestService Unit Tests")
class ClinicDeletionRequestServiceUnitTest {

    @Mock
    private ClinicDeletionRequestRepository deletionRequestRepository;

    @Mock
    private ClinicRepository clinicRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private ClinicDeletionRequestService clinicDeletionRequestService;

    @Test
    @DisplayName("Submit deletion request - success")
    void submitDeletionRequest_success() {
        UUID clinicId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(ownerId);
        owner.setFullName("Owner Test");

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);
        clinic.setOwner(owner);
        clinic.setName("Clinic A");
        clinic.setStatus(ClinicStatus.APPROVED);

        when(clinicRepository.findByIdAndNotDeleted(clinicId)).thenReturn(Optional.of(clinic));
        when(deletionRequestRepository.existsByClinicClinicIdAndStatus(clinicId, ClinicDeletionRequestStatus.PENDING))
                .thenReturn(false);
        when(deletionRequestRepository.save(any(ClinicDeletionRequest.class))).thenAnswer(invocation -> {
            ClinicDeletionRequest request = invocation.getArgument(0);
            request.setRequestId(UUID.randomUUID());
            return request;
        });

        ClinicDeletionRequestResponse response = clinicDeletionRequestService.submitDeletionRequest(
                clinicId,
                ownerId,
                "Lý do xin xóa hợp lệ để test");

        assertEquals(clinicId, response.getClinicId());
        assertEquals(ClinicDeletionRequestStatus.PENDING, response.getStatus());
        verify(deletionRequestRepository).save(any(ClinicDeletionRequest.class));
    }

    @Test
    @DisplayName("Submit deletion request - fail when not owner")
    void submitDeletionRequest_notOwner_throwForbidden() {
        UUID clinicId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(UUID.randomUUID());

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);
        clinic.setOwner(owner);
        clinic.setStatus(ClinicStatus.APPROVED);

        when(clinicRepository.findByIdAndNotDeleted(clinicId)).thenReturn(Optional.of(clinic));

        assertThrows(ForbiddenException.class,
                () -> clinicDeletionRequestService.submitDeletionRequest(
                        clinicId,
                        UUID.randomUUID(),
                        "Lý do xin xóa hợp lệ để test"));
    }

    @Test
    @DisplayName("Review deletion request - reject requires note")
    void reviewRequest_rejectWithoutNote_throwBadRequest() {
        UUID requestId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();

        User owner = new User();
        owner.setUserId(UUID.randomUUID());

        Clinic clinic = new Clinic();
        clinic.setClinicId(UUID.randomUUID());
        clinic.setOwner(owner);
        clinic.setStatus(ClinicStatus.APPROVED);

        ClinicDeletionRequest request = ClinicDeletionRequest.builder()
                .requestId(requestId)
                .clinic(clinic)
                .owner(owner)
                .status(ClinicDeletionRequestStatus.PENDING)
                .reason("Lý do hợp lệ")
                .build();

        User admin = new User();
        admin.setUserId(adminId);

        when(deletionRequestRepository.findByRequestId(requestId)).thenReturn(Optional.of(request));
        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));

        assertThrows(BadRequestException.class,
                () -> clinicDeletionRequestService.reviewRequest(
                        requestId,
                        ClinicDeletionReviewAction.REJECT,
                        "   ",
                        adminId));
    }
}
