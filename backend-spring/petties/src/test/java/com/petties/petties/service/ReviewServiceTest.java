package com.petties.petties.service;

import com.petties.petties.dto.review.ReviewRequestDTO;
import com.petties.petties.dto.review.ReviewResponseDTO;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Review;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.ReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewServiceTest {

    @Mock
    private ReviewRepository reviewRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private ClinicRepository clinicRepository;

    @InjectMocks
    private ReviewService reviewService;

    private User user;
    private Clinic clinic;
    private Booking booking;
    private Review review;
    private ReviewRequestDTO reviewRequestDTO;

    @BeforeEach
    void setUp() {
        UUID userId = UUID.randomUUID();
        UUID clinicId = UUID.randomUUID();
        UUID bookingId = UUID.randomUUID();
        UUID reviewId = UUID.randomUUID();

        user = User.builder()
                .userId(userId)
                .username("testuser")
                .fullName("Test User")
                .build();

        clinic = Clinic.builder()
                .clinicId(clinicId)
                .name("Test Clinic")
                .build();

        booking = Booking.builder()
                .bookingId(bookingId)
                .bookingCode("BK-123")
                .petOwner(user)
                .clinic(clinic)
                .status(BookingStatus.COMPLETED)
                .build();

        review = Review.builder()
                .reviewId(reviewId)
                .booking(booking)
                .clinic(clinic)
                .user(user)
                .rating(5)
                .comment("Great service")
                .createdAt(LocalDateTime.now())
                .build();

        reviewRequestDTO = new ReviewRequestDTO();
        reviewRequestDTO.setBookingId(bookingId);
        reviewRequestDTO.setRating(5);
        reviewRequestDTO.setComment("Great service");
    }

    // --- Create Review Tests ---

    @Test
    @DisplayName("TC-001: Should create review successfully when valid data provided")
    void createReview_Success() {
        when(bookingRepository.findById(booking.getBookingId())).thenReturn(Optional.of(booking));
        when(reviewRepository.save(any(Review.class))).thenReturn(review);
        when(reviewRepository.getAverageRatingByClinicId(clinic.getClinicId())).thenReturn(5.0);
        when(reviewRepository.countByClinic_ClinicId(clinic.getClinicId())).thenReturn(1L);

        ReviewResponseDTO result = reviewService.createReview(user, reviewRequestDTO);

        assertNotNull(result);
        assertEquals(review.getReviewId(), result.getReviewId());
        assertEquals(5, result.getRating());
        assertEquals("Great service", result.getComment());

        verify(bookingRepository).findById(booking.getBookingId());
        verify(reviewRepository).save(any(Review.class));
        verify(clinicRepository).save(clinic);
    }

    @Test
    @DisplayName("TC-002: Should throw exception when booking not found")
    void createReview_BookingNotFound() {
        when(bookingRepository.findById(any())).thenReturn(Optional.empty());

        Exception exception = assertThrows(RuntimeException.class, () -> {
            reviewService.createReview(user, reviewRequestDTO);
        });
        assertEquals("Booking not found", exception.getMessage());
    }

    @Test
    @DisplayName("TC-003: Should throw exception when user is not the booking owner")
    void createReview_NotOwner() {
        User otherUser = User.builder().userId(UUID.randomUUID()).build();
        when(bookingRepository.findById(booking.getBookingId())).thenReturn(Optional.of(booking));

        Exception exception = assertThrows(RuntimeException.class, () -> {
            reviewService.createReview(otherUser, reviewRequestDTO);
        });
        assertEquals("You are not the owner of this booking", exception.getMessage());
    }

    @Test
    @DisplayName("TC-004: Should throw exception when booking is not completed")
    void createReview_NotCompleted() {
        booking.setStatus(BookingStatus.CONFIRMED);
        when(bookingRepository.findById(booking.getBookingId())).thenReturn(Optional.of(booking));

        Exception exception = assertThrows(RuntimeException.class, () -> {
            reviewService.createReview(user, reviewRequestDTO);
        });
        assertEquals("Booking is not completed yet", exception.getMessage());
    }

    @Test
    @DisplayName("TC-005: Should throw exception when booking is already reviewed")
    void createReview_AlreadyReviewed() {
        booking.setReview(review);
        when(bookingRepository.findById(booking.getBookingId())).thenReturn(Optional.of(booking));

        Exception exception = assertThrows(RuntimeException.class, () -> {
            reviewService.createReview(user, reviewRequestDTO);
        });
        assertEquals("Booking already reviewed", exception.getMessage());
    }

    @Test
    @DisplayName("TC-006: Should create review successfully with minimum boundary rating (1)")
    void createReview_MinBoundaryRating() {
        reviewRequestDTO.setRating(1);
        review.setRating(1);
        
        when(bookingRepository.findById(booking.getBookingId())).thenReturn(Optional.of(booking));
        when(reviewRepository.save(any(Review.class))).thenReturn(review);
        when(reviewRepository.getAverageRatingByClinicId(clinic.getClinicId())).thenReturn(1.0);
        when(reviewRepository.countByClinic_ClinicId(clinic.getClinicId())).thenReturn(1L);

        ReviewResponseDTO result = reviewService.createReview(user, reviewRequestDTO);

        assertNotNull(result);
        assertEquals(1, result.getRating());
        verify(reviewRepository).save(any(Review.class));
    }

    @Test
    @DisplayName("TC-007: Should handle invalid rating 0 gracefully")
    void createReview_InvalidRatingZero() {
        reviewRequestDTO.setRating(0);
        review.setRating(0);
        
        // Assuming service accepts what DTO passes and relies on validation at Controller layer
        // So here we test Service layer logic (it saves 0 unless explicit check exists).
        when(bookingRepository.findById(booking.getBookingId())).thenReturn(Optional.of(booking));
        when(reviewRepository.save(any(Review.class))).thenReturn(review);
        when(reviewRepository.getAverageRatingByClinicId(clinic.getClinicId())).thenReturn(0.0);
        when(reviewRepository.countByClinic_ClinicId(clinic.getClinicId())).thenReturn(1L);

        ReviewResponseDTO result = reviewService.createReview(user, reviewRequestDTO);
        assertEquals(0, result.getRating());
    }

    @Test
    @DisplayName("TC-008: Should throw exception when bookingId is null")
    void createReview_NullBookingId() {
        reviewRequestDTO.setBookingId(null);
        // By default findById(null) in Spring Data JPA throws InvalidDataAccessApiUsageException 
        // We simulate RuntimeException "Booking not found" or handle gracefully.
        when(bookingRepository.findById(null)).thenThrow(new IllegalArgumentException("id is null"));

        assertThrows(IllegalArgumentException.class, () -> {
            reviewService.createReview(user, reviewRequestDTO);
        });
    }

    // --- Update Review Tests ---

    @Test
    @DisplayName("TC-009: Should update review successfully")
    void updateReview_Success() {
        ReviewRequestDTO updateRequest = new ReviewRequestDTO();
        updateRequest.setRating(4);
        updateRequest.setComment("Updated comment");

        when(reviewRepository.findById(review.getReviewId())).thenReturn(Optional.of(review));
        when(reviewRepository.save(any(Review.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reviewRepository.getAverageRatingByClinicId(clinic.getClinicId())).thenReturn(4.5);
        when(reviewRepository.countByClinic_ClinicId(clinic.getClinicId())).thenReturn(1L);

        ReviewResponseDTO result = reviewService.updateReview(review.getReviewId(), user, updateRequest);

        assertEquals(4, result.getRating());
        assertEquals("Updated comment", result.getComment());

        verify(reviewRepository).save(review);
        verify(clinicRepository).save(clinic);
    }

    @Test
    @DisplayName("TC-010: Should throw exception when updating non-existent review")
    void updateReview_ReviewNotFound() {
        when(reviewRepository.findById(any())).thenReturn(Optional.empty());

        Exception exception = assertThrows(RuntimeException.class, () -> {
            reviewService.updateReview(UUID.randomUUID(), user, reviewRequestDTO);
        });
        assertEquals("Review not found", exception.getMessage());
    }

    @Test
    @DisplayName("TC-011: Should throw exception when user is not the review owner")
    void updateReview_NotOwner() {
        User otherUser = User.builder().userId(UUID.randomUUID()).build();
        when(reviewRepository.findById(review.getReviewId())).thenReturn(Optional.of(review));

        Exception exception = assertThrows(RuntimeException.class, () -> {
            reviewService.updateReview(review.getReviewId(), otherUser, reviewRequestDTO);
        });
        assertEquals("You are not allowed to update this review", exception.getMessage());
    }

    @Test
    @DisplayName("TC-012: Should update review successfully with boundary rating (1)")
    void updateReview_MinBoundaryRating() {
        ReviewRequestDTO updateRequest = new ReviewRequestDTO();
        updateRequest.setRating(1);
        updateRequest.setComment("Updated");

        when(reviewRepository.findById(review.getReviewId())).thenReturn(Optional.of(review));
        when(reviewRepository.save(any(Review.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reviewRepository.getAverageRatingByClinicId(clinic.getClinicId())).thenReturn(1.0);
        when(reviewRepository.countByClinic_ClinicId(clinic.getClinicId())).thenReturn(1L);

        ReviewResponseDTO result = reviewService.updateReview(review.getReviewId(), user, updateRequest);

        assertEquals(1, result.getRating());
        verify(reviewRepository).save(review);
    }

    @Test
    @DisplayName("TC-013: Should update review successfully with boundary max rating (5)")
    void updateReview_MaxBoundaryRating() {
        ReviewRequestDTO updateRequest = new ReviewRequestDTO();
        updateRequest.setRating(5);
        updateRequest.setComment("Updated");

        when(reviewRepository.findById(review.getReviewId())).thenReturn(Optional.of(review));
        when(reviewRepository.save(any(Review.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reviewRepository.getAverageRatingByClinicId(clinic.getClinicId())).thenReturn(5.0);
        when(reviewRepository.countByClinic_ClinicId(clinic.getClinicId())).thenReturn(1L);

        ReviewResponseDTO result = reviewService.updateReview(review.getReviewId(), user, updateRequest);

        assertEquals(5, result.getRating());
        verify(reviewRepository).save(review);
    }

    @Test
    @DisplayName("TC-014: Should handle update review with invalid rating (0) gracefully")
    void updateReview_InvalidRatingZero() {
        ReviewRequestDTO updateRequest = new ReviewRequestDTO();
        updateRequest.setRating(0);
        updateRequest.setComment("Updated");

        when(reviewRepository.findById(review.getReviewId())).thenReturn(Optional.of(review));
        when(reviewRepository.save(any(Review.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reviewRepository.getAverageRatingByClinicId(clinic.getClinicId())).thenReturn(0.0);
        when(reviewRepository.countByClinic_ClinicId(clinic.getClinicId())).thenReturn(1L);

        ReviewResponseDTO result = reviewService.updateReview(review.getReviewId(), user, updateRequest);

        assertEquals(0, result.getRating());
    }

    @Test
    @DisplayName("TC-015: Should throw exception when reviewId is null")
    void updateReview_NullReviewId() {
        when(reviewRepository.findById(null)).thenThrow(new IllegalArgumentException("id is null"));

        assertThrows(IllegalArgumentException.class, () -> {
            reviewService.updateReview(null, user, reviewRequestDTO);
        });
    }

    // --- Get Clinic Reviews Tests ---

    @Test
    @DisplayName("TC-016: Should return list of reviews for clinic with multiple reviews")
    void getClinicReviews_Success_Multiple() {
        Review review2 = Review.builder()
                .reviewId(UUID.randomUUID())
                .user(user)
                .rating(4)
                .comment("Good service")
                .createdAt(LocalDateTime.now().minusDays(1))
                .build();
        
        when(reviewRepository.findByClinic_ClinicIdOrderByCreatedAtDesc(clinic.getClinicId()))
                .thenReturn(Arrays.asList(review, review2));

        List<ReviewResponseDTO> results = reviewService.getClinicReviews(clinic.getClinicId());

        assertFalse(results.isEmpty());
        assertEquals(2, results.size());
        assertEquals(review.getReviewId(), results.get(0).getReviewId()); // verify desc order assumption here
    }

    @Test
    @DisplayName("TC-017: Should return a list for a clinic with exactly 1 review")
    void getClinicReviews_Success_Single() {
        when(reviewRepository.findByClinic_ClinicIdOrderByCreatedAtDesc(clinic.getClinicId()))
                .thenReturn(List.of(review));

        List<ReviewResponseDTO> results = reviewService.getClinicReviews(clinic.getClinicId());

        assertFalse(results.isEmpty());
        assertEquals(1, results.size());
        assertEquals(review.getReviewId(), results.get(0).getReviewId());
    }

    @Test
    @DisplayName("TC-018: Should return empty list when no reviews found")
    void getClinicReviews_Empty() {
        when(reviewRepository.findByClinic_ClinicIdOrderByCreatedAtDesc(clinic.getClinicId()))
                .thenReturn(Collections.emptyList());

        List<ReviewResponseDTO> results = reviewService.getClinicReviews(clinic.getClinicId());

        assertTrue(results.isEmpty());
    }

    @Test
    @DisplayName("TC-019: Should return empty list for non-existent clinicId")
    void getClinicReviews_NonExistentClinic() {
        UUID randomId = UUID.randomUUID();
        when(reviewRepository.findByClinic_ClinicIdOrderByCreatedAtDesc(randomId))
                .thenReturn(Collections.emptyList());

        List<ReviewResponseDTO> results = reviewService.getClinicReviews(randomId);

        assertTrue(results.isEmpty());
    }

    @Test
    @DisplayName("TC-020: Should handle null clinicId gracefully")
    void getClinicReviews_NullClinicId() {
        when(reviewRepository.findByClinic_ClinicIdOrderByCreatedAtDesc(null))
                .thenReturn(Collections.emptyList());
                
        List<ReviewResponseDTO> results = reviewService.getClinicReviews(null);

        assertTrue(results.isEmpty());
    }

    @Test
    @DisplayName("TC-021: Verify response contains userName and rating fields")
    void getClinicReviews_VerifyFields() {
        user.setAvatar("https://example.com/avatar.jpg");
        when(reviewRepository.findByClinic_ClinicIdOrderByCreatedAtDesc(clinic.getClinicId()))
                .thenReturn(List.of(review));

        List<ReviewResponseDTO> results = reviewService.getClinicReviews(clinic.getClinicId());

        assertEquals(1, results.size());
        ReviewResponseDTO dto = results.get(0);
        assertEquals("Test User", dto.getUserName());
        assertEquals("https://example.com/avatar.jpg", dto.getUserAvatar());
        assertEquals(5, dto.getRating());
        assertEquals("Great service", dto.getComment());
    }
}
