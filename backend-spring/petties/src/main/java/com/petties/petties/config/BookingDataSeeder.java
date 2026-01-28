package com.petties.petties.config;

import com.petties.petties.model.*;
import com.petties.petties.model.enums.*;
import com.petties.petties.repository.*;
import com.petties.petties.service.PricingService;
import com.petties.petties.service.LocationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.springframework.transaction.annotation.Transactional;

/**
 * BookingDataSeeder - Seed mock booking data for testing
 * 
 * Runs AFTER DataInitializer (Order 2)
 * Creates:
 * - Mock pets for pet owner
 * - Mock bookings with different service categories
 */
@Component
@RequiredArgsConstructor
@Slf4j
@Order(2) // Run after DataInitializer (default order 0)
public class BookingDataSeeder implements CommandLineRunner {

        private final UserRepository userRepository;
        private final PetRepository petRepository;
        private final ClinicRepository clinicRepository;
        private final ClinicServiceRepository clinicServiceRepository;
        private final BookingRepository bookingRepository;
        private final VetShiftRepository vetShiftRepository;
        private final PricingService pricingService;
        private final LocationService locationService;

        @Override
        @Transactional
        public void run(String... args) throws Exception {
                // Only run in dev mode
                String profile = System.getProperty("spring.profiles.active", "dev");
                if ("prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile)) {
                        log.info("🔒 Production mode - skipping booking mock data");
                        return;
                }

                log.info("📦 Seeding booking mock data...");

                try {
                        seedMockPets();
                        seedMockVetShifts();
                        seedMockServices(); // Add services with required categories
                        seedMockBookings();
                        log.info("✅ Booking mock data seeded successfully!");
                } catch (Exception e) {
                        log.error("❌ Failed to seed booking mock data: {}", e.getMessage());
                }
        }

        /**
         * Create mock pets for petOwner user
         */
        private void seedMockPets() {
                User petOwner = userRepository.findByUsername("petOwner").orElse(null);
                if (petOwner == null) {
                        log.warn("petOwner user not found, skipping pet seeding");
                        return;
                }

                // Check if pets already exist
                if (petRepository.findByUser_UserId(petOwner.getUserId()).size() > 0) {
                        log.info("   - Pets already exist for petOwner");
                        return;
                }

                // Create mock pets
                Pet[] pets = {
                                createPet(petOwner, "Buddy", "Chó", "Golden Retriever", LocalDate.of(2022, 3, 15), 25.5,
                                                "Đực"),
                                createPet(petOwner, "Mimi", "Mèo", "British Shorthair", LocalDate.of(2023, 6, 20), 4.2,
                                                "Cái"),
                                createPet(petOwner, "Max", "Chó", "German Shepherd", LocalDate.of(2021, 1, 10), 32.0,
                                                "Đực")
                };

                for (Pet pet : pets) {
                        if (pet != null) {
                                petRepository.save(pet);
                                log.info("   + Created pet: {}", pet.getName());
                        }
                }
        }

        private Pet createPet(User owner, String name, String species, String breed,
                        LocalDate dob, double weight, String gender) {
                Pet pet = new Pet();
                pet.setName(name);
                pet.setSpecies(species);
                pet.setBreed(breed);
                pet.setDateOfBirth(dob);
                pet.setWeight(weight);
                pet.setGender(gender);
                pet.setUser(owner);
                return pet;
        }

        /**
         * Create mock vet shifts for testing auto-assign
         */
        private void seedMockVetShifts() {
                User vet = userRepository.findByUsername("vet").orElse(null);
                if (vet == null) {
                        log.warn("vet user not found, skipping shift seeding");
                        return;
                }

                Clinic clinic = vet.getWorkingClinic();
                if (clinic == null) {
                        log.warn("vet has no working clinic, skipping shift seeding");
                        return;
                }

                // Check if shifts already exist for next 7 days
                LocalDate today = LocalDate.now();
                List<VetShift> existingShifts = vetShiftRepository.findByVet_UserIdAndWorkDate(vet.getUserId(), today);
                if (!existingShifts.isEmpty()) {
                        log.info("   - Vet shifts already exist");
                        return;
                }

                // Create shifts for next 7 days (8:00 - 17:00)
                for (int i = 0; i < 7; i++) {
                        LocalDate shiftDate = today.plusDays(i);
                        VetShift shift = VetShift.builder()
                                        .vet(vet)
                                        .clinic(clinic)
                                        .workDate(shiftDate)
                                        .startTime(LocalTime.of(8, 0))
                                        .endTime(LocalTime.of(17, 0))
                                        .isOvernight(false)
                                        .build();
                        vetShiftRepository.save(shift);
                }
                log.info("   + Created 7 days of vet shifts for {}", vet.getFullName());
        }

