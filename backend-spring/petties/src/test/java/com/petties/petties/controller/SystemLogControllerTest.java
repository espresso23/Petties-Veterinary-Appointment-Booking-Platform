package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.SystemLogService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SystemLogController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("SystemLogController Unit Tests")
class SystemLogControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private SystemLogService systemLogService;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private UserDetailsServiceImpl userDetailsService;

    @MockitoBean
    private BlacklistedTokenRepository blacklistedTokenRepository;

    @Test
    @DisplayName("TC-UNIT-SYSLOG-001: Get Logs Returns 200")
    void getBackendLogs_returns200() throws Exception {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("total", 1);
        payload.put("items", List.of());

        when(systemLogService.getBackendLogs(1, 30, null, null, null, null, "ALL"))
                .thenReturn(payload);

        mockMvc.perform(get("/admin/system-logs/backend")
                        .param("source", "ALL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1));
    }

    @Test
    @DisplayName("TC-UNIT-SYSLOG-002: Bulk Delete Returns 200")
    void bulkDeleteAuditLogs_returns200() throws Exception {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("deleted_count", 2);
        payload.put("message", "Đã xóa 2 bản ghi audit log.");

        when(systemLogService.bulkDeleteAuditLogs(eq(List.of("evt-1", "evt-2")), eq("ALL"), any()))
                .thenReturn(payload);

        Map<String, Object> request = Map.of(
                "eventIds", List.of("evt-1", "evt-2"),
                "source", "ALL"
        );

        mockMvc.perform(delete("/admin/system-logs/backend/bulk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted_count").value(2));
    }

    @Test
    @DisplayName("TC-UNIT-SYSLOG-003: Delete Time Range Invalid Returns 400")
    void deleteByTimeRange_invalid_returns400() throws Exception {
        when(systemLogService.deleteAuditLogsByTimeRange(any(), any(), eq("ALL"), any()))
                .thenThrow(new BadRequestException("Thoi gian bat dau khong duoc lon hon thoi gian ket thuc."));

        Map<String, Object> request = Map.of(
                "fromTime", "2026-04-20T12:00:00Z",
                "toTime", "2026-04-19T12:00:00Z",
                "source", "ALL"
        );

        mockMvc.perform(delete("/admin/system-logs/backend/time-range")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}
