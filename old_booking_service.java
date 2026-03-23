package com.petties.petties.service;

import com.petties.petties.dto.booking.AvailableStaffResponse;
import com.petties.petties.dto.booking.AvailableSlotsResponse;
import com.petties.petties.dto.booking.BookingConfirmRequest;
import com.petties.petties.dto.booking.BookingRequest;
import com.petties.petties.dto.booking.BookingResponse;
import com.petties.petties.dto.booking.CheckoutRequest;
import com.petties.petties.dto.booking.ClinicTodayBookingResponse;
import com.petties.petties.dto.booking.EstimatedCompletionRequest;
import com.petties.petties.dto.booking.PetServiceItemRequest;
import com.petties.petties.dto.booking.ProxyBookingRequest;
import com.petties.petties.dto.booking.ProxyPetInfo;
import com.petties.petties.dto.booking.ProxyPetServiceItem;
import com.petties.petties.dto.booking.ProxyRecipientInfo;
import com.petties.petties.dto.booking.StaffAvailabilityCheckResponse;
import com.petties.petties.dto.booking.StaffOptionDTO;
import com.petties.petties.dto.booking.StaffHomeSummaryResponse;
import com.petties.petties.dto.booking.UpcomingBookingDTO;
import com.petties.petties.dto.booking.EstimatedCompletionRequest.PetEstimation;
import com.petties.petties.dto.clinicService.ClinicServiceResponse;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.mapper.BookingMapper;
import com.petties.petties.model.Booking;
import com.petties.petties.model.BookingServiceItem;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicService;
import com.petties.petties.model.Payment;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.model.enums.PaymentMethod;
import com.petties.petties.model.enums.PaymentStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.ServiceCategory;
import com.petties.petties.model.enums.StaffSpecialty;
import com.petties.petties.repository.*;
import com.petties.petties.util.BookingScheduleUtil;
import com.petties.petties.util.SpeciesUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.petties.petties.dto.booking.EstimatedCompletionResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.AbstractMap;
import com.petties.petties.model.OperatingHours;
import java.util.*;
import java.util.stream.Collectors;

