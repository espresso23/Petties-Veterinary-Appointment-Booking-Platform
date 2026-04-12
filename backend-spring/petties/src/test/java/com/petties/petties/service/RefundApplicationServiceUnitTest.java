package com.petties.petties.service;

import com.petties.petties.dto.refund.RefundApplicationResponse;
import com.petties.petties.dto.refund.RefundApplicationRequest;
import com.petties.petties.dto.refund.RefundApplicationStatusUpdateRequest;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.RefundApplication;
import com.petties.petties.model.enums.RefundApplicationStatus;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.RefundApplicationRepository;
import com.petties.petties.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("RefundApplicationService Unit Tests")
class RefundApplicationServiceUnitTest {

    @Mock
    private RefundApplicationRepository refundApplicationRepository;

    @Mock
    private ClinicRepository clinicRepository;

    @Mock
    private AuthService authService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WithdrawalService withdrawalService;

    @InjectMocks
    private RefundApplicationService refundApplicationService;

    @Test
    @DisplayName("Approve refund - withdrawal fails but approval still succeeds")
    void updateStatus_approveWithdrawalFails_stillSuccess() {
        UUID applicationId = UUID.randomUUID();
        UUID clinicId = UUID.randomUUID();

        Clinic clinic = new Clinic();
        clinic.setClinicId(clinicId);
        clinic.setName("Phòng khám A");

        RefundApplication pendingApplication = RefundApplication.builder()
                .refundApplicationId(applicationId)
                .clinic(clinic)
                .periodYearMonth("2026-03")
                .monthRevenue(new BigDecimal("1000000"))
                .qrRevenue(new BigDecimal("400000"))
                .cashRevenue(new BigDecimal("600000"))
                .requestedAmount(new BigDecimal("950000"))
                .webDeductionPercent(5)
                .webDeductionAmount(new BigDecimal("50000"))
                .amountAfterDeduction(new BigDecimal("950000"))
                .status(RefundApplicationStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        RefundApplicationStatusUpdateRequest request = new RefundApplicationStatusUpdateRequest();
        request.setStatus(RefundApplicationStatus.APPROVED);
        request.setNote("Duyệt thử nghiệm");

        when(refundApplicationRepository.findById(applicationId)).thenReturn(Optional.of(pendingApplication));
        when(refundApplicationRepository.save(any(RefundApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(withdrawalService.createWithdrawalFromApprovedRefund(applicationId))
                .thenThrow(new BadRequestException("Số dư clinic không đủ."));

        RefundApplicationResponse response = assertDoesNotThrow(
                () -> refundApplicationService.updateStatus(applicationId, request));

        assertNotNull(response);
        assertEquals("APPROVED", response.getStatus());
        assertEquals("Duyệt thử nghiệm", response.getRejectionReason());

        verify(notificationService).notifyClinicOwnerRefundApproved(any(RefundApplication.class));
        verify(withdrawalService).createWithdrawalFromApprovedRefund(applicationId);
        verify(notificationService, never()).notifyClinicOwnerRefundRejected(any(RefundApplication.class), any());
    }

        @Test
        @DisplayName("Create refund - requested amount exceeds withdrawable after deduction")
        void create_requestedAmountExceedsAmountAfterDeduction_throwsBadRequest() {
                UUID clinicId = UUID.randomUUID();
                UUID ownerId = UUID.randomUUID();

                com.petties.petties.model.User owner = new com.petties.petties.model.User();
                owner.setUserId(ownerId);
                owner.setRole(com.petties.petties.model.enums.Role.CLINIC_OWNER);

                Clinic clinic = new Clinic();
                clinic.setClinicId(clinicId);
                clinic.setOwner(owner);
                clinic.setName("Phòng khám A");

                RefundApplicationRequest request = RefundApplicationRequest.builder()
                                .clinicId(clinicId)
                                .periodYearMonth("2026-03")
                                .monthRevenue(new BigDecimal("1000000"))
                                .qrRevenue(new BigDecimal("400000"))
                                .cashRevenue(new BigDecimal("600000"))
                                .requestedAmount(new BigDecimal("960000"))
                                .build();

                when(authService.getCurrentUser()).thenReturn(owner);
                when(clinicRepository.findById(clinicId)).thenReturn(Optional.of(clinic));

                BadRequestException exception = assertThrows(BadRequestException.class,
                                () -> refundApplicationService.create(request));

                assertEquals("Số tiền yêu cầu rút không được vượt quá số tiền có thể rút sau khấu trừ.", exception.getMessage());
                verify(refundApplicationRepository, never()).save(any(RefundApplication.class));
                verify(notificationService, never()).notifyAdminsRefundRequested(any(RefundApplication.class));
        }
}