        /**
         * Create mock services with required categories for multi-service booking
         * testing
         */
        private void seedMockServices() {
                // Find the target clinic (same logic as seedMockBookings)
                Clinic clinic = clinicRepository.findAll().stream()
                                .filter(c -> c.getName() != null && c.getName().contains("Central"))
                                .findFirst()
                                .orElseGet(() -> {
                                        User manager = userRepository.findByUsername("clinicManager").orElse(null);
                                        return manager != null && manager.getWorkingClinic() != null
                                                        ? manager.getWorkingClinic()
                                                        : clinicRepository.findAll().stream().findFirst().orElse(null);
                                });

                if (clinic == null) {
                        log.warn("No clinic found, skipping service seeding");
                        return;
                }

                log.info("   - Seeding services for clinic: {}", clinic.getName());

                // Get existing services
                List<ClinicService> existingServices = clinicServiceRepository
                                .findByClinicClinicIdAndIsActiveTrue(clinic.getClinicId());

                // Categories to ensure exist
                java.util.Map<ServiceCategory, String[]> servicesToCreate = new java.util.LinkedHashMap<>();
                servicesToCreate.put(ServiceCategory.CHECK_UP, new String[] { "Khám tổng quát", "150000" });
                servicesToCreate.put(ServiceCategory.GROOMING_SPA, new String[] { "Tắm spa", "200000" });
                servicesToCreate.put(ServiceCategory.VACCINATION, new String[] { "Tiêm phòng dại", "180000" });
                servicesToCreate.put(ServiceCategory.DENTAL, new String[] { "Cạo vôi răng", "350000" });
                servicesToCreate.put(ServiceCategory.DERMATOLOGY, new String[] { "Khám da liễu", "250000" });

                for (java.util.Map.Entry<ServiceCategory, String[]> entry : servicesToCreate.entrySet()) {
                        ServiceCategory category = entry.getKey();
                        String[] data = entry.getValue();

                        // Check if service with this category already exists
                        boolean exists = existingServices.stream()
                                        .anyMatch(s -> category.equals(s.getServiceCategory()));

                        if (!exists) {
                                ClinicService service = new ClinicService();
                                service.setClinic(clinic);
                                service.setName(data[0]);
                                service.setBasePrice(new BigDecimal(data[1]));
                                service.setDurationTime(30);
                                service.setSlotsRequired(1);
                                service.setIsActive(true);
                                service.setIsHomeVisit(category == ServiceCategory.VACCINATION
                                                || category == ServiceCategory.GROOMING_SPA
                                                || category == ServiceCategory.CHECK_UP);
                                service.setIsCustom(true);
                                service.setServiceCategory(category);
                                // Set pricePerKm for home visit services
                                boolean supportsHomeVisit = category == ServiceCategory.VACCINATION
                                                || category == ServiceCategory.GROOMING_SPA
                                                || category == ServiceCategory.CHECK_UP;

                                service.setPricePerKm(supportsHomeVisit ? BigDecimal.valueOf(5000) : BigDecimal.ZERO);

                                // Add weight-based pricing for GROOMING_SPA
                                if (category == ServiceCategory.GROOMING_SPA) {
                                        // 0-10kg: 150,000đ
                                        ServiceWeightPrice wp1 = new ServiceWeightPrice();
                                        wp1.setService(service);
                                        wp1.setMinWeight(BigDecimal.ZERO);
                                        wp1.setMaxWeight(BigDecimal.valueOf(10));
                                        wp1.setPrice(BigDecimal.valueOf(150000));

                                        // 10.01-25kg: 250,000đ
                                        ServiceWeightPrice wp2 = new ServiceWeightPrice();
                                        wp2.setService(service);
                                        wp2.setMinWeight(BigDecimal.valueOf(10.01));
                                        wp2.setMaxWeight(BigDecimal.valueOf(25));
                                        wp2.setPrice(BigDecimal.valueOf(250000));

                                        // 25.01-100kg: 400,000đ
                                        ServiceWeightPrice wp3 = new ServiceWeightPrice();
                                        wp3.setService(service);
                                        wp3.setMinWeight(BigDecimal.valueOf(25.01));
                                        wp3.setMaxWeight(BigDecimal.valueOf(100));
                                        wp3.setPrice(BigDecimal.valueOf(400000));

                                        service.getWeightPrices().addAll(List.of(wp1, wp2, wp3));
                                        log.info(
                                                        "   + Added weight-based pricing for GROOMING_SPA: 0-10kg=150k, 10-25kg=250k, 25-100kg=400k");
                                }

                                clinicServiceRepository.save(service);
                                log.info("   + Created service: {} ({})", data[0], category);
                        }
                }
        }

