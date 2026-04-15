package com.petties.petties.service;

import com.petties.petties.dto.clinic.ClinicDeletionRequestResponse;
import com.petties.petties.dto.clinic.ClinicDeletionReviewAction;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicDeletionRequest;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ClinicDeletionRequestStatus;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.repository.ClinicDeletionRequestRepository;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClinicDeletionRequestService {

    private final ClinicDeletionRequestRepository deletionRequestRepository;
    private final ClinicRepository clinicRepository;
    private final UserRepository userRepository;

    @Transactional
    public ClinicDeletionRequestResponse submitDeletionRequest(UUID clinicId, UUID ownerId, String reason) {
        Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

        if (!clinic.getOwner().getUserId().equals(ownerId)) {
            throw new ForbiddenException("Chỉ chủ phòng khám mới có thể gửi đơn xóa");
        }

        if (clinic.getStatus() != ClinicStatus.APPROVED && clinic.getStatus() != ClinicStatus.SUSPENDED) {
            throw new BadRequestException("Chỉ có thể gửi đơn xóa với phòng khám đã duyệt hoặc tạm ngưng");
        }

        if (deletionRequestRepository.existsByClinicClinicIdAndStatus(clinicId, ClinicDeletionRequestStatus.PENDING)) {
            throw new BadRequestException("Phòng khám này đã có đơn xóa đang chờ duyệt");
        }

        ClinicDeletionRequest request = ClinicDeletionRequest.builder()
                .clinic(clinic)
                .owner(clinic.getOwner())
                .reason(reason.trim())
                .status(ClinicDeletionRequestStatus.PENDING)
                .build();

        request = deletionRequestRepository.save(request);
        log.info("Owner {} submitted deletion request {} for clinic {}", ownerId, request.getRequestId(), clinicId);

        return toResponse(request);
    }

    @Transactional(readOnly = true)
    public Page<ClinicDeletionRequestResponse> getOwnerDeletionRequests(UUID ownerId, Pageable pageable) {
        return deletionRequestRepository.findByOwnerUserId(ownerId, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<ClinicDeletionRequestResponse> getPendingRequests(Pageable pageable) {
        return deletionRequestRepository.findByStatus(ClinicDeletionRequestStatus.PENDING, pageable)
                .map(this::toResponse);
    }

    @Transactional
    public ClinicDeletionRequestResponse reviewRequest(UUID requestId, ClinicDeletionReviewAction action, String adminNote, UUID adminId) {
        ClinicDeletionRequest request = deletionRequestRepository.findByRequestId(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn xóa phòng khám"));

        if (request.getStatus() != ClinicDeletionRequestStatus.PENDING) {
            throw new BadRequestException("Đơn xóa này đã được xử lý trước đó");
        }

        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy quản trị viên"));

        if (action == ClinicDeletionReviewAction.REJECT && (adminNote == null || adminNote.trim().isEmpty())) {
            throw new BadRequestException("Lý do từ chối đơn xóa là bắt buộc");
        }

        if (action == ClinicDeletionReviewAction.APPROVE) {
            Clinic clinic = request.getClinic();
            clinicRepository.delete(clinic);
            request.setStatus(ClinicDeletionRequestStatus.APPROVED);
        } else {
            request.setStatus(ClinicDeletionRequestStatus.REJECTED);
        }

        request.setAdminNote(adminNote != null ? adminNote.trim() : null);
        request.setReviewedBy(admin);
        request.setReviewedAt(LocalDateTime.now());

        request = deletionRequestRepository.save(request);
        log.info("Admin {} reviewed deletion request {} with action {}", adminId, requestId, action);

        return toResponse(request);
    }

    private ClinicDeletionRequestResponse toResponse(ClinicDeletionRequest request) {
        return ClinicDeletionRequestResponse.builder()
                .requestId(request.getRequestId())
                .clinicId(request.getClinic().getClinicId())
                .clinicName(request.getClinic().getName())
                .ownerId(request.getOwner().getUserId())
                .ownerName(request.getOwner().getFullName())
                .status(request.getStatus())
                .reason(request.getReason())
                .adminNote(request.getAdminNote())
                .reviewedBy(request.getReviewedBy() != null ? request.getReviewedBy().getUserId() : null)
                .reviewedByName(request.getReviewedBy() != null ? request.getReviewedBy().getFullName() : null)
                .requestedAt(request.getRequestedAt())
                .reviewedAt(request.getReviewedAt())
                .build();
    }
}
