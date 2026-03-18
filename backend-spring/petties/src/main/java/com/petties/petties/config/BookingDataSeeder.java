package com.petties.petties.config;

import com.petties.petties.model.*;
import com.petties.petties.model.enums.*;
import com.petties.petties.repository.*;
import com.petties.petties.service.PricingService;
import com.petties.petties.service.LocationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * BookingDataSeeder - Seed mock booking data for testing
 * 
 * Runs AFTER DataInitializer (Order 2)
 * Creates:
 * - Mock pets for pet owner
 * - Mock bookings with different service categories
 */
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
@ConditionalOnProperty(name = "app.init.seed-booking-data", havingValue = "true")
@RequiredArgsConstructor
@Order(2)
public class BookingDataSeeder implements CommandLineRunner {

        private static final Logger log = LoggerFactory.getLogger(BookingDataSeeder.class);

        private final UserRepository userRepository;
        private final PetRepository petRepository;
        private final ClinicRepository clinicRepository;
        private final ClinicServiceRepository clinicServiceRepository;
        private final BookingRepository bookingRepository;
        private final StaffShiftRepository staffShiftRepository;
        private final PricingService pricingService;
        private final LocationService locationService;
        private final VaccineTemplateRepository vaccineTemplateRepository;
        private final VaccineDosePriceRepository vaccineDosePriceRepository;
        private final com.petties.petties.service.VaccinationService vaccinationService;
        private final SlotRepository slotRepository;
        private final BookingSlotRepository bookingSlotRepository;
        private final VaccinationRecordRepository vaccinationRecordRepository;
        private final com.petties.petties.service.NotificationService notificationService;

        private long bookingSequenceCounter = 1;

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

                log.info("   Cleaning up old data to ensure fresh seeding...");
                // Order of deletion to avoid FK constraints
                bookingSlotRepository.deleteAll();
                slotRepository.deleteAll();
                vaccinationRecordRepository.deleteAll();
                bookingRepository.deleteAll();
                staffShiftRepository.deleteAll();

                bookingRepository.flush();
                staffShiftRepository.flush();

                seedMockPets();
                seedMockStaffShifts();
                seedMockServices(); // Add services with required categories
                seedMockBookings();

