package com.petties.petties.controller;

import com.petties.petties.dto.tracking.LocationUpdateRequest;
import com.petties.petties.dto.tracking.LocationUpdateResponse;
import com.petties.petties.service.TrackingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

/**
 * WebSocket Controller for real-time Staff location tracking.
 * 
 * Staff sends location updates via STOMP to /app/tracking.update
 * Pet Owner subscribes to /topic/booking.{bookingId}.location to receive
 * updates
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class TrackingController {

    private final TrackingService trackingService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Receive location update from Staff and broadcast to Pet Owner.
     * 
     * Staff sends: STOMP SEND /app/tracking.update
     * Owner receives: STOMP SUBSCRIBE /topic/booking.{bookingId}.location
     */
    @MessageMapping("/tracking.update")
    public void updateLocation(@Payload LocationUpdateRequest request,
            SimpMessageHeaderAccessor headerAccessor) {
        try {
            // Get authenticated user from WebSocket session
            Principal principal = headerAccessor.getUser();
            if (principal == null) {
                log.warn("Unauthenticated tracking update attempt");
                return;
            }

            UUID staffId = UUID.fromString(principal.getName());
            log.debug("Received location update from Staff {}: booking={}, lat={}, lng={}",
                    staffId, request.getBookingId(), request.getLatitude(), request.getLongitude());

            // Update location in Redis and get enriched response
            LocationUpdateResponse response = trackingService.updateStaffLocation(
                    request.getBookingId(),
                    request.getLatitude(),
                    request.getLongitude(),
                    staffId);

            // Broadcast to Pet Owner subscribed to this booking's topic
            String destination = "/topic/booking." + request.getBookingId() + ".location";
            messagingTemplate.convertAndSend(destination, response);

            log.debug("Broadcasted location to {}", destination);

        } catch (IllegalArgumentException e) {
            log.warn("Invalid tracking update: {}", e.getMessage());
        } catch (IllegalStateException e) {
            log.warn("Tracking not allowed: {}", e.getMessage());
        } catch (SecurityException e) {
            log.warn("Unauthorized tracking update: {}", e.getMessage());
        } catch (Exception e) {
            log.error("Error processing tracking update: {}", e.getMessage(), e);
        }
    }
}
