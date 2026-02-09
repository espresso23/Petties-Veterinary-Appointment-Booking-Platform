package com.petties.petties.service;

import com.petties.petties.dto.tracking.LocationUpdateResponse;
import com.petties.petties.model.Booking;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.repository.BookingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisTemplate;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for TrackingService - GPS location tracking for SOS/Home Visit
 * bookings.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("TrackingService Unit Tests")
class TrackingServiceUnitTest {

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private HashOperations<String, Object, Object> hashOperations;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private LocationService locationService;

    @InjectMocks
    private TrackingService trackingService;

    private UUID bookingId;
    private UUID staffId;
    private UUID ownerId;
    private Booking sosBooking;
    private User staff;
    private User owner;

    @BeforeEach
    void setUp() {
        bookingId = UUID.randomUUID();
        staffId = UUID.randomUUID();
        ownerId = UUID.randomUUID();

        // Setup Staff user
        staff = new User();
        staff.setUserId(staffId);
        staff.setFullName("Test Staff");

        // Setup Owner user
        owner = new User();
        owner.setUserId(ownerId);
        owner.setFullName("Test Owner");

        // Setup SOS Booking with ON_THE_WAY status
        sosBooking = new Booking();
        sosBooking.setBookingId(bookingId);
        sosBooking.setType(BookingType.SOS);
        sosBooking.setStatus(BookingStatus.ON_THE_WAY);
        sosBooking.setAssignedStaff(staff);
        sosBooking.setPetOwner(owner);
        sosBooking.setHomeLat(new BigDecimal("10.7769"));
        sosBooking.setHomeLong(new BigDecimal("106.7009"));
    }

    @Test
    @DisplayName("TC-TRACK-001: Update staff location successfully")
    void updateStaffLocation_Success() {
        // Given
        BigDecimal staffLat = new BigDecimal("10.7800");
        BigDecimal staffLng = new BigDecimal("106.7100");

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(sosBooking));
        when(redisTemplate.opsForHash()).thenReturn(hashOperations);
        when(locationService.calculateDistance(any(), any(), any(), any())).thenReturn(2.5);

        // When
        LocationUpdateResponse response = trackingService.updateStaffLocation(
                bookingId, staffLat, staffLng, staffId);

        // Then
        assertNotNull(response);
        assertEquals(bookingId, response.getBookingId());
        assertEquals(staffLat, response.getLatitude());
        assertEquals(staffLng, response.getLongitude());
        assertEquals(2.5, response.getDistanceKm());
        assertNotNull(response.getEtaMinutes());
        assertNotNull(response.getStatusMessage());

        verify(hashOperations).putAll(eq("tracking:" + bookingId), anyMap());
        verify(redisTemplate).expire(eq("tracking:" + bookingId), any());
    }

    @Test
    @DisplayName("TC-TRACK-002: Reject tracking when booking is not ON_THE_WAY")
    void updateStaffLocation_RejectWhenNotOnTheWay() {
        // Given
        sosBooking.setStatus(BookingStatus.CONFIRMED); // Wrong status

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(sosBooking));

        // When & Then
        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> trackingService.updateStaffLocation(bookingId,
                        new BigDecimal("10.78"), new BigDecimal("106.71"), staffId));

        assertTrue(exception.getMessage().contains("ON_THE_WAY"));
    }

    @Test
    @DisplayName("TC-TRACK-003: Reject tracking from unauthorized staff")
    void updateStaffLocation_RejectUnauthorizedStaff() {
        // Given
        UUID wrongStaffId = UUID.randomUUID();

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(sosBooking));

        // When & Then
        SecurityException exception = assertThrows(SecurityException.class,
                () -> trackingService.updateStaffLocation(bookingId,
                        new BigDecimal("10.78"), new BigDecimal("106.71"), wrongStaffId));

        assertTrue(exception.getMessage().contains("not assigned"));
    }

    @Test
    @DisplayName("TC-TRACK-004: Get staff location for pet owner")
    void getStaffLocation_Success() {
        // Given
        Map<Object, Object> redisData = new HashMap<>();
        redisData.put("lat", "10.7800");
        redisData.put("lng", "106.7100");
        redisData.put("distanceKm", "2.5");
        redisData.put("etaMinutes", "6");
        redisData.put("lastUpdated", "2026-02-06T10:00:00Z");

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(sosBooking));
        when(redisTemplate.opsForHash()).thenReturn(hashOperations);
        when(hashOperations.entries("tracking:" + bookingId)).thenReturn(redisData);

        // When
        Optional<LocationUpdateResponse> result = trackingService.getStaffLocation(bookingId, ownerId);

        // Then
        assertTrue(result.isPresent());
        LocationUpdateResponse response = result.get();
        assertEquals(new BigDecimal("10.7800"), response.getLatitude());
        assertEquals(new BigDecimal("106.7100"), response.getLongitude());
        assertEquals(2.5, response.getDistanceKm());
        assertEquals(6, response.getEtaMinutes());
    }

    @Test
    @DisplayName("TC-TRACK-005: Reject getting location for unauthorized owner")
    void getStaffLocation_RejectUnauthorizedOwner() {
        // Given
        UUID wrongOwnerId = UUID.randomUUID();

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(sosBooking));

        // When & Then
        SecurityException exception = assertThrows(SecurityException.class,
                () -> trackingService.getStaffLocation(bookingId, wrongOwnerId));

        assertTrue(exception.getMessage().contains("not authorized"));
    }

    @Test
    @DisplayName("TC-TRACK-006: Return empty when no tracking data exists")
    void getStaffLocation_EmptyWhenNoData() {
        // Given
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(sosBooking));
        when(redisTemplate.opsForHash()).thenReturn(hashOperations);
        when(hashOperations.entries("tracking:" + bookingId)).thenReturn(new HashMap<>());

        // When
        Optional<LocationUpdateResponse> result = trackingService.getStaffLocation(bookingId, ownerId);

        // Then
        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("TC-TRACK-007: Clear tracking data successfully")
    void clearTracking_Success() {
        // Given
        when(redisTemplate.delete("tracking:" + bookingId)).thenReturn(true);

        // When
        trackingService.clearTracking(bookingId);

        // Then
        verify(redisTemplate).delete("tracking:" + bookingId);
    }

    @Test
    @DisplayName("TC-TRACK-008: Status message shows 'sắp đến' when distance < 0.5km")
    void updateStaffLocation_StatusMessageNearby() {
        // Given
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(sosBooking));
        when(redisTemplate.opsForHash()).thenReturn(hashOperations);
        when(locationService.calculateDistance(any(), any(), any(), any())).thenReturn(0.3);

        // When
        LocationUpdateResponse response = trackingService.updateStaffLocation(
                bookingId, new BigDecimal("10.777"), new BigDecimal("106.701"), staffId);

        // Then
        assertTrue(response.getStatusMessage().contains("sắp đến"));
    }
}
