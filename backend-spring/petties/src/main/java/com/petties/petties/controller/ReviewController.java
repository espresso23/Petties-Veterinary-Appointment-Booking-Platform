package com.petties.petties.controller;

import com.petties.petties.dto.review.ReviewRequestDTO;
import com.petties.petties.dto.review.ReviewResponseDTO;
import com.petties.petties.model.User;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/reviews")
@RequiredArgsConstructor
@Slf4j
public class ReviewController {

    private final ReviewService reviewService;
    private final UserRepository userRepository;

    @PreAuthorize("hasRole('PET_OWNER')")
    @PostMapping
    public ResponseEntity<ReviewResponseDTO> createReview(
            @Valid @RequestBody ReviewRequestDTO request,
            @AuthenticationPrincipal UserDetails userDetails) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;

        User user = userRepository.findById(userPrincipal.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        ReviewResponseDTO response = reviewService.createReview(user, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PreAuthorize("hasRole('PET_OWNER')")
    @PutMapping("/{reviewId}")
    public ResponseEntity<ReviewResponseDTO> updateReview(
            @PathVariable UUID reviewId,
            @Valid @RequestBody ReviewRequestDTO request,
            @AuthenticationPrincipal UserDetails userDetails) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;

        User user = userRepository.findById(userPrincipal.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        ReviewResponseDTO response = reviewService.updateReview(reviewId, user, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/clinic/{clinicId}")
    public ResponseEntity<List<ReviewResponseDTO>> getClinicReviews(@PathVariable UUID clinicId) {
        log.info("CONTROLLER: Received request for clinic reviews. ID: {}", clinicId);
        List<ReviewResponseDTO> reviews = reviewService.getClinicReviews(clinicId);
        log.info("CONTROLLER: Returning {} reviews for clinic ID: {}", reviews.size(), clinicId);
        return ResponseEntity.ok(reviews);
    }
}
