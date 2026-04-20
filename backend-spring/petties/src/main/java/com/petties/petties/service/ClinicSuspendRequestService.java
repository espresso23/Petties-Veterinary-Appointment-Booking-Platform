package com.petties.petties.service;

import com.petties.petties.dto.clinic.ClinicSuspendRequestCreateRequest;
import com.petties.petties.dto.clinic.ClinicSuspendRequestResponse;
import com.petties.petties.dto.clinic.ClinicSuspendRequestReviewRequest;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicSuspendRequest;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ClinicStatus;
import com.petties.petties.model.enums.ClinicSuspendRequestStatus;
import com.petties.petties.model.enums.ClinicSuspendRequestType;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.ClinicSuspendRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClinicSuspendRequestService {

    private final ClinicSuspendRequestRepository suspendRequestRepository;
    private final ClinicRepository clinicRepository;
    private final AuthService authService;
    private final NotificationService notificationService;

    @Transactional
    public ClinicSuspendRequestResponse create(ClinicSuspendRequestCreateRequest request) {
        User currentUser = authService.getCurrentUser();
        if (currentUser.getRole() != Role.CLINIC_OWNER) {
            throw new ForbiddenException("Chỉ chủ phòng khám mới được gửi yêu cầu tạm ngưng");
        }

        Clinic clinic = clinicRepository.findByIdAndNotDeleted(request.getClinicId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

        if (clinic.getOwner() == null || !clinic.getOwner().getUserId().equals(currentUser.getUserId())) {
            throw new ForbiddenException("Bạn không phải chủ sở hữu của phòng khám này");
        }

        ClinicSuspendRequestType requestType;
        if (clinic.getStatus() == ClinicStatus.APPROVED) {
            requestType = ClinicSuspendRequestType.SUSPEND;
        } else if (clinic.getStatus() == ClinicStatus.SUSPENDED) {
            requestType = ClinicSuspendRequestType.UNSUSPEND;
        } else {
            throw new BadRequestException("Chỉ có thể gửi đơn khi phòng khám đang hoạt động hoặc tạm ngưng");
        }

        if (suspendRequestRepository.existsByClinicClinicIdAndStatus(clinic.getClinicId(), ClinicSuspendRequestStatus.PENDING)) {
            throw new BadRequestException("Phòng khám đã có một yêu cầu đang chờ duyệt");
        }

        ClinicSuspendRequest entity = ClinicSuspendRequest.builder()
                .clinic(clinic)
                .requestedBy(currentUser)
                .reason(request.getReason().trim())
                .requestType(requestType)
                .status(ClinicSuspendRequestStatus.PENDING)
                .build();

        entity = suspendRequestRepository.save(entity);
        log.info("Clinic suspend request created: {} for clinic {}", entity.getClinicSuspendRequestId(), clinic.getClinicId());

        try {
            notificationService.notifyAdminsClinicSuspendRequested(entity);
        } catch (Exception e) {
            log.error("Failed to notify admins about clinic suspend request {}", entity.getClinicSuspendRequestId(), e);
        }

        return toResponse(entity);
    }

    @Transactional(readOnly = true)
    public List<ClinicSuspendRequestResponse> getMyRequests() {
        User currentUser = authService.getCurrentUser();
        if (currentUser.getRole() != Role.CLINIC_OWNER) {
            throw new ForbiddenException("Chỉ chủ phòng khám mới được xem yêu cầu của mình");
        }

        return suspendRequestRepository.findByRequestedByUserIdOrderByCreatedAtDesc(currentUser.getUserId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<ClinicSuspendRequestResponse> getPendingForAdmin(Pageable pageable) {
        return suspendRequestRepository.findByStatusOrderByCreatedAtDesc(ClinicSuspendRequestStatus.PENDING, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<ClinicSuspendRequestResponse> getAllForAdmin(ClinicSuspendRequestStatus status, Pageable pageable) {
        Page<ClinicSuspendRequest> page = status == null
                ? suspendRequestRepository.findAll(pageable)
                : suspendRequestRepository.findByStatusOrderByCreatedAtDesc(status, pageable);
        return page.map(this::toResponse);
    }

    @Transactional
    public ClinicSuspendRequestResponse review(UUID requestId, ClinicSuspendRequestReviewRequest request) {
        User currentUser = authService.getCurrentUser();
        if (currentUser.getRole() != Role.ADMIN) {
            throw new ForbiddenException("Chỉ quản trị viên mới được duyệt yêu cầu");
        }

        ClinicSuspendRequest entity = suspendRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy yêu cầu tạm ngưng"));

        if (entity.getStatus() != ClinicSuspendRequestStatus.PENDING) {
            throw new BadRequestException("Chỉ có thể duyệt yêu cầu đang chờ xử lý");
        }

        ClinicSuspendRequestStatus nextStatus = request.getStatus();
        if (nextStatus == ClinicSuspendRequestStatus.PENDING) {
            throw new BadRequestException("Trạng thái duyệt không hợp lệ");
        }

        entity.setStatus(nextStatus);
        entity.setAdminNote(request.getNote());
        entity.setReviewedBy(currentUser);
        entity.setReviewedAt(LocalDateTime.now());

        if (nextStatus == ClinicSuspendRequestStatus.APPROVED) {
            Clinic clinic = entity.getClinic();
            if (entity.getRequestType() == ClinicSuspendRequestType.UNSUSPEND) {
                clinic.setStatus(ClinicStatus.APPROVED);
            } else {
                clinic.setStatus(ClinicStatus.SUSPENDED);
            }
            clinicRepository.save(clinic);
            log.info("Clinic {} updated by approved request {} with type {}",
                    clinic.getClinicId(),
                    entity.getClinicSuspendRequestId(),
                    entity.getRequestType());
            try {
                if (entity.getRequestType() == ClinicSuspendRequestType.UNSUSPEND) {
                    notificationService.notifyClinicOwnerClinicActivated(clinic);
                } else {
                    notificationService.notifyClinicOwnerSuspendRequestApproved(entity);
                }
            } catch (Exception e) {
                log.error("Failed to notify owner about approved suspend request {}", entity.getClinicSuspendRequestId(), e);
            }
        } else {
            log.info("Clinic request {} with type {} rejected by admin {}",
                    entity.getClinicSuspendRequestId(),
                    entity.getRequestType(),
                    currentUser.getUserId());
            try {
                notificationService.notifyClinicOwnerSuspendRequestRejected(entity);
            } catch (Exception e) {
                log.error("Failed to notify owner about rejected suspend request {}", entity.getClinicSuspendRequestId(), e);
            }
        }

        entity = suspendRequestRepository.save(entity);
        return toResponse(entity);
    }

    @Transactional
    public ClinicSuspendRequestResponse activateClinic(UUID clinicId) {
        User currentUser = authService.getCurrentUser();
        if (currentUser.getRole() != Role.ADMIN) {
            throw new ForbiddenException("Chỉ quản trị viên mới được kích hoạt phòng khám");
        }

        Clinic clinic = clinicRepository.findByIdAndNotDeleted(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

        if (clinic.getStatus() != ClinicStatus.SUSPENDED) {
            throw new BadRequestException("Phòng khám không ở trạng thái tạm ngưng");
        }

        clinic.setStatus(ClinicStatus.APPROVED);
        clinicRepository.save(clinic);

        try {
            notificationService.notifyClinicOwnerClinicActivated(clinic);
        } catch (Exception e) {
            log.error("Failed to notify owner about clinic activation {}", clinicId, e);
        }

        return ClinicSuspendRequestResponse.builder()
                .clinicId(clinic.getClinicId())
                .clinicName(clinic.getName())
                .clinicStatus(clinic.getStatus().name())
                .status("APPROVED")
                .build();
    }

    private ClinicSuspendRequestResponse toResponse(ClinicSuspendRequest entity) {
        return ClinicSuspendRequestResponse.builder()
                .clinicSuspendRequestId(entity.getClinicSuspendRequestId())
                .clinicId(entity.getClinic().getClinicId())
                .clinicName(entity.getClinic().getName())
                .clinicStatus(entity.getClinic().getStatus().name())
                .requestedById(entity.getRequestedBy().getUserId())
                .requestedByName(entity.getRequestedBy().getFullName())
                .reason(entity.getReason())
                .requestType(entity.getRequestType().name())
                .status(entity.getStatus().name())
                .adminNote(entity.getAdminNote())
                .reviewedById(entity.getReviewedBy() != null ? entity.getReviewedBy().getUserId() : null)
                .reviewedByName(entity.getReviewedBy() != null ? entity.getReviewedBy().getFullName() : null)
                .reviewedAt(entity.getReviewedAt())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}