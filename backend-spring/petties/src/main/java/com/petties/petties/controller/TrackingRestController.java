package com.petties.petties.controller;

import com.petties.petties.dto.tracking.LocationUpdateResponse;
import com.petties.petties.service.TrackingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;
import java.util.UUID;

/**
 * REST Controller for tracking-related HTTP endpoints.
 * Used for initial location fetch when Pet Owner opens tracking screen.
 */
@RestController
@RequestMapping("/tracking")
@RequiredArgsConstructor
@Slf4j
public class TrackingRestController {

    private final TrackingService trackingService;

    /**
     * Get current Staff location for a booking.
     * Used when Pet Owner first opens the tracking screen to get initial position.
     * 
     * @param bookingId   The booking ID
     * @param userDetails Authenticated Pet Owner
     * @return Current location or 204 No Content if not available
     */
    @GetMapping("/booking/{bookingId}")
    public ResponseEntity<LocationUpdateResponse> getStaffLocation(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal UserDetails userDetails) {

        UUID ownerId = UUID.fromString(userDetails.getUsername());
        log.debug("Pet Owner {} requesting Staff location for booking {}", ownerId, bookingId);

        Optional<LocationUpdateResponse> location = trackingService.getStaffLocation(bookingId, ownerId);

        return location
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
