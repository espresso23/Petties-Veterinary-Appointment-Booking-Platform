package com.petties.petties.service;

import com.petties.petties.model.ClinicService;
import com.petties.petties.model.Pet;
import com.petties.petties.model.ServiceWeightPrice;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.repository.ServiceWeightPriceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for PricingService
 *
 * Tests cover:
 * - calculateServicePrice: weight-based pricing logic
 * - calculateBookingDistanceFee: home visit fee calculation
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("PricingService Unit Tests")
class PricingServiceUnitTest {

    @Mock
    private ServiceWeightPriceRepository weightPriceRepository;

    @InjectMocks
    private PricingService pricingService;

    private ClinicService service;
    private Pet pet;

    @BeforeEach
    void setUp() {
        // Create a basic service with base price
        service = new ClinicService();
        service.setName("Khám tổng quát");
        service.setBasePrice(new BigDecimal("100000")); // 100,000 VND
        service.setWeightPrices(new ArrayList<>());

        // Create a basic pet
        pet = new Pet();
        pet.setName("Buddy");
        pet.setWeight(10.0);
    }

    // ========== HELPER METHODS ==========

    private ServiceWeightPrice createWeightPrice(double min, double max, String price) {
        ServiceWeightPrice wp = new ServiceWeightPrice();
        wp.setMinWeight(new BigDecimal(String.valueOf(min)));
        wp.setMaxWeight(new BigDecimal(String.valueOf(max)));
        wp.setPrice(new BigDecimal(price));
        wp.setService(service);
        return wp;
    }

    private ClinicService createServiceWithPricePerKm(String pricePerKm) {
        ClinicService svc = new ClinicService();
        svc.setName("Test Service");
        svc.setBasePrice(new BigDecimal("100000"));
        svc.setPricePerKm(pricePerKm != null ? new BigDecimal(pricePerKm) : null);
        return svc;
    }

    // ========== calculateServicePrice TESTS ==========

    @Nested
    @DisplayName("calculateServicePrice Tests")
    class CalculateServicePriceTests {

        @Test
        @DisplayName("1. Pet null → should return basePrice")
        void whenPetIsNull_shouldReturnBasePrice() {
            BigDecimal result = pricingService.calculateServicePrice(service, null);

            assertEquals(new BigDecimal("100000"), result);
        }

        @Test
        @DisplayName("2. Pet weight = 0 → should return basePrice")
        void whenPetWeightIsZero_shouldReturnBasePrice() {
            pet.setWeight(0);

            BigDecimal result = pricingService.calculateServicePrice(service, pet);

            assertEquals(new BigDecimal("100000"), result);
        }

        @Test
        @DisplayName("3. Pet weight < 0 → should return basePrice")
        void whenPetWeightIsNegative_shouldReturnBasePrice() {
            pet.setWeight(-5);

            BigDecimal result = pricingService.calculateServicePrice(service, pet);

            assertEquals(new BigDecimal("100000"), result);
        }

        @Test
        @DisplayName("4. No weightPrices → should return basePrice")
        void whenNoWeightPrices_shouldReturnBasePrice() {
            service.setWeightPrices(new ArrayList<>());
            pet.setWeight(10);

            BigDecimal result = pricingService.calculateServicePrice(service, pet);

            assertEquals(new BigDecimal("100000"), result);
        }

        @Test
        @DisplayName("5. Weight in range → should return basePrice + weight surcharge")
        void whenWeightInRange_shouldReturnBasePricePlusSurcharge() {
            // Surcharge of 100,000 for weight range 5-15kg
            ServiceWeightPrice wp = createWeightPrice(5, 15, "100000");
            service.setWeightPrices(Arrays.asList(wp));
            pet.setWeight(10);

            BigDecimal result = pricingService.calculateServicePrice(service, pet);

            // basePrice (100,000) + surcharge (100,000) = 200,000
            assertEquals(new BigDecimal("200000"), result);
        }

        @Test
        @DisplayName("6. Weight at min boundary → should return basePrice + weight surcharge")
        void whenWeightAtMinBoundary_shouldReturnBasePricePlusSurcharge() {
            // Surcharge of 50,000 for weight range 5-15kg
            ServiceWeightPrice wp = createWeightPrice(5, 15, "50000");
            service.setWeightPrices(Arrays.asList(wp));
            pet.setWeight(5);

            BigDecimal result = pricingService.calculateServicePrice(service, pet);

            // basePrice (100,000) + surcharge (50,000) = 150,000
            assertEquals(new BigDecimal("150000"), result);
        }

