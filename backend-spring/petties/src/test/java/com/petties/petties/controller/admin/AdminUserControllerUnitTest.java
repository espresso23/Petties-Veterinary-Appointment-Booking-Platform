package com.petties.petties.controller.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.response.AdminUserSummaryResponse;
import com.petties.petties.dto.user.AdminRestrictUserRequest;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminUserController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("AdminUserController Unit Tests")
class AdminUserControllerUnitTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockitoBean
    private UserDetailsServiceImpl userDetailsService;

    @MockitoBean
    private BlacklistedTokenRepository blacklistedTokenRepository;

    @Test
    @DisplayName("TC-UNIT-ADMIN-USER-001: Get users with strikeStatus filter")
    void getUsersForNotificationTarget_withStrikeStatus_returns200() throws Exception {
        AdminUserSummaryResponse item = AdminUserSummaryResponse.builder()
                .userId(UUID.randomUUID())
                .username("user_a")
                .email("usera@example.com")
                .role(Role.STAFF)
                .createdAt(LocalDateTime.now())
                .build();

        when(userService.searchUsersForAdmin(any(), any(), any(), any(), eq("ACTIVE"), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(item)));

        mockMvc.perform(get("/admin/users")
                        .param("strikeStatus", "ACTIVE")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].username").value("user_a"));
    }

    @Test
    @DisplayName("TC-UNIT-ADMIN-USER-002: Restrict user success")
    void restrictUser_validPayload_returns200() throws Exception {
        UUID userId = UUID.randomUUID();
        AdminRestrictUserRequest request = AdminRestrictUserRequest.builder()
                .reason("Vi phạm chính sách nội dung nhiều lần")
                .isPermanent(false)
                .days(7)
                .build();

        AdminUserSummaryResponse response = AdminUserSummaryResponse.builder()
                .userId(userId)
                .username("restricted_user")
                .role(Role.PET_OWNER)
                .strikeUntil(LocalDateTime.now().plusDays(7))
                .build();

        when(userService.restrictUserForAdmin(eq(userId), any(AdminRestrictUserRequest.class))).thenReturn(response);

        mockMvc.perform(post("/admin/users/{userId}/restrict", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("restricted_user"));

        verify(userService).restrictUserForAdmin(eq(userId), any(AdminRestrictUserRequest.class));
    }

    @Test
    @DisplayName("TC-UNIT-ADMIN-USER-003: Lift user strike success")
    void liftUserStrike_validUser_returns200() throws Exception {
        UUID userId = UUID.randomUUID();
        AdminUserSummaryResponse response = AdminUserSummaryResponse.builder()
                .userId(userId)
                .username("restored_user")
                .role(Role.STAFF)
                .strikeUntil(null)
                .build();

        when(userService.liftUserStrikeForAdmin(userId)).thenReturn(response);

        mockMvc.perform(post("/admin/users/{userId}/lift-strike", userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("restored_user"));

        verify(userService).liftUserStrikeForAdmin(userId);
    }
}
