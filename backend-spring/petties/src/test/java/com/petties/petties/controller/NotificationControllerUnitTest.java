package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.notification.NotificationResponse;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.NotificationType;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.NotificationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for NotificationController using @WebMvcTest and MockMvc.
 * Follows CONTROLLER_TESTING_GUIDE.md standards (Flat structure).
 */
@WebMvcTest(NotificationController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("NotificationController Unit Tests")
class NotificationControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private NotificationService notificationService;

        @MockitoBean
        private AuthService authService;

        // Security-related dependencies for JwtAuthenticationFilter
        @MockitoBean
        private JwtTokenProvider jwtTokenProvider;

        @MockitoBean
        private JwtAuthenticationFilter jwtAuthenticationFilter;

        @MockitoBean
        private UserDetailsServiceImpl userDetailsService;

        @MockitoBean
        private BlacklistedTokenRepository blacklistedTokenRepository;

        @Autowired
        private ObjectMapper objectMapper;

        // --- Helper Methods ---

        private User mockUser() {
                User u = new User();
                u.setUserId(UUID.randomUUID());
                return u;
        }

        private NotificationResponse mockNotification(UUID id, NotificationType type, boolean read) {
                return NotificationResponse.builder()
                                .notificationId(id)
                                .clinicId(UUID.randomUUID())
                                .clinicName("Test Clinic")
                                .type(type)
                                .message("Test notification message")
                                .read(read)
                                .createdAt(LocalDateTime.now())
                                .build();
        }

        // ==================== GET CLINIC NOTIFICATIONS TESTS ====================

        @Test
        @DisplayName("TC-UNIT-NOTIF-001: Success - returns paged clinic notifications")
        void getClinicNotifications_validRequest_returns200() throws Exception {
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);

                Page<NotificationResponse> page = new PageImpl<>(List.of(
                                mockNotification(UUID.randomUUID(), NotificationType.APPROVED, false),
                                mockNotification(UUID.randomUUID(), NotificationType.REJECTED, true)));

                when(notificationService.getNotificationsByUserId(eq(user.getUserId()), any())).thenReturn(page);

                mockMvc.perform(get("/notifications/clinic")
                                .param("page", "0")
                                .param("size", "20"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content", hasSize(2)))
                                .andExpect(jsonPath("$.content[0].type").value("APPROVED"))
                                .andExpect(jsonPath("$.content[1].type").value("REJECTED"));
        }

        @Test
        @DisplayName("TC-UNIT-NOTIF-002: Success - empty notifications")
        void getClinicNotifications_emptyResult_returns200() throws Exception {
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);

                Page<NotificationResponse> emptyPage = new PageImpl<>(List.of());
                when(notificationService.getNotificationsByUserId(eq(user.getUserId()), any())).thenReturn(emptyPage);

                mockMvc.perform(get("/notifications/clinic"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content", hasSize(0)));
        }

        @Test
        @DisplayName("TC-UNIT-NOTIF-003: Success - with pagination")
        void getClinicNotifications_withPagination_returns200() throws Exception {
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);

                Page<NotificationResponse> page = new PageImpl<>(List.of(
                                mockNotification(UUID.randomUUID(), NotificationType.PENDING, false)));

                when(notificationService.getNotificationsByUserId(eq(user.getUserId()), any())).thenReturn(page);

                mockMvc.perform(get("/notifications/clinic")
                                .param("page", "1")
                                .param("size", "10"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content", hasSize(1)));
        }

        // ==================== GET UNREAD COUNT TESTS ====================

        @Test
        @DisplayName("TC-UNIT-NOTIF-004: Success - returns unread count")
        void getUnreadCount_hasUnread_returns200() throws Exception {
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);
                when(notificationService.getUnreadCountByUserId(user.getUserId())).thenReturn(5L);

                mockMvc.perform(get("/notifications/clinic/unread-count"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.count").value(5));
        }

        @Test
        @DisplayName("TC-UNIT-NOTIF-005: Success - zero unread count")
        void getUnreadCount_noUnread_returns200() throws Exception {
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);
                when(notificationService.getUnreadCountByUserId(user.getUserId())).thenReturn(0L);

                mockMvc.perform(get("/notifications/clinic/unread-count"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.count").value(0));
        }

        // ==================== MARK AS READ TESTS ====================

        @Test
        @DisplayName("TC-UNIT-NOTIF-006: Success - mark notification as read")
        void markAsRead_validRequest_returns200() throws Exception {
                UUID notificationId = UUID.randomUUID();
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);
                doNothing().when(notificationService).markAsRead(eq(notificationId), eq(user.getUserId()));

                mockMvc.perform(put("/notifications/{id}/read", notificationId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.message").value("Notification marked as read"));
        }

        @Test
        @DisplayName("TC-UNIT-NOTIF-007: Fail - notification not found")
        void markAsRead_notificationNotFound_returns404() throws Exception {
                UUID notificationId = UUID.randomUUID();
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);
                doThrow(new ResourceNotFoundException("Notification not found"))
                                .when(notificationService).markAsRead(eq(notificationId), eq(user.getUserId()));

                mockMvc.perform(put("/notifications/{id}/read", notificationId))
                                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("TC-UNIT-NOTIF-008: Fail - not owner of notification")
        void markAsRead_notOwner_returns403() throws Exception {
                UUID notificationId = UUID.randomUUID();
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);
                doThrow(new ForbiddenException("You can only mark your own notifications as read"))
                                .when(notificationService).markAsRead(eq(notificationId), eq(user.getUserId()));

                mockMvc.perform(put("/notifications/{id}/read", notificationId))
                                .andExpect(status().isForbidden());
        }

        // ==================== MARK ALL AS READ TESTS ====================

        @Test
        @DisplayName("TC-UNIT-NOTIF-009: Success - mark all notifications as read")
        void markAllAsRead_validRequest_returns200() throws Exception {
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);
                doNothing().when(notificationService).markAllAsReadByUserId(eq(user.getUserId()));

                mockMvc.perform(put("/notifications/clinic/mark-all-read"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.message").value("All notifications marked as read"));
        }

        @Test
        @DisplayName("TC-UNIT-NOTIF-010: Success - mark all when no notifications")
        void markAllAsRead_noNotifications_returns200() throws Exception {
                User user = mockUser();
                when(authService.getCurrentUser()).thenReturn(user);
                doNothing().when(notificationService).markAllAsReadByUserId(eq(user.getUserId()));

                mockMvc.perform(put("/notifications/clinic/mark-all-read"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.message").value("All notifications marked as read"));
        }
}