        /**
         * Create mock bookings with different service categories
         * Includes multi-service bookings for testing multi-specialty assignment
         */
        private void seedMockBookings() {
                User petOwner = userRepository.findByUsername("petOwner").orElse(null);
                if (petOwner == null) {
                        log.warn("petOwner not found, skipping booking seeding");
                        return;
                }

                // Try to find clinic by name pattern first, then fallback to clinicManager's
                // clinic
                Clinic clinic = clinicRepository.findAll().stream()
                                .filter(c -> c.getName() != null && c.getName().contains("Central"))
                                .findFirst()
                                .orElseGet(() -> {
                                        User manager = userRepository.findByUsername("clinicManager").orElse(null);
                                        return manager != null && manager.getWorkingClinic() != null
                                                        ? manager.getWorkingClinic()
                                                        : clinicRepository.findAll().stream().findFirst().orElse(null);
                                });

                if (clinic == null) {
                        log.warn("No clinic found, skipping booking seeding");
                        return;
                }

                log.info("   - Seeding bookings for clinic: {} (ID: {})", clinic.getName(), clinic.getClinicId());

                List<Pet> pets = petRepository.findByUser_UserId(petOwner.getUserId());
                if (pets.isEmpty()) {
                        log.warn("No pets found for petOwner, skipping booking seeding");
                        return;
                }
                log.info("   - Found {} pets for petOwner", pets.size());

                // Check bookings - clear old PENDING bookings and reseed if needed
                LocalDate today = LocalDate.now();
                List<Booking> existingPendingBookings = bookingRepository.findAll().stream()
                                .filter(b -> b.getStatus() == BookingStatus.PENDING
                                                || b.getStatus() == BookingStatus.CONFIRMED)
                                .filter(b -> b.getNotes() != null && b.getNotes().startsWith("[")) // Only seeded
                                                                                                   // bookings have
                                                                                                   // [TOMORROW] etc
                                                                                                   // prefix
                                .toList();

                // Delete old seeded bookings that are in the past
                List<Booking> staleBookings = existingPendingBookings.stream()
                                .filter(b -> b.getBookingDate().isBefore(today))
                                .toList();

                if (!staleBookings.isEmpty()) {
                        log.info("   - Cleaning up {} stale seeded bookings from past dates", staleBookings.size());
                        bookingRepository.deleteAll(staleBookings);
                }

                // Check if we have enough FUTURE bookings
                long futureBookingsCount = existingPendingBookings.stream()
                                .filter(b -> !b.getBookingDate().isBefore(today))
                                .count();

                if (futureBookingsCount >= 8) {
                        log.info("   - Already have {} future seeded bookings, skipping", futureBookingsCount);
                        return;
                }
                log.info("   - Current future bookings: {}, will seed more", futureBookingsCount);

                // Get services by category
                List<ClinicService> allServices = clinicServiceRepository
                                .findByClinicClinicIdAndIsActiveTrue(clinic.getClinicId());
                log.info("   - Found {} active services for clinic", allServices.size());
                if (allServices.isEmpty()) {
                        log.warn("No services found for clinic, skipping booking seeding");
                        return;
                }

                // Use FUTURE dates for testing (today's bookings may already be past the time)
                LocalDate tomorrow = today.plusDays(1);
                LocalDate dayAfter = today.plusDays(2);
                LocalDate day3 = today.plusDays(3);
                Pet pet1 = pets.get(0);
                Pet pet2 = pets.size() > 1 ? pets.get(1) : pet1;
                Pet pet3 = pets.size() > 2 ? pets.get(2) : pet1;

                // ========== TOMORROW BOOKINGS ==========

                // BOOKING 1: Single service (CHECK_UP) - Morning
                createBooking(clinic, pet1, petOwner, tomorrow, LocalTime.of(9, 0),
                                BookingType.IN_CLINIC, "[TOMORROW] Khám tổng quát sáng",
                                findServicesByCategory(allServices, "CHECK_UP", 1));

                // BOOKING 2: Single service (GROOMING_SPA) - Late Morning
                createBooking(clinic, pet1, petOwner, tomorrow, LocalTime.of(10, 30),
                                BookingType.IN_CLINIC, "[TOMORROW] Tắm spa",
                                findServicesByCategory(allServices, "GROOMING_SPA", 1));

                // BOOKING 3: MULTI-SERVICE (CHECK_UP + GROOMING - different specialty)
                createBooking(clinic, pet2, petOwner, tomorrow, LocalTime.of(14, 0),
                                BookingType.IN_CLINIC, "[TOMORROW] Combo khám + tắm (MULTI-SPECIALTY)",
                                findServicesByCategories(allServices, new String[] { "CHECK_UP", "GROOMING_SPA" }));

                // BOOKING 4: HOME VISIT (VACCINATION) - calculate real distance from clinic
                double homeLat4 = 16.0058, homeLng4 = 108.2478;
                double distKm4 = locationService.calculateDistance(
                                clinic.getLatitude(), clinic.getLongitude(),
                                BigDecimal.valueOf(homeLat4), BigDecimal.valueOf(homeLng4));
                createBookingWithHomeVisit(clinic, pet1, petOwner, tomorrow, LocalTime.of(15, 30),
                                String.format("[TOMORROW] Tiêm vaccine tại nhà - %.1fkm", distKm4),
                                findServicesByCategory(allServices, "VACCINATION", 1),
                                "123 Lê Văn Hiến, Ngũ Hành Sơn, Đà Nẵng", homeLat4, homeLng4,
                                BigDecimal.valueOf(distKm4));

                // ========== DAY AFTER TOMORROW BOOKINGS ==========

                // BOOKING 5: MULTI-SERVICE (DENTAL + DERMATOLOGY)
                createBooking(clinic, pet1, petOwner, dayAfter, LocalTime.of(9, 30),
                                BookingType.IN_CLINIC, "[+2 DAYS] Combo nha khoa + da liễu",
                                findServicesByCategories(allServices, new String[] { "DENTAL", "DERMATOLOGY" }));

                // BOOKING 6: Single DENTAL
                createBooking(clinic, pet2, petOwner, dayAfter, LocalTime.of(11, 0),
                                BookingType.IN_CLINIC, "[+2 DAYS] Cạo vôi răng chó lớn",
                                findServicesByCategory(allServices, "DENTAL", 1));

                // BOOKING 7: Triple services (CHECK_UP + VACCINATION + GROOMING)
                createBooking(clinic, pet3, petOwner, dayAfter, LocalTime.of(14, 30),
                                BookingType.IN_CLINIC, "[+2 DAYS] Combo 3 dịch vụ",
                                findServicesByCategories(allServices,
                                                new String[] { "CHECK_UP", "VACCINATION", "GROOMING_SPA" }));

                // ========== 3 DAYS LATER BOOKINGS ==========

                // BOOKING 8: Morning slot for testing reassign
                createBooking(clinic, pet1, petOwner, day3, LocalTime.of(8, 30),
                                BookingType.IN_CLINIC, "[+3 DAYS] Khám sớm - test reassign",
                                findServicesByCategory(allServices, "CHECK_UP", 1));

                // BOOKING 9: HOME VISIT with multiple services - calculate real distance
                double homeLat9 = 15.9925, homeLng9 = 108.2564;
                double distKm9 = locationService.calculateDistance(
                                clinic.getLatitude(), clinic.getLongitude(),
                                BigDecimal.valueOf(homeLat9), BigDecimal.valueOf(homeLng9));
                createBookingWithHomeVisit(clinic, pet2, petOwner, day3, LocalTime.of(10, 0),
                                String.format("[+3 DAYS] Khám + tiêm tại nhà - %.1fkm", distKm9),
                                findServicesByCategories(allServices, new String[] { "CHECK_UP", "VACCINATION" }),
                                "456 Trần Đại Nghĩa, Hòa Hải, Ngũ Hành Sơn, Đà Nẵng", homeLat9, homeLng9,
                                BigDecimal.valueOf(distKm9));

                // BOOKING 10: Late afternoon booking
                createBooking(clinic, pet3, petOwner, day3, LocalTime.of(16, 0),
                                BookingType.IN_CLINIC, "[+3 DAYS] Khám da liễu chiều muộn",
                                findServicesByCategory(allServices, "DERMATOLOGY", 1));

                // ========== BOOKING 11: HOME VISIT với pet nặng để test weight-based +
                // distance pricing ==========
                double homeLat11 = 16.0321, homeLng11 = 108.2395;
                double distKm11 = locationService.calculateDistance(
                                clinic.getLatitude(), clinic.getLongitude(),
                                BigDecimal.valueOf(homeLat11), BigDecimal.valueOf(homeLng11));
                createBookingWithHomeVisit(clinic, pet3, petOwner, day3, LocalTime.of(14, 0),
                                String.format("[+3 DAYS] Tắm spa tại nhà - chó lớn 32kg, %.1fkm (TEST WEIGHT + DISTANCE)",
                                                distKm11),
                                findServicesByCategory(allServices, "GROOMING_SPA", 1),
                                "789 Võ Chí Công, Mỹ An, Ngũ Hành Sơn, Đà Nẵng", homeLat11, homeLng11,
                                BigDecimal.valueOf(distKm11));

                // ========== BOOKING 12: IN_PROGRESS for testing Add-on Service ==========
                double homeLat12 = 16.0150, homeLng12 = 108.2450;
                double distKm12 = locationService.calculateDistance(
                                clinic.getLatitude(), clinic.getLongitude(),
                                BigDecimal.valueOf(homeLat12), BigDecimal.valueOf(homeLng12));
                createBookingWithStatus(clinic, pet1, petOwner, LocalDate.now(), LocalTime.of(10, 0),
                                String.format("[TODAY] Đang khám tại nhà - TEST ADD-ON SERVICE (%.1fkm)", distKm12),
                                findServicesByCategory(allServices, "CHECK_UP", 1),
                                "123 Mỹ Khê, Ngũ Hành Sơn, Đà Nẵng", homeLat12, homeLng12,
                                BigDecimal.valueOf(distKm12), BookingStatus.IN_PROGRESS);

                // ========== BOOKING 13: ASSIGNED for testing Check-in flow ==========
                double homeLat13 = 16.0280, homeLng13 = 108.2380;
                double distKm13 = locationService.calculateDistance(
                                clinic.getLatitude(), clinic.getLongitude(),
                                BigDecimal.valueOf(homeLat13), BigDecimal.valueOf(homeLng13));
                createBookingWithStatus(clinic, pet2, petOwner, LocalDate.now(), LocalTime.of(14, 0),
                                String.format("[TODAY] Đã gán BS - TEST CHECK-IN (%.1fkm)", distKm13),
                                findServicesByCategory(allServices, "VACCINATION", 1),
                                "456 Ngô Quyền, Sơn Trà, Đà Nẵng", homeLat13, homeLng13,
                                BigDecimal.valueOf(distKm13), BookingStatus.ASSIGNED);
        }