        @Test
        @DisplayName("7. Weight at max boundary → should return basePrice + weight surcharge")
        void whenWeightAtMaxBoundary_shouldReturnBasePricePlusSurcharge() {
            // Surcharge of 50,000 for weight range 5-15kg
            ServiceWeightPrice wp = createWeightPrice(5, 15, "50000");
            service.setWeightPrices(Arrays.asList(wp));
            pet.setWeight(15);

            BigDecimal result = pricingService.calculateServicePrice(service, pet);

            // basePrice (100,000) + surcharge (50,000) = 150,000
            assertEquals(new BigDecimal("150000"), result);
        }

        @Test
        @DisplayName("8. Weight below all ranges → should return basePrice")
        void whenWeightBelowAllRanges_shouldReturnBasePrice() {
            ServiceWeightPrice wp = createWeightPrice(10, 20, "200000");
            service.setWeightPrices(Arrays.asList(wp));
            pet.setWeight(5);

            BigDecimal result = pricingService.calculateServicePrice(service, pet);

            assertEquals(new BigDecimal("100000"), result);
        }

        @Test
        @DisplayName("9. Weight above all ranges → should return basePrice")
        void whenWeightAboveAllRanges_shouldReturnBasePrice() {
            ServiceWeightPrice wp = createWeightPrice(10, 20, "200000");
            service.setWeightPrices(Arrays.asList(wp));
            pet.setWeight(25);

            BigDecimal result = pricingService.calculateServicePrice(service, pet);

            assertEquals(new BigDecimal("100000"), result);
        }

        @Test
        @DisplayName("10. Multiple ranges - weight matches first range")
        void whenMultipleRanges_weightMatchesFirstRange() {
            // Surcharge 50,000 for 5-10kg, surcharge 100,000 for 10.01-20kg
            ServiceWeightPrice wp1 = createWeightPrice(5, 10, "50000");
            ServiceWeightPrice wp2 = createWeightPrice(10.01, 20, "100000");
            service.setWeightPrices(Arrays.asList(wp1, wp2));
            pet.setWeight(8);

            BigDecimal result = pricingService.calculateServicePrice(service, pet);

            // basePrice (100,000) + surcharge (50,000) = 150,000
            assertEquals(new BigDecimal("150000"), result);
        }

        @Test
        @DisplayName("11. Multiple ranges - weight matches second range")
        void whenMultipleRanges_weightMatchesSecondRange() {
            // Surcharge 50,000 for 5-10kg, surcharge 100,000 for 10.01-20kg
            ServiceWeightPrice wp1 = createWeightPrice(5, 10, "50000");
            ServiceWeightPrice wp2 = createWeightPrice(10.01, 20, "100000");
            service.setWeightPrices(Arrays.asList(wp1, wp2));
            pet.setWeight(15);

            BigDecimal result = pricingService.calculateServicePrice(service, pet);

            // basePrice (100,000) + surcharge (100,000) = 200,000
            assertEquals(new BigDecimal("200000"), result);
        }

        @Test
        @DisplayName("12. Null weightPrices list → should return basePrice")
        void whenWeightPricesListIsNull_shouldReturnBasePrice() {
            service.setWeightPrices(null);
            pet.setWeight(10);

            BigDecimal result = pricingService.calculateServicePrice(service, pet);

            assertEquals(new BigDecimal("100000"), result);
        }
    }

    // ========== calculateBookingDistanceFee TESTS ==========

    @Nested
    @DisplayName("calculateBookingDistanceFee Tests")
    class CalculateBookingDistanceFeeTests {

        @Test
        @DisplayName("12. Not HOME_VISIT → should return ZERO")
        void whenNotHomeVisit_shouldReturnZero() {
            List<ClinicService> services = Arrays.asList(createServiceWithPricePerKm("20000"));
            BigDecimal distance = new BigDecimal("10");

            BigDecimal result = pricingService.calculateBookingDistanceFee(services, distance, BookingType.IN_CLINIC);

            assertEquals(BigDecimal.ZERO, result);
        }

