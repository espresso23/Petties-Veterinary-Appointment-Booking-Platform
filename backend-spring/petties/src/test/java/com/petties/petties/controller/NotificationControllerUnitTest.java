package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.dto.notification.NotificationResponse;
import com.petties.petties.model.User;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.NotificationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NotificationController.class)
@DisplayName("NotificationController Unit Tests")
class NotificationControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private NotificationService notificationService;

        @MockitoBean
        private AuthService authService;

        @MockitoBean
        private JwtTokenProvider jwtTokenProvider;

        @MockitoBean
        private BlacklistedTokenRepository blacklistedTokenRepository;

        @MockitoBean
        private UserDetailsServiceImpl userDetailsService;

        @Autowired
        private ObjectMapper objectMapper;

        @Test
        @DisplayName("GET /notifications/me - Get my notifications returns 200")
        @WithMockUser
        void getMyNotifications_returns200() throws Exception {
                // Arrange
                User user = new User();
                user.setUserId(UUID.randomUUID());

                NotificationResponse notif = new NotificationResponse();
                notif.setNotificationId(UUID.randomUUID());
                notif.setMessage("Hello");

                when(authService.getCurrentUser()).thenReturn(user);
                when(notificationService.getNotificationsByUserId(eq(user.getUserId()), any(Pageable.class)))
                                .thenReturn(new PageImpl<>(List.of(notif)));

                // Act & Assert
                mockMvc.perform(get("/notifications/me"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.content[0].message").value("Hello"));
        }

        @Test
        @DisplayName("GET /notifications/me/unread-count - Get unread count returns 200")
        @WithMockUser
        void getUnreadCount_returns200() throws Exception {
                // Arrange
                User user = new User();
                user.setUserId(UUID.randomUUID());

                when(authService.getCurrentUser()).thenReturn(user);
                when(notificationService.getUnreadCountByUserId(user.getUserId())).thenReturn(5L);

                // Act & Assert
                mockMvc.perform(get("/notifications/me/unread-count"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.count").value(5));
        }

        @Test
        @DisplayName("PUT /notifications/{id}/read - Mark as read returns 200")
        @WithMockUser
        void markAsRead_returns200() throws Exception {
                // Arrange
                UUID notifId = UUID.randomUUID();
                User user = new User();
                user.setUserId(UUID.randomUUID());

                when(authService.getCurrentUser()).thenReturn(user);
                doNothing().when(notificationService).markAsRead(notifId, user.getUserId());

                // Act & Assert
                mockMvc.perform(put("/notifications/{id}/read", notifId)
                                .with(csrf()))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.message").exists());
        }

        @Test
        @DisplayName("PUT /notifications/me/mark-all-read - Mark all read returns 200")
        @WithMockUser
        void markAllAsRead_returns200() throws Exception {
                // Arrange
                User user = new User();
                user.setUserId(UUID.randomUUID());

                when(authService.getCurrentUser()).thenReturn(user);
                doNothing().when(notificationService).markAllAsReadByUserId(user.getUserId());

                // Act & Assert
                mockMvc.perform(put("/notifications/me/mark-all-read")
                                .with(csrf()))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.message").exists());
        }
}
