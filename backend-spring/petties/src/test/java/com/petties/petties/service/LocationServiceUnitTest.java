package com.petties.petties.service;

import com.petties.petties.dto.clinic.DistanceResponse;
import com.petties.petties.dto.clinic.GeocodeResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LocationServiceUnitTest {

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private LocationService locationService;

    @BeforeEach
    void setUp() {
        // Inject properties
        ReflectionTestUtils.setField(locationService, "apiKey", "test-api-key");
        ReflectionTestUtils.setField(locationService, "geocodingUrl", "https://rsapi.goong.io/geocode");
        ReflectionTestUtils.setField(locationService, "distanceMatrixUrl", "https://rsapi.goong.io/distancematrix");
    }

    // ==================== HAVERSINE TESTS ====================

    @Test
    @DisplayName("TC-UNIT-LOC-001: Haversine - Close coordinates")
    void calculateDistance_closeCoords_returnsCorrectDistance() {
        // Coordinates in Ho Chi Minh City (~1km apart)
        BigDecimal lat1 = new BigDecimal("10.7769"); // Ben Thanh Market
        BigDecimal lng1 = new BigDecimal("106.7009");
        BigDecimal lat2 = new BigDecimal("10.7828"); // Notre Dame Cathedral
        BigDecimal lng2 = new BigDecimal("106.6962");

        double distance = locationService.calculateDistance(lat1, lng1, lat2, lng2);

        // Expected approx 0.8km - 1.0km
        assertTrue(distance > 0.6 && distance < 1.0, "Distance should be around 0.8km");
    }

    @Test
    @DisplayName("TC-UNIT-LOC-002: Haversine - Same coordinates")
    void calculateDistance_sameCoords_returnsZero() {
        BigDecimal lat = new BigDecimal("10.7769");
        BigDecimal lng = new BigDecimal("106.7009");

        double distance = locationService.calculateDistance(lat, lng, lat, lng);

        assertEquals(0.0, distance, 0.001);
    }

    // ==================== GEOCODING TESTS ====================

    @Test
    @DisplayName("TC-UNIT-LOC-003: Geocode - Success")
    void geocode_validAddress_returnsCoordinates() {
        // Mock API response structure
        Map<String, Object> location = Map.of("lat", 10.12345678, "lng", 106.12345678);
        Map<String, Object> geometry = Map.of("location", location);
        Map<String, Object> result = Map.of(
                "formatted_address", "Formatted Address",
                "geometry", geometry);
        Map<String, Object> responseBody = Map.of(
                "status", "OK",
                "results", List.of(result));

        when(restTemplate.getForEntity(anyString(), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        GeocodeResponse response = locationService.geocode("Test Address");

        assertNotNull(response);
        assertEquals(new BigDecimal("10.12345678"), response.getLatitude());
        assertEquals(new BigDecimal("106.12345678"), response.getLongitude());
        assertEquals("Formatted Address", response.getFormattedAddress());
    }

    @Test
    @DisplayName("TC-UNIT-LOC-004: Geocode - API Error throws Exception")
    void geocode_apiError_throwsRuntimeException() {
        Map<String, Object> responseBody = Map.of("status", "ZERO_RESULTS");

        when(restTemplate.getForEntity(anyString(), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        assertThrows(RuntimeException.class, () -> locationService.geocode("Invalid Address"));
    }

    @Test
    @DisplayName("TC-UNIT-LOC-005: Geocode - No API Key throws Exception")
    void geocode_noApiKey_throwsException() {
        ReflectionTestUtils.setField(locationService, "apiKey", "");
        assertThrows(IllegalStateException.class, () -> locationService.geocode("Address"));
    }

    // ==================== REVERSE GEOCODING TESTS ====================

    @Test
    @DisplayName("TC-UNIT-LOC-006: Reverse Geocode - Success")
    void reverseGeocode_validCoords_returnsAddress() {
        Map<String, Object> result = Map.of("formatted_address", "123 Street, City");
        Map<String, Object> responseBody = Map.of(
                "status", "OK",
                "results", List.of(result));

        when(restTemplate.getForEntity(anyString(), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        String address = locationService.reverseGeocode(new BigDecimal("10.1"), new BigDecimal("106.1"));

        assertEquals("123 Street, City", address);
    }

    // ==================== DISTANCE MATRIX TESTS ====================

    @Test
    @DisplayName("TC-UNIT-LOC-007: Distance Matrix - Success (Road Distance)")
    void calculateDistanceMatrix_apiSuccess_returnsRoadDistance() {
        // Mock structure detailed as per Goong/Google API
        Map<String, Object> distObj = Map.of("value", 5500); // 5.5 km
        Map<String, Object> durObj = Map.of("value", 600); // 10 mins (600s)

        Map<String, Object> element = Map.of(
                "status", "OK",
                "distance", distObj,
                "duration", durObj);
        Map<String, Object> row = Map.of("elements", List.of(element));
        Map<String, Object> responseBody = Map.of(
                "status", "OK",
                "rows", List.of(row));

        when(restTemplate.getForEntity(anyString(), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        DistanceResponse response = locationService.calculateDistanceMatrix(
                BigDecimal.TEN, BigDecimal.TEN, BigDecimal.TEN, BigDecimal.TEN);

        assertEquals(5.5, response.getDistance());
        assertEquals("km", response.getUnit());
        assertEquals(10, response.getDuration());
    }

    @Test
    @DisplayName("TC-UNIT-LOC-008: Distance Matrix - Fallback to Haversine on API Error")
    void calculateDistanceMatrix_apiFail_fallsBackToHaversine() {
        // Mock API failure response
        Map<String, Object> responseBody = Map.of("status", "REQUEST_DENIED");

        when(restTemplate.getForEntity(anyString(), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        // Using coordinates ~111km apart (1 degree lat diff)
        BigDecimal lat1 = new BigDecimal("10.0");
        BigDecimal lng1 = new BigDecimal("106.0");
        BigDecimal lat2 = new BigDecimal("11.0");
        BigDecimal lng2 = new BigDecimal("106.0");

        DistanceResponse response = locationService.calculateDistanceMatrix(lat1, lng1, lat2, lng2);

        // Approx 111km
        assertTrue(response.getDistance() > 100 && response.getDistance() < 120);
        // Duration should be null or 0 in fallback (depending on implementation, code
        // sets distance but builder default duration is null/0)
    }

    @Test
    @DisplayName("TC-UNIT-LOC-009: Distance Matrix - Fallback on Exception")
    void calculateDistanceMatrix_exception_fallsBackToHaversine() {
        when(restTemplate.getForEntity(anyString(), eq(Map.class)))
                .thenThrow(new RuntimeException("Network error"));

        BigDecimal lat1 = new BigDecimal("10.0");
        BigDecimal lng1 = new BigDecimal("106.0");
        BigDecimal lat2 = new BigDecimal("11.0");
        BigDecimal lng2 = new BigDecimal("106.0");

        DistanceResponse response = locationService.calculateDistanceMatrix(lat1, lng1, lat2, lng2);

        // Should return calculated haversine distance
        assertTrue(response.getDistance() > 100);
    }

    @Test
    @DisplayName("TC-UNIT-LOC-010: Distance Matrix - Use Haversine if No API Key")
    void calculateDistanceMatrix_noApiKey_usesHaversine() {
        ReflectionTestUtils.setField(locationService, "apiKey", "");

        // No mock needed for restTemplate as it shouldn't be called

        BigDecimal lat1 = new BigDecimal("10.0");
        BigDecimal lng1 = new BigDecimal("106.0");
        BigDecimal lat2 = new BigDecimal("11.0");
        BigDecimal lng2 = new BigDecimal("106.0");

        DistanceResponse response = locationService.calculateDistanceMatrix(lat1, lng1, lat2, lng2);

        assertTrue(response.getDistance() > 100);
        verify(restTemplate, never()).getForEntity(anyString(), eq(Map.class));
    }
}
