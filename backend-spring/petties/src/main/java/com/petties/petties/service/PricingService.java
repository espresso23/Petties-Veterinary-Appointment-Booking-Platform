package com.petties.petties.service;

import com.petties.petties.model.ClinicService;
import com.petties.petties.model.Pet;
import com.petties.petties.model.ServiceWeightPrice;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.repository.ServiceWeightPriceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

/**
 * PricingService - Calculate service prices based on pet weight and distance
 * 
 * Pricing Logic:
 * 1. Weight-based pricing: lookup ServiceWeightPrice table by pet weight
 * - If found: use weight-specific price
 * - If not found: use basePrice
 * 
 * 2. Home visit fee: distanceKm × pricePerKm
 * - Only applies when booking type is HOME_VISIT
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PricingService {

    private final ServiceWeightPriceRepository weightPriceRepository;

    /**
     * Calculate total price for a service based on pet weight
     * 
     * @param service The clinic service
     * @param pet     The pet (for weight lookup)
     * @return The calculated price
     */
    public BigDecimal calculateServicePrice(ClinicService service, Pet pet) {
        BigDecimal basePrice = service.getBasePrice();

        if (pet == null || pet.getWeight() <= 0) {
            log.debug("No pet weight, using base price for service {}", service.getName());
            return basePrice;
        }

        BigDecimal petWeight = BigDecimal.valueOf(pet.getWeight());

        // Try to find weight-based surcharge
        List<ServiceWeightPrice> weightPrices = service.getWeightPrices();

        if (weightPrices != null && !weightPrices.isEmpty()) {
            for (ServiceWeightPrice wp : weightPrices) {
                // Check if pet weight falls within this range
                if (petWeight.compareTo(wp.getMinWeight()) >= 0
                        && petWeight.compareTo(wp.getMaxWeight()) <= 0) {
                    // Add weight surcharge to base price
                    BigDecimal finalPrice = basePrice.add(wp.getPrice());
                    log.debug("Found weight surcharge for service {}: +{} (weight range: {}-{}kg). Final price: {}",
                            service.getName(), wp.getPrice(), wp.getMinWeight(), wp.getMaxWeight(), finalPrice);
                    return finalPrice;
                }
            }
            log.debug("Pet weight {} not in any price range, using base price", petWeight);
        }

        // Fallback to base price
        return basePrice;
    }

    /**
     * Calculate home visit fee for the entire booking based on distance
     * Picks the highest pricePerKm from the list of services as the booking fee
     *
     * @param services    List of services in the booking
     * @param distanceKm  The distance in kilometers
     * @param bookingType The booking type
     * @return The home visit fee (calculated once for the entire booking)
     */
    public BigDecimal calculateBookingDistanceFee(List<ClinicService> services, BigDecimal distanceKm,
            BookingType bookingType) {
        if (bookingType != BookingType.HOME_VISIT || distanceKm == null || distanceKm.compareTo(BigDecimal.ZERO) <= 0
                || services == null || services.isEmpty()) {
            return BigDecimal.ZERO;
        }

        // Use the highest pricePerKm among selected services
        BigDecimal maxPricePerKm = services.stream()
                .map(ClinicService::getPricePerKm)
                .filter(p -> p != null)
                .max(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);

        BigDecimal fee = distanceKm.multiply(maxPricePerKm);
        log.info("Calculated booking distance fee: {} ({} km × {} đ/km)", fee, distanceKm, maxPricePerKm);
        return fee;
    }
}