                log.info("✅ Booking mock data seeded successfully!");
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
                                createPet(petOwner, "Buddy", com.petties.petties.model.enums.PetSpecies.DOG, "Golden Retriever", LocalDate.of(2022, 3, 15), 25.5,
                                                "Đực"),
                                createPet(petOwner, "Mimi", com.petties.petties.model.enums.PetSpecies.CAT, "British Shorthair", LocalDate.of(2023, 6, 20), 4.2,
                                                "Cái"),
                                createPet(petOwner, "Max", com.petties.petties.model.enums.PetSpecies.DOG, "German Shepherd", LocalDate.of(2021, 1, 10), 32.0,
                                                "Đực")
                };

                for (Pet pet : pets) {
                        if (pet != null) {
                                petRepository.save(pet);
                                log.info("   + Created pet: {}", pet.getName());
                        }
                }
        }

        private Pet createPet(User owner, String name, com.petties.petties.model.enums.PetSpecies species, String breed,
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
         * Create mock staff shifts for testing auto-assign
         * Extends to 21:00 to cover evening test bookings
         */
        private void seedMockStaffShifts() {
                Clinic clinic = clinicRepository.findAll().stream()
                                .filter(c -> c.getName() != null && c.getName().contains("Central"))
                                .findFirst()
                                .orElse(null);
                if (clinic == null)
                        return;

                List<User> staffMembers = userRepository.findAll().stream()
                                .filter(u -> u.getRole() == Role.STAFF && u.getWorkingClinic() != null
                                                && u.getWorkingClinic().getClinicId().equals(clinic.getClinicId()))
                                .toList();

                if (staffMembers.isEmpty()) {
                        log.warn("No staff found for clinic {}, skipping shift seeding", clinic.getName());
                        return;
                }

                LocalDate today = LocalDate.now();

                for (User staff : staffMembers) {
                        log.info("   - Seeding shifts for staff: {}", staff.getFullName());
                        // 1. Ensure TODAY has a shift for testing (even if Sunday)
                        List<StaffShift> shiftsToday = staffShiftRepository.findByStaff_UserIdAndWorkDate(
                                        staff.getUserId(),
                                        today);
                        if (shiftsToday.isEmpty()) {
                                StaffShift todayShift = StaffShift.builder()
                                                .staff(staff)
                                                .clinic(clinic)
                                                .workDate(today)
                                                .startTime(LocalTime.of(8, 0))
                                                .endTime(LocalTime.of(21, 0)) // Extended for testing
                                                .isOvernight(false)
                                                .build();
                                StaffShift savedShift = staffShiftRepository.save(todayShift);
                                generateSlots(savedShift);
                                log.info("   + Created/Forced shift for TODAY (Sunday testing): 08:00-21:00 with slots");
                        } else {
                                // Update existing shift to ensure it covers test times
                                StaffShift existing = shiftsToday.get(0);
                                if (existing.getEndTime().isBefore(LocalTime.of(21, 0))) {
                                        existing.setEndTime(LocalTime.of(21, 0));
                                        staffShiftRepository.save(existing);
                                        log.info("   + Extended existing Today shift to 21:00 for testing");
                                }
                        }

                        // 2. Ensure next 6 days have shifts
                        for (int i = 1; i <= 6; i++) {
                                LocalDate shiftDate = today.plusDays(i);
                                if (staffShiftRepository.findByStaff_UserIdAndWorkDate(staff.getUserId(), shiftDate)
                                                .isEmpty()) {
                                        StaffShift shift = StaffShift.builder()
                                                        .staff(staff)
                                                        .clinic(clinic)
                                                        .workDate(shiftDate)
                                                        .startTime(LocalTime.of(8, 0))
                                                        .endTime(LocalTime.of(21, 0))
                                                        .isOvernight(false)
                                                        .build();
                                        StaffShift saved = staffShiftRepository.save(shift);
                                        generateSlots(saved);
                                }
                        }
                }
                log.info("   + Verified staff shifts for ALL staff for next 7 days");
        }

        private List<Slot> generateSlots(StaffShift shift, LocalTime breakStart, LocalTime breakEnd) {
                List<Slot> slots = new java.util.ArrayList<>();
                LocalTime currentTime = shift.getStartTime();
                LocalTime endTime = shift.getEndTime();
                boolean isOvernight = Boolean.TRUE.equals(shift.getIsOvernight());

                if (isOvernight) {
                        LocalTime lastSlotBeforeMidnight = LocalTime.of(23, 30);
                        while (currentTime.isBefore(lastSlotBeforeMidnight)
                                        || currentTime.equals(lastSlotBeforeMidnight)) {
                                LocalTime slotEnd = currentTime.plusMinutes(30);
                                if (slotEnd.isBefore(currentTime))
                                        break;
                                if (!isInBreakTime(currentTime, slotEnd, breakStart, breakEnd)) {
                                        slots.add(new Slot(null, shift, currentTime, slotEnd, SlotStatus.AVAILABLE,
                                                        java.time.LocalDateTime.now(), java.time.LocalDateTime.now()));
                                }
                                currentTime = slotEnd;
                                if (currentTime.equals(LocalTime.MIDNIGHT)
                                                || currentTime.isBefore(shift.getStartTime()))
                                        break;
                        }

                        currentTime = LocalTime.of(0, 0);
                        while (currentTime.plusMinutes(30).compareTo(endTime) <= 0) {
                                LocalTime slotEnd = currentTime.plusMinutes(30);
                                if (!isInBreakTime(currentTime, slotEnd, breakStart, breakEnd)) {
                                        slots.add(new Slot(null, shift, currentTime, slotEnd, SlotStatus.AVAILABLE,
                                                        java.time.LocalDateTime.now(), java.time.LocalDateTime.now()));
                                }
                                currentTime = slotEnd;
                        }
                } else {
                        while (currentTime.plusMinutes(30).compareTo(endTime) <= 0) {
                                LocalTime slotEnd = currentTime.plusMinutes(30);
                                if (!isInBreakTime(currentTime, slotEnd, breakStart, breakEnd)) {
                                        slots.add(new Slot(null, shift, currentTime, slotEnd, SlotStatus.AVAILABLE,
                                                        java.time.LocalDateTime.now(), java.time.LocalDateTime.now()));
                                }
                                currentTime = slotEnd;
                        }
                }
                return slots;
        }

        private boolean isInBreakTime(LocalTime slotStart, LocalTime slotEnd, LocalTime breakStart,
                        LocalTime breakEnd) {
                if (breakStart == null || breakEnd == null)
                        return false;
                return slotStart.isBefore(breakEnd) && slotEnd.isAfter(breakStart);
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

                        // Special handling for VACCINATION - create the extra "Tiêm phòng dại" service
                        // first
                        if (category == ServiceCategory.VACCINATION) {
                                // Check if "Tiêm phòng dại" specifically exists
                                boolean rabiesExists = existingServices.stream()
                                                .anyMatch(s -> "Tiêm phòng dại".equals(s.getName()));
                                if (!rabiesExists) {
                                        ClinicService service = new ClinicService();
                                        service.setClinic(clinic);
                                        service.setName("Tiêm phòng dại");
                                        service.setBasePrice(new BigDecimal("180000"));
                                        service.setDurationTime(30);
                                        service.setSlotsRequired(1);
                                        service.setIsActive(true);
                                        service.setIsHomeVisit(true);
                                        service.setIsCustom(true);
                                        service.setServiceCategory(ServiceCategory.VACCINATION);
                                        clinicServiceRepository.save(service);
                                }
                                seedVaccinationServices(clinic);
                                continue;
                        }

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
                                service.setIsHomeVisit(category == ServiceCategory.GROOMING_SPA
                                                || category == ServiceCategory.CHECK_UP);
                                service.setIsCustom(true);
                                service.setServiceCategory(category);
                                // Set pricePerKm for home visit services
                                boolean supportsHomeVisit = category == ServiceCategory.GROOMING_SPA
                                                || category == ServiceCategory.CHECK_UP;

                                // pricePerKm is now managed at clinic level via ClinicPriceService

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

        private void seedVaccinationServices(Clinic clinic) {
                List<VaccineTemplate> templates = vaccineTemplateRepository.findAll();
                if (templates.isEmpty()) {
                        log.warn("   ! No vaccine templates found to seed services.");
                        return;
                }

                for (VaccineTemplate template : templates) {
                        // Check if service for this template already exists
                        ClinicService existingService = clinicServiceRepository
                                        .findByClinicClinicIdAndIsActiveTrue(clinic.getClinicId())
                                        .stream()
                                        .filter(s -> s.getVaccineTemplate() != null
                                                        && s.getVaccineTemplate().getId().equals(template.getId()))
                                        .findFirst()
                                        .orElse(null);

                        if (existingService != null) {
                                // Force duration to 30 mins
                                if (existingService.getDurationTime() != 30) {
                                        existingService.setDurationTime(30);
                                        clinicServiceRepository.save(existingService);
                                }

                                // If exists but has old name prefix "Tiêm " or doesn't match template name,
                                // rename it
                                String currentName = existingService.getName();
                                String correctName = template.getName();

                                if (!currentName.equals(correctName) && currentName.startsWith("Tiêm ")) {
                                        existingService.setName(correctName);
                                        clinicServiceRepository.save(existingService);
                                        log.info("   ! Renamed legacy service: '{}' -> '{}'", currentName, correctName);
                                }
                                continue;
                        }

                        String serviceName = template.getName();

                        ClinicService service = new ClinicService();
                        service.setClinic(clinic);
                        service.setName(serviceName);
                        service.setServiceCategory(ServiceCategory.VACCINATION);
                        service.setBasePrice(template.getDefaultPrice() != null ? template.getDefaultPrice()
                                        : BigDecimal.valueOf(100000));
                        service.setDurationTime(30); // Standardized to 30 mins
                        service.setSlotsRequired(1);
                        service.setIsActive(true);
                        service.setIsHomeVisit(true);
                        service.setIsCustom(false);
                        service.setVaccineTemplate(template);
                        service.setReminderInterval(template.getRepeatIntervalDays());
                        service.setReminderUnit("DAYS");
                        service.setPetType(template.getTargetSpecies() != null ? template.getTargetSpecies().name()
                                        : "BOTH");

                        ClinicService savedService = clinicServiceRepository.save(service);

                        // Create Dose Prices
                        createDosePrices(savedService, template);

                        log.info("   + Created Vaccine Service: {} (Base: {}đ)", serviceName, service.getBasePrice());
                }
        }

        private void createDosePrices(ClinicService service, VaccineTemplate template) {
                int doses = template.getSeriesDoses() != null ? template.getSeriesDoses() : 1;
                BigDecimal basePrice = service.getBasePrice();

                for (int i = 1; i <= doses; i++) {
                        VaccineDosePrice price = new VaccineDosePrice();
                        price.setService(service);
                        price.setDoseNumber(i);
                        price.setDoseLabel("Mũi " + i);
                        price.setPrice(basePrice); // Same price for series doses usually
                        price.setIsActive(true);
                        vaccineDosePriceRepository.save(price);
                }

                // Annual Booster (Dose 4 convention)
                if (Boolean.TRUE.equals(template.getIsAnnualRepeat())) {
                        VaccineDosePrice booster = new VaccineDosePrice();
                        booster.setService(service);
                        booster.setDoseNumber(4);
                        booster.setDoseLabel("Tiêm nhắc lại (Hằng năm)");
                        booster.setPrice(basePrice.add(BigDecimal.valueOf(0))); // Can adjustment price if needed
                        booster.setIsActive(true);
                        vaccineDosePriceRepository.save(booster);
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

                // Ensure clinic has coordinates for distance calculation
                if (clinic.getLatitude() == null || clinic.getLongitude() == null) {
                        log.info("   - Clinic missing coordinates, setting defaults for Hanoi");
                        clinic.setLatitude(BigDecimal.valueOf(21.0285));
                        clinic.setLongitude(BigDecimal.valueOf(105.8542));
                        clinicRepository.saveAndFlush(clinic);
                }

                log.info("   - Seeding bookings for clinic: {} (ID: {})", clinic.getName(), clinic.getClinicId());

                List<Pet> pets = petRepository.findByUser_UserId(petOwner.getUserId());
                if (pets.isEmpty()) {
                        log.warn("No pets found for petOwner, skipping booking seeding");
                        return;
                }
                log.info("   - Found {} pets for petOwner", pets.size());

                LocalDate today = LocalDate.now();
                LocalDate tomorrow = today.plusDays(1);

                // Check if bookings already exist for today to avoid resetting user's work
                long todayBookingsCount = bookingRepository.countByClinicAndDate(clinic.getClinicId(), today);
                if (todayBookingsCount > 5) { // Skip if already has bookings
                        log.info("   🔒 Bookings already exist for today ({} bookings), skipping mock booking generation.",
                                        todayBookingsCount);
                        return;
                }
                log.info("   Start fresh seeding...");
                bookingSequenceCounter = 1;

                // Get services by category
                List<ClinicService> allServices = clinicServiceRepository
                                .findByClinicClinicIdAndIsActiveTrue(clinic.getClinicId());

                if (allServices.isEmpty()) {
                        log.warn("No services found for clinic, skipping booking seeding");
                        return;
                }

                Pet pet1 = pets.get(0); // Lu (Chó)
                Pet pet2 = pets.size() > 1 ? pets.get(1) : pet1; // Miu (Mèo)
                Pet pet3 = pets.size() > 2 ? pets.get(2) : pet1; // Bella (Chó)

                // ========== TODAY'S BOOKINGS (Normal seeding as requested) ==========

                // 1. Tiêm phòng 5 bệnh - CONFIRMED (17:00)
                createBookingWithStatus(clinic, pet1, petOwner, today, LocalTime.of(17, 0),
                                "Tiêm mũi 1 nhắc lại",
                                findServicesByNameOrCategory(allServices, "5 bệnh", "VACCINATION", 1),
                                null, 0, 0, BigDecimal.ZERO,
                                BookingStatus.CONFIRMED,
                                null,
                                BookingType.IN_CLINIC);

                // 2. Tiêm phòng 4 bệnh - CONFIRMED (18:00)
                createBookingWithStatus(clinic, pet2, petOwner, today, LocalTime.of(18, 0),
                                "Mèo con tiêm chủng lần đầu",
                                findServicesByNameOrCategory(allServices, "4 bệnh", "VACCINATION", 1),
                                null, 0, 0, BigDecimal.ZERO,
                                BookingStatus.CONFIRMED,
                                null,
                                BookingType.IN_CLINIC);

                // 3. Tiêm phòng dại - CONFIRMED (19:00)
                createBookingWithStatus(clinic, pet3, petOwner, today, LocalTime.of(19, 0),
                                "Tiêm phòng dại định kỳ",
                                findServicesByNameOrCategory(allServices, "Tiêm phòng dại", "VACCINATION", 1),
                                null, 0, 0, BigDecimal.ZERO,
                                BookingStatus.CONFIRMED,
                                null,
                                BookingType.IN_CLINIC);

                // 4. Khám tổng quát - CONFIRMED (20:00)
                createBookingWithStatus(clinic, pet1, petOwner, today, LocalTime.of(20, 0),
                                "Khám định kỳ buổi tối",
                                findServicesByCategory(allServices, "CHECK_UP", 1),
                                null, 0, 0, BigDecimal.ZERO,
                                BookingStatus.CONFIRMED,
                                null,
                                BookingType.IN_CLINIC);

                // 5. Tiêm phòng dại (Extra) - CONFIRMED (16:00)
                createBookingWithStatus(clinic, pet1, petOwner, today, LocalTime.of(16, 0),
                                "Tiêm phòng dại bổ sung",
                                findServicesByNameOrCategory(allServices, "Tiêm phòng dại", "VACCINATION", 1),
                                null, 0, 0, BigDecimal.ZERO,
                                BookingStatus.CONFIRMED,
                                null,
                                BookingType.IN_CLINIC);

                // 6. Tiêm vắc-xin 5 bệnh - CONFIRMED (16:30) for testing
                createBookingWithStatus(clinic, pet1, petOwner, today, LocalTime.of(16, 30),
                                "Tiêm vắc-xin 5 bệnh - Kiểm tra Check-in",
                                findServicesByNameOrCategory(allServices, "5 bệnh", "VACCINATION", 1),
                                null, 0, 0, BigDecimal.ZERO,
                                BookingStatus.CONFIRMED,
                                null,
                                BookingType.IN_CLINIC);

                // ========== FUTURE BOOKINGS ==========

                // Tomorrow: Vaccination 7-in-1
                createBooking(clinic, pet3, petOwner, tomorrow, LocalTime.of(9, 30),
                                BookingType.IN_CLINIC, "Tiêm vắc-xin 7 bệnh cho chó",
                                findServicesByNameOrCategory(allServices, "7 bệnh", "VACCINATION", 1));

                // Tomorrow: Home visit check-up
                double homeLatT = 16.0678, homeLngT = 108.2201;
                double distKmT = locationService.calculateDistance(
                                clinic.getLatitude(), clinic.getLongitude(),
                                BigDecimal.valueOf(homeLatT), BigDecimal.valueOf(homeLngT));
                createBookingWithHomeVisit(clinic, pet1, petOwner, tomorrow, LocalTime.of(14, 0),
                                "Khám sức khỏe tại nhà",
                                findServicesByCategory(allServices, "CHECK_UP", 1),
                                "123 Nguyễn Văn Linh, Đà Nẵng", homeLatT, homeLngT,
                                BigDecimal.valueOf(distKmT));
        }

        /**
         * Check if booking already exists to avoid duplicate key violation
         */
        private boolean bookingExists(Pet pet, Clinic clinic, LocalDate date, LocalTime time) {
                return bookingRepository.existsByPetAndClinicAndDateAndTime(
                        pet.getId(), clinic.getClinicId(), date, time);
        }

        /**
         * Create a booking with services
         */
        private void createBooking(Clinic clinic, Pet pet, User petOwner, LocalDate date,
                        LocalTime time, BookingType type, String notes, List<ClinicService> services) {
                if (bookingRepository.existsByPetAndClinicAndDateAndTime(pet.getId(), clinic.getClinicId(), date, time)) {
                        log.info("   🔒 Booking already exists for {} at {} {}. Skipping.", pet.getName(), date, time);
                        return;
                }

                // Check if booking already exists
                if (bookingExists(pet, clinic, date, time)) {
                        log.info("   - Skipping existing booking: {} at {} {}", pet.getName(), date, time);
                        return;
                }

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

                // Generate unique booking code
                String bookingCode = generateUniqueBookingCode(clinic.getClinicId(), date);

                // Nếu booking_code này đã tồn tại (do user đã tạo booking thật trước đó) thì bỏ qua seeding
                if (bookingRepository.findByBookingCode(bookingCode).isPresent()) {
                        log.info("   - Skipping seeded booking because booking_code already exists: {}", bookingCode);
                        return;
                }

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

                // Auto-create draft vaccination records
                for (BookingServiceItem item : booking.getBookingServices()) {
                        try {
                                vaccinationService.createDraftFromBooking(booking, item);
                        } catch (Exception e) {
                                log.warn("   ! Failed to create draft vaccination for booking {}: {}",
                                                bookingCode, e.getMessage());
                        }
                }
        }

        /**
         * Create a home visit booking with proper pricing (weight-based + distance fee)
         */
        private void createBookingWithHomeVisit(Clinic clinic, Pet pet, User petOwner,
                        LocalDate date, LocalTime time, String notes, List<ClinicService> services,
                        String address, double lat, double lng, BigDecimal distanceKm) {

                if (bookingRepository.existsByPetAndClinicAndDateAndTime(pet.getId(), clinic.getClinicId(), date, time)) {
                        log.info("   🔒 Booking already exists for {} at {} {}. Skipping.", pet.getName(), date, time);
                        return;
                }

                if (services.isEmpty())
                        return;

                // Check if booking already exists
                if (bookingExists(pet, clinic, date, time)) {
                        log.info("   - Skipping existing home visit booking: {} at {} {}", pet.getName(), date, time);
                        return;
                }

                long sequence = bookingRepository.countByClinicAndDate(clinic.getClinicId(), date) + 1;
                String bookingCode = Booking.generateBookingCode(date, (int) sequence);

                if (bookingRepository.findByBookingCode(bookingCode).isPresent()) {
                        log.info("   - Skipping seeded HOME VISIT booking because booking_code already exists: {}",
                                        bookingCode);
                        return;
                }

                // Calculate single distance fee for the whole booking (using clinic-level
                // pricePerKm)
                BigDecimal distanceFee = pricingService.calculateBookingDistanceFee(clinic.getClinicId(), distanceKm,
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

                // Auto-create draft vaccination records
                for (BookingServiceItem item : booking.getBookingServices()) {
                        try {
                                vaccinationService.createDraftFromBooking(booking, item);
                        } catch (Exception e) {
                                log.warn("   ! Failed to create draft vaccination for booking {}: {}",
                                                bookingCode, e.getMessage());
                        }
                }
        }

        /**
         * Create a home visit booking with custom status (for testing IN_PROGRESS)
         * Also assigns staff for CONFIRMED/IN_PROGRESS statuses
         */
        private void createBookingWithStatus(Clinic clinic, Pet pet, User petOwner,
                        LocalDate date, LocalTime time, String notes, List<ClinicService> services,
                        String address, double lat, double lng, BigDecimal distanceKm, BookingStatus status,
                        String staffUsername, BookingType type) {

                if (bookingRepository.existsByPetAndClinicAndDateAndTime(pet.getId(), clinic.getClinicId(), date, time)) {
                        log.info("   🔒 Booking already exists for {} at {} {}. Skipping.", pet.getName(), date, time);
                        return;
                }

                if (services.isEmpty())
                        return;

                // Check if booking already exists
                if (bookingExists(pet, clinic, date, time)) {
                        log.info("   - Skipping existing status booking: {} at {} {}", pet.getName(), date, time);
                        return;
                }

                long sequence = bookingRepository.countByClinicAndDate(clinic.getClinicId(), date) + 1;
                String bookingCode = Booking.generateBookingCode(date, (int) sequence);

                if (bookingRepository.findByBookingCode(bookingCode).isPresent()) {
                        log.info("   - Skipping seeded status booking because booking_code already exists: {}",
                                        bookingCode);
                        return;
                }

                // Calculate distance fee (using clinic-level pricePerKm)
                BigDecimal distanceFee = pricingService.calculateBookingDistanceFee(clinic.getClinicId(), distanceKm,
                                type);

                // Calculate service prices
                BigDecimal servicesTotal = BigDecimal.ZERO;
                for (ClinicService service : services) {
                        servicesTotal = servicesTotal.add(pricingService.calculateServicePrice(service, pet));
                }

                BigDecimal totalPrice = servicesTotal.add(distanceFee);

                // Find a staff to assign for CONFIRMED/IN_PROGRESS/COMPLETED statuses
                User assignedStaff = null;
                if (status == BookingStatus.CONFIRMED || status == BookingStatus.IN_PROGRESS
                                || status == BookingStatus.COMPLETED) {
                        String username = (staffUsername != null && !staffUsername.isEmpty()) ? staffUsername : "staff";
                        assignedStaff = userRepository.findByUsername(username).orElse(null);
                        if (assignedStaff == null) {
                                log.warn("{} user not found, booking will have no assigned staff", staffUsername);
                        }
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
                                .distanceFee(distanceFee)
                                .status(status)
                                .notes(notes)
                                .homeAddress(address)
                                .homeLat(BigDecimal.valueOf(lat))
                                .homeLong(BigDecimal.valueOf(lng))
                                .distanceKm(distanceKm)
                                .assignedStaff(assignedStaff)
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
                                        .assignedStaff(assignedStaff)
                                        .build();
                        booking.getBookingServices().add(item);
                }

                bookingRepository.save(booking);

                // Assign to slots if staff is assigned
                if (assignedStaff != null && status != BookingStatus.PENDING && status != BookingStatus.CANCELLED) {
                        assignBookingToSlots(booking, services);
                        // Send notification as well so the UI/SSE works
                        try {
                                notificationService.sendBookingAssignedNotificationToStaff(booking);
                        } catch (Exception e) {
                                log.warn("   ! Failed to send notification for {}: {}", bookingCode, e.getMessage());
                        }
                }

                // Auto-create draft vaccination records for CONFIRMED/ASSIGNED etc.
                if (status != BookingStatus.PENDING && status != BookingStatus.CANCELLED) {
                        for (BookingServiceItem item : booking.getBookingServices()) {
                                try {
                                        vaccinationService.createDraftFromBooking(booking, item);
                                } catch (Exception e) {
                                        log.warn("   ! Failed to create draft vaccination for booking {}: {}",
                                                        bookingCode, e.getMessage());
                                }
                        }
                }

                log.info("   + Created {} booking: {} - {} (staff: {}, total: {}đ)",
                                status, bookingCode, notes,
                                assignedStaff != null ? assignedStaff.getFullName() : "NONE", totalPrice);
        }

        /**
         * Find services by name substring, fallback to category if not found
         */
        private List<ClinicService> findServicesByNameOrCategory(List<ClinicService> services, String namePart,
                        String categoryName, int limit) {
                // Try to find by name first
                List<ClinicService> byName = services.stream()
                                .filter(s -> s.getName() != null
                                                && s.getName().toLowerCase().contains(namePart.toLowerCase()))
                                .limit(limit)
                                .collect(Collectors.toList());

                if (!byName.isEmpty()) {
                        return byName;
                }

                // Fallback to category
                log.warn("   ! Service with name containing '{}' not found. Falling back to category '{}'", namePart,
                                categoryName);
                return services.stream()
                                .filter(s -> s.getServiceCategory() != null
                                                && categoryName.equals(s.getServiceCategory().name()))
                                .limit(limit)
                                .collect(Collectors.toList());
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
                                .collect(Collectors.toList());
        }

        private void generateSlots(StaffShift shift) {
                LocalTime current = shift.getStartTime();
                LocalTime end = shift.getEndTime();
                while (current.plusMinutes(30).isBefore(end) || current.plusMinutes(30).equals(end)) {
                        Slot slot = new Slot();
                        slot.setShift(shift);
                        slot.setStartTime(current);
                        slot.setEndTime(current.plusMinutes(30));
                        slot.setStatus(SlotStatus.AVAILABLE);
                        slotRepository.save(slot);
                        current = current.plusMinutes(30);
                }
        }

        private void assignBookingToSlots(Booking booking, List<ClinicService> services) {
                if (booking.getAssignedStaff() == null)
                        return;

                List<Slot> staffSlots = slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(
                                staffShiftRepository.findOneByStaff_UserIdAndWorkDate(
                                                booking.getAssignedStaff().getUserId(), booking.getBookingDate())
                                                .map(StaffShift::getShiftId).orElse(null),
                                SlotStatus.AVAILABLE);

                if (staffSlots.isEmpty())
                        return;

                LocalTime currentTime = booking.getBookingTime();
                for (int i = 0; i < services.size(); i++) {
                        BookingServiceItem item = booking.getBookingServices().get(i);

                        // Find slots for this service
                        final LocalTime serviceStartTime = currentTime;
                        List<Slot> bookedSlots = staffSlots.stream()
                                        .filter(s -> !s.getStartTime().isBefore(serviceStartTime))
                                        .limit(1) // Simplify to 1 slot per service for seeding
                                        .collect(Collectors.toList());

                        for (Slot slot : bookedSlots) {
                                slot.setStatus(SlotStatus.BOOKED);
                                slotRepository.save(slot);

                                BookingSlot bs = BookingSlot.builder()
                                                .booking(booking)
                                                .slot(slot)
                                                .bookingServiceItem(item)
                                                .build();
                                bookingSlotRepository.save(bs);
                                currentTime = slot.getEndTime();
                        }
                }
        }

        /**
         * Generate a unique booking code that doesn't exist in database
         */
        private String generateUniqueBookingCode(java.util.UUID clinicId, LocalDate date) {
                long sequence = bookingRepository.countByClinicAndDate(clinicId, date) + 1;
                String bookingCode = Booking.generateBookingCode(date, (int) sequence);

                // Keep incrementing until we find a unique code
                while (bookingRepository.existsByBookingCode(bookingCode)) {
                        sequence++;
                        bookingCode = Booking.generateBookingCode(date, (int) sequence);
                }

                return bookingCode;
        }
}
