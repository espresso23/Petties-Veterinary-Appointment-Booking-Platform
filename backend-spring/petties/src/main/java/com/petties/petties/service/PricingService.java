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
import java.util.UUID;

/**
 * PricingService - Calculate service prices based on pet weight and distance
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PricingService {

    private final ServiceWeightPriceRepository weightPriceRepository;
    private final ClinicPriceService clinicPriceService;

    private static final BigDecimal DEFAULT_PRICE_PER_KM = new BigDecimal("5000");

    /**
     * Calculate total price for a service based on pet weight
     */
    public BigDecimal calculateServicePrice(ClinicService service, Pet pet) {
        BigDecimal basePrice = service.getBasePrice();

        if (pet == null || pet.getWeight() <= 0) {
            log.debug("No pet weight, using base price for service {}", service.getName());
            return basePrice;
        }

        BigDecimal petWeight = BigDecimal.valueOf(pet.getWeight());
        List<ServiceWeightPrice> weightPrices = service.getWeightPrices();

        if (weightPrices != null && !weightPrices.isEmpty()) {
            for (ServiceWeightPrice wp : weightPrices) {
                if (petWeight.compareTo(wp.getMinWeight()) >= 0
                        && petWeight.compareTo(wp.getMaxWeight()) <= 0) {
                    BigDecimal finalPrice = basePrice.add(wp.getPrice());
                    log.debug("Found weight surcharge for service {}: +{} (weight range: {}-{}kg). Final price: {}",
                            service.getName(), wp.getPrice(), wp.getMinWeight(), wp.getMaxWeight(), finalPrice);
                    return finalPrice;
                }
            }
        }

        return basePrice;
    }

    /**
     * Calculate home visit fee for the entire booking based on distance
     */
    public BigDecimal calculateBookingDistanceFee(UUID clinicId, BigDecimal distanceKm,
            BookingType bookingType) {
        if ((bookingType != BookingType.HOME_VISIT && bookingType != BookingType.SOS)
                || distanceKm == null || distanceKm.compareTo(BigDecimal.ZERO) <= 0
                || clinicId == null) {
            return BigDecimal.ZERO;
        }

        BigDecimal pricePerKm = clinicPriceService.getPricePerKm(clinicId)
                .orElse(DEFAULT_PRICE_PER_KM);

        BigDecimal fee = distanceKm.multiply(pricePerKm);
        log.info("Calculated booking distance fee: {} ({} km × {} đ/km) [clinic: {}]",
                fee, distanceKm, pricePerKm, clinicId);
        return fee;
    }

    /**
     * Calculate SOS emergency fee for a clinic
     */
    public BigDecimal calculateSOSFee(UUID clinicId) {
        return clinicPriceService.getSosFee(clinicId).orElse(BigDecimal.ZERO);
    }
}
