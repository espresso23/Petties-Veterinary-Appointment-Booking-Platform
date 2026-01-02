package com.petties.petties.service;

import com.petties.petties.dto.clinic.DistanceResponse;
import com.petties.petties.dto.clinic.GeocodeResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

/**
 * Service for Location-based services (Geocoding and Distance calculation)
 * Primary fallback: Haversine formula for distance calculation
 * Supports optional integration with external providers (like Goong.io or
 * Google)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LocationService {

    private final RestTemplate restTemplate;

    @Value("${goong.api.key:}")
    private String apiKey;

    @Value("${goong.geocoding.url:https://rsapi.goong.io/geocode}")
    private String geocodingUrl;

    @Value("${goong.distance.url:https://rsapi.goong.io/distancematrix}")
    private String distanceMatrixUrl;

    public GeocodeResponse geocode(String address) {
        if (apiKey == null || apiKey.isEmpty()) {
            log.warn("Goong API key not configured. Geocoding disabled.");
            throw new IllegalStateException("Location API key not configured");
        }

        try {
            String url = UriComponentsBuilder.fromUriString(geocodingUrl)
                    .queryParam("address", address)
                    .queryParam("api_key", apiKey)
                    .toUriString();

            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) restTemplate
                    .getForEntity(url, Map.class);
            Map<String, Object> body = response.getBody();

            if (body == null || body.get("results") == null) {
                log.error("Geocoding failed: {}", body != null ? body.get("status") : "Unknown error");
                throw new RuntimeException(
                        "Geocoding failed: " + (body != null ? body.get("status") : "Unknown error"));
            }

            @SuppressWarnings("unchecked")
            java.util.List<Map<String, Object>> results = (java.util.List<Map<String, Object>>) body.get("results");
            if (results == null || results.isEmpty()) {
                throw new RuntimeException("No results found for address: " + address);
            }

            Map<String, Object> result = results.get(0);
            @SuppressWarnings("unchecked")
            Map<String, Object> geometry = (Map<String, Object>) result.get("geometry");
            @SuppressWarnings("unchecked")
            Map<String, Object> location = (Map<String, Object>) geometry.get("location");

            BigDecimal lat = BigDecimal.valueOf(((Number) location.get("lat")).doubleValue())
                    .setScale(8, RoundingMode.HALF_UP);
            BigDecimal lng = BigDecimal.valueOf(((Number) location.get("lng")).doubleValue())
                    .setScale(8, RoundingMode.HALF_UP);
            String formattedAddress = (String) result.get("formatted_address");

            return GeocodeResponse.builder()
                    .latitude(lat)
                    .longitude(lng)
                    .formattedAddress(formattedAddress)
                    .build();

        } catch (Exception e) {
            log.error("Error geocoding address: {}", address, e);
            throw new RuntimeException("Failed to geocode address: " + e.getMessage(), e);
        }
    }

    public String reverseGeocode(BigDecimal latitude, BigDecimal longitude) {
        if (apiKey == null || apiKey.isEmpty()) {
            log.warn("Goong API key not configured. Reverse geocoding disabled.");
            throw new IllegalStateException("Location API key not configured");
        }

        try {
            String url = UriComponentsBuilder.fromUriString(geocodingUrl)
                    .queryParam("latlng", latitude + "," + longitude)
                    .queryParam("api_key", apiKey)
                    .toUriString();

            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) restTemplate
                    .getForEntity(url, Map.class);
            Map<String, Object> body = response.getBody();

            if (body == null || body.get("results") == null) {
                log.error("Reverse geocoding failed: {}", body != null ? body.get("status") : "Unknown error");
                throw new RuntimeException("Reverse geocoding failed");
            }

            @SuppressWarnings("unchecked")
            java.util.List<Map<String, Object>> results = (java.util.List<Map<String, Object>>) body.get("results");
            if (results == null || results.isEmpty()) {
                throw new RuntimeException("No results found for coordinates");
            }

            return (String) results.get(0).get("formatted_address");

        } catch (Exception e) {
            log.error("Error reverse geocoding coordinates: {}, {}", latitude, longitude, e);
            throw new RuntimeException("Failed to reverse geocode: " + e.getMessage(), e);
        }
    }

    /**
     * Calculate straight-line distance using Haversine formula
     */
    public double calculateDistance(BigDecimal lat1, BigDecimal lng1,
            BigDecimal lat2, BigDecimal lng2) {
        // Haversine formula
        final int EARTH_RADIUS_KM = 6371;

        double lat1Rad = Math.toRadians(lat1.doubleValue());
        double lat2Rad = Math.toRadians(lat2.doubleValue());
        double deltaLat = Math.toRadians(lat2.doubleValue() - lat1.doubleValue());
        double deltaLng = Math.toRadians(lng2.doubleValue() - lng1.doubleValue());

        double a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                        Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return EARTH_RADIUS_KM * c;
    }

    /**
     * Calculate road distance matrix
     * Falls back to Haversine formula if API key is not configured or fails
     */
    public DistanceResponse calculateDistanceMatrix(BigDecimal originLat, BigDecimal originLng,
            BigDecimal destLat, BigDecimal destLng) {
        if (apiKey == null || apiKey.isEmpty()) {
            log.info("Location API key not configured. Using Haversine formula.");
            double distance = calculateDistance(originLat, originLng, destLat, destLng);
            return DistanceResponse.builder()
                    .distance(distance)
                    .unit("km")
                    .build();
        }

        try {
            String origins = originLat + "," + originLng;
            String destinations = destLat + "," + destLng;

            String url = UriComponentsBuilder.fromUriString(distanceMatrixUrl)
                    .queryParam("origins", origins)
                    .queryParam("destinations", destinations)
                    .queryParam("api_key", apiKey)
                    .toUriString();

            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) restTemplate
                    .getForEntity(url, Map.class);
            Map<String, Object> body = response.getBody();

            if (body == null || !"OK".equals(body.get("status"))) {
                log.warn("Distance Matrix API failed, falling back to Haversine formula");
                double distance = calculateDistance(originLat, originLng, destLat, destLng);
                return DistanceResponse.builder()
                        .distance(distance)
                        .unit("km")
                        .build();
            }

            @SuppressWarnings("unchecked")
            java.util.List<Map<String, Object>> rows = (java.util.List<Map<String, Object>>) body.get("rows");
            if (rows == null || rows.isEmpty()) {
                throw new RuntimeException("No results from Distance Matrix API");
            }

            @SuppressWarnings("unchecked")
            java.util.List<Map<String, Object>> elements = (java.util.List<Map<String, Object>>) rows.get(0)
                    .get("elements");
            if (elements == null || elements.isEmpty()) {
                throw new RuntimeException("No elements in Distance Matrix response");
            }

            Map<String, Object> element = elements.get(0);
            @SuppressWarnings("unchecked")
            Map<String, Object> distance = (Map<String, Object>) element.get("distance");
            @SuppressWarnings("unchecked")
            Map<String, Object> duration = (Map<String, Object>) element.get("duration");

            double distanceValue = ((Number) distance.get("value")).doubleValue() / 1000.0; // Convert meters to km
            int durationValue = ((Number) duration.get("value")).intValue() / 60; // Convert seconds to minutes

            return DistanceResponse.builder()
                    .distance(distanceValue)
                    .unit("km")
                    .duration(durationValue)
                    .durationUnit("minutes")
                    .build();

        } catch (Exception e) {
            log.error("Error calculating distance matrix, falling back to Haversine formula", e);
            double distance = calculateDistance(originLat, originLng, destLat, destLng);
            return DistanceResponse.builder()
                    .distance(distance)
                    .unit("km")
                    .build();
        }
    }
}
