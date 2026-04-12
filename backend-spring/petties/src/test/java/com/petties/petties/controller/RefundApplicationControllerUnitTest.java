package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.refund.RefundApplicationRequest;
import com.petties.petties.dto.refund.RefundApplicationResponse;
import com.petties.petties.dto.refund.RefundApplicationStatusUpdateRequest;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.enums.RefundApplicationStatus;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.RefundApplicationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit Tests for RefundApplicationController.
 *
 * Follows @WebMvcTest + @AutoConfigureMockMvc(addFilters = false) pattern.
 * All service calls are mocked; no real database or security is involved.
 *
 * Test naming: methodName_condition_expectedResult
 * Test IDs: TC-REFUND-001 ... TC-REFUND-NNN
 */
@WebMvcTest(RefundApplicationController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("RefundApplicationController Unit Tests")
class RefundApplicationControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

        @Autowired
        private ObjectMapper objectMapper;

        @MockitoBean
        private RefundApplicationService refundApplicationService;

        @MockitoBean
        private AuthService authService;

        @MockitoBean
        private JwtTokenProvider jwtTokenProvider;

        @MockitoBean
        private UserDetailsServiceImpl userDetailsServiceImpl;

        @MockitoBean
        private BlacklistedTokenRepository blacklistedTokenRepository;

        // ---------- Test fixtures ----------
        private UUID applicationId;
        private RefundApplicationResponse sampleResponse;

        @BeforeEach
        void setUp() {
                applicationId = UUID.randomUUID();

                sampleResponse = RefundApplicationResponse.builder()
                                .refundApplicationId(applicationId)
                                .clinicId(UUID.randomUUID())
                                .clinicName("Test Clinic")
                                .periodYearMonth("2026-03")
                                .monthRevenue(new BigDecimal("10000000"))
                                .qrRevenue(new BigDecimal("8000000"))
                                .cashRevenue(new BigDecimal("2000000"))
                                .webDeductionPercent(5)
                                .webDeductionAmount(new BigDecimal("400000"))
                                .amountAfterDeduction(new BigDecimal("7600000"))
                                .status(RefundApplicationStatus.PENDING.name())
                                .createdAt(LocalDateTime.now())
                                .build();
        }

        // ==================== POST /refund-applications ====================

        @Test
        @DisplayName("TC-REFUND-001: Create – valid request returns 200 with data")
        void create_validRequest_returns200() throws Exception {
                RefundApplicationRequest req = new RefundApplicationRequest();
                req.setMonthRevenue(new BigDecimal("10000000"));
                req.setQrRevenue(new BigDecimal("8000000"));
                req.setCashRevenue(new BigDecimal("2000000"));
                req.setRequestedAmount(new BigDecimal("7600000"));
                req.setPeriodYearMonth("2026-03");

                when(refundApplicationService.create(any())).thenReturn(sampleResponse);

                mockMvc.perform(post("/refund-applications")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.clinicName").value("Test Clinic"))
                                .andExpect(jsonPath("$.data.status").value("PENDING"));
        }

        @Test
        @DisplayName("TC-REFUND-002: Create – missing requestedAmount returns 400")
        void create_missingRequestedAmount_returns400() throws Exception {
                // requestedAmount is @NotNull in the DTO – sending empty body triggers 400
                mockMvc.perform(post("/refund-applications")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("TC-REFUND-003: Create – exceeds withdrawable returns 400 from service")
        void create_exceededAmount_returns400() throws Exception {
                RefundApplicationRequest req = new RefundApplicationRequest();
                req.setMonthRevenue(new BigDecimal("1000000"));
                req.setQrRevenue(new BigDecimal("1000000"));
                req.setCashRevenue(BigDecimal.ZERO);
                req.setRequestedAmount(new BigDecimal("9999999999"));

                when(refundApplicationService.create(any()))
                                .thenThrow(new BadRequestException("Số tiền yêu cầu rút vượt quá số dư có thể rút."));

                mockMvc.perform(post("/refund-applications")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message").value(containsString("số dư")));
        }

        @Test
        @DisplayName("TC-REFUND-004: Create – user has no clinic returns 403")
        void create_noClinic_returns403() throws Exception {
                RefundApplicationRequest req = new RefundApplicationRequest();
                req.setMonthRevenue(BigDecimal.ZERO);
                req.setQrRevenue(BigDecimal.ZERO);
                req.setCashRevenue(BigDecimal.ZERO);
                req.setRequestedAmount(BigDecimal.ZERO);

                when(refundApplicationService.create(any()))
                                .thenThrow(new ForbiddenException("Bạn chưa có phòng khám nào để nộp đơn."));

                mockMvc.perform(post("/refund-applications")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isForbidden())
                                .andExpect(jsonPath("$.message").value(containsString("phòng khám")));
        }

        @Test
        @DisplayName("TC-REFUND-005: Create – invalid period format returns 400")
        void create_invalidPeriodFormat_returns400() throws Exception {
                RefundApplicationRequest req = new RefundApplicationRequest();
                req.setMonthRevenue(new BigDecimal("1000000"));
                req.setQrRevenue(new BigDecimal("1000000"));
                req.setCashRevenue(BigDecimal.ZERO);
                req.setRequestedAmount(new BigDecimal("950000"));
                req.setPeriodYearMonth("06-2026"); // wrong format

                when(refundApplicationService.create(any()))
                                .thenThrow(new BadRequestException("Định dạng kỳ không hợp lệ. Dùng yyyy-MM"));

                mockMvc.perform(post("/refund-applications")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message").value(containsString("Định dạng kỳ")));
        }

        // ==================== GET /refund-applications/my-clinic ====================

        @Test
        @DisplayName("TC-REFUND-006: GetMyClinic – returns list with 200")
        void getMyClinicApplications_success_returns200() throws Exception {
                when(refundApplicationService.getMyClinicApplications())
                                .thenReturn(List.of(sampleResponse));

                mockMvc.perform(get("/refund-applications/my-clinic"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.items", hasSize(1)))
                                .andExpect(jsonPath("$.items[0].clinicName").value("Test Clinic"));
        }

        @Test
        @DisplayName("TC-REFUND-007: GetMyClinic – empty list returns 200 with empty items")
        void getMyClinicApplications_emptyList_returns200() throws Exception {
                when(refundApplicationService.getMyClinicApplications()).thenReturn(List.of());

                mockMvc.perform(get("/refund-applications/my-clinic"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.items", hasSize(0)));
        }

        @Test
        @DisplayName("TC-REFUND-008: GetMyClinic – owner with no clinic returns 403")
        void getMyClinicApplications_noClinic_returns403() throws Exception {
                when(refundApplicationService.getMyClinicApplications())
                                .thenThrow(new ForbiddenException("Bạn chưa có phòng khám nào."));

                mockMvc.perform(get("/refund-applications/my-clinic"))
                                .andExpect(status().isForbidden());
        }

        // ==================== GET /refund-applications/clinic/{clinicId}
        // ====================

        @Test
        @DisplayName("TC-REFUND-009: GetClinicById – valid clinicId returns 200 with list")
        void getClinicApplications_validId_returns200() throws Exception {
                UUID clinicId = UUID.randomUUID();
                when(refundApplicationService.getClinicApplications(clinicId))
                                .thenReturn(List.of(sampleResponse));

                mockMvc.perform(get("/refund-applications/clinic/{clinicId}", clinicId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.items", hasSize(1)));
        }

        @Test
        @DisplayName("TC-REFUND-010: GetClinicById – not owner of clinic returns 403")
        void getClinicApplications_notOwner_returns403() throws Exception {
                UUID clinicId = UUID.randomUUID();
                when(refundApplicationService.getClinicApplications(clinicId))
                                .thenThrow(new ForbiddenException(
                                                "Bạn không có quyền xem đơn rút tiền của phòng khám này."));

                mockMvc.perform(get("/refund-applications/clinic/{clinicId}", clinicId))
                                .andExpect(status().isForbidden())
                                .andExpect(jsonPath("$.message").value(containsString("quyền")));
        }

        @Test
        @DisplayName("TC-REFUND-011: GetClinicById – invalid UUID path param returns 400")
        void getClinicApplications_invalidUUID_returns400() throws Exception {
                mockMvc.perform(get("/refund-applications/clinic/not-a-uuid"))
                                .andExpect(status().isBadRequest());
        }

        // ==================== GET /refund-applications/admin/pending
        // ====================

        @Test
        @DisplayName("TC-REFUND-012: GetPendingForAdmin – returns all PENDING with 200")
        void getPendingForAdmin_success_returns200() throws Exception {
                when(refundApplicationService.getPendingForAdmin()).thenReturn(List.of(sampleResponse));

                mockMvc.perform(get("/refund-applications/admin/pending"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.items", hasSize(1)))
                                .andExpect(jsonPath("$.items[0].status").value("PENDING"));
        }

        @Test
        @DisplayName("TC-REFUND-013: GetPendingForAdmin – empty returns 200 with empty list")
        void getPendingForAdmin_empty_returns200() throws Exception {
                when(refundApplicationService.getPendingForAdmin()).thenReturn(List.of());

                mockMvc.perform(get("/refund-applications/admin/pending"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.items", hasSize(0)));
        }

        @Test
        @DisplayName("TC-REFUND-014: GetPendingForAdmin – service throws 500 propagates")
        void getPendingForAdmin_serviceThrows_returns500() throws Exception {
                when(refundApplicationService.getPendingForAdmin())
                                .thenThrow(new RuntimeException("DB connection error"));

                mockMvc.perform(get("/refund-applications/admin/pending"))
                                .andExpect(status().isInternalServerError());
        }

        // ==================== GET /refund-applications/admin/all ====================

        @Test
        @DisplayName("TC-REFUND-015: GetAllForAdmin – no filter returns all")
        void getAllForAdmin_noFilter_returnsAll() throws Exception {
                RefundApplicationResponse approved = RefundApplicationResponse.builder()
                                .refundApplicationId(UUID.randomUUID())
                                .clinicId(UUID.randomUUID())
                                .clinicName("Clinic A")
                                .periodYearMonth("2026-02")
                                .qrRevenue(BigDecimal.TEN)
                                .cashRevenue(BigDecimal.ZERO)
                                .webDeductionPercent(5)
                                .webDeductionAmount(BigDecimal.ONE)
                                .amountAfterDeduction(new BigDecimal("9"))
                                .status(RefundApplicationStatus.APPROVED.name())
                                .createdAt(LocalDateTime.now())
                                .build();

                when(refundApplicationService.getAllForAdmin(isNull(), isNull(), isNull(), isNull(), isNull()))
                                .thenReturn(List.of(sampleResponse, approved));

                mockMvc.perform(get("/refund-applications/admin/all"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.items", hasSize(2)));
        }

        @Test
        @DisplayName("TC-REFUND-016: GetAllForAdmin – status filter returns only matching")
        void getAllForAdmin_statusFilter_returnsFiltered() throws Exception {
                when(refundApplicationService.getAllForAdmin(eq("APPROVED"), isNull(), isNull(), isNull(), isNull()))
                                .thenReturn(List.of());

                mockMvc.perform(get("/refund-applications/admin/all")
                                .param("status", "APPROVED"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.items", hasSize(0)));
        }

        @Test
        @DisplayName("TC-REFUND-017: GetAllForAdmin – date range filter applies correctly")
        void getAllForAdmin_dateRangeFilter_returns200() throws Exception {
                when(refundApplicationService.getAllForAdmin(isNull(), isNull(), isNull(),
                                eq("2026-03-01"), eq("2026-03-06")))
                                .thenReturn(List.of(sampleResponse));

                mockMvc.perform(get("/refund-applications/admin/all")
                                .param("from", "2026-03-01")
                                .param("to", "2026-03-06"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.items", hasSize(1)));
        }

        @Test
        @DisplayName("TC-REFUND-018: GetAllForAdmin – service throws 500 propagates")
        void getAllForAdmin_serviceThrows_returns500() throws Exception {
                when(refundApplicationService.getAllForAdmin(any(), any(), any(), any(), any()))
                                .thenThrow(new RuntimeException("Unexpected error"));

                mockMvc.perform(get("/refund-applications/admin/all"))
                                .andExpect(status().isInternalServerError());
        }

        // ==================== PUT /refund-applications/{id}/status
        // ====================

        @Test
        @DisplayName("TC-REFUND-019: UpdateStatus APPROVED – valid returns 200")
        void updateStatus_approve_returns200() throws Exception {
                RefundApplicationResponse approved = RefundApplicationResponse.builder()
                                .refundApplicationId(applicationId)
                                .clinicId(UUID.randomUUID())
                                .clinicName("Test Clinic")
                                .periodYearMonth("2026-03")
                                .qrRevenue(new BigDecimal("8000000"))
                                .cashRevenue(new BigDecimal("2000000"))
                                .webDeductionPercent(5)
                                .webDeductionAmount(new BigDecimal("400000"))
                                .amountAfterDeduction(new BigDecimal("7600000"))
                                .status(RefundApplicationStatus.APPROVED.name())
                                .createdAt(LocalDateTime.now())
                                .build();

                when(refundApplicationService.updateStatus(eq(applicationId), any())).thenReturn(approved);

                RefundApplicationStatusUpdateRequest req = new RefundApplicationStatusUpdateRequest();
                req.setStatus(RefundApplicationStatus.APPROVED);

                mockMvc.perform(put("/refund-applications/{id}/status", applicationId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.status").value("APPROVED"));
        }

        @Test
        @DisplayName("TC-REFUND-020: UpdateStatus REJECTED with note – valid returns 200")
        void updateStatus_reject_withNote_returns200() throws Exception {
                RefundApplicationResponse rejected = RefundApplicationResponse.builder()
                                .refundApplicationId(applicationId)
                                .clinicId(UUID.randomUUID())
                                .clinicName("Test Clinic")
                                .periodYearMonth("2026-03")
                                .qrRevenue(new BigDecimal("5000000"))
                                .cashRevenue(BigDecimal.ZERO)
                                .webDeductionPercent(5)
                                .webDeductionAmount(new BigDecimal("250000"))
                                .amountAfterDeduction(new BigDecimal("4750000"))
                                .status(RefundApplicationStatus.REJECTED.name())
                                .rejectionReason("Thông tin tài khoản không hợp lệ")
                                .createdAt(LocalDateTime.now())
                                .build();

                when(refundApplicationService.updateStatus(eq(applicationId), any())).thenReturn(rejected);

                RefundApplicationStatusUpdateRequest req = new RefundApplicationStatusUpdateRequest();
                req.setStatus(RefundApplicationStatus.REJECTED);
                req.setNote("Thông tin tài khoản không hợp lệ");

                mockMvc.perform(put("/refund-applications/{id}/status", applicationId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                                .andExpect(jsonPath("$.data.rejectionReason")
                                                .value("Thông tin tài khoản không hợp lệ"));
        }

        @Test
        @DisplayName("TC-REFUND-021: UpdateStatus – application not found returns 404")
        void updateStatus_applicationNotFound_returns404() throws Exception {
                when(refundApplicationService.updateStatus(eq(applicationId), any()))
                                .thenThrow(new ResourceNotFoundException("Không tìm thấy đơn nộp này."));

                RefundApplicationStatusUpdateRequest req = new RefundApplicationStatusUpdateRequest();
                req.setStatus(RefundApplicationStatus.APPROVED);

                mockMvc.perform(put("/refund-applications/{id}/status", applicationId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.message").value("Không tìm thấy đơn nộp này."));
        }

        @Test
        @DisplayName("TC-REFUND-022: UpdateStatus – already not PENDING returns 400")
        void updateStatus_alreadyProcessed_returns400() throws Exception {
                when(refundApplicationService.updateStatus(eq(applicationId), any()))
                                .thenThrow(new BadRequestException("Chỉ có thể duyệt đơn đang ở trạng thái PENDING."));

                RefundApplicationStatusUpdateRequest req = new RefundApplicationStatusUpdateRequest();
                req.setStatus(RefundApplicationStatus.APPROVED);

                mockMvc.perform(put("/refund-applications/{id}/status", applicationId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message").value(containsString("PENDING")));
        }

        @Test
        @DisplayName("TC-REFUND-023: UpdateStatus – non-admin user returns 403")
        void updateStatus_notAdmin_returns403() throws Exception {
                when(refundApplicationService.updateStatus(eq(applicationId), any()))
                                .thenThrow(new ForbiddenException("Chỉ Admin mới có quyền duyệt đơn rút tiền."));

                RefundApplicationStatusUpdateRequest req = new RefundApplicationStatusUpdateRequest();
                req.setStatus(RefundApplicationStatus.APPROVED);

                mockMvc.perform(put("/refund-applications/{id}/status", applicationId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isForbidden())
                                .andExpect(jsonPath("$.message").value(containsString("Admin")));
        }

        @Test
        @DisplayName("TC-REFUND-024: UpdateStatus – empty body returns 400")
        void updateStatus_emptyBody_returns400() throws Exception {
                mockMvc.perform(put("/refund-applications/{id}/status", applicationId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("TC-REFUND-025: UpdateStatus – invalid applicationId UUID returns 400")
        void updateStatus_invalidUUID_returns400() throws Exception {
                RefundApplicationStatusUpdateRequest req = new RefundApplicationStatusUpdateRequest();
                req.setStatus(RefundApplicationStatus.APPROVED);

                mockMvc.perform(put("/refund-applications/{id}/status", "not-a-valid-uuid")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("TC-REFUND-026: UpdateStatus – setting status back to PENDING returns 400")
        void updateStatus_settingPending_returns400() throws Exception {
                when(refundApplicationService.updateStatus(eq(applicationId), any()))
                                .thenThrow(new BadRequestException("Trạng thái duyệt không hợp lệ."));

                RefundApplicationStatusUpdateRequest req = new RefundApplicationStatusUpdateRequest();
                req.setStatus(RefundApplicationStatus.PENDING);

                mockMvc.perform(put("/refund-applications/{id}/status", applicationId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.message").value(containsString("không hợp lệ")));
        }

        @Test
        @DisplayName("TC-REFUND-027: UpdateStatus – service internal error returns 500")
        void updateStatus_serviceThrows_returns500() throws Exception {
                when(refundApplicationService.updateStatus(any(), any()))
                                .thenThrow(new RuntimeException("Internal error"));

                RefundApplicationStatusUpdateRequest req = new RefundApplicationStatusUpdateRequest();
                req.setStatus(RefundApplicationStatus.APPROVED);

                mockMvc.perform(put("/refund-applications/{id}/status", applicationId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isInternalServerError());
        }

        // ==================== Response structure validation ====================

        @Test
        @DisplayName("TC-REFUND-028: Create – response contains all required fields")
        void create_responseHasAllFields_returns200() throws Exception {
                RefundApplicationRequest req = new RefundApplicationRequest();
                req.setMonthRevenue(new BigDecimal("6000000"));
                req.setQrRevenue(new BigDecimal("5000000"));
                req.setCashRevenue(new BigDecimal("1000000"));
                req.setRequestedAmount(new BigDecimal("4750000"));
                req.setPeriodYearMonth("2026-03");

                when(refundApplicationService.create(any())).thenReturn(sampleResponse);

                mockMvc.perform(post("/refund-applications")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.refundApplicationId").exists())
                                .andExpect(jsonPath("$.data.clinicId").exists())
                                .andExpect(jsonPath("$.data.periodYearMonth").exists())
                                .andExpect(jsonPath("$.data.qrRevenue").exists())
                                .andExpect(jsonPath("$.data.cashRevenue").exists())
                                .andExpect(jsonPath("$.data.webDeductionPercent").exists())
                                .andExpect(jsonPath("$.data.webDeductionAmount").exists())
                                .andExpect(jsonPath("$.data.amountAfterDeduction").exists())
                                .andExpect(jsonPath("$.data.status").value("PENDING"))
                                .andExpect(jsonPath("$.data.createdAt").exists());
        }

        @Test
        @DisplayName("TC-REFUND-029: GetMyClinic – response fields complete")
        void getMyClinicApplications_responseFieldsComplete_returns200() throws Exception {
                when(refundApplicationService.getMyClinicApplications()).thenReturn(List.of(sampleResponse));

                mockMvc.perform(get("/refund-applications/my-clinic"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.message").exists())
                                .andExpect(jsonPath("$.items[0].refundApplicationId").exists())
                                .andExpect(jsonPath("$.items[0].clinicName").value("Test Clinic"))
                                .andExpect(jsonPath("$.items[0].periodYearMonth").value("2026-03"))
                                .andExpect(jsonPath("$.items[0].amountAfterDeduction").value(7600000));
        }

        @Test
        @DisplayName("TC-REFUND-030: Approve – response includes updated status and message")
        void updateStatus_approve_responseContainsMessage() throws Exception {
                RefundApplicationResponse approved = RefundApplicationResponse.builder()
                                .refundApplicationId(applicationId)
                                .clinicId(UUID.randomUUID())
                                .clinicName("Test Clinic")
                                .periodYearMonth("2026-03")
                                .qrRevenue(new BigDecimal("8000000"))
                                .cashRevenue(new BigDecimal("2000000"))
                                .webDeductionPercent(5)
                                .webDeductionAmount(new BigDecimal("400000"))
                                .amountAfterDeduction(new BigDecimal("7600000"))
                                .status(RefundApplicationStatus.APPROVED.name())
                                .createdAt(LocalDateTime.now())
                                .build();

                when(refundApplicationService.updateStatus(eq(applicationId), any())).thenReturn(approved);

                RefundApplicationStatusUpdateRequest req = new RefundApplicationStatusUpdateRequest();
                req.setStatus(RefundApplicationStatus.APPROVED);

                mockMvc.perform(put("/refund-applications/{id}/status", applicationId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.message").value("Cập nhật trạng thái đơn hoàn tiền thành công"))
                                .andExpect(jsonPath("$.data.status").value("APPROVED"));
        }
}
