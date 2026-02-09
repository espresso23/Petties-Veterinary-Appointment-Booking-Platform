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

import java.math.BigDecimal;
import java.time.LocalDateTime;
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
    @DisplayName("Should create review successfully when valid data provided")
    void createReview_Success() {
        // Arrange
        when(bookingRepository.findById(booking.getBookingId())).thenReturn(Optional.of(booking));
        when(reviewRepository.save(any(Review.class))).thenReturn(review);
        when(reviewRepository.getAverageRatingByClinicId(clinic.getClinicId())).thenReturn(5.0);
        when(reviewRepository.countByClinic_ClinicId(clinic.getClinicId())).thenReturn(1L);

        // Act
        ReviewResponseDTO result = reviewService.createReview(user, reviewRequestDTO);

        // Assert
        assertNotNull(result);
        assertEquals(review.getReviewId(), result.getReviewId());
        assertEquals(5, result.getRating());
        assertEquals("Great service", result.getComment());

        verify(bookingRepository).findById(booking.getBookingId());
        verify(reviewRepository).save(any(Review.class));
        verify(clinicRepository).save(clinic); // Verify clinic stats updated
    }

    @Test
    @DisplayName("Should throw exception when booking not found")
    void createReview_BookingNotFound() {
        // Arrange
        when(bookingRepository.findById(any())).thenReturn(Optional.empty());

        // Act & Assert
        Exception exception = assertThrows(RuntimeException.class, () -> {
            reviewService.createReview(user, reviewRequestDTO);
        });
        assertEquals("Booking not found", exception.getMessage());
    }

    @Test
    @DisplayName("Should throw exception when user is not the booking owner")
    void createReview_NotOwner() {
        // Arrange
        User otherUser = User.builder().userId(UUID.randomUUID()).build();
        when(bookingRepository.findById(booking.getBookingId())).thenReturn(Optional.of(booking));

        // Act & Assert
        Exception exception = assertThrows(RuntimeException.class, () -> {
            reviewService.createReview(otherUser, reviewRequestDTO);
        });
        assertEquals("You are not the owner of this booking", exception.getMessage());
    }

    @Test
    @DisplayName("Should throw exception when booking is not completed")
    void createReview_NotCompleted() {
        // Arrange
        booking.setStatus(BookingStatus.CONFIRMED); // Not COMPLETED
        when(bookingRepository.findById(booking.getBookingId())).thenReturn(Optional.of(booking));

        // Act & Assert
        Exception exception = assertThrows(RuntimeException.class, () -> {
            reviewService.createReview(user, reviewRequestDTO);
        });
        assertEquals("Booking is not completed yet", exception.getMessage());
    }

    @Test
    @DisplayName("Should throw exception when booking is already reviewed")
    void createReview_AlreadyReviewed() {
        // Arrange
        booking.setReview(review); // Already has a review
        when(bookingRepository.findById(booking.getBookingId())).thenReturn(Optional.of(booking));

        // Act & Assert
        Exception exception = assertThrows(RuntimeException.class, () -> {
            reviewService.createReview(user, reviewRequestDTO);
        });
        assertEquals("Booking already reviewed", exception.getMessage());
    }

    // --- Update Review Tests ---

    @Test
    @DisplayName("Should update review successfully")
    void updateReview_Success() {
        // Arrange
        ReviewRequestDTO updateRequest = new ReviewRequestDTO();
        updateRequest.setRating(4);
        updateRequest.setComment("Updated comment");

        when(reviewRepository.findById(review.getReviewId())).thenReturn(Optional.of(review));
        when(reviewRepository.save(any(Review.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reviewRepository.getAverageRatingByClinicId(clinic.getClinicId())).thenReturn(4.5);
        when(reviewRepository.countByClinic_ClinicId(clinic.getClinicId())).thenReturn(1L);

        // Act
        ReviewResponseDTO result = reviewService.updateReview(review.getReviewId(), user, updateRequest);

        // Assert
        assertEquals(4, result.getRating());
        assertEquals("Updated comment", result.getComment());

        verify(reviewRepository).save(review);
        verify(clinicRepository).save(clinic);
    }

    @Test
    @DisplayName("Should throw exception when updating non-existent review")
    void updateReview_ReviewNotFound() {
        // Arrange
        when(reviewRepository.findById(any())).thenReturn(Optional.empty());

        // Act & Assert
        Exception exception = assertThrows(RuntimeException.class, () -> {
            reviewService.updateReview(UUID.randomUUID(), user, reviewRequestDTO);
        });
        assertEquals("Review not found", exception.getMessage());
    }

    @Test
    @DisplayName("Should throw exception when user is not the review owner")
    void updateReview_NotOwner() {
        // Arrange
        User otherUser = User.builder().userId(UUID.randomUUID()).build();
        when(reviewRepository.findById(review.getReviewId())).thenReturn(Optional.of(review));

        // Act & Assert
        Exception exception = assertThrows(RuntimeException.class, () -> {
            reviewService.updateReview(review.getReviewId(), otherUser, reviewRequestDTO);
        });
        assertEquals("You are not allowed to update this review", exception.getMessage());
    }

    // --- Get Clinic Reviews Tests ---

    @Test
    @DisplayName("Should return list of reviews for clinic")
    void getClinicReviews_Success() {
        // Arrange
        when(reviewRepository.findByClinic_ClinicIdOrderByCreatedAtDesc(clinic.getClinicId()))
                .thenReturn(List.of(review));

        // Act
        List<ReviewResponseDTO> results = reviewService.getClinicReviews(clinic.getClinicId());

        // Assert
        assertFalse(results.isEmpty());
        assertEquals(1, results.size());
        assertEquals(review.getReviewId(), results.get(0).getReviewId());
    }

    @Test
    @DisplayName("Should return empty list when no reviews found")
    void getClinicReviews_Empty() {
        // Arrange
        when(reviewRepository.findByClinic_ClinicIdOrderByCreatedAtDesc(clinic.getClinicId()))
                .thenReturn(Collections.emptyList());

        // Act
        List<ReviewResponseDTO> results = reviewService.getClinicReviews(clinic.getClinicId());

        // Assert
        assertTrue(results.isEmpty());
    }
}
