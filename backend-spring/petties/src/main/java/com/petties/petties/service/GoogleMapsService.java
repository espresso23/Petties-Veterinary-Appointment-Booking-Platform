package com.petties.petties.service;

import com.petties.petties.dto.clinic.DistanceResponse;
import com.petties.petties.dto.clinic.GeocodeResponse;

import java.math.BigDecimal;

/**
 * Service for Google Maps API integration
 * - Geocoding: Convert address to lat/lng
 * - Reverse Geocoding: Convert lat/lng to address
 * - Distance Calculation: Calculate distance between two points
 */
public interface GoogleMapsService {

    /**
     * Geocode address to lat/lng
     * @param address Full address string
     * @return GeocodeResponse with latitude, longitude, and formatted address
     */
    GeocodeResponse geocode(String address);

    /**
     * Reverse geocode lat/lng to address
     * @param latitude Latitude
     * @param longitude Longitude
     * @return Formatted address string
     */
    String reverseGeocode(BigDecimal latitude, BigDecimal longitude);

    /**
     * Calculate distance between two points using Haversine formula
     * @param lat1 Origin latitude
     * @param lng1 Origin longitude
     * @param lat2 Destination latitude
     * @param lng2 Destination longitude
     * @return Distance in kilometers
     */
    double calculateDistance(BigDecimal lat1, BigDecimal lng1, 
                             BigDecimal lat2, BigDecimal lng2);

    /**
     * Calculate distance using Google Distance Matrix API (more accurate, includes duration)
     * @param originLat Origin latitude
     * @param originLng Origin longitude
     * @param destLat Destination latitude
     * @param destLng Destination longitude
     * @return DistanceResponse with distance and duration
     */
    DistanceResponse calculateDistanceMatrix(
        BigDecimal originLat, BigDecimal originLng,
        BigDecimal destLat, BigDecimal destLng
    );
}

