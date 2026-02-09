package com.petties.petties.controller;

import com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal;
import com.petties.petties.dto.sos.SosConfirmRequest;
import com.petties.petties.dto.sos.SosMatchRequest;
import com.petties.petties.dto.sos.SosMatchResponse;
import com.petties.petties.service.SosMatchingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * SOS Auto-Match Controller
 * 
 * Endpoints for SOS emergency booking with automatic clinic matching
 * 
 * WebSocket topics:
 * - /topic/sos-matching/{bookingId} - Status updates for Pet Owner
 * - /topic/sos-alert/{userId} - Alert notifications for Clinic Managers
 */
@RestController
@RequestMapping("/sos")
@RequiredArgsConstructor
@Slf4j
public class SosController {

    private final SosMatchingService sosMatchingService;

    /**
     * Start SOS matching process
     * Pet Owner sends emergency request with GPS coordinates
     * 
     * @param request     Contains petId, latitude, longitude, symptoms
     * @param userDetails Authentication principal
     * @return SosMatchResponse with booking info and WebSocket topic URL
     */
    @PostMapping("/match")
    @PreAuthorize("hasRole('PET_OWNER')")
    public ResponseEntity<SosMatchResponse> startMatching(
            @Valid @RequestBody SosMatchRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        UserPrincipal userPrincipal = (UserPrincipal) userDetails;
        UUID petOwnerId = userPrincipal.getUserId();
        log.info("SOS match request from pet owner: {}", petOwnerId);

        SosMatchResponse response = sosMatchingService.startMatching(request, petOwnerId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Clinic manager confirms or declines SOS request
     * 
     * @param bookingId   Booking UUID from path
     * @param request     Contains accepted flag and optional
     *                    declineReason/assignedStaffId
     * @param userDetails Authentication principal
     * @return Updated SosMatchResponse
     */
    @PostMapping("/{bookingId}/confirm")
    @PreAuthorize("hasRole('CLINIC_MANAGER')")
    public ResponseEntity<SosMatchResponse> confirmSos(
            @PathVariable UUID bookingId,
            @RequestBody SosConfirmRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        UserPrincipal userPrincipal = (UserPrincipal) userDetails;
        UUID clinicManagerId = userPrincipal.getUserId();
        log.info("SOS confirmation from manager {} for booking {}: accepted={}",
                clinicManagerId, bookingId, request.isAccepted());

        // Ensure bookingId from path matches request
        request.setBookingId(bookingId);

        SosMatchResponse response = sosMatchingService.processConfirmation(request, clinicManagerId);
        return ResponseEntity.ok(response);
    }

    /**
     * Get current matching status
     *
     * @param bookingId Booking UUID
     * @return Current status with clinic info if matched
     */
    @GetMapping("/{bookingId}/status")
    @PreAuthorize("hasAnyRole('PET_OWNER', 'CLINIC_MANAGER', 'STAFF')")
    public ResponseEntity<SosMatchResponse> getStatus(@PathVariable UUID bookingId) {
        SosMatchResponse response = sosMatchingService.getMatchingStatus(bookingId);
        return ResponseEntity.ok(response);
    }

    /**
     * Check if user has an active SOS booking
     *
     * @param userDetails Authentication principal
     * @return Active SOS booking info or 204 if none
     */
    @GetMapping("/active")
    @PreAuthorize("hasRole('PET_OWNER')")
    public ResponseEntity<SosMatchResponse> getActiveSosBooking(
            @AuthenticationPrincipal UserDetails userDetails) {

        UserPrincipal userPrincipal = (UserPrincipal) userDetails;
        UUID petOwnerId = userPrincipal.getUserId();
        log.debug("Checking active SOS booking for pet owner: {}", petOwnerId);

        try {
            return sosMatchingService.getActiveSosBooking(petOwnerId)
                    .map(booking -> {
                        log.debug("Found active SOS booking: {}", booking.getBookingId());
                        SosMatchResponse.SosMatchResponseBuilder responseBuilder = SosMatchResponse.builder()
                                .bookingId(booking.getBookingId())
                                .status(booking.getStatus())
                                .message("Bạn có yêu cầu SOS đang hoạt động")
                                .wsTopicUrl("/topic/sos-matching/" + booking.getBookingId());

                        // Include pet info for mobile to resume matching
                        if (booking.getPet() != null) {
                            responseBuilder
                                    .petId(booking.getPet().getId())
                                    .petName(booking.getPet().getName());
                        }

                        if (booking.getClinic() != null) {
                            responseBuilder
                                    .clinicId(booking.getClinic().getClinicId())
                                    .clinicName(booking.getClinic().getName())
                                    .clinicPhone(booking.getClinic().getPhone())
                                    .clinicAddress(booking.getClinic().getAddress());
                        }

                        return ResponseEntity.ok(responseBuilder.build());
                    })
                    .orElse(ResponseEntity.noContent().build());
        } catch (Exception e) {
            log.error("Error getting active SOS booking for user {}: {}", petOwnerId, e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Cancel SOS matching (Pet Owner only, before confirmation)
     * 
     * @param bookingId   Booking UUID
     * @param userDetails Authentication principal
     * @return Success message
     */
    @DeleteMapping("/{bookingId}")
    @PreAuthorize("hasRole('PET_OWNER')")
    public ResponseEntity<Void> cancelMatching(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal UserDetails userDetails) {

        UserPrincipal userPrincipal = (UserPrincipal) userDetails;
        log.info("SOS cancel request for booking {} from user {}", bookingId, userPrincipal.getUserId());
        sosMatchingService.cancelMatching(bookingId, userPrincipal.getUserId());
        return ResponseEntity.noContent().build();
    }
}
