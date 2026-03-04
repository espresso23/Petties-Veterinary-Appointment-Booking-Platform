package com.petties.petties.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petties.petties.config.JwtAuthenticationFilter;
import com.petties.petties.config.JwtTokenProvider;
import com.petties.petties.config.UserDetailsServiceImpl;
import com.petties.petties.dto.review.ReviewRequestDTO;
import com.petties.petties.dto.review.ReviewResponseDTO;
import com.petties.petties.model.User;
import com.petties.petties.repository.BlacklistedTokenRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.service.ReviewService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Unit tests for ReviewController using @WebMvcTest and MockMvc.
 *
 * Tests cover:
 * - Create Review (Pet Owner)
 * - Update Review (Pet Owner)
 * - Delete Review (Pet Owner)
 * - Get Clinic Reviews (Public)
 *
 * Each endpoint tests:
 * - Happy path (200/201/204)
 * - Validation errors (400)
 * - Not found / business errors (500 - RuntimeException)
 */
@WebMvcTest(ReviewController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ReviewController Unit Tests")
class ReviewControllerUnitTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private ReviewService reviewService;

        @MockitoBean
        private UserRepository userRepository;

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

        // ==================== HELPER METHODS ====================

        private ReviewResponseDTO createMockReviewResponse() {
                return ReviewResponseDTO.builder()
                                .reviewId(UUID.randomUUID())
                                .rating(5)
                                .comment("Dịch vụ rất tốt")
                                .userName("Nguyễn Văn A")
                                .userAvatar("https://cloudinary.com/avatar.jpg")
                                .createdAt(LocalDateTime.now())
                                .build();
        }

        private ReviewRequestDTO createMockReviewRequest() {
                ReviewRequestDTO request = new ReviewRequestDTO();
                request.setBookingId(UUID.randomUUID());
                request.setRating(5);
                request.setComment("Dịch vụ rất tốt");
                return request;
        }

        private User createMockUser(UUID userId) {
                return User.builder()
                                .userId(userId)
                                .username("testuser")
                                .fullName("Nguyễn Văn A")
                                .build();
        }

        /**
         * Helper method to setup SecurityContext with UserPrincipal
         * Required because ReviewController casts UserDetails to UserPrincipal
         */
        private void setupUserPrincipalAuth(UUID userId) {
                UserDetailsServiceImpl.UserPrincipal userPrincipal = mock(UserDetailsServiceImpl.UserPrincipal.class);
                when(userPrincipal.getUserId()).thenReturn(userId);

                Authentication authentication = mock(Authentication.class);
                when(authentication.getPrincipal()).thenReturn(userPrincipal);

                SecurityContext securityContext = mock(SecurityContext.class);
                when(securityContext.getAuthentication()).thenReturn(authentication);

                SecurityContextHolder.setContext(securityContext);
        }

        // ==================== CREATE REVIEW TESTS ====================

        @Test
        @DisplayName("TC-REVIEW-CREATE-001: Create review with valid request - Returns 201")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void createReview_validRequest_returns201() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                setupUserPrincipalAuth(userId);

                User user = createMockUser(userId);
                when(userRepository.findById(userId)).thenReturn(Optional.of(user));

                ReviewRequestDTO request = createMockReviewRequest();
                ReviewResponseDTO response = createMockReviewResponse();

                when(reviewService.createReview(any(User.class), any(ReviewRequestDTO.class)))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(post("/reviews")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.reviewId").exists())
                                .andExpect(jsonPath("$.rating").value(5))
                                .andExpect(jsonPath("$.comment").value("Dịch vụ rất tốt"))
                                .andExpect(jsonPath("$.userName").value("Nguyễn Văn A"));

                verify(reviewService).createReview(any(User.class), any(ReviewRequestDTO.class));
        }

        @Test
        @DisplayName("TC-REVIEW-CREATE-002: Create review without bookingId - Returns 400")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void createReview_missingBookingId_returns400() throws Exception {
                // Arrange - Request without bookingId (@NotNull violation)
                ReviewRequestDTO request = new ReviewRequestDTO();
                request.setRating(5);
                request.setComment("Great");

                // Act & Assert
                mockMvc.perform(post("/reviews")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(reviewService, never()).createReview(any(), any());
        }

        @Test
        @DisplayName("TC-REVIEW-CREATE-003: Create review with rating below minimum (0) - Returns 400")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void createReview_ratingBelowMin_returns400() throws Exception {
                // Arrange - Rating = 0, violates @Min(1)
                ReviewRequestDTO request = new ReviewRequestDTO();
                request.setBookingId(UUID.randomUUID());
                request.setRating(0);
                request.setComment("Bad");

                // Act & Assert
                mockMvc.perform(post("/reviews")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(reviewService, never()).createReview(any(), any());
        }

        @Test
        @DisplayName("TC-REVIEW-CREATE-004: Create review with rating above maximum (6) - Returns 400")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void createReview_ratingAboveMax_returns400() throws Exception {
                // Arrange - Rating = 6, violates @Max(5)
                ReviewRequestDTO request = new ReviewRequestDTO();
                request.setBookingId(UUID.randomUUID());
                request.setRating(6);
                request.setComment("Perfect");

                // Act & Assert
                mockMvc.perform(post("/reviews")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(reviewService, never()).createReview(any(), any());
        }

        @Test
        @DisplayName("TC-REVIEW-CREATE-005: Create review - Booking not found - Returns 500")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void createReview_bookingNotFound_returns500() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                setupUserPrincipalAuth(userId);

                User user = createMockUser(userId);
                when(userRepository.findById(userId)).thenReturn(Optional.of(user));

                ReviewRequestDTO request = createMockReviewRequest();

                when(reviewService.createReview(any(User.class), any(ReviewRequestDTO.class)))
                                .thenThrow(new RuntimeException("Booking not found"));

                // Act & Assert
                mockMvc.perform(post("/reviews")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isInternalServerError());
        }

        @Test
        @DisplayName("TC-REVIEW-CREATE-006: Create review - Not booking owner - Returns 500")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void createReview_notBookingOwner_returns500() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                setupUserPrincipalAuth(userId);

                User user = createMockUser(userId);
                when(userRepository.findById(userId)).thenReturn(Optional.of(user));

                ReviewRequestDTO request = createMockReviewRequest();

                when(reviewService.createReview(any(User.class), any(ReviewRequestDTO.class)))
                                .thenThrow(new RuntimeException("You are not the owner of this booking"));

                // Act & Assert
                mockMvc.perform(post("/reviews")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isInternalServerError());
        }

        @Test
        @DisplayName("TC-REVIEW-CREATE-007: Create review - Booking not completed - Returns 500")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void createReview_bookingNotCompleted_returns500() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                setupUserPrincipalAuth(userId);

                User user = createMockUser(userId);
                when(userRepository.findById(userId)).thenReturn(Optional.of(user));

                ReviewRequestDTO request = createMockReviewRequest();

                when(reviewService.createReview(any(User.class), any(ReviewRequestDTO.class)))
                                .thenThrow(new RuntimeException("Booking is not completed yet"));

                // Act & Assert
                mockMvc.perform(post("/reviews")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isInternalServerError());
        }

        @Test
        @DisplayName("TC-REVIEW-CREATE-008: Create review - Booking already reviewed - Returns 500")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void createReview_alreadyReviewed_returns500() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                setupUserPrincipalAuth(userId);

                User user = createMockUser(userId);
                when(userRepository.findById(userId)).thenReturn(Optional.of(user));

                ReviewRequestDTO request = createMockReviewRequest();

                when(reviewService.createReview(any(User.class), any(ReviewRequestDTO.class)))
                                .thenThrow(new RuntimeException("Booking already reviewed"));

                // Act & Assert
                mockMvc.perform(post("/reviews")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isInternalServerError());
        }

        @Test
        @DisplayName("TC-REVIEW-CREATE-009: Create review - User not found - Returns 500")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void createReview_userNotFound_returns500() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                setupUserPrincipalAuth(userId);

                when(userRepository.findById(userId)).thenReturn(Optional.empty());

                ReviewRequestDTO request = createMockReviewRequest();

                // Act & Assert
                mockMvc.perform(post("/reviews")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isInternalServerError());

                verify(reviewService, never()).createReview(any(), any());
        }

        // ==================== UPDATE REVIEW TESTS ====================

        @Test
        @DisplayName("TC-REVIEW-UPDATE-001: Update review with valid request - Returns 200")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void updateReview_validRequest_returns200() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                UUID reviewId = UUID.randomUUID();
                setupUserPrincipalAuth(userId);

                User user = createMockUser(userId);
                when(userRepository.findById(userId)).thenReturn(Optional.of(user));

                ReviewRequestDTO request = new ReviewRequestDTO();
                request.setBookingId(UUID.randomUUID());
                request.setRating(4);
                request.setComment("Cập nhật đánh giá");

                ReviewResponseDTO response = ReviewResponseDTO.builder()
                                .reviewId(reviewId)
                                .rating(4)
                                .comment("Cập nhật đánh giá")
                                .userName("Nguyễn Văn A")
                                .createdAt(LocalDateTime.now())
                                .build();

                when(reviewService.updateReview(eq(reviewId), any(User.class), any(ReviewRequestDTO.class)))
                                .thenReturn(response);

                // Act & Assert
                mockMvc.perform(put("/reviews/{reviewId}", reviewId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.rating").value(4))
                                .andExpect(jsonPath("$.comment").value("Cập nhật đánh giá"));

                verify(reviewService).updateReview(eq(reviewId), any(User.class), any(ReviewRequestDTO.class));
        }

        @Test
        @DisplayName("TC-REVIEW-UPDATE-002: Update review without bookingId - Returns 400")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void updateReview_missingBookingId_returns400() throws Exception {
                // Arrange - Request without bookingId (@NotNull violation)
                UUID reviewId = UUID.randomUUID();
                ReviewRequestDTO request = new ReviewRequestDTO();
                request.setRating(4);
                request.setComment("Updated");

                // Act & Assert
                mockMvc.perform(put("/reviews/{reviewId}", reviewId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isBadRequest());

                verify(reviewService, never()).updateReview(any(), any(), any());
        }

        @Test
        @DisplayName("TC-REVIEW-UPDATE-003: Update review - Review not found - Returns 500")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void updateReview_reviewNotFound_returns500() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                UUID reviewId = UUID.randomUUID();
                setupUserPrincipalAuth(userId);

                User user = createMockUser(userId);
                when(userRepository.findById(userId)).thenReturn(Optional.of(user));

                ReviewRequestDTO request = createMockReviewRequest();

                when(reviewService.updateReview(eq(reviewId), any(User.class), any(ReviewRequestDTO.class)))
                                .thenThrow(new RuntimeException("Review not found"));

                // Act & Assert
                mockMvc.perform(put("/reviews/{reviewId}", reviewId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isInternalServerError());
        }

        @Test
        @DisplayName("TC-REVIEW-UPDATE-004: Update review - Not review owner - Returns 500")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void updateReview_notOwner_returns500() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                UUID reviewId = UUID.randomUUID();
                setupUserPrincipalAuth(userId);

                User user = createMockUser(userId);
                when(userRepository.findById(userId)).thenReturn(Optional.of(user));

                ReviewRequestDTO request = createMockReviewRequest();

                when(reviewService.updateReview(eq(reviewId), any(User.class), any(ReviewRequestDTO.class)))
                                .thenThrow(new RuntimeException("You are not allowed to update this review"));

                // Act & Assert
                mockMvc.perform(put("/reviews/{reviewId}", reviewId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isInternalServerError());
        }

        // ==================== DELETE REVIEW TESTS ====================

        @Test
        @DisplayName("TC-REVIEW-DELETE-001: Delete review with valid request - Returns 204")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void deleteReview_validRequest_returns204() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                UUID reviewId = UUID.randomUUID();
                setupUserPrincipalAuth(userId);

                User user = createMockUser(userId);
                when(userRepository.findById(userId)).thenReturn(Optional.of(user));

                doNothing().when(reviewService).deleteReview(eq(reviewId), any(User.class));

                // Act & Assert
                mockMvc.perform(delete("/reviews/{reviewId}", reviewId))
                                .andExpect(status().isNoContent());

                verify(reviewService).deleteReview(eq(reviewId), any(User.class));
        }

        @Test
        @DisplayName("TC-REVIEW-DELETE-002: Delete review - Review not found - Returns 500")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void deleteReview_reviewNotFound_returns500() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                UUID reviewId = UUID.randomUUID();
                setupUserPrincipalAuth(userId);

                User user = createMockUser(userId);
                when(userRepository.findById(userId)).thenReturn(Optional.of(user));

                doThrow(new RuntimeException("Review not found"))
                                .when(reviewService).deleteReview(eq(reviewId), any(User.class));

                // Act & Assert
                mockMvc.perform(delete("/reviews/{reviewId}", reviewId))
                                .andExpect(status().isInternalServerError());
        }

        @Test
        @DisplayName("TC-REVIEW-DELETE-003: Delete review - Not review owner - Returns 500")
        @WithMockUser(username = "11111111-1111-1111-1111-111111111111", roles = "PET_OWNER")
        void deleteReview_notOwner_returns500() throws Exception {
                // Arrange
                UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
                UUID reviewId = UUID.randomUUID();
                setupUserPrincipalAuth(userId);

                User user = createMockUser(userId);
                when(userRepository.findById(userId)).thenReturn(Optional.of(user));

                doThrow(new RuntimeException("You are not allowed to delete this review"))
                                .when(reviewService).deleteReview(eq(reviewId), any(User.class));

                // Act & Assert
                mockMvc.perform(delete("/reviews/{reviewId}", reviewId))
                                .andExpect(status().isInternalServerError());
        }

        // ==================== GET CLINIC REVIEWS TESTS ====================

        @Test
        @DisplayName("TC-REVIEW-GET-001: Get clinic reviews - Returns 200 with list")
        @WithMockUser(roles = "PET_OWNER")
        void getClinicReviews_validClinicId_returns200() throws Exception {
                // Arrange
                UUID clinicId = UUID.randomUUID();
                ReviewResponseDTO review1 = ReviewResponseDTO.builder()
                                .reviewId(UUID.randomUUID())
                                .rating(5)
                                .comment("Rất tốt")
                                .userName("Nguyễn Văn A")
                                .createdAt(LocalDateTime.now())
                                .build();
                ReviewResponseDTO review2 = ReviewResponseDTO.builder()
                                .reviewId(UUID.randomUUID())
                                .rating(4)
                                .comment("Tốt")
                                .userName("Trần Thị B")
                                .createdAt(LocalDateTime.now())
                                .build();

                when(reviewService.getClinicReviews(clinicId)).thenReturn(List.of(review1, review2));

                // Act & Assert
                mockMvc.perform(get("/reviews/clinic/{clinicId}", clinicId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$").isArray())
                                .andExpect(jsonPath("$.length()").value(2))
                                .andExpect(jsonPath("$[0].rating").value(5))
                                .andExpect(jsonPath("$[0].comment").value("Rất tốt"))
                                .andExpect(jsonPath("$[1].rating").value(4))
                                .andExpect(jsonPath("$[1].userName").value("Trần Thị B"));

                verify(reviewService).getClinicReviews(clinicId);
        }

        @Test
        @DisplayName("TC-REVIEW-GET-002: Get clinic reviews - Empty result - Returns 200")
        @WithMockUser(roles = "PET_OWNER")
        void getClinicReviews_emptyResult_returns200WithEmptyList() throws Exception {
                // Arrange
                UUID clinicId = UUID.randomUUID();

                when(reviewService.getClinicReviews(clinicId)).thenReturn(Collections.emptyList());

                // Act & Assert
                mockMvc.perform(get("/reviews/clinic/{clinicId}", clinicId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$").isArray())
                                .andExpect(jsonPath("$.length()").value(0));

                verify(reviewService).getClinicReviews(clinicId);
        }

        @Test
        @DisplayName("TC-REVIEW-GET-003: Get clinic reviews with single review - Returns 200")
        @WithMockUser(roles = "PET_OWNER")
        void getClinicReviews_singleReview_returns200() throws Exception {
                // Arrange
                UUID clinicId = UUID.randomUUID();
                ReviewResponseDTO review = createMockReviewResponse();

                when(reviewService.getClinicReviews(clinicId)).thenReturn(List.of(review));

                // Act & Assert
                mockMvc.perform(get("/reviews/clinic/{clinicId}", clinicId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$").isArray())
                                .andExpect(jsonPath("$.length()").value(1))
                                .andExpect(jsonPath("$[0].reviewId").exists())
                                .andExpect(jsonPath("$[0].rating").value(5))
                                .andExpect(jsonPath("$[0].userName").value("Nguyễn Văn A"))
                                .andExpect(jsonPath("$[0].userAvatar").exists());
        }
}