        /**
         * Create a booking with services
         */
        private void createBooking(Clinic clinic, Pet pet, User petOwner, LocalDate date,
                        LocalTime time, BookingType type, String notes, List<ClinicService> services) {

                log.info("   >> createBooking called with {} services for: {}", services.size(), notes);
                if (services.isEmpty()) {
                        log.warn("No services provided for booking '{}', using first available", notes);
                        services = clinicServiceRepository.findByClinicClinicIdAndIsActiveTrue(clinic.getClinicId());
                        if (services.isEmpty())
                                return;
                        services = List.of(services.get(0));
                } else {
                        log.info("   >> Services: {}", services.stream()
                                        .map(s -> s.getName() + "(" + s.getServiceCategory() + ")")
                                        .toList());
                }

                long sequence = bookingRepository.countByClinicAndDate(clinic.getClinicId(), date) + 1;
                String bookingCode = Booking.generateBookingCode(date, (int) sequence);

                // Calculate total price: sum of service prices
                BigDecimal totalPrice = BigDecimal.ZERO;
                for (ClinicService service : services) {
                        totalPrice = totalPrice.add(pricingService.calculateServicePrice(service, pet));
                }

                Booking booking = Booking.builder()
                                .bookingCode(bookingCode)
                                .pet(pet)
                                .petOwner(petOwner)
                                .clinic(clinic)
                                .bookingDate(date)
                                .bookingTime(time)
                                .type(type)
                                .totalPrice(totalPrice)
                                .distanceFee(BigDecimal.ZERO)
                                .status(BookingStatus.PENDING)
                                .notes(notes)
                                .build();

                // Add service items with calculated prices and breakdown
                for (ClinicService service : services) {
                        BigDecimal basePrice = service.getBasePrice();
                        BigDecimal weightPrice = pricingService.calculateServicePrice(service, pet);

                        BookingServiceItem item = BookingServiceItem.builder()
                                        .booking(booking)
                                        .service(service)
                                        .unitPrice(weightPrice)
                                        .basePrice(basePrice)
                                        .weightPrice(weightPrice)
                                        .quantity(1)
                                        .build();
                        booking.getBookingServices().add(item);
                }

                bookingRepository.save(booking);
                log.info("   + Created booking: {} with {} service(s) - {} (total: {})",
                                bookingCode, services.size(), notes, totalPrice);
        }

