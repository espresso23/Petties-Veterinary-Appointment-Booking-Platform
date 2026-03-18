package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.User;
import com.petties.petties.model.Withdrawal;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.WithdrawalStatus;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.WithdrawalService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(WithdrawalController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("WithdrawalController Unit Tests")
class WithdrawalControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private WithdrawalService withdrawalService;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private UserDetailsServiceImpl userDetailsServiceImpl;

    @MockitoBean
    private BlacklistedTokenRepository blacklistedTokenRepository;

    @Test
    @DisplayName("GET /withdrawals/my-clinic - manager xem danh sách withdrawal thành công")
    void getMyClinicWithdrawals_manager_returnsSuccess() throws Exception {
        UUID clinicId = UUID.randomUUID();
        Clinic clinic = Clinic.builder().clinicId(clinicId).name("Petties Clinic").build();

        User currentUser = User.builder()
                .userId(UUID.randomUUID())
                .role(Role.CLINIC_MANAGER)
                .workingClinic(clinic)
                .build();

        Withdrawal withdrawal = Withdrawal.builder()
                .withdrawalId(UUID.randomUUID())
                .requestedAmount(new BigDecimal("2500000"))
                .transferredAmount(new BigDecimal("2500000"))
                .platformFee(BigDecimal.ZERO)
                .status(WithdrawalStatus.PENDING)
                .build();

        when(authService.getCurrentUser()).thenReturn(currentUser);
        when(withdrawalService.getClinicWithdrawals(clinicId)).thenReturn(List.of(withdrawal));

        mockMvc.perform(get("/withdrawals/my-clinic"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.items[0].status").value("PENDING"));
    }

    @Test
    @DisplayName("GET /withdrawals/my-clinic - user chưa được gán clinic trả về 400")
    void getMyClinicWithdrawals_noClinic_returnsBadRequest() throws Exception {
        User currentUser = User.builder()
                .userId(UUID.randomUUID())
                .role(Role.CLINIC_MANAGER)
                .workingClinic(null)
                .build();

        when(authService.getCurrentUser()).thenReturn(currentUser);

        mockMvc.perform(get("/withdrawals/my-clinic"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("chưa được gán phòng khám")));
    }

    @Test
    @DisplayName("GET /withdrawals/admin/status/{status} - admin lọc theo trạng thái thành công")
    void getWithdrawalsByStatus_returnsSuccess() throws Exception {
        Withdrawal withdrawal = Withdrawal.builder()
                .withdrawalId(UUID.randomUUID())
                .requestedAmount(new BigDecimal("3000000"))
                .transferredAmount(new BigDecimal("3000000"))
                .platformFee(BigDecimal.ZERO)
                .status(WithdrawalStatus.COMPLETED)
                .build();

        when(withdrawalService.getWithdrawalsByStatus(WithdrawalStatus.COMPLETED))
                .thenReturn(List.of(withdrawal));

        mockMvc.perform(get("/withdrawals/admin/status/{status}", "COMPLETED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.items[0].status").value("COMPLETED"));
    }

    @Test
    @DisplayName("PUT /withdrawals/{id}/status - cập nhật trạng thái thành công")
    void updateWithdrawalStatus_validRequest_returnsSuccess() throws Exception {
        UUID withdrawalId = UUID.randomUUID();
        Withdrawal updated = Withdrawal.builder()
                .withdrawalId(withdrawalId)
                .requestedAmount(new BigDecimal("1500000"))
                .transferredAmount(new BigDecimal("1500000"))
                .platformFee(BigDecimal.ZERO)
                .status(WithdrawalStatus.COMPLETED)
                .transferReference("BANK-TXN-001")
                .build();

        when(withdrawalService.updateWithdrawalStatus(
                eq(withdrawalId),
                eq(WithdrawalStatus.COMPLETED),
                eq("BANK-TXN-001"),
                eq(null)))
                .thenReturn(updated);

        Map<String, Object> request = Map.of(
                "status", "completed",
                "transferReference", "BANK-TXN-001");

        mockMvc.perform(put("/withdrawals/{id}/status", withdrawalId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.transferReference").value("BANK-TXN-001"));
    }

    @Test
    @DisplayName("PUT /withdrawals/{id}/status - status không hợp lệ trả về 400")
    void updateWithdrawalStatus_invalidStatus_returnsBadRequest() throws Exception {
        UUID withdrawalId = UUID.randomUUID();
        Map<String, Object> request = Map.of(
                "status", "invalid_status");

        mockMvc.perform(put("/withdrawals/{id}/status", withdrawalId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Lỗi tham số không hợp lệ")));
    }

    @Test
    @DisplayName("GET /withdrawals/{id} - endpoint chi tiết hiện trả về thông báo đang phát triển")
    void getWithdrawal_placeholder_returnsSuccessMessage() throws Exception {
        mockMvc.perform(get("/withdrawals/{id}", UUID.randomUUID()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Tính năng đang phát triển"));
    }
}
