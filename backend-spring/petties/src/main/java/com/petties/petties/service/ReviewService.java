package com.petties.petties.service;

import com.petties.petties.dto.review.ReviewRequestDTO;
import com.petties.petties.dto.review.ReviewResponseDTO;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Review;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.ReviewRepository;
import com.petties.petties.repository.ClinicRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final BookingRepository bookingRepository;
    private final ClinicRepository clinicRepository;

    @Transactional
    public ReviewResponseDTO createReview(User user, ReviewRequestDTO request) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        // Validate Ownership
        if (!booking.getPetOwner().getUserId().equals(user.getUserId())) {
            throw new RuntimeException("You are not the owner of this booking");
        }

        // Validate Status
        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw new RuntimeException("Booking is not completed yet");
        }

        // Validate duplicates - Use the OneToOne mapping to check
        if (booking.getReview() != null) {
            throw new RuntimeException("Booking already reviewed");
        }

        Review review = Review.builder()
                .booking(booking)
                .clinic(booking.getClinic())
                .user(user)
                .rating(request.getRating())
                .comment(request.getComment())
                .build();

        Review savedReview = reviewRepository.save(review);
        System.out.println("CREATED REVIEW: " + savedReview.getReviewId() +
                " for Booking: " + booking.getBookingCode() +
                " | ClinicId: " + booking.getClinic().getClinicId() +
                " | Rating: " + savedReview.getRating());

        updateClinicStats(booking.getClinic());

        return mapToDTO(savedReview);
    }

    @Transactional
    public ReviewResponseDTO updateReview(UUID reviewId, User user, ReviewRequestDTO request) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new RuntimeException("Review not found"));

        // Validate Ownership
        if (!review.getUser().getUserId().equals(user.getUserId())) {
            throw new RuntimeException("You are not allowed to update this review");
        }

        review.setRating(request.getRating());
        review.setComment(request.getComment());

        Review savedReview = reviewRepository.save(review);
        System.out.println("UPDATED REVIEW: " + savedReview.getReviewId() +
                " | Rating: " + savedReview.getRating());

        updateClinicStats(savedReview.getClinic());

        return mapToDTO(savedReview);
    }

    private void updateClinicStats(com.petties.petties.model.Clinic clinic) {
        Double avgRating = reviewRepository.getAverageRatingByClinicId(clinic.getClinicId());
        long count = reviewRepository.countByClinic_ClinicId(clinic.getClinicId());

        if (avgRating != null) {
            clinic.setRatingAvg(BigDecimal.valueOf(avgRating).setScale(1, RoundingMode.HALF_UP));
        } else {
            clinic.setRatingAvg(BigDecimal.ZERO);
        }
        clinic.setRatingCount((int) count);
        clinicRepository.save(clinic);
    }

    @Transactional(readOnly = true)
    public List<ReviewResponseDTO> getClinicReviews(UUID clinicId) {
        List<Review> reviews = reviewRepository.findByClinic_ClinicIdOrderByCreatedAtDesc(clinicId);
        System.out.println("FETCHING REVIEWS Request for ClinicId: " + clinicId);
        System.out.println("FOUND Reviews count: " + reviews.size());
        if (!reviews.isEmpty()) {
            System.out.println("Sample Review ClinicId: " + reviews.get(0).getClinic().getClinicId());
        } else {
            System.out.println("No reviews found for this clinicId.");
        }
        return reviews.stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    private ReviewResponseDTO mapToDTO(Review review) {
        String userName = "Unknown User";
        String userAvatar = null;

        if (review.getUser() != null) {
            userName = review.getUser().getFullName() != null ? review.getUser().getFullName()
                    : review.getUser().getUsername();
            userAvatar = review.getUser().getAvatar();
        }

        return ReviewResponseDTO.builder()
                .reviewId(review.getReviewId())
                .rating(review.getRating())
                .comment(review.getComment())
                .userName(userName)
                .userAvatar(userAvatar)
                .createdAt(review.getCreatedAt())
                .build();
    }
}