        /**
         * Create a home visit booking with proper pricing (weight-based + distance fee)
         */
        private void createBookingWithHomeVisit(Clinic clinic, Pet pet, User petOwner,
                        LocalDate date, LocalTime time, String notes, List<ClinicService> services,
                        String address, double lat, double lng, BigDecimal distanceKm) {

                if (services.isEmpty())
                        return;

                long sequence = bookingRepository.countByClinicAndDate(clinic.getClinicId(), date) + 1;
                String bookingCode = Booking.generateBookingCode(date, (int) sequence);

                // Calculate single distance fee for the whole booking
                BigDecimal distanceFee = pricingService.calculateBookingDistanceFee(services, distanceKm,
                                BookingType.HOME_VISIT);

                // Total price = sum of weight-based service prices + distance fee
                BigDecimal totalPrice = distanceFee;
                for (ClinicService service : services) {
                        BigDecimal weightPrice = pricingService.calculateServicePrice(service, pet);
                        totalPrice = totalPrice.add(weightPrice);
                }

                Booking booking = Booking.builder()
                                .bookingCode(bookingCode)
                                .pet(pet)
                                .petOwner(petOwner)
                                .clinic(clinic)
                                .bookingDate(date)
                                .bookingTime(time)
                                .type(BookingType.HOME_VISIT)
                                .totalPrice(totalPrice)
                                .distanceFee(distanceFee)
                                .status(BookingStatus.PENDING)
                                .notes(notes)
                                .homeAddress(address)
                                .homeLat(BigDecimal.valueOf(lat))
                                .homeLong(BigDecimal.valueOf(lng))
                                .distanceKm(distanceKm)
                                .build();

                for (ClinicService service : services) {
                        // Calculate individual pricing components
                        BigDecimal basePrice = service.getBasePrice();
                        BigDecimal weightPrice = pricingService.calculateServicePrice(service, pet);

                        // Unit price for home visit is just the weight price
                        // The distance fee is stored at the booking level
                        BigDecimal unitPrice = weightPrice;

                        BookingServiceItem item = BookingServiceItem.builder()
                                        .booking(booking)
                                        .service(service)
                                        .unitPrice(unitPrice)
                                        .basePrice(basePrice)
                                        .weightPrice(weightPrice)
                                        .quantity(1)
                                        .build();
                        booking.getBookingServices().add(item);
                }

                bookingRepository.save(booking);
                log.info("   + Created HOME VISIT booking: {} - {} (distance: {}km, total: {}đ)",
                                bookingCode, notes, distanceKm, totalPrice);
        }