        @Test
        @DisplayName("13. Distance null → should return ZERO")
        void whenDistanceIsNull_shouldReturnZero() {
            List<ClinicService> services = Arrays.asList(createServiceWithPricePerKm("20000"));

            BigDecimal result = pricingService.calculateBookingDistanceFee(services, null, BookingType.HOME_VISIT);

            assertEquals(BigDecimal.ZERO, result);
        }

        @Test
        @DisplayName("14. Distance zero → should return ZERO")
        void whenDistanceIsZero_shouldReturnZero() {
            List<ClinicService> services = Arrays.asList(createServiceWithPricePerKm("20000"));

            BigDecimal result = pricingService.calculateBookingDistanceFee(services, BigDecimal.ZERO,
                    BookingType.HOME_VISIT);

            assertEquals(BigDecimal.ZERO, result);
        }

        @Test
        @DisplayName("15. Distance negative → should return ZERO")
        void whenDistanceIsNegative_shouldReturnZero() {
            List<ClinicService> services = Arrays.asList(createServiceWithPricePerKm("20000"));

            BigDecimal result = pricingService.calculateBookingDistanceFee(services, new BigDecimal("-5"),
                    BookingType.HOME_VISIT);

            assertEquals(BigDecimal.ZERO, result);
        }

        @Test
        @DisplayName("16. Services null → should return ZERO")
        void whenServicesIsNull_shouldReturnZero() {
            BigDecimal result = pricingService.calculateBookingDistanceFee(null, new BigDecimal("10"),
                    BookingType.HOME_VISIT);

            assertEquals(BigDecimal.ZERO, result);
        }

        @Test
        @DisplayName("17. Services empty → should return ZERO")
        void whenServicesIsEmpty_shouldReturnZero() {
            BigDecimal result = pricingService.calculateBookingDistanceFee(Collections.emptyList(),
                    new BigDecimal("10"), BookingType.HOME_VISIT);

            assertEquals(BigDecimal.ZERO, result);
        }

        @Test
        @DisplayName("18. Single service → should return distance × pricePerKm")
        void whenSingleService_shouldCalculateCorrectFee() {
            List<ClinicService> services = Arrays.asList(createServiceWithPricePerKm("20000"));
            BigDecimal distance = new BigDecimal("10");

            BigDecimal result = pricingService.calculateBookingDistanceFee(services, distance, BookingType.HOME_VISIT);

            assertEquals(new BigDecimal("200000"), result);
        }

        @Test
        @DisplayName("19. Multiple services - should use max pricePerKm")
        void whenMultipleServices_shouldUseMaxPricePerKm() {
            List<ClinicService> services = Arrays.asList(
                    createServiceWithPricePerKm("20000"),
                    createServiceWithPricePerKm("30000"));
            BigDecimal distance = new BigDecimal("10");

            BigDecimal result = pricingService.calculateBookingDistanceFee(services, distance, BookingType.HOME_VISIT);

            assertEquals(new BigDecimal("300000"), result);
        }

        @Test
        @DisplayName("20. Service with null pricePerKm → should skip and use non-null")
        void whenServiceHasNullPricePerKm_shouldUseNonNull() {
            List<ClinicService> services = Arrays.asList(
                    createServiceWithPricePerKm(null),
                    createServiceWithPricePerKm("20000"));
            BigDecimal distance = new BigDecimal("10");

            BigDecimal result = pricingService.calculateBookingDistanceFee(services, distance, BookingType.HOME_VISIT);

            assertEquals(new BigDecimal("200000"), result);
        }

        @Test
        @DisplayName("21. All services have null pricePerKm → should return ZERO")
        void whenAllServicesHaveNullPricePerKm_shouldReturnZero() {
            List<ClinicService> services = Arrays.asList(
                    createServiceWithPricePerKm(null),
                    createServiceWithPricePerKm(null));
            BigDecimal distance = new BigDecimal("10");

            BigDecimal result = pricingService.calculateBookingDistanceFee(services, distance, BookingType.HOME_VISIT);

            assertEquals(BigDecimal.ZERO, result);
        }

        @Test
        @DisplayName("22. SOS booking type → should return ZERO (only HOME_VISIT charges fee)")
        void whenSosBookingType_shouldReturnZero() {
            List<ClinicService> services = Arrays.asList(createServiceWithPricePerKm("20000"));
            BigDecimal distance = new BigDecimal("10");

            BigDecimal result = pricingService.calculateBookingDistanceFee(services, distance, BookingType.SOS);

            assertEquals(BigDecimal.ZERO, result);
        }
    }
}
