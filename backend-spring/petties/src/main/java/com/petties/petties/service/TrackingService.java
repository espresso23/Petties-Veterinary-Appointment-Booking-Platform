package com.petties.petties.service;

import com.petties.petties.dto.tracking.LocationUpdateResponse;
import com.petties.petties.model.Booking;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Service for managing real-time Staff location tracking during SOS/Home Visit
 * bookings.
 * Uses Redis for temporary storage of location data.
 * 
 * Redis Key Pattern: tracking:{bookingId}
 * Expiration: 1 hour (auto-cleanup after booking completion)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TrackingService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final BookingRepository bookingRepository;
    private final LocationService locationService;

    private static final String TRACKING_KEY_PREFIX = "tracking:";
    private static final Duration TRACKING_EXPIRATION = Duration.ofHours(1);

    /**
     * Update Staff's current location for a booking.
     * Only works when booking status is ON_THE_WAY.
     * 
     * @param bookingId The booking ID
     * @param latitude  Staff's current latitude
     * @param longitude Staff's current longitude
     * @param staffId   The Staff's user ID (for validation)
     * @return LocationUpdateResponse with enriched data (ETA, distance)
     */
    public LocationUpdateResponse updateStaffLocation(UUID bookingId, BigDecimal latitude,
            BigDecimal longitude, UUID staffId) {

        // 1. Validate booking exists and is in EN_ROUTE status
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found: " + bookingId));

        if (booking.getStatus() != BookingStatus.ON_THE_WAY) {
            throw new IllegalStateException("Tracking is only available when booking is ON_THE_WAY. Current status: "
                    + booking.getStatus());
        }

        // 2. Validate Staff is assigned to this booking
        if (booking.getAssignedStaff() == null ||
                !booking.getAssignedStaff().getUserId().equals(staffId)) {
            throw new SecurityException("Staff is not assigned to this booking");
        }

        // 3. Build tracking data
        String key = TRACKING_KEY_PREFIX + bookingId;
        Map<String, Object> locationData = new HashMap<>();
        locationData.put("lat", latitude.toString());
        locationData.put("lng", longitude.toString());
        locationData.put("lastUpdated", Instant.now().toString());
        locationData.put("staffId", staffId.toString());

        // 4. Calculate distance and ETA if customer location is available
        Double distanceKm = null;
        Integer etaMinutes = null;

        if (booking.getHomeLat() != null && booking.getHomeLong() != null) {
            distanceKm = locationService.calculateDistance(
                    latitude, longitude,
                    booking.getHomeLat(), booking.getHomeLong());
            locationData.put("distanceKm", distanceKm.toString());

            // Simple ETA estimation: assume average speed of 25 km/h in city traffic
            etaMinutes = (int) Math.ceil((distanceKm / 25.0) * 60);
            locationData.put("etaMinutes", etaMinutes.toString());

            log.debug("Updated location for booking {}: lat={}, lng={}, distance={}km, eta={}min",
                    bookingId, latitude, longitude, distanceKm, etaMinutes);
        }

        // 5. Save to Redis with expiration
        redisTemplate.opsForHash().putAll(key, locationData);
        redisTemplate.expire(key, TRACKING_EXPIRATION);

        log.info("Tracking updated for booking {}: Staff {} at ({}, {})",
                bookingId, staffId, latitude, longitude);

        // 6. Build response for broadcasting
        return LocationUpdateResponse.builder()
                .bookingId(bookingId)
                .latitude(latitude)
                .longitude(longitude)
                .distanceKm(distanceKm)
                .etaMinutes(etaMinutes)
                .lastUpdated(Instant.now())
                .statusMessage(buildStatusMessage(distanceKm, etaMinutes))
                .build();
    }

    /**
     * Get current Staff location for a booking.
     * Used by Pet Owner to get initial location when opening the tracking screen.
     * 
     * @param bookingId The booking ID
     * @param ownerId   The Pet Owner's user ID (for validation)
     * @return Optional containing location data if available
     */
    public Optional<LocationUpdateResponse> getStaffLocation(UUID bookingId, UUID ownerId) {
        // 1. Validate booking ownership
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found: " + bookingId));

        if (!booking.getPetOwner().getUserId().equals(ownerId)) {
            throw new SecurityException("Owner is not authorized to view this booking's tracking");
        }

        // 2. Get from Redis
        String key = TRACKING_KEY_PREFIX + bookingId;
        Map<Object, Object> data = redisTemplate.opsForHash().entries(key);

        if (data.isEmpty()) {
            log.debug("No tracking data found for booking {}", bookingId);
            return Optional.empty();
        }

        // 3. Parse and return
        try {
            BigDecimal lat = new BigDecimal((String) data.get("lat"));
            BigDecimal lng = new BigDecimal((String) data.get("lng"));
            Double distanceKm = data.get("distanceKm") != null
                    ? Double.parseDouble((String) data.get("distanceKm"))
                    : null;
            Integer etaMinutes = data.get("etaMinutes") != null
                    ? Integer.parseInt((String) data.get("etaMinutes"))
                    : null;
            Instant lastUpdated = Instant.parse((String) data.get("lastUpdated"));

            return Optional.of(LocationUpdateResponse.builder()
                    .bookingId(bookingId)
                    .latitude(lat)
                    .longitude(lng)
                    .distanceKm(distanceKm)
                    .etaMinutes(etaMinutes)
                    .lastUpdated(lastUpdated)
                    .statusMessage(buildStatusMessage(distanceKm, etaMinutes))
                    .build());

        } catch (Exception e) {
            log.error("Error parsing tracking data for booking {}: {}", bookingId, e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Clear tracking data for a booking.
     * Should be called when booking transitions out of ON_THE_WAY status.
     * 
     * @param bookingId The booking ID
     */
    public void clearTracking(UUID bookingId) {
        String key = TRACKING_KEY_PREFIX + bookingId;
        Boolean deleted = redisTemplate.delete(key);
        log.info("Cleared tracking for booking {}: {}", bookingId, deleted ? "success" : "key not found");
    }

    /**
     * Build a user-friendly status message for display in the app.
     */
    private String buildStatusMessage(Double distanceKm, Integer etaMinutes) {
        if (distanceKm == null || etaMinutes == null) {
            return "Nhân viên đang trên đường đến...";
        }

        if (distanceKm < 0.5) {
            return "Nhân viên sắp đến nơi!";
        } else if (etaMinutes <= 5) {
            return String.format("Còn khoảng %.1f km (dưới 5 phút)", distanceKm);
        } else {
            return String.format("Còn khoảng %.1f km (khoảng %d phút)", distanceKm, etaMinutes);
        }
    }
}