/**
 * BookingService - Business logic for booking management
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BookingService {

        private final BookingRepository bookingRepository;
        private final PetRepository petRepository;
        private final ClinicRepository clinicRepository;
        private final ClinicServiceRepository clinicServiceRepository;
        private final UserRepository userRepository;
        private final StaffAssignmentService staffAssignmentService;
        private final NotificationService notificationService;
        private final PricingService pricingService;
        private final BookingServiceItemRepository bookingServiceItemRepository;
        private final SseEmitterService sseEmitterService;
        private final EmrRecordRepository emrRecordRepository;
        private final VaccinationService vaccinationService;
        private final BookingMapper bookingMapper;
        private final BookingNotificationService bookingNotificationService;
        private final PaymentRepository paymentRepository;
        private final TransactionService transactionService;
        private final SosSessionManager sosSessionManager;
        private final TrackingService trackingService;

        @Value("${sepay.qr.acc:}")
        private String sepayQrAcc;

        @Value("${sepay.qr.bank:}")
        private String sepayQrBank;

        private static final int MAX_RETRY_COUNT = 3;

        private static final String PREFERRED_PAYMENT_PREFIX = "PhÆ°Æ¡ng thá»©c thanh toĂ¡n mong muá»‘n:";

        // ========== HELPER METHODS ==========

        /**
         * Validate vaccine species compatibility between pet and service
         * Throws BadRequestException if vaccine is not compatible with pet species
         */
        private void validateVaccineSpeciesCompatibility(Pet pet, ClinicService service) {
                if (service.getVaccineTemplate() != null) {
                        var targetSpecies = service.getVaccineTemplate().getTargetSpecies();
                        if (!SpeciesUtils.isVaccineCompatible(targetSpecies, pet.getSpecies())) {
                                String vaccineSpecies = SpeciesUtils.getVietnameseName(targetSpecies);
                                throw new BadRequestException(
                                        String.format("Váº¯c-xin '%s' chá»‰ dĂ nh cho %s, khĂ´ng phĂ¹ há»£p vá»›i thĂº cÆ°ng '%s' cá»§a báº¡n",
                                                service.getName(), vaccineSpecies, pet.getName())
                                );
                        }
                }
        }

        /**
         * Normalize payment method preference from client request.
         * Only accept QR/CASH to avoid storing invalid values.
         */
        private String normalizePreferredPaymentMethod(String paymentMethod) {
                if (paymentMethod == null || paymentMethod.isBlank()) {
                        return null;
                }
                String normalized = paymentMethod.trim().toUpperCase();
                if (!"QR".equals(normalized) && !"CASH".equals(normalized)) {
                        return null;
                }
                return normalized;
        }

        /**
         * Merge existing notes with preferred payment method line.
         */
        private String mergeBookingNotesWithPreferredPayment(String notes, String paymentMethod) {
                String normalized = normalizePreferredPaymentMethod(paymentMethod);
                if (normalized == null) {
                        return notes;
                }

                String label = "QR".equals(normalized) ? "Chuyá»ƒn khoáº£n QR" : "Tiá»n máº·t";
                String preferenceLine = PREFERRED_PAYMENT_PREFIX + " " + label;

                if (notes == null || notes.isBlank()) {
                        return preferenceLine;
                }

                if (notes.contains(PREFERRED_PAYMENT_PREFIX)) {
                        return notes;
                }

                return notes + "\n" + preferenceLine;
        }

        private PaymentMethod resolvePreferredPaymentMethodFromBooking(Booking booking) {
                if (booking.getPaymentMethod() != null) {
                        return booking.getPaymentMethod();
                }

                String notes = booking.getNotes() != null ? booking.getNotes().toLowerCase() : "";
                if (notes.contains("phÆ°Æ¡ng thá»©c thanh toĂ¡n mong muá»‘n: chuyá»ƒn khoáº£n qr")
                                || notes.contains("phuong thuc thanh toan mong muon: chuyen khoan qr")
                                || notes.contains("chuyá»ƒn khoáº£n qr")
                                || notes.contains("chuyen khoan qr")) {
                        return PaymentMethod.QR;
                }

                if (notes.contains("phÆ°Æ¡ng thá»©c thanh toĂ¡n mong muá»‘n: tiá»n máº·t")
                                || notes.contains("phuong thuc thanh toan mong muon: tien mat")
                                || notes.contains("tiá»n máº·t")
                                || notes.contains("tien mat")) {
                        return PaymentMethod.CASH;
                }

                return null;
        }

        private boolean prepareQrPaymentWhenInProgress(Booking booking) {
                PaymentMethod preferredMethod = resolvePreferredPaymentMethodFromBooking(booking);
                if (preferredMethod != PaymentMethod.QR) {
                        return false;
                }

                String paymentDescription = transactionService.generatePaymentDescription(booking.getBookingId());
                if (paymentDescription == null || paymentDescription.isBlank()) {
                        log.warn("Could not generate payment description for booking {} during IN_PROGRESS transition",
                                        booking.getBookingCode());
                        return false;
                }

                Payment payment = paymentRepository.findByBookingBookingId(booking.getBookingId()).orElse(null);

                if (payment == null) {
                        try {
                                payment = Payment.builder()
                                                .booking(booking)
                                                .amount(booking.getTotalPrice())
                                                .method(PaymentMethod.QR)
                                                .status(PaymentStatus.PENDING)
                                                .paymentDescription(paymentDescription)
                                                .build();
                                paymentRepository.save(payment);
                        } catch (DataIntegrityViolationException ex) {
                                // Concurrent check-in / repeated action can create the payment in another request.
                                payment = paymentRepository.findByBookingBookingId(booking.getBookingId())
                                                .orElseThrow(() -> ex);
                                if (payment.getPaymentDescription() == null || payment.getPaymentDescription().isBlank()) {
                                        payment.setPaymentDescription(paymentDescription);
                                        paymentRepository.save(payment);
                                }
                        }
                } else if (payment.getStatus() != PaymentStatus.PAID) {
                        payment.setMethod(PaymentMethod.QR);
                        payment.setStatus(PaymentStatus.PENDING);
                        payment.setPaidAt(null);
                        payment.setStripePaymentId(null);
                        payment.setPaymentDescription(paymentDescription);
                        paymentRepository.save(payment);
                }

                booking.setPayment(payment);
                booking.syncPaymentStatus(payment);
                return true;
        }

        /**
         * Prepare QR payment immediately after booking creation.
         * Creates/reuses Payment as QR/PENDING, generates paymentDescription and QR image URL.
         */
        private BookingResponse buildBookingResponseWithQrPayment(Booking booking) {
                Payment existingPayment = paymentRepository.findByBookingBookingId(booking.getBookingId()).orElse(null);

                Payment payment;
                if (existingPayment != null) {
                        existingPayment.setMethod(PaymentMethod.QR);
                        existingPayment.setStatus(PaymentStatus.PENDING);
                        existingPayment.setPaidAt(null);
                        existingPayment.setStripePaymentId(null);
                        existingPayment.setPaymentDescription(null);
                        payment = existingPayment;
                } else {
                        payment = Payment.builder()
                                        .booking(booking)
                                        .amount(booking.getTotalPrice())
                                        .method(PaymentMethod.QR)
                                        .status(PaymentStatus.PENDING)
                                        .build();
                }

                paymentRepository.save(payment);
                booking.setPayment(payment);
                booking.syncPaymentStatus(payment);
                bookingRepository.save(booking);

                String paymentDescription = transactionService.generatePaymentDescription(booking.getBookingId());
                String qrImageUrl = String.format(
                                "https://qr.sepay.vn/img?acc=%s&bank=%s&amount=%s&des=%s",
                                sepayQrAcc,
                                sepayQrBank,
                                booking.getTotalPrice().toBigInteger().toString(),
                                paymentDescription);

                BookingResponse response = bookingMapper.mapToResponse(booking);
                response.setQrImageUrl(qrImageUrl);
                return response;
        }

        /**
         * Get current user by userId (helper method for Controller to avoid direct
         * Repository access)
         *
         * @param userId User ID from JWT token
         * @return User entity
         */
        @Transactional(readOnly = true)
        public User getCurrentUserById(UUID userId) {
                return userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y ngÆ°á»i dĂ¹ng"));
        }

        // ========== CREATE BOOKING ==========

        /**
         * Create a new booking (from pet owner).
         * Supports single-pet (petId + serviceIds) and multi-pet (items: list of petId
         * + serviceIds).
         */
        @Transactional
        public BookingResponse createBooking(BookingRequest request, UUID petOwnerId) {
                log.info("Creating booking at clinic {}", request.getClinicId());

                try {
                        // Resolve (primaryPet, list of (pet, service)) and validate
                        List<PetServiceItemRequest> items = request.getItems();
                        boolean multiPet = items != null && !items.isEmpty();

                        if (multiPet) {
                                if (items.stream().anyMatch(
                                                it -> it.getPetId() == null || it.getServiceIds() == null
                                                                || it.getServiceIds().isEmpty())) {
                                        throw new BadRequestException(
                                                        "Má»—i má»¥c pháº£i cĂ³ mĂ£ thĂº cÆ°ng vĂ  Ă­t nháº¥t má»™t dá»‹ch vá»¥");
                                }
                        } else {
                                if (request.getPetId() == null || request.getServiceIds() == null
                                                || request.getServiceIds().isEmpty()) {
                                        throw new BadRequestException(
                                                        "Vui lĂ²ng gá»­i mĂ£ thĂº cÆ°ng vĂ  danh sĂ¡ch dá»‹ch vá»¥, hoáº·c dĂ¹ng items cho Ä‘áº·t nhiá»u thĂº cÆ°ng");
                                }
                        }

                        User petOwner = userRepository.findById(petOwnerId)
                                        .orElseThrow(() -> new ResourceNotFoundException(
                                                        "KhĂ´ng tĂ¬m tháº¥y chá»§ thĂº cÆ°ng"));
                        Clinic clinic = clinicRepository.findById(request.getClinicId())
                                        .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y phĂ²ng khĂ¡m"));

                        List<Pet> petsToUse = new ArrayList<>();
                        List<ClinicService> servicesToUse = new ArrayList<>();
                        UUID primaryPetId;

                        if (multiPet) {
                                primaryPetId = items.get(0).getPetId();
                                Set<UUID> allServiceIds = new java.util.HashSet<>();
                                for (PetServiceItemRequest it : items) {
                                        Pet p = petRepository.findById(it.getPetId())
                                                        .orElseThrow(() -> new ResourceNotFoundException(
                                                                        "KhĂ´ng tĂ¬m tháº¥y thĂº cÆ°ng: " + it.getPetId()));
                                        if (!p.getUser().getUserId().equals(petOwnerId)) {
                                                throw new ForbiddenException(
                                                                "ThĂº cÆ°ng khĂ´ng thuá»™c quyá»n sá»Ÿ há»¯u cá»§a báº¡n");
                                        }
                                        allServiceIds.addAll(it.getServiceIds());
                                }
                                List<ClinicService> clinicServices = clinicServiceRepository.findAllById(allServiceIds);
                                Map<UUID, ClinicService> serviceMap = clinicServices.stream()
                                                .collect(Collectors.toMap(ClinicService::getServiceId, s -> s));
                                for (PetServiceItemRequest it : items) {
                                        Pet p = petRepository.findById(it.getPetId()).orElseThrow();
                                        for (UUID sid : it.getServiceIds()) {
                                                ClinicService svc = serviceMap.get(sid);
                                                if (svc == null) {
                                                        throw new ResourceNotFoundException(
                                                                        "Dá»‹ch vá»¥ khĂ´ng tá»“n táº¡i: " + sid);
                                                }
                                                if (!svc.getClinic().getClinicId().equals(clinic.getClinicId())) {
                                                        throw new BadRequestException(
                                                                        "Dá»‹ch vá»¥ khĂ´ng thuá»™c phĂ²ng khĂ¡m Ä‘Ă£ chá»n");
                                                }
                                                // Validate vaccine species compatibility
                                                validateVaccineSpeciesCompatibility(p, svc);
                                                petsToUse.add(p);
                                                servicesToUse.add(svc);
                                        }
                                }
                        } else {
                                Pet pet = petRepository.findById(request.getPetId())
                                                .orElseThrow(() -> new ResourceNotFoundException(
                                                                "KhĂ´ng tĂ¬m tháº¥y thĂº cÆ°ng"));
                                if (!pet.getUser().getUserId().equals(petOwnerId)) {
                                        throw new ForbiddenException("ThĂº cÆ°ng khĂ´ng thuá»™c quyá»n sá»Ÿ há»¯u cá»§a báº¡n");
                                }
                                primaryPetId = pet.getId();
                        List<ClinicService> services = clinicServiceRepository
                                        .findAllById(request.getServiceIds());
                        if (services.isEmpty()) {
                                throw new BadRequestException("Vui lĂ²ng chá»n Ă­t nháº¥t má»™t dá»‹ch vá»¥ há»£p lá»‡");
                        }
                        if (services.size() != request.getServiceIds().size()) {
                                throw new ResourceNotFoundException("Má»™t sá»‘ dá»‹ch vá»¥ khĂ´ng tá»“n táº¡i");
                        }
                                for (ClinicService s : services) {
                                        if (!s.getClinic().getClinicId().equals(clinic.getClinicId())) {
                                                throw new BadRequestException("Dá»‹ch vá»¥ khĂ´ng thuá»™c phĂ²ng khĂ¡m Ä‘Ă£ chá»n");
                                        }
                                        // Validate vaccine species compatibility
                                        validateVaccineSpeciesCompatibility(pet, s);
                                        petsToUse.add(pet);
                                        servicesToUse.add(s);
                                }
                        }

                        Pet primaryPet = petRepository.findById(primaryPetId).orElseThrow();

                        // Home Visit Validation
                        if (request.getType() == BookingType.HOME_VISIT || request.getType() == BookingType.SOS) {
                                List<String> ineligibleServices = servicesToUse.stream()
                                                .filter(s -> s.getIsHomeVisit() == null || !s.getIsHomeVisit())
                                                .map(ClinicService::getName)
                                                .collect(Collectors.toList());
                                if (!ineligibleServices.isEmpty()) {
                                        throw new BadRequestException("CĂ¡c dá»‹ch vá»¥ sau khĂ´ng há»— trá»£ khĂ¡m táº¡i nhĂ : "
                                                        + String.join(", ", ineligibleServices));
                                }
                        }

                        // Calculate total price: sum over (pet, service) with weight-based price
                        BigDecimal servicesTotal = BigDecimal.ZERO;
                        for (int i = 0; i < servicesToUse.size(); i++) {
                                Pet p = petsToUse.get(i);
                                ClinicService svc = servicesToUse.get(i);
                                servicesTotal = servicesTotal.add(pricingService.calculateServicePrice(svc, p));
                        }
                        log.debug("Services total price: {}", servicesTotal);

                        // 2. Calculate distance fee or SOS fee
                        BigDecimal distanceKm = request.getDistanceKm();
                        BigDecimal distanceFee = BigDecimal.ZERO;
                        BigDecimal sosFee = BigDecimal.ZERO;

                        if (request.getType() == BookingType.SOS) {
                                sosFee = pricingService.calculateSOSFee(clinic.getClinicId());
                                log.debug("SOS fee calculated: {}", sosFee);
                        } else {
                                distanceFee = pricingService.calculateBookingDistanceFee(clinic.getClinicId(),
                                        distanceKm,
                                        request.getType());
                        log.debug("Distance fee calculated: {}", distanceFee);
                        }

                        // 3. Final total
                        BigDecimal totalPrice = servicesTotal.add(distanceFee).add(sosFee);
                        log.info("Total booking price: {} (services: {} + distance: {} + SOS: {})",
                                        totalPrice, servicesTotal, distanceFee, sosFee);

                        Booking booking = Booking.builder()
                                        .pet(primaryPet)
                                        .petOwner(petOwner)
                                        .clinic(clinic)
                                        .bookingDate(request.getBookingDate())
                                        .bookingTime(request.getBookingTime())
                                        .type(request.getType())
                                        .totalPrice(totalPrice)
                                        .distanceFee(distanceFee)
                                        .sosFee(sosFee)
                                        .status(BookingStatus.PENDING)
                                        .notes(mergeBookingNotesWithPreferredPayment(
                                                        request.getNotes(), request.getPaymentMethod()))
                                        .homeAddress(request.getHomeAddress())
                                        .homeLat(request.getHomeLat())
                                        .homeLong(request.getHomeLong())
                                        .distanceKm(distanceKm)
                                        .build();

                        for (int i = 0; i < servicesToUse.size(); i++) {
                                Pet p = petsToUse.get(i);
                                ClinicService service = servicesToUse.get(i);
                                BigDecimal basePrice = service.getBasePrice();
                                BigDecimal weightPrice = pricingService.calculateServicePrice(service, p);
                                BookingServiceItem item = BookingServiceItem.builder()
                                                .booking(booking)
                                                .pet(p)
                                                .service(service)
                                                .unitPrice(weightPrice)
                                                .basePrice(basePrice)
                                                .weightPrice(weightPrice)
                                                .quantity(1)
                                                .isAddOn(false)
                                                .build();
                                booking.getBookingServices().add(item);
                        }
                        log.debug("Services added to booking object");

                        // Generate unique booking code using UUID (no race condition)
                        String bookingCode = Booking.generateUniqueBookingCode(request.getBookingDate());
                                        booking.setBookingCode(bookingCode);

                        Booking savedBooking = bookingRepository.save(booking);
                                        log.info("Booking created successfully: {}", savedBooking.getBookingCode());

                        // ========== NOTIFICATION AFTER SUCCESSFUL SAVE ==========
                        try {
                                notificationService.sendBookingNotificationToClinic(savedBooking);
                                log.debug("Notification sent to clinic");
                        } catch (Exception e) {
                                log.error("Failed to send notification (non-blocking): {}", e.getMessage());
                        }

                        String preferredPaymentMethod = normalizePreferredPaymentMethod(request.getPaymentMethod());
                        if ("QR".equals(preferredPaymentMethod)) {
                                log.info("Booking {} selected QR at creation, initializing QR payment", savedBooking.getBookingCode());
                                return buildBookingResponseWithQrPayment(savedBooking);
                        }

                        return bookingMapper.mapToResponse(savedBooking);
                } catch (org.springframework.dao.DataIntegrityViolationException e) {
                        // Let GlobalExceptionHandler translate to user-friendly Vietnamese messages
                        log.error("Data integrity violation: ", e);
                        throw e;
                } catch (BadRequestException | IllegalStateException | IllegalArgumentException e) {
                        log.warn("Business exception during booking creation: {}", e.getMessage());
                        throw e;
                } catch (Exception e) {
                        log.error("Error creating booking: ", e);
                        throw new RuntimeException("Lá»—i táº¡o booking: " + e.getMessage());
                }
        }

        // ========== PROXY BOOKING (Äáº¶T Há»˜) ==========

        /**
         * Create a proxy booking on behalf of someone else.
         * The logged-in user (proxyBooker) creates a booking for a recipient who may
         * not have an account.
         *
         * @param request       ProxyBookingRequest with recipient info, pet info, and
         *                      booking details
         * @param proxyBookerId UUID of the logged-in user who is booking on behalf of
         *                      the recipient
         * @return BookingResponse
         */
        @Transactional
        public BookingResponse createProxyBooking(ProxyBookingRequest request, UUID proxyBookerId) {
                log.info("Creating proxy booking by user {} for recipient {}",
                                proxyBookerId, request.getRecipient().getPhone());

                try {
                        // Get the proxy booker (the person making the booking on behalf of someone)
                        User proxyBooker = userRepository.findById(proxyBookerId)
                                        .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y ngÆ°á»i dĂ¹ng"));

                        // Step 1: Create a new guest user for the recipient
                        ProxyRecipientInfo recipientInfo = request.getRecipient();
                        User recipient = createRecipientUser(recipientInfo);

                        // Step 2: Validate clinic
                        Clinic clinic = clinicRepository.findById(request.getClinicId())
                                        .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y phĂ²ng khĂ¡m"));

                        // Step 3: Collect (serviceId, pet) pairs - má»—i cáº·p á»©ng vá»›i 1 BookingServiceItem
                        // DĂ¹ng List thay vĂ¬ Map vĂ¬ cĂ¹ng serviceId cĂ³ thá»ƒ dĂ¹ng cho nhiá»u pet khĂ¡c nhau
                        List<Pet> createdPets = new ArrayList<>();
                        List<AbstractMap.SimpleEntry<UUID, Pet>> servicePetPairs = new ArrayList<>();
                        java.util.Set<UUID> uniqueServiceIds = new java.util.HashSet<>();

                        for (ProxyPetServiceItem item : request.getItems()) {
                                // Create pet for recipient
                                Pet pet = createPetForRecipient(item.getPet(), recipient);
                                createdPets.add(pet);
                                log.info("Created new pet {} for recipient", pet.getName());

                                // Má»—i (serviceId, pet) lĂ  1 item riĂªng - cĂ¹ng service cĂ³ thá»ƒ cho nhiá»u pet
                                for (UUID serviceId : item.getServiceIds()) {
                                        servicePetPairs.add(new AbstractMap.SimpleEntry<>(serviceId, pet));
                                        uniqueServiceIds.add(serviceId);
                                }
                        }

                        // Step 4: Validate services
                        List<ClinicService> services = clinicServiceRepository.findAllById(uniqueServiceIds)
                                        .stream()
                                        .filter(ClinicService::getIsActive)
                                        .collect(Collectors.toList());

                        if (services.isEmpty()) {
                                throw new BadRequestException("KhĂ´ng tĂ¬m tháº¥y dá»‹ch vá»¥ há»£p lá»‡");
                        }

                        Map<UUID, ClinicService> serviceById = services.stream()
                                        .collect(Collectors.toMap(ClinicService::getServiceId, s -> s, (a, b) -> a));

                        // Step 5: Validate home visit services if applicable
                        if (request.getType() == BookingType.HOME_VISIT || request.getType() == BookingType.SOS) {
                                List<String> ineligibleServices = services.stream()
                                                .filter(s -> s.getIsHomeVisit() == null || !s.getIsHomeVisit())
                                                .map(ClinicService::getName)
                                                .collect(Collectors.toList());
                                if (!ineligibleServices.isEmpty()) {
                                        throw new BadRequestException("CĂ¡c dá»‹ch vá»¥ sau khĂ´ng há»— trá»£ khĂ¡m táº¡i nhĂ : "
                                                        + String.join(", ", ineligibleServices));
                                }
                        }

                        // Step 6: Validate vaccine species compatibility + Calculate pricing
                        Pet firstPet = createdPets.get(0);
                        BigDecimal servicesTotal = BigDecimal.ZERO;
                        for (AbstractMap.SimpleEntry<UUID, Pet> pair : servicePetPairs) {
                                ClinicService svc = serviceById.get(pair.getKey());
                                if (svc != null) {
                                        // Validate vaccine species compatibility
                                        validateVaccineSpeciesCompatibility(pair.getValue(), svc);
                                        servicesTotal = servicesTotal.add(
                                                        pricingService.calculateServicePrice(svc, pair.getValue()));
                                }
                        }
                        BigDecimal distanceKm = request.getDistanceKm();
                        BigDecimal distanceFee = pricingService.calculateBookingDistanceFee(
                                        clinic.getClinicId(), distanceKm, request.getType());
                        BigDecimal totalPrice = servicesTotal.add(distanceFee);

                        // Step 7: Build the booking
                        Booking booking = Booking.builder()
                                        .pet(firstPet) // Primary pet
                                        .petOwner(recipient)
                                        .proxyBooker(proxyBooker)
                                        .clinic(clinic)
                                        .bookingDate(request.getBookingDate())
                                        .bookingTime(request.getBookingTime())
                                        .type(request.getType())
                                        .totalPrice(totalPrice)
                                        .distanceFee(distanceFee)
                                        .status(BookingStatus.PENDING)
                                        .notes(mergeBookingNotesWithPreferredPayment(
                                                        request.getNotes(), request.getPaymentMethod()))
                                        .homeAddress(request.getHomeAddress() != null ? request.getHomeAddress()
                                                        : recipientInfo.getAddress())
                                        .homeLat(request.getHomeLat() != null ? request.getHomeLat()
                                                        : recipientInfo.getLat())
                                        .homeLong(request.getHomeLong() != null ? request.getHomeLong()
                                                        : recipientInfo.getLng())
                                        .distanceKm(distanceKm)
                                        .build();

                        // Step 8: Add services to booking - each (serviceId, pet) creates a
                        // BookingServiceItem
                        for (AbstractMap.SimpleEntry<UUID, Pet> pair : servicePetPairs) {
                                ClinicService service = serviceById.get(pair.getKey());
                                if (service == null) {
                                        continue;
                                }
                                Pet petForService = pair.getValue();
                                BigDecimal basePrice = service.getBasePrice();
                                BigDecimal weightPrice = pricingService.calculateServicePrice(service, petForService);
                                BookingServiceItem bookingItem = BookingServiceItem.builder()
                                                .booking(booking)
                                                .pet(petForService)
                                                .service(service)
                                                .unitPrice(weightPrice)
                                                .basePrice(basePrice)
                                                .weightPrice(weightPrice)
                                                .quantity(1)
                                                .isAddOn(false)
                                                .build();
                                booking.getBookingServices().add(bookingItem);
                        }

                        // Step 9: Generate unique booking code and save
                        String bookingCode = Booking.generateUniqueBookingCode(request.getBookingDate());
                        booking.setBookingCode(bookingCode);
                        Booking savedBooking = bookingRepository.save(booking);
                        log.info("Proxy booking created successfully: {} by user {} for recipient {} with {} pets",
                                        savedBooking.getBookingCode(), proxyBookerId, recipientInfo.getPhone(),
                                        createdPets.size());

                        // Step 10: Send notification to clinic
                        try {
                                notificationService.sendBookingNotificationToClinic(savedBooking);
                        } catch (Exception e) {
                                log.error("Failed to send notification (non-blocking): {}", e.getMessage());
                        }

                        String preferredPaymentMethod = normalizePreferredPaymentMethod(request.getPaymentMethod());
                        if ("QR".equals(preferredPaymentMethod)) {
                                log.info("Proxy booking {} selected QR at creation, initializing QR payment",
                                                savedBooking.getBookingCode());
                                return buildBookingResponseWithQrPayment(savedBooking);
                        }

                        return bookingMapper.mapToResponse(savedBooking);

                } catch (BadRequestException | IllegalStateException | IllegalArgumentException e) {
                        log.warn("Business exception during proxy booking creation: {}", e.getMessage());
                        throw e;
                } catch (Exception e) {
                        log.error("Error creating proxy booking: ", e);
                        throw new RuntimeException("Lá»—i táº¡o proxy booking: " + e.getMessage());
                }
        }

        /**
         * Create a new guest user for proxy booking.
         * In proxy booking flow, we always create a new guest user without checking
         * existing records.
         */
        private User createRecipientUser(ProxyRecipientInfo recipientInfo) {
                // Generate a unique username using phone + timestamp to avoid conflicts
                String uniqueUsername = "proxy_" + recipientInfo.getPhone() + "_" + System.currentTimeMillis();

                User newUser = new User();
                newUser.setFullName(recipientInfo.getFullName());
                newUser.setPhone(null); // Don't set phone to avoid unique constraint issues
                newUser.setAddress(recipientInfo.getAddress());
                newUser.setRole(Role.PET_OWNER);
                newUser.setUsername(uniqueUsername);
                newUser.setPassword(""); // No password for guest users

                newUser = userRepository.save(newUser);
                log.info("Created new guest user for proxy booking: {} ({})", newUser.getUserId(),
                                recipientInfo.getPhone());
                return newUser;
        }

        /**
         * Create a new pet for the recipient during proxy booking.
         */
        private Pet createPetForRecipient(ProxyPetInfo petInfo, User owner) {
                // Set default dateOfBirth to today if not provided (required field in DB)
                LocalDate dateOfBirth = petInfo.getDateOfBirth() != null
                                ? petInfo.getDateOfBirth()
                                : LocalDate.now();

                Pet pet = Pet.builder()
                                .name(petInfo.getName())
                                .species(petInfo.getSpecies()) // PetSpecies enum
                                .breed(petInfo.getBreed())
                                .gender(petInfo.getGender()) // String type
                                .dateOfBirth(dateOfBirth)
                                .weight(petInfo.getWeight() != null ? petInfo.getWeight().doubleValue() : 0.0)
                                .user(owner)
                                .build();

                return petRepository.save(pet);
        }

        // ========== CONFIRM BOOKING ==========

        /**
         * Confirm booking and auto-assign staff to all services (Manager action)
         * Groups services by specialty and assigns appropriate staff for each
         *
         * Supports partial confirmation options:
         * - allowPartial: Confirm even if some services don't have available staff
         * - removeUnavailableServices: Remove services without available staff and
         * recalculate price
         */
        @Transactional
        public BookingResponse confirmBooking(UUID bookingId, BookingConfirmRequest request) {
                log.info("Confirming booking {}", bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y lá»‹ch háº¹n"));

                if (booking.getStatus() != BookingStatus.PENDING) {
                        throw new IllegalStateException("Booking is not in PENDING status");
                }

                // ========== VALIDATE: Prevent confirming past bookings ==========
                LocalDate today = LocalDate.now();
                LocalTime now = LocalTime.now();

                if (booking.getBookingDate().isBefore(today)) {
                        throw new IllegalStateException(
                                        "KhĂ´ng thá»ƒ xĂ¡c nháº­n booking Ä‘Ă£ qua ngĂ y. Vui lĂ²ng há»§y vĂ  Ä‘áº·t láº¡i.");
                }

                // Allow a 30-minute grace period for confirming today's bookings
                if (booking.getBookingDate().isEqual(today)) {
                        LocalTime graceTime = booking.getBookingTime().plusMinutes(30);
                        if (now.isAfter(graceTime)) {
                                throw new IllegalStateException(
                                                "KhĂ´ng thá»ƒ xĂ¡c nháº­n booking Ä‘Ă£ quĂ¡ 30 phĂºt so vá»›i giá» háº¹n. Vui lĂ²ng gĂ¡n bĂ¡c sÄ© thá»§ cĂ´ng hoáº·c Ä‘áº·t láº¡i.");
                        }
                }

                boolean allowPartial = request != null && Boolean.TRUE.equals(request.getAllowPartial());
                boolean removeUnavailable = request != null
                                && Boolean.TRUE.equals(request.getRemoveUnavailableServices());

                // Handle removeUnavailableServices option
                if (removeUnavailable) {
                        StaffAvailabilityCheckResponse availability = staffAssignmentService
                                        .checkStaffAvailabilityForBooking(booking);

                        if (!availability.isAllServicesHaveStaff()) {
                                // Remove services without available staff
                                List<UUID> servicesToRemove = availability.getServices().stream()
                                                .filter(s -> !s.isHasAvailableStaff())
                                                .map(s -> s.getBookingServiceId())
                                                .collect(Collectors.toList());

                                log.info("Removing {} unavailable services from booking", servicesToRemove.size());

                                // Remove from booking
                                List<BookingServiceItem> itemsToKeep = booking.getBookingServices().stream()
                                                .filter(item -> !servicesToRemove.contains(item.getBookingServiceId()))
                                                .collect(Collectors.toList());

                                // Calculate new total price
                                BigDecimal newTotalPrice = itemsToKeep.stream()
                                                .map(item -> item.getUnitPrice() != null ? item.getUnitPrice()
                                                                : BigDecimal.ZERO)
                                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                                // Delete removed service items
                                List<BookingServiceItem> itemsToRemove = booking.getBookingServices().stream()
                                                .filter(item -> servicesToRemove.contains(item.getBookingServiceId()))
                                                .collect(Collectors.toList());

                                for (BookingServiceItem item : itemsToRemove) {
                                        bookingServiceItemRepository.delete(item);
                                        log.info("Removed service '{}' from booking", item.getService().getName());
                                }

                                // Update booking
                                booking.getBookingServices().clear();
                                booking.getBookingServices().addAll(itemsToKeep);
                                booking.setTotalPrice(newTotalPrice);

                                // Send notification to pet owner about removed services
                                // notificationService.sendServiceRemovedNotification(booking, itemsToRemove);
                        }
                }

                // Check if any services remain
                if (booking.getBookingServices().isEmpty()) {
                        throw new IllegalStateException("KhĂ´ng cĂ²n dá»‹ch vá»¥ nĂ o sau khi loáº¡i bá». Vui lĂ²ng há»§y booking.");
                }

                // Update status to CONFIRMED
                booking.setStatus(BookingStatus.CONFIRMED);

                // Determine which staff to use for manual assignment
                // Priority: selectedStaffId > assignedStaffId (both serve same purpose)
                UUID manualStaffId = null;
                if (request != null) {
                        manualStaffId = request.getSelectedStaffId() != null
                                        ? request.getSelectedStaffId()
                                        : request.getAssignedStaffId();
                }

                // Auto-assign staff to all services (or manual-assign if specified)
                try {
                        if (manualStaffId != null) {
                                // Manual assignment - assign same staff to all services
                                final UUID finalManualStaffId = manualStaffId;
                                User manualStaff = userRepository.findById(finalManualStaffId)
                                                .orElseThrow(() -> new ResourceNotFoundException(
                                                                "KhĂ´ng tĂ¬m tháº¥y nhĂ¢n viĂªn"));
                                log.info("Manual staff assignment: {}", manualStaff.getFullName());

                                booking.setAssignedStaff(manualStaff);
                                booking.getBookingServices().forEach(item -> item.setAssignedStaff(manualStaff));
                                booking.setStatus(BookingStatus.CONFIRMED);

                                // Reserve slots for the booking
                                staffAssignmentService.reserveSlotsForBooking(booking);

                                notificationService.sendBookingAssignedNotificationToStaff(booking);

                                // Push SSE event to assigned staff and clinic managers for real-time sync
                                bookingNotificationService.pushBookingUpdateToUsers(booking, "CONFIRMED");
                        } else {
                                // Auto-assign staff based on service specialty (now slot-aware)
                                Map<UUID, User> assignments = staffAssignmentService.assignStaffToAllServices(booking);

                                boolean allAssigned = assignments.size() == booking.getBookingServices().size();

                                if (allAssigned) {
                                        booking.setStatus(BookingStatus.CONFIRMED);
                                        // Reserve slots for the booking
                                        staffAssignmentService.reserveSlotsForBooking(booking);
                                        // Send notification to all assigned staff
                                        notificationService.sendBookingAssignedNotificationToStaff(booking);

                                        // Push SSE event to assigned staff and clinic managers for real-time sync
                                        bookingNotificationService.pushBookingUpdateToUsers(booking, "CONFIRMED");
                                } else if (allowPartial && !assignments.isEmpty()) {
                                        // Partial assignment allowed
                                        booking.setStatus(BookingStatus.CONFIRMED);
                                        log.info("Partial assignment: {} of {} services assigned",
                                                        assignments.size(), booking.getBookingServices().size());
                                        // Don't reserve slots for partial assignment - manager will assign manually
                                        // later
                                } else {
                                        log.warn("Auto-assignment failed or incomplete: only {}/{} assigned",
                                                        assignments.size(), booking.getBookingServices().size());
                                        throw new IllegalStateException(
                                                        "Há»‡ thá»‘ng khĂ´ng tĂ¬m tháº¥y Ä‘á»§ nhĂ¢n viĂªn cĂ²n trá»‘ng lá»‹ch Ä‘á»ƒ gĂ¡n tá»± Ä‘á»™ng. Vui lĂ²ng gĂ¡n thá»§ cĂ´ng.");
                                }

                                log.info("Auto-assigned {} staff to services", assignments.size());
                        }
                } catch (Exception e) {
                        log.error("Failed during booking assignment/reservation: {}", e.getMessage(), e);
                        // Re-throw as IllegalStateException to returning 400-series if it's a business
                        // logic failure
                        if (e instanceof IllegalStateException || e instanceof ResourceNotFoundException) {
                                throw e;
                        }
                        throw new IllegalStateException("Lá»—i khi gĂ¡n lá»‹ch: " + e.getMessage());
                }

                Booking updatedBooking = bookingRepository.save(booking);
                log.info("Booking {} confirmed. Status: {}",
                                updatedBooking.getBookingCode(), updatedBooking.getStatus());

                // Auto-create draft vaccination records
                try {
                        for (BookingServiceItem item : updatedBooking.getBookingServices()) {
                                vaccinationService.createDraftFromBooking(updatedBooking, item);
                        }
                } catch (Exception e) {
                        log.error("Failed to auto-create vaccination drafts: {}", e.getMessage());
                        // Don't fail the whole confirmation, just log error
                }

                return bookingMapper.mapToResponse(updatedBooking);
        }

        // ========== GET BOOKINGS ==========

        /**
         * Get bookings for a clinic with optional status and type filter (Manager view)
         */
        @Transactional(readOnly = true)
        public Page<BookingResponse> getBookingsByClinic(UUID clinicId, BookingStatus status,
                        BookingType type, Pageable pageable) {
                return bookingRepository.findByClinicIdAndStatusAndType(clinicId, status, type, pageable)
                                .map(bookingMapper::mapToResponse);
        }

        /**
         * Get bookings assigned to a staff
         */
        @Transactional(readOnly = true)
        public Page<BookingResponse> getBookingsByStaff(UUID staffId,
                        com.petties.petties.model.enums.BookingStatus status, Pageable pageable) {
                log.info("Fetching booking history for staff ID: {}", staffId);

                try {
                        // JPQL query handles null status automatically
                        Page<Booking> bookings = bookingRepository.findByAssignedStaffIdAndStatus(staffId, status,
                                        pageable);
                        return bookings.map(bookingMapper::mapToResponse);
                } catch (Exception e) {
                        log.error("Error fetching bookings for staff {}: {}", staffId, e.getMessage(), e);
                        throw new RuntimeException("Failed to fetch staff bookings: " + e.getMessage(), e);
                }
        }

        /**
         * Get booking by ID
         */
        @Transactional(readOnly = true)
        public BookingResponse getBookingById(UUID bookingId) {
                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y lá»‹ch háº¹n"));
                return bookingMapper.mapToResponse(booking);
        }

        /**
         * Get booking by code
         */
        @Transactional(readOnly = true)
        public BookingResponse getBookingByCode(String bookingCode) {
                Booking booking = bookingRepository.findByBookingCode(bookingCode)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y lá»‹ch háº¹n"));
                return bookingMapper.mapToResponse(booking);
        }

        // ========== CANCEL BOOKING ==========

        /**
         * Cancel booking
         */
        @Transactional
        public BookingResponse cancelBooking(UUID bookingId, String reason, UUID cancelledBy) {
                log.info("Starting cancelBooking for ID: {}, reason: {}, cancelledBy: {}", bookingId, reason,
                                cancelledBy);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> {
                                        log.error("Booking not found for ID: {}", bookingId);
                                        return new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y lá»‹ch háº¹n");
                                });

                log.info("Found booking {}. Current status: {}, Type: {}", booking.getBookingCode(),
                                booking.getStatus(), booking.getType());

                if (!booking.canBeCancelled()) {
                        log.warn("Booking {} cannot be cancelled in status {}", booking.getBookingCode(),
                                        booking.getStatus());
                        throw new IllegalStateException("Booking cannot be cancelled in current status");
                }

                // If SOS booking, clear matching session from Redis
                if (booking.getType() == BookingType.SOS) {
                        log.info("SOS booking {} being cancelled, clearing matching session", bookingId);
                        try {
                                sosSessionManager.clearSession(bookingId);
                                // Also release user lock if still held
                                sosSessionManager.releaseUserLock(booking.getPetOwner().getUserId());
                        } catch (Exception e) {
                                log.warn("Failed to clear SOS session or release lock: {}", e.getMessage());
                        }
                }

                // Release slots back to AVAILABLE before cancelling
                log.info("Releasing slots for booking {}", booking.getBookingCode());
                try {
                staffAssignmentService.releaseSlotsForBooking(booking);
                } catch (Exception e) {
                        log.warn("Failed to release slots for booking {}: {}. Continuing with cancellation.",
                                        booking.getBookingCode(), e.getMessage());
                }

                booking.setStatus(BookingStatus.CANCELLED);
                booking.setCancellationReason(reason);
                booking.setCancelledBy(cancelledBy);

                log.info("Saving cancelled booking {}", booking.getBookingCode());
                Booking savedBooking = bookingRepository.save(booking);
                log.info("Booking {} cancelled and saved successfully", savedBooking.getBookingCode());

                // Push SSE event for real-time sync
                try {
                bookingNotificationService.pushBookingUpdateToUsers(savedBooking, "CANCELLED");
                } catch (Exception e) {
                        log.warn("Failed to push SSE notification for cancelled booking {}: {}",
                                        savedBooking.getBookingCode(), e.getMessage());
                }

                return bookingMapper.mapToResponse(savedBooking);
        }

        // ========== STAFF AVAILABILITY CHECK ==========

        /**
         * Check staff availability for a booking before confirmation
         * Returns detailed info about which services have available staff
         * and suggests alternative time slots if needed
         *
         * @param bookingId Booking ID to check
         * @return StaffAvailabilityCheckResponse with availability details
         */
        @Transactional(readOnly = true)
        public StaffAvailabilityCheckResponse checkStaffAvailability(UUID bookingId) {
                log.info("Checking staff availability for booking {}", bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found: " + bookingId));

                if (booking.getStatus() != BookingStatus.PENDING) {
                        throw new IllegalStateException("Chá»‰ cĂ³ thá»ƒ kiá»ƒm tra availability cho booking PENDING");
                }

                return staffAssignmentService.checkStaffAvailabilityForBooking(booking);
        }

        /**
         * Get available staff for manual selection when confirming a booking
         *
         * @param bookingId Booking ID to get available staff for
         * @return List of StaffOptionDTO with availability and workload info
         */
        @Transactional(readOnly = true)
        public List<StaffOptionDTO> getAvailableStaffForConfirm(UUID bookingId) {
                log.info("Getting available staff for confirm: booking {}", bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found: " + bookingId));

                if (booking.getStatus() != BookingStatus.PENDING &&
                                (booking.getType() != BookingType.SOS ||
                                                (booking.getStatus() != BookingStatus.PENDING_CLINIC_CONFIRM
                                                                && booking.getStatus() != BookingStatus.SEARCHING))) {
                        throw new IllegalStateException(
                                        "Chá»‰ cĂ³ thá»ƒ láº¥y danh sĂ¡ch nhĂ¢n viĂªn cho booking Ä‘ang chá» xĂ¡c nháº­n");
                }

                return staffAssignmentService.getAvailableStaffForBookingConfirm(booking);
        }

        // ========== STAFF REASSIGNMENT ==========

        /**
         * Get available staff for reassigning a specific service
         *
         * @param bookingId Booking ID
         * @param serviceId BookingServiceItem ID
         * @return List of AvailableStaffResponse with their status
         */
        @Transactional(readOnly = true)
        public List<AvailableStaffResponse> getAvailableStaffForReassign(UUID bookingId, UUID serviceId) {
                log.info("Getting available staff for reassign: booking={}, service={}", bookingId, serviceId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found: " + bookingId));

                BookingServiceItem serviceItem = bookingServiceItemRepository.findById(serviceId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Service item not found: " + serviceId));

                // Get required specialty from service
                StaffSpecialty requiredSpecialty = serviceItem.getService().getServiceCategory() != null
                                ? serviceItem.getService().getServiceCategory().getRequiredSpecialty()
                                : StaffSpecialty.VET;

                // Calculate slots needed
                Integer duration = serviceItem.getService().getDurationTime();
                int slotsNeeded = (duration != null && duration > 0)
                                ? (int) Math.ceil(duration / 30.0)
                                : 1;

                // Calculate start time for this service
                LocalTime startTime = calculateServiceStartTime(booking, serviceId);

                // Get currently assigned staff ID to exclude from list
                UUID currentStaffId = serviceItem.getAssignedStaff() != null
                                ? serviceItem.getAssignedStaff().getUserId()
                                : null;

                return staffAssignmentService.getAvailableStaffForReassign(
                                booking.getClinic().getClinicId(),
                                booking.getBookingDate(),
                                startTime,
                                requiredSpecialty,
                                slotsNeeded,
                                currentStaffId);
        }

        /**
         * Reassign staff for a specific service
         *
         * @param bookingId  Booking ID
         * @param serviceId  BookingServiceItem ID
         * @param newStaffId New staff ID to assign
         * @return Updated booking response
         */
        @Transactional
        public BookingResponse reassignStaffForService(UUID bookingId, UUID serviceId, UUID newStaffId) {
                log.info("Reassigning staff for booking={}, service={}, newStaff={}", bookingId, serviceId, newStaffId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found: " + bookingId));

                // SAVE old staff BEFORE reassigning
                BookingServiceItem serviceItem = booking.getBookingServices().stream()
                                .filter(s -> s.getBookingServiceId().equals(serviceId))
                                .findFirst()
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Service not found in booking: " + serviceId));

                User oldStaff = serviceItem.getAssignedStaff();
                UUID oldStaffId = oldStaff != null ? oldStaff.getUserId() : null;
                String serviceName = serviceItem.getService().getName();

                log.info("Old staff for service {}: {}", serviceId, oldStaffId);

                // Perform the reassignment (this will replace oldStaff with newStaff)
                staffAssignmentService.reassignStaffForService(serviceId, newStaffId, bookingServiceItemRepository);

                // Refresh booking from DB
                booking = bookingRepository.findById(bookingId).orElseThrow();

                // Get new staff for notification
                User newStaff = userRepository.findById(newStaffId)
                                .orElseThrow(() -> new ResourceNotFoundException("Staff not found: " + newStaffId));

                // Send in-app notification + FCM push to both staff
                notificationService.sendStaffReassignedNotification(booking, newStaff, oldStaff, serviceName);

                // Push SSE event to BOTH old and new staff for real-time sync
                bookingNotificationService.pushBookingUpdateToStaff(booking, "STAFF_REASSIGNED", oldStaffId,
                                newStaffId);

                return bookingMapper.mapToResponse(booking);
        }

        /**
         * Calculate the start time for a specific service in a booking.
         * Multi-pet: parallel schedule. Single-pet: sequential.
         */
        private LocalTime calculateServiceStartTime(Booking booking, UUID serviceId) {
                Map<UUID, LocalTime[]> schedule = BookingScheduleUtil.computeSchedule(booking);
                LocalTime[] range = schedule.get(serviceId);
                return range != null ? range[0] : booking.getBookingTime();
        }

        // ========== ADD-ON SERVICE (During Active Booking) ==========

        /**
         * Add a service to an active booking (IN_PROGRESS or ARRIVED)
         * Used when staff wants to add extra services during home visit
         * Distance fee is NOT recalculated (already at location)
         *
         * @param bookingId   Booking ID
         * @param serviceId   Service ID to add
         * @param currentUser Current user performing the action
         * @return Updated booking response
         */
        @Transactional
        public BookingResponse addServiceToBooking(UUID bookingId, UUID serviceId, User currentUser) {
                log.info("Adding service {} to booking {} by user {}", serviceId, bookingId, currentUser.getUserId());

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y lá»‹ch háº¹n"));

                if (currentUser.getRole() == Role.STAFF || currentUser.getRole() == Role.CLINIC_MANAGER) {
                        UUID userClinicId = currentUser.getWorkingClinic() != null
                                        ? currentUser.getWorkingClinic().getClinicId()
                                        : null;
                        UUID bookingClinicId = booking.getClinic() != null ? booking.getClinic().getClinicId() : null;
                        if (userClinicId == null || bookingClinicId == null || !bookingClinicId.equals(userClinicId)) {
                                throw new ForbiddenException("Báº¡n khĂ´ng cĂ³ quyá»n thao tĂ¡c booking cá»§a phĂ²ng khĂ¡m khĂ¡c");
                        }
                }

                // Validate status - only allow for active bookings
                if (booking.getStatus() != BookingStatus.IN_PROGRESS) {
                        throw new IllegalStateException(
                                        "Chá»‰ cĂ³ thá»ƒ thĂªm dá»‹ch vá»¥ khi booking Ä‘ang á»Ÿ tráº¡ng thĂ¡i IN_PROGRESS");
                }

                // Fetch service
                ClinicService service = clinicServiceRepository.findById(serviceId)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y dá»‹ch vá»¥"));

                // Validate service belongs to the same clinic
                if (!service.getClinic().getClinicId().equals(booking.getClinic().getClinicId())) {
                        throw new ForbiddenException("Báº¡n khĂ´ng thá»ƒ thĂªm dá»‹ch vá»¥ cá»§a phĂ²ng khĂ¡m khĂ¡c");
                }

                // Check if service already exists in booking
                boolean alreadyExists = booking.getBookingServices().stream()
                                .anyMatch(item -> item.getService().getServiceId().equals(serviceId));
                if (alreadyExists) {
                        throw new IllegalArgumentException("Dá»‹ch vá»¥ nĂ y Ä‘Ă£ cĂ³ trong Ä‘Æ¡n hĂ ng");
                }

                // HOME_VISIT: chá»‰ cho thĂªm dá»‹ch vá»¥ cĂ³ thá»ƒ thá»±c hiá»‡n táº¡i nhĂ  (phĂ²ng API gá»i trá»±c tiáº¿p)
                if (booking.getType() == BookingType.HOME_VISIT
                                && !Boolean.TRUE.equals(service.getIsHomeVisit())) {
                        throw new IllegalArgumentException(
                                        "Booking khĂ¡m táº¡i nhĂ  chá»‰ cĂ³ thá»ƒ thĂªm dá»‹ch vá»¥ thá»±c hiá»‡n táº¡i nhĂ ");
                }

                // ============ SPECIALTY VALIDATION FOR HOME_VISIT STAFF ============
                // If booking is HOME_VISIT and current user is STAFF,
                // they can only add services within their specialty.
                // SOS dispatches prioritize speed, so we bypass specialty checks.
                if (booking.getType() == BookingType.HOME_VISIT
                                && currentUser.getRole() == Role.STAFF) {

                        StaffSpecialty staffSpecialty = currentUser.getSpecialty();
                        StaffSpecialty requiredSpecialty = service.getServiceCategory() != null
                                        ? service.getServiceCategory().getRequiredSpecialty()
                                        : StaffSpecialty.VET;

                        // With 2 specialties: exact match only
                        boolean isSpecialtyMatch = staffSpecialty == requiredSpecialty;

                        if (!isSpecialtyMatch) {
                                log.warn("Staff {} with specialty {} cannot add service {} requiring specialty {}",
                                                currentUser.getUserId(), staffSpecialty, service.getName(),
                                                requiredSpecialty);
                                throw new IllegalArgumentException(
                                                String.format("Báº¡n khĂ´ng thá»ƒ thĂªm dá»‹ch vá»¥ nĂ y vĂ¬ náº±m ngoĂ i chuyĂªn mĂ´n cá»§a báº¡n. "
                                                                +
                                                                "ChuyĂªn mĂ´n cá»§a báº¡n: %s, Dá»‹ch vá»¥ yĂªu cáº§u: %s",
                                                                staffSpecialty, requiredSpecialty));
                        }
                } else if (booking.getType() == BookingType.SOS) {
                        log.info("SOS Booking: Bypassing specialty check for service addition");
                }
                // IN_CLINIC: Manager can add any service (no specialty restriction)

                // Calculate price (weight-based, NO distance fee)
                Pet pet = booking.getPet();
                BigDecimal basePrice = service.getBasePrice();
                BigDecimal weightPrice = pricingService.calculateServicePrice(service, pet);

                // Create new service item (dá»‹ch vá»¥ phĂ¡t sinh khĂ´ng gĂ¡n staff - ai thá»±c hiá»‡n
                // khĂ´ng cáº§n xĂ¡c Ä‘á»‹nh)
                BookingServiceItem newItem = BookingServiceItem.builder()
                                .booking(booking)
                                .pet(pet)
                                .service(service)
                                .unitPrice(weightPrice)
                                .basePrice(basePrice)
                                .weightPrice(weightPrice)
                                .quantity(1)
                                .assignedStaff(null)
                                .isAddOn(true)
                                .build();

                booking.getBookingServices().add(newItem);

                // Update total price (add new service price, NO additional distance fee)
                BigDecimal newTotal = booking.getTotalPrice().add(weightPrice);
                booking.setTotalPrice(newTotal);

                bookingRepository.save(booking);
                log.info("Added service '{}' to booking {}. New total: {} (added: {})",
                                service.getName(), booking.getBookingCode(), newTotal, weightPrice);

                // Auto-create draft vaccination record if service is a vaccine
                try {
                        vaccinationService.createDraftFromBooking(booking, newItem);
                } catch (Exception e) {
                        log.error("Failed to auto-create vaccination draft for add-on service: {}", e.getMessage());
                }

                // Push SSE event for real-time sync
                bookingNotificationService.pushBookingUpdateToUsers(booking, "SERVICE_ADDED");

                return bookingMapper.mapToResponse(booking);
        }

        /**
         * Process checkout for a booking (Staff/Manager action)
         * For SOS bookings, allows overriding the SOS fee
         *
         * @param bookingId   Booking ID
         * @param request     Checkout request with optional fee override
         * @param currentUser Current user performing checkout
         * @return Updated booking response
         */
        @Transactional
        public BookingResponse processCheckout(UUID bookingId, CheckoutRequest request, User currentUser) {
                log.info("Processing checkout for booking {} by user {}", bookingId, currentUser.getUserId());

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y lá»‹ch háº¹n"));

                // Validate status
                if (booking.getStatus() != BookingStatus.IN_PROGRESS) {
                        throw new IllegalStateException(
                                        "Chá»‰ cĂ³ thá»ƒ checkout khi lá»‹ch háº¹n Ä‘ang thá»±c hiá»‡n");
                }

                // Handle SOS fee override or automated calculation
                if (booking.getType() == BookingType.SOS) {
                        BigDecimal sosFee;
                        if (request != null && request.getOverriddenSosFee() != null) {
                                sosFee = request.getOverriddenSosFee();
                                log.info("SOS Booking: using overridden SOS fee {}", sosFee);
                        } else {
                                sosFee = pricingService.calculateSOSFee(booking.getClinic().getClinicId());
                                log.info("SOS Booking: using automated SOS fee calculation {}", sosFee);
                        }

                        booking.setSosFee(sosFee);

                        // Recalculate total price
                        BigDecimal servicesTotal = booking.getBookingServices().stream()
                                        .map(BookingServiceItem::getUnitPrice)
                                        .reduce(BigDecimal.ZERO, BigDecimal::add);

                        // Total = Services + SOS Fee (Distance fee is 0 for SOS)
                        booking.setTotalPrice(servicesTotal.add(sosFee));
                }

                // Checkout sáº½ hoĂ n táº¥t booking ngay sau khi chá»‘t thĂ´ng tin thanh toĂ¡n.
                String paymentMethod = request != null ? request.getPaymentMethod() : null;
                PaymentMethod method = paymentMethod != null && !paymentMethod.isBlank()
                                ? PaymentMethod.valueOf(paymentMethod.trim().toUpperCase())
                                : PaymentMethod.CASH;

                Payment payment = paymentRepository.findByBookingBookingId(bookingId).orElse(null);
                if (payment == null) {
                        payment = Payment.builder()
                                        .booking(booking)
                                        .amount(booking.getTotalPrice())
                                        .method(method)
                                        .status(PaymentStatus.PENDING)
                                        .build();
                }

                if (payment.getStatus() != PaymentStatus.PAID) {
                        payment.setMethod(method);
                        payment.markAsPaid();
                }

                paymentRepository.save(payment);
                booking.setPayment(payment);
                booking.syncPaymentStatus(payment);
                booking.setStatus(BookingStatus.COMPLETED);
                Booking savedBooking = bookingRepository.save(booking);
                if (savedBooking != null) {
                        booking = savedBooking;
                }

                try {
                        trackingService.clearTracking(bookingId);
                } catch (Exception e) {
                        log.warn("Failed to clear tracking data: {}", e.getMessage());
                }

                bookingNotificationService.pushBookingUpdateToUsers(booking, "COMPLETED");
                try {
                        notificationService.sendCompletedNotification(booking);
                } catch (Exception e) {
                        log.warn("Failed to send completed notification after checkout: {}", e.getMessage());
                }

                log.info("Booking {} checked out by staff and completed with method {}",
                                booking.getBookingCode(), payment.getMethod());
                return bookingMapper.mapToResponse(booking);
        }

        /**
         * Remove a service from booking
         * ONLY allowed for add-on services (isAddOn = true)
         */
        @Transactional
        public BookingResponse removeServiceFromBooking(UUID bookingId, UUID bookingServiceId) {
                log.info("Removing service {} from booking {}", bookingServiceId, bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y lá»‹ch háº¹n"));

                if (booking.getStatus() != BookingStatus.IN_PROGRESS) {
                        throw new IllegalStateException("Chá»‰ cĂ³ thá»ƒ xĂ³a dá»‹ch vá»¥ phĂ¡t sinh khi booking Ä‘ang thá»±c hiá»‡n");
                }

                BookingServiceItem itemToRemove = booking.getBookingServices().stream()
                                .filter(item -> item.getBookingServiceId().equals(bookingServiceId))
                                .findFirst()
                                .orElseThrow(() -> new ResourceNotFoundException("Service item not found in booking"));

                // Validate: Only allow removing add-on services
                if (!Boolean.TRUE.equals(itemToRemove.getIsAddOn())) {
                        throw new IllegalStateException(
                                        "KhĂ´ng thá»ƒ xĂ³a dá»‹ch vá»¥ gá»‘c cá»§a booking. Chá»‰ cĂ³ thá»ƒ xĂ³a dá»‹ch vá»¥ phĂ¡t sinh.");
                }

                // Update total price
                BigDecimal priceToRemove = itemToRemove.getWeightPrice(); // Or unitPrice * quantity if > 1
                BigDecimal newTotal = booking.getTotalPrice().subtract(priceToRemove);
                booking.setTotalPrice(newTotal);

                // Remove from list and delete entity
                booking.getBookingServices().remove(itemToRemove);
                bookingServiceItemRepository.delete(itemToRemove);

                Booking updatedBooking = bookingRepository.save(booking);
                log.info("Removed service '{}'. New total: {}", itemToRemove.getService().getName(), newTotal);

                // Push SSE event
                bookingNotificationService.pushBookingUpdateToUsers(updatedBooking, "SERVICE_REMOVED");

                return bookingMapper.mapToResponse(updatedBooking);
        }

        /**
         * Get available services that can be added to this booking
         * Filters out services already in the booking
         * For HOME_VISIT: VETs only see services within their specialty
         * For IN_CLINIC: Managers/Admins see all active services
         *
         * @param bookingId   Booking ID
         * @param currentUser Current user
         * @return List of available services
         */
        @Transactional(readOnly = true)
        public List<ClinicServiceResponse> getAvailableServicesForAddOn(
                        UUID bookingId, User currentUser) {
                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y lá»‹ch háº¹n"));

                if (currentUser.getRole() == Role.STAFF || currentUser.getRole() == Role.CLINIC_MANAGER) {
                        UUID userClinicId = currentUser.getWorkingClinic() != null
                                        ? currentUser.getWorkingClinic().getClinicId()
                                        : null;
                        UUID bookingClinicId = booking.getClinic() != null ? booking.getClinic().getClinicId() : null;
                        if (userClinicId == null || bookingClinicId == null || !bookingClinicId.equals(userClinicId)) {
                                throw new ForbiddenException("Báº¡n khĂ´ng cĂ³ quyá»n xem dá»‹ch vá»¥ cá»§a phĂ²ng khĂ¡m khĂ¡c");
                        }
                }

                // Get all active services for the clinic
                List<ClinicService> allActiveServices = clinicServiceRepository
                                .findByClinicClinicIdAndIsActiveTrue(booking.getClinic().getClinicId());

                // IDs of services already in the booking
                Set<UUID> existingServiceIds = booking.getBookingServices().stream()
                                .map(item -> item.getService().getServiceId())
                                .collect(Collectors.toSet());

                // Filter and Map
                try {
                        return allActiveServices.stream()
                                        .filter(service -> !existingServiceIds.contains(service.getServiceId()))
                                        .filter(service -> {
                                                // 1. IN_CLINIC: Chá»‰ hiá»ƒn thá»‹ dá»‹ch vá»¥ táº¡i phĂ²ng khĂ¡m (isHomeVisit = false)
                                                if (booking.getType() == BookingType.IN_CLINIC) {
                                                        if (Boolean.TRUE.equals(service.getIsHomeVisit())) {
                                                                return false;
                                                        }
                                                }

                                                // 2. HOME_VISIT: Chá»‰ hiá»ƒn thá»‹ dá»‹ch vá»¥ cĂ³ thá»ƒ thá»±c hiá»‡n táº¡i nhĂ  (isHomeVisit = true)
                                                if (booking.getType() == BookingType.HOME_VISIT) {
                                                        if (!Boolean.TRUE.equals(service.getIsHomeVisit())) {
                                                                return false;
                                                        }
                                                }

                                                // 3. Specialty filtering for Staff in Home Visit
                                                if (booking.getType() == BookingType.HOME_VISIT
                                                                && currentUser.getRole() == Role.STAFF) {

                                                        StaffSpecialty staffSpecialty = currentUser.getSpecialty();
                                                        StaffSpecialty requiredSpecialty = service
                                                                        .getServiceCategory() != null
                                                                                        ? service.getServiceCategory()
                                                                                                        .getRequiredSpecialty()
                                                                                        : StaffSpecialty.VET;

                                                        return staffSpecialty == requiredSpecialty;
                                                }
                                                return true;
                                        })
                                        .map(bookingMapper::mapServiceToResponse)
                                        .collect(Collectors.toList());
                } catch (Exception e) {
                        log.error("Error filtering/mapping services for booking {}: {}", bookingId, e.getMessage(), e);
                        throw e; // Controller will catch this
                }
        }

        // ========== SMART AVAILABILITY ==========

        /**
         * Get available time slots for booking
         * Delegates to StaffAssignmentService for Smart Availability algorithm
         * 
         * @param clinicId   Clinic ID
         * @param date       Booking date
         * @param serviceIds List of service IDs
         * @return Available slots response with start times
         */
        public AvailableSlotsResponse getAvailableSlots(
                        UUID clinicId, LocalDate date, List<UUID> serviceIds) {

                log.info("Getting available slots for clinic {}, date {}, services {}", clinicId, date, serviceIds);

                // Delegate to StaffAssignmentService for Smart Availability algorithm
                List<LocalTime> availableStartTimes = staffAssignmentService.findAvailableSlots(clinicId, date,
                                serviceIds);

                return AvailableSlotsResponse.builder()
                                .availableSlots(availableStartTimes)
                                .totalSlots(availableStartTimes.size())
                                .build();
        }

        // ========== STATUS TRANSITIONS ==========

        /**
         * Check-in booking (Staff action)
         * Transitions: CONFIRMED â†’ IN_PROGRESS
         *
         * @param bookingId Booking ID
         * @return Updated booking response
         */
        @Transactional
        public BookingResponse checkIn(UUID bookingId) {
                log.info("Check-in booking {}", bookingId);

                Booking booking = bookingRepository.findByIdWithDetails(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y lá»‹ch háº¹n"));

// Validate status - chá»‰ cho phĂ©p check-in khi CONFIRMED (check-in chuyá»ƒn sang IN_PROGRESS)
                if (booking.getStatus() != BookingStatus.CONFIRMED) {
                        throw new IllegalStateException(
                                        "Chá»‰ cĂ³ thá»ƒ check-in khi booking á»Ÿ tráº¡ng thĂ¡i CONFIRMED. Tráº¡ng thĂ¡i hiá»‡n táº¡i: "
                                                        + booking.getStatus());
                }

                // Update status to IN_PROGRESS
                booking.setStatus(BookingStatus.IN_PROGRESS);
                boolean qrPaymentPrepared = prepareQrPaymentWhenInProgress(booking);
                bookingRepository.save(booking);

                log.info("Booking {} checked in successfully. Status: IN_PROGRESS", booking.getBookingCode());

                // Push SSE event for real-time sync
                bookingNotificationService.pushBookingUpdateToUsers(booking, "CHECK_IN");

                // Notify pet owner (do not break check-in flow if notification insert is duplicated)
                try {
                        notificationService.sendCheckinNotification(booking);
                } catch (Exception e) {
                        log.warn("Failed to send check-in notification for booking {}: {}",
                                        booking.getBookingCode(), e.getMessage());
                }

                if (qrPaymentPrepared) {
                        try {
                                notificationService.sendPaymentRequiredNotification(booking);
                        } catch (Exception e) {
                                log.warn("Failed to send payment-required notification for booking {}: {}",
                                                booking.getBookingCode(), e.getMessage());
                        }
                }

                // Auto-create draft vaccination records chá»‰ khi booking cĂ³ dá»‹ch vá»¥ tiĂªm phĂ²ng
                try {
                        List<BookingServiceItem> services = booking.getBookingServices();
                        if (services != null) {
                                for (BookingServiceItem item : services) {
                                        if (item.getService() != null
                                                        && item.getService().getServiceCategory() == ServiceCategory.VACCINATION) {
                                                vaccinationService.createDraftFromBooking(booking, item);
                                        }
                                }
                        }
                } catch (Exception e) {
                        log.error("Failed to auto-create vaccination drafts during check-in: {}", e.getMessage());
                }

                return bookingMapper.mapToResponse(booking);
        }

        /**
         * Start moving to customer location (Staff action)
         * Transitions: CONFIRMED â†’ IN_PROGRESS
         * Only for SOS/HOME_VISIT bookings
         */
        @Transactional
        public BookingResponse startMoving(UUID bookingId) {
                log.info("Staff starting movement for booking {}", bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y lá»‹ch háº¹n"));

                // Validate type
                if (booking.getType() != com.petties.petties.model.enums.BookingType.SOS
                                && booking.getType() != com.petties.petties.model.enums.BookingType.HOME_VISIT) {
                        throw new IllegalStateException("Chá»‰ Ă¡p dá»¥ng cho Ä‘áº·t lá»‹ch SOS hoáº·c khĂ¡m táº¡i nhĂ ");
                }

                // Validate status
                if (booking.getStatus() != BookingStatus.CONFIRMED) {
                        throw new IllegalStateException(
                                        "Chá»‰ cĂ³ thá»ƒ báº¯t Ä‘áº§u di chuyá»ƒn khi booking á»Ÿ tráº¡ng thĂ¡i CONFIRMED. Tráº¡ng thĂ¡i hiá»‡n táº¡i: "
                                                        + booking.getStatus());
                }

                // Update status to IN_PROGRESS
                booking.setStatus(BookingStatus.IN_PROGRESS);
                boolean qrPaymentPrepared = prepareQrPaymentWhenInProgress(booking);
                bookingRepository.save(booking);

                log.info("Booking {} started moving. Status: IN_PROGRESS", booking.getBookingCode());

                // Push SSE event for real-time sync
                bookingNotificationService.pushBookingUpdateToUsers(booking, "START_MOVING");

                // Notify pet owner
                try {
                        notificationService.sendStaffOnWayNotification(booking);
                } catch (Exception e) {
                        log.warn("Failed to send movement notification: {}", e.getMessage());
                }

                if (qrPaymentPrepared) {
                        try {
                                notificationService.sendPaymentRequiredNotification(booking);
                        } catch (Exception e) {
                                log.warn("Failed to send payment-required notification for booking {}: {}",
                                                booking.getBookingCode(), e.getMessage());
                        }
                }

                return bookingMapper.mapToResponse(booking);
        }

        @Transactional
        public BookingResponse arrived(UUID bookingId) {
                log.info("Staff arrived for booking {}", bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y lá»‹ch háº¹n"));

                // Validate status - must be IN_PROGRESS (movement phase)
                if (booking.getStatus() != BookingStatus.IN_PROGRESS) {
                        throw new IllegalStateException(
                                        "Chá»‰ cĂ³ thá»ƒ bĂ¡o Ä‘Ă£ Ä‘áº¿n khi booking á»Ÿ tráº¡ng thĂ¡i IN_PROGRESS. Tráº¡ng thĂ¡i hiá»‡n táº¡i: "
                                                        + booking.getStatus());
                }

                booking.setArrivedAt(LocalDateTime.now());
                Booking savedBooking = bookingRepository.save(booking);

                log.info("Booking {} arrival recorded at {}", savedBooking.getBookingCode(),
                                savedBooking.getArrivedAt());

                // Push SSE event for real-time sync
                bookingNotificationService.pushBookingUpdateToUsers(savedBooking, "ARRIVED");

                // Broadcast ARRIVED event qua WebSocket tracking Ä‘á»ƒ Pet Owner nháº­n real-time
                try {
                        trackingService.publishArrival(savedBooking);
                } catch (Exception e) {
                        log.warn("Failed to publish ARRIVED tracking event: {}", e.getMessage());
                }

                try {
                        notificationService.sendStaffArrivedNotification(booking);
                } catch (Exception e) {
                        log.warn("Failed to send arrival notification: {}", e.getMessage());
                }

                return bookingMapper.mapToResponse(booking);
        }

        /**
         * Complete booking with payment method selection (Manager action)
         * - CASH: Creates Payment (PAID) â†’ Booking COMPLETED immediately
         * - QR: Creates Payment (PENDING) â†’ Returns QR info â†’ Booking stays IN_PROGRESS
         * - null request: Legacy behavior â†’ Booking COMPLETED without payment
         *
         * @param bookingId Booking ID
         * @param request   CheckoutRequest with paymentMethod (CASH or QR), nullable
         * @return Updated booking response (with qrImageUrl for QR)
         */
        @Transactional
        public BookingResponse complete(UUID bookingId, CheckoutRequest request) {
                log.info("Completing booking {} with payment method: {}",
                                bookingId, request != null ? request.getPaymentMethod() : "NONE");

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y lá»‹ch háº¹n"));

                // Validate status
                if (booking.getStatus() != BookingStatus.IN_PROGRESS) {
                        throw new IllegalStateException(
                                        "Chá»‰ cĂ³ thá»ƒ hoĂ n thĂ nh/thanh toĂ¡n khi booking á»Ÿ tráº¡ng thĂ¡i IN_PROGRESS. Tráº¡ng thĂ¡i hiá»‡n táº¡i: "
                                                        + booking.getStatus());
                }

                // Náº¿u khĂ´ng truyá»n phÆ°Æ¡ng thá»©c thanh toĂ¡n:
                // - QR: cho phĂ©p hoĂ n táº¥t trÆ°á»›c, giá»¯ payment á»Ÿ tráº¡ng thĂ¡i PENDING
                // - CASH/khĂ¡c: giá»¯ hĂ nh vi cÅ© (Ä‘Ă¡nh dáº¥u Ä‘Ă£ thanh toĂ¡n)
                if (request == null || request.getPaymentMethod() == null) {
                        // TĂ¬m payment hiá»‡n táº¡i (náº¿u cĂ³)
                        Payment payment = paymentRepository.findByBookingBookingId(bookingId).orElse(null);

                        if (payment == null) {
                                PaymentMethod inferredMethod = booking.getPaymentMethod() != null
                                                ? booking.getPaymentMethod()
                                                : PaymentMethod.CASH;

                                PaymentStatus initialStatus = inferredMethod == PaymentMethod.QR
                                                ? PaymentStatus.PENDING
                                                : PaymentStatus.PAID;

                                // ChÆ°a cĂ³ payment â†’ táº¡o má»›i theo method Ä‘Ă£ chá»n tá»« trÆ°á»›c trĂªn booking
                                payment = Payment.builder()
                                                .booking(booking)
                                                .amount(booking.getTotalPrice())
                                                .method(inferredMethod)
                                                .status(initialStatus)
                                                .build();

                                if (inferredMethod == PaymentMethod.QR) {
                                        payment.setPaidAt(null);
                                        if (payment.getPaymentDescription() == null || payment.getPaymentDescription().isBlank()) {
                                                payment.setPaymentDescription(transactionService.generatePaymentDescription(bookingId));
                                        }
                                }
                        } else if (payment.getStatus() != PaymentStatus.PAID) {
                                // ÄĂ£ cĂ³ payment nhÆ°ng chÆ°a PAID
                                payment.setMethod(
                                                payment.getMethod() != null ? payment.getMethod() : PaymentMethod.CASH);

                                if (payment.getMethod() == PaymentMethod.QR) {
                                        // QR cho phĂ©p hoĂ n táº¥t trÆ°á»›c, giá»¯ unpaid Ä‘á»ƒ Pet Owner thanh toĂ¡n sau
                                        payment.setStatus(PaymentStatus.PENDING);
                                        payment.setPaidAt(null);
                                        if (payment.getPaymentDescription() == null || payment.getPaymentDescription().isBlank()) {
                                                payment.setPaymentDescription(transactionService.generatePaymentDescription(bookingId));
                                        }
                                } else {
                                        // CASH/khĂ¡c: Ä‘Ă¡nh dáº¥u Ä‘Ă£ thanh toĂ¡n nhÆ° luá»“ng cÅ©
                                        payment.markAsPaid();
                                }
                        }

                        paymentRepository.save(payment);
                        booking.setPayment(payment);
                        booking.syncPaymentStatus(payment);

                        booking.setStatus(BookingStatus.COMPLETED);
                        bookingRepository.save(booking);
                        log.info("Booking {} completed with implicit payment (method: {})", booking.getBookingCode(),
                                        payment.getMethod());

                        // Clear GPS tracking data from Redis (for SOS/HOME_VISIT bookings)
                        try {
                                trackingService.clearTracking(bookingId);
                        } catch (Exception e) {
                                log.warn("Failed to clear tracking data: {}", e.getMessage());
                        }

                        // Push SSE event for real-time sync
                        bookingNotificationService.pushBookingUpdateToUsers(booking, "COMPLETED");

                        // Notify pet owner
                        try {
                                notificationService.sendCompletedNotification(booking);
                        } catch (Exception e) {
                                log.warn("Failed to send completed notification: {}", e.getMessage());
                        }

                        return bookingMapper.mapToResponse(booking);
                }

                PaymentMethod method = PaymentMethod.valueOf(request.getPaymentMethod());

                // Check if payment already exists for this booking (1-1 relationship)
                Payment existingPayment = paymentRepository.findByBookingBookingId(bookingId).orElse(null);

                // Náº¿u Ä‘Ă£ thanh toĂ¡n rá»“i thĂ¬ chá»‰ cáº§n hoĂ n táº¥t booking, khĂ´ng táº¡o payment má»›i
                if (existingPayment != null && existingPayment.getStatus() == PaymentStatus.PAID) {
                        booking.syncPaymentStatus(existingPayment);
                        booking.setStatus(BookingStatus.COMPLETED);
                        bookingRepository.save(booking);
                        return bookingMapper.mapToResponse(booking);
                }

                // Vá»›i QR, báº¯t buá»™c pháº£i xĂ¡c nháº­n PAID trÆ°á»›c khi complete.
                if (method == PaymentMethod.QR) {
                        throw new BadRequestException(
                                        "Booking QR chÆ°a thanh toĂ¡n thĂ nh cĂ´ng. Vui lĂ²ng chá» xĂ¡c nháº­n thanh toĂ¡n trÆ°á»›c khi hoĂ n táº¥t.");
                }

                // DĂ¹ng láº¡i báº£n ghi payment hiá»‡n táº¡i (PENDING/FAILED/REFUNDED) thay vĂ¬ táº¡o báº£n ghi má»›i
                Payment payment;
                if (existingPayment != null) {
                        log.info("Reusing existing payment {} for booking {} with new method {} and resetting state",
                                        existingPayment.getPaymentId(), bookingId, method);
                        existingPayment.setMethod(method);
                        existingPayment.setStatus(PaymentStatus.PENDING);
                        existingPayment.setPaidAt(null);
                        existingPayment.setStripePaymentId(null);
                        existingPayment.setPaymentDescription(null);
                        payment = existingPayment;
                } else {
                        // ChÆ°a cĂ³ payment nĂ o cho booking nĂ y â†’ táº¡o má»›i
                        payment = Payment.builder()
                                .booking(booking)
                                .amount(booking.getTotalPrice())
                                .method(method)
                                .status(PaymentStatus.PENDING)
                                .build();
                }

                if (method == PaymentMethod.CASH) {
                        // CASH: Mark as paid immediately and complete booking
                        payment.markAsPaid();
                        paymentRepository.save(payment);

                        booking.setPayment(payment);
                        booking.syncPaymentStatus(payment);
                        booking.setStatus(BookingStatus.COMPLETED);
                        bookingRepository.save(booking);

                        log.info("Booking {} completed with CASH payment", booking.getBookingCode());

                        bookingNotificationService.pushBookingUpdateToUsers(booking, "COMPLETED");
                        try {
                                notificationService.sendCompletedNotification(booking);
                        } catch (Exception e) {
                                log.warn("Failed to send completed notification: {}", e.getMessage());
                        }

                        return bookingMapper.mapToResponse(booking);
                } else {
                        throw new IllegalArgumentException("PhÆ°Æ¡ng thá»©c thanh toĂ¡n khĂ´ng Ä‘Æ°á»£c há»— trá»£: " + method);
                }
        }

        /**
         * Notify pet owner that staff is on the way (Manager action)
         * Does NOT change booking status - just sends notification
         * 
         * @param bookingId Booking ID
         * @return Booking response
         */
        @Transactional(readOnly = true)
        public BookingResponse notifyOnWay(UUID bookingId) {
                log.info("Sending 'staff on the way' notification for booking {}", bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y lá»‹ch háº¹n"));

                // Validate status - should be CONFIRMED (staff assigned but not yet started)
                if (booking.getStatus() != BookingStatus.CONFIRMED) {
                        throw new IllegalStateException(
                                        "Chá»‰ cĂ³ thá»ƒ gá»­i thĂ´ng bĂ¡o khi booking á»Ÿ tráº¡ng thĂ¡i CONFIRMED. Tráº¡ng thĂ¡i hiá»‡n táº¡i: "
                                                        + booking.getStatus());
                }

                // Validate booking type - only for HOME_VISIT or SOS
                if (booking.getType() != BookingType.HOME_VISIT
                                && booking.getType() != BookingType.SOS) {
                        throw new IllegalStateException("Chá»‰ Ă¡p dá»¥ng cho lá»‹ch háº¹n táº¡i nhĂ  hoáº·c SOS");
                }

                // Send notification
                try {
                        notificationService.sendStaffOnWayNotification(booking);
                        log.info("Sent 'staff on the way' notification for booking {}", booking.getBookingCode());
                } catch (Exception e) {
                        log.error("Failed to send 'staff on the way' notification: {}", e.getMessage());
                        throw new RuntimeException("KhĂ´ng thá»ƒ gá»­i thĂ´ng bĂ¡o: " + e.getMessage());
                }

                return bookingMapper.mapToResponse(booking);
        }

        // ========== STAFF HOME SUMMARY ==========

        /**
         * Get staff home screen summary - optimized single API call for mobile
         * Returns: today's booking count, pending count, in-progress count, and
         * upcoming bookings
         *
         * @param staffId Staff user ID
         * @return StaffHomeSummaryResponse with aggregated data
         */
        @Transactional(readOnly = true)
        public StaffHomeSummaryResponse getStaffHomeSummary(UUID staffId) {
                log.info("Getting home summary for staff {}", staffId);

                try {
                        LocalDate today = LocalDate.now();

                        // Get all bookings assigned to this staff for today
                        List<Booking> todayBookings = bookingRepository.findByAssignedStaffIdAndBookingDate(staffId,
                                        today);

                        // Get upcoming bookings (today and next 7 days) with active statuses
                        LocalDate endDate = today.plusDays(7);
                        List<com.petties.petties.model.enums.BookingStatus> activeStatuses = List.of(
                                        BookingStatus.CONFIRMED,
                                        BookingStatus.PENDING,
                                        BookingStatus.IN_PROGRESS);
                        List<Booking> upcomingBookings = bookingRepository
                                        .findByAssignedStaffIdAndBookingDateBetweenAndStatusIn(
                                                        staffId, today, endDate, activeStatuses);

                        // Calculate stats for today
                        int todayCount = todayBookings != null ? todayBookings.size() : 0;
                        int pendingCount = todayBookings != null ? (int) todayBookings.stream()
                                        .filter(b -> b.getStatus() == BookingStatus.CONFIRMED
                                                        || b.getStatus() == BookingStatus.PENDING)
                                        .count() : 0;
                        int inProgressCount = todayBookings != null ? (int) todayBookings.stream()
                                        .filter(b -> b.getStatus() == BookingStatus.IN_PROGRESS)
                                        .count() : 0;

                        // Map upcoming bookings to DTO (limit to 5 for home screen)
                        List<UpcomingBookingDTO> upcomingDTOs = new ArrayList<>();
                        if (upcomingBookings != null && !upcomingBookings.isEmpty()) {
                                upcomingDTOs = upcomingBookings.stream()
                                                .sorted((a, b) -> {
                                                        int dateCompare = a.getBookingDate()
                                                                        .compareTo(b.getBookingDate());
                                                        if (dateCompare != 0)
                                                                return dateCompare;
                                                        return a.getBookingTime().compareTo(b.getBookingTime());
                                                })
                                                .limit(5)
                                                .map(bookingMapper::mapToUpcomingDTO)
                                                .collect(Collectors.toList());
                        }

                        return StaffHomeSummaryResponse.builder()
                                        .todayBookingsCount(todayCount)
                                        .pendingCount(pendingCount)
                                        .inProgressCount(inProgressCount)
                                        .upcomingBookings(upcomingDTOs)
                                        .build();
                } catch (Exception e) {
                        log.error("Error getting staff home summary for staff {}: {}", staffId, e.getMessage(), e);
                        throw e;
                }
        }

        /**
         * Get bookings by pet owner with eager loading to avoid
         * LazyInitializationException
         */
        @Transactional(readOnly = true)
        public Page<BookingResponse> getMyBookings(UUID petOwnerId, Pageable pageable) {
                log.info("Fetching bookings for pet owner: {}", petOwnerId);

                Page<Booking> bookingPage = bookingRepository.findByPetOwnerId(petOwnerId, pageable);
                List<BookingResponse> responses = bookingPage.getContent().stream()
                                .map(bookingMapper::mapToResponse)
                                .collect(Collectors.toList());

                return new org.springframework.data.domain.PageImpl<>(
                                responses, pageable, bookingPage.getTotalElements());
        }

        /**
         * Get bookings created by user on behalf of others (proxy bookings)
         */
        @Transactional(readOnly = true)
        public Page<BookingResponse> getMyProxyBookings(UUID proxyBookerId, Pageable pageable) {
                log.info("Fetching proxy bookings created by user: {}", proxyBookerId);
                Page<Booking> bookings = bookingRepository.findByProxyBookerId(proxyBookerId, pageable);
                return bookings.map(bookingMapper::mapToResponse);
        }

        // ========== SHARED VISIBILITY ==========

        /**
         * Get all bookings for a clinic today - Shared Visibility for Staff
         * All staff in the clinic can see ALL bookings, with isMyAssignment flag
         * to identify their own assignments
         *
         * @param clinicId     Clinic ID
         * @param currentStaff Current logged-in staff
         * @return List of ClinicTodayBookingResponse with isMyAssignment flag
         */
        @Transactional(readOnly = true)
        public List<ClinicTodayBookingResponse> getClinicTodayBookings(
                        UUID clinicId, User currentStaff) {
                log.info("Getting today's bookings for clinic {} by staff {}", clinicId, currentStaff.getUserId());

                // Validate: Staff must belong to the clinic
                if (currentStaff.getWorkingClinic() == null ||
                                !currentStaff.getWorkingClinic().getClinicId().equals(clinicId)) {
                        throw new ForbiddenException(
                                        "Báº¡n khĂ´ng cĂ³ quyá»n xem lá»‹ch háº¹n cá»§a phĂ²ng khĂ¡m nĂ y");
                }

                LocalDate today = LocalDate.now();
                List<Booking> bookings = bookingRepository.findByClinicIdAndDateWithDetails(clinicId, today);

                return bookings.stream()
                                .map(booking -> bookingMapper.mapToClinicTodayResponse(booking,
                                                currentStaff.getUserId()))
                                .collect(Collectors.toList());
        }

        // ========== ESTIMATED COMPLETION TIME ==========

        /**
         * Calculate estimated completion time based on pet info, services, and start
         * time
         * Supports multi-pet format: pets: [{ petId, petWeight, serviceIds: [...] }]
         *
         * @param clinicId Clinic ID to fetch services from
         * @param request  EstimatedCompletionRequest with pets array
         * @return EstimatedCompletionResponse with total duration and breakdown by pet
         */
        @Transactional(readOnly = true)
        public EstimatedCompletionResponse calculateEstimatedCompletion(
                        UUID clinicId,
                        EstimatedCompletionRequest request) {
                log.info("Calculating estimated completion for clinic={}, pets={}, type={}, startDateTime={}",
                                clinicId, request.getPets().size(), request.getType(), request.getStartDateTime());

                Clinic clinic = clinicRepository.findById(clinicId)
                                .orElseThrow(() -> new ResourceNotFoundException("KhĂ´ng tĂ¬m tháº¥y phĂ²ng khĂ¡m"));

                // Get operating hours for the specific day
                String dayOfWeek = request.getStartDateTime().getDayOfWeek().name();
                OperatingHours oh = clinic.getOperatingHours() != null ? clinic.getOperatingHours().get(dayOfWeek)
                                : null;

                if (oh != null && Boolean.TRUE.equals(oh.getIsClosed())) {
                        throw new com.petties.petties.exception.BadRequestException(
                                        "PhĂ²ng khĂ¡m Ä‘Ă³ng cá»­a vĂ o ngĂ y nĂ y (" + dayOfWeek + ")");
                }

                LocalDateTime currentStartDateTime = request.getStartDateTime();
                int grandTotalDurationMinutes = 0;
                int grandTotalSlotsRequired = 0;
                List<EstimatedCompletionResponse.PetDuration> petDurations = new ArrayList<>();

                for (PetEstimation petEst : request.getPets()) {
                        // Fetch services for this pet
                        List<ClinicService> services = clinicServiceRepository.findAllById(petEst.getServiceIds());

                        if (services.isEmpty()) {
                                throw new ResourceNotFoundException(
                                                "KhĂ´ng tĂ¬m tháº¥y dá»‹ch vá»¥ nĂ o cho pet: " + petEst.getPetId());
                        }

                        // Validate all services belong to the same clinic
                        boolean allBelongToClinic = services.stream()
                                        .allMatch(s -> s.getClinic().getClinicId().equals(clinicId));
                        if (!allBelongToClinic) {
                                throw new BadRequestException("Má»™t sá»‘ dá»‹ch vá»¥ khĂ´ng thuá»™c phĂ²ng khĂ¡m nĂ y");
                        }

                        // Calculate durations for this pet's services
                        List<EstimatedCompletionResponse.ServiceDuration> serviceDurations = new ArrayList<>();
                        int petTotalDuration = 0;

                        for (ClinicService service : services) {
                                int durationMinutes = service.getDurationTime() != null ? service.getDurationTime()
                                                : 30;
                                int slotsRequired = (int) Math.ceil(durationMinutes / 30.0);

                                // Logic for Clinic Breaks (only if IN_CLINIC)
                                if (request.getType() == BookingType.IN_CLINIC && oh != null
                                                && oh.getBreakStart() != null && oh.getBreakEnd() != null) {

                                        LocalTime currentStartTime = currentStartDateTime.toLocalTime();

                                        // 1. If currentStart is during break, push to breakEnd
                                        if (!currentStartTime.isBefore(oh.getBreakStart())
                                                        && currentStartTime.isBefore(oh.getBreakEnd())) {
                                                currentStartDateTime = currentStartDateTime.with(oh.getBreakEnd());
                                        }

                                        LocalDateTime serviceEndDateTime = currentStartDateTime
                                                        .plusMinutes(durationMinutes);
                                        LocalTime endStartTime = serviceEndDateTime.toLocalTime();

                                        // 2. If service starts before break but finishes after break starts
                                        // (Push the whole service end time by break duration)
                                        if (currentStartDateTime.toLocalTime().isBefore(oh.getBreakStart())
                                                        && endStartTime.isAfter(oh.getBreakStart())) {
                                                long breakDuration = Duration.between(oh.getBreakStart(),
                                                                oh.getBreakEnd()).toMinutes();
                                                serviceEndDateTime = serviceEndDateTime.plusMinutes(breakDuration);
                                        }

                                        serviceDurations.add(EstimatedCompletionResponse.ServiceDuration.builder()
                                                        .serviceId(service.getServiceId().toString())
                                                        .serviceName(service.getName())
                                                        .durationMinutes(durationMinutes)
                                                        .slotsRequired(slotsRequired)
                                                        .estimatedStartTime(currentStartDateTime)
                                                        .estimatedEndTime(serviceEndDateTime)
                                                        .build());

                                        petTotalDuration += durationMinutes;
                                        grandTotalSlotsRequired += slotsRequired;
                                        currentStartDateTime = serviceEndDateTime;
                                } else {
                                        // HOME_VISIT, SOS or no operating hours/breaks defined
                                        LocalDateTime serviceEndDateTime = currentStartDateTime
                                                        .plusMinutes(durationMinutes);

                                        serviceDurations.add(EstimatedCompletionResponse.ServiceDuration.builder()
                                                        .serviceId(service.getServiceId().toString())
                                                        .serviceName(service.getName())
                                                        .durationMinutes(durationMinutes)
                                                        .slotsRequired(slotsRequired)
                                                        .estimatedStartTime(currentStartDateTime)
                                                        .estimatedEndTime(serviceEndDateTime)
                                                        .build());

                                        petTotalDuration += durationMinutes;
                                        grandTotalSlotsRequired += slotsRequired;
                                        currentStartDateTime = serviceEndDateTime;
                                }
                        }

                        grandTotalDurationMinutes += petTotalDuration;

                        petDurations.add(EstimatedCompletionResponse.PetDuration.builder()
                                        .petId(petEst.getPetId() != null ? petEst.getPetId().toString() : null)
                                        .petWeight(petEst.getPetWeight())
                                        .totalDurationMinutes(petTotalDuration)
                                        .services(serviceDurations)
                                        .build());
                }

                // Final grand estimated end time is just the last currentStartDateTime
                LocalDateTime estimatedEndDateTime = currentStartDateTime;

                log.info("Estimated completion: startDateTime={}, endDateTime={}, totalDuration={}min, pets={}",
                                request.getStartDateTime(), estimatedEndDateTime, grandTotalDurationMinutes,
                                petDurations.size());

                return EstimatedCompletionResponse.builder()
                                .startTime(request.getStartDateTime())
                                .estimatedEndTime(estimatedEndDateTime)
                                .totalDurationMinutes(grandTotalDurationMinutes)
                                .totalSlotsRequired(grandTotalSlotsRequired)
                                .pets(petDurations)
                                .build();
        }
}