        /**
         * Create a home visit booking with custom status (for testing IN_PROGRESS)
         * Also assigns vet for ASSIGNED/IN_PROGRESS/CHECK_IN statuses
         */
        private void createBookingWithStatus(Clinic clinic, Pet pet, User petOwner,
                        LocalDate date, LocalTime time, String notes, List<ClinicService> services,
                        String address, double lat, double lng, BigDecimal distanceKm, BookingStatus status) {

                if (services.isEmpty())
                        return;

                long sequence = bookingRepository.countByClinicAndDate(clinic.getClinicId(), date) + 1;
                String bookingCode = Booking.generateBookingCode(date, (int) sequence);

                // Calculate distance fee (using highest pricePerKm)
                BigDecimal distanceFee = pricingService.calculateBookingDistanceFee(services, distanceKm,
                                BookingType.HOME_VISIT);

                // Calculate service prices
                BigDecimal servicesTotal = BigDecimal.ZERO;
                for (ClinicService service : services) {
                        servicesTotal = servicesTotal.add(pricingService.calculateServicePrice(service, pet));
                }

                BigDecimal totalPrice = servicesTotal.add(distanceFee);

                // Find a vet to assign for ASSIGNED/IN_PROGRESS/CHECK_IN statuses
                User assignedVet = null;
                if (status == BookingStatus.ASSIGNED || status == BookingStatus.IN_PROGRESS
                                || status == BookingStatus.CHECK_IN || status == BookingStatus.CONFIRMED) {
                        assignedVet = userRepository.findByUsername("vet").orElse(null);
                        if (assignedVet == null) {
                                log.warn("vet user not found, booking will have no assigned vet");
                        }
                }

                Booking booking = Booking.builder()
                                .bookingCode(bookingCode)
                                .pet(pet)
                                .petOwner(petOwner)
                                .clinic(clinic)
                                .bookingDate(date)
                                .bookingTime(time)
                                .type(BookingType.HOME_VISIT)
                                .totalPrice(totalPrice)
                                .distanceFee(distanceFee)
                                .status(status)
                                .notes(notes)
                                .homeAddress(address)
                                .homeLat(BigDecimal.valueOf(lat))
                                .homeLong(BigDecimal.valueOf(lng))
                                .distanceKm(distanceKm)
                                .assignedVet(assignedVet)
                                .build();

                for (ClinicService service : services) {
                        BigDecimal basePrice = service.getBasePrice();
                        BigDecimal weightPrice = pricingService.calculateServicePrice(service, pet);

                        BookingServiceItem item = BookingServiceItem.builder()
                                        .booking(booking)
                                        .service(service)
                                        .unitPrice(weightPrice)
                                        .basePrice(basePrice)
                                        .weightPrice(weightPrice)
                                        .quantity(1)
                                        .assignedVet(assignedVet)
                                        .build();
                        booking.getBookingServices().add(item);
                }

                bookingRepository.save(booking);
                log.info("   + Created {} booking: {} - {} (vet: {}, total: {}đ)",
                                status, bookingCode, notes,
                                assignedVet != null ? assignedVet.getFullName() : "NONE", totalPrice);
        }

        /**
         * Find services by category name
         */
        private List<ClinicService> findServicesByCategory(List<ClinicService> services, String categoryName,
                        int limit) {
                return services.stream()
                                .filter(s -> s.getServiceCategory() != null
                                                && categoryName.equals(s.getServiceCategory().name()))
                                .limit(limit)
                                .toList();
        }

        /**
         * Find one service for each category
         */
        private List<ClinicService> findServicesByCategories(List<ClinicService> services, String[] categories) {
                log.info("   >> findServicesByCategories: looking for {} in {} services",
                                java.util.Arrays.toString(categories), services.size());

                // Log all available categories
                log.info("   >> Available categories: {}",
                                services.stream()
                                                .map(s -> s.getServiceCategory() != null ? s.getServiceCategory().name()
                                                                : "NULL")
                                                .distinct()
                                                .toList());

                List<ClinicService> result = java.util.Arrays.stream(categories)
                                .map(cat -> services.stream()
                                                .filter(s -> s.getServiceCategory() != null
                                                                && cat.equals(s.getServiceCategory().name()))
                                                .findFirst()
                                                .orElse(null))
                                .filter(s -> s != null)
                                .toList();

                log.info("   >> Found {} services matching categories", result.size());
                return result;
        }
}
