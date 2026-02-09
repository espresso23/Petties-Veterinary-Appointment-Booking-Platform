package com.petties.petties.service;

import com.petties.petties.dto.booking.AvailableStaffResponse;
import com.petties.petties.dto.booking.AvailableSlotsResponse;
import com.petties.petties.dto.booking.BookingConfirmRequest;
import com.petties.petties.dto.booking.BookingRequest;
import com.petties.petties.dto.booking.BookingResponse;
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
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.StaffSpecialty;
import com.petties.petties.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.petties.petties.dto.booking.EstimatedCompletionResponse;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
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
        private final BookingMapper bookingMapper;
        private final BookingNotificationService bookingNotificationService;

        private static final int MAX_RETRY_COUNT = 3;

        // ========== HELPER METHODS ==========

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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));
        }

        /**
         * Generate unique booking code with retry logic to prevent race conditions.
         * Uses count-based sequence with random offset as fallback.
         */
        private String generateUniqueBookingCode(UUID clinicId, LocalDate bookingDate) {
                int attempt = 0;
                while (attempt < MAX_RETRY_COUNT) {
                        try {
                                long sequence = bookingRepository.countByClinicAndDate(clinicId, bookingDate) + 1;
                                String bookingCode = Booking.generateBookingCode(bookingDate, (int) sequence);

                                // Check if booking code already exists (defensive check)
                                if (bookingRepository.findByBookingCode(bookingCode).isEmpty()) {
                                        log.debug("Generated unique booking code: {}", bookingCode);
                                        return bookingCode;
                                }

                                // Code already exists, need to retry with higher sequence
                                log.warn("Booking code {} already exists, retrying with higher sequence", bookingCode);
                        } catch (Exception e) {
                                log.warn("Error generating booking code on attempt {}: {}", attempt, e.getMessage());
                        }

                        attempt++;
                }

                // Final fallback: use random suffix to ensure uniqueness
                long sequence = bookingRepository.countByClinicAndDate(clinicId, bookingDate) + 1 + attempt;
                String bookingCode = Booking.generateBookingCode(bookingDate, (int) sequence);
                log.warn("Using fallback booking code with random suffix: {}", bookingCode);
                return bookingCode;
        }

        // ========== CREATE BOOKING ==========

        /**
         * Create a new booking (from pet owner).
         * Supports single-pet (petId + serviceIds) and multi-pet (items: list of petId + serviceIds).
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
                                                        "Mỗi mục phải có mã thú cưng và ít nhất một dịch vụ");
                                }
                        } else {
                                if (request.getPetId() == null || request.getServiceIds() == null
                                                || request.getServiceIds().isEmpty()) {
                                        throw new BadRequestException(
                                                        "Vui lòng gửi mã thú cưng và danh sách dịch vụ, hoặc dùng items cho đặt nhiều thú cưng");
                                }
                        }

                        User petOwner = userRepository.findById(petOwnerId)
                                        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chủ thú cưng"));
                        Clinic clinic = clinicRepository.findById(request.getClinicId())
                                        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

                        List<Pet> petsToUse = new ArrayList<>();
                        List<ClinicService> servicesToUse = new ArrayList<>();
                        UUID primaryPetId;

                        if (multiPet) {
                                primaryPetId = items.get(0).getPetId();
                                Set<UUID> allServiceIds = new java.util.HashSet<>();
                                for (PetServiceItemRequest it : items) {
                                        Pet p = petRepository.findById(it.getPetId())
                                                        .orElseThrow(() -> new ResourceNotFoundException(
                                                                        "Không tìm thấy thú cưng: " + it.getPetId()));
                                        if (!p.getUser().getUserId().equals(petOwnerId)) {
                                                throw new ForbiddenException("Thú cưng không thuộc quyền sở hữu của bạn");
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
                                                        throw new ResourceNotFoundException("Dịch vụ không tồn tại: " + sid);
                                                }
                                                if (!svc.getClinic().getClinicId().equals(clinic.getClinicId())) {
                                                        throw new BadRequestException("Dịch vụ không thuộc phòng khám đã chọn");
                                                }
                                                petsToUse.add(p);
                                                servicesToUse.add(svc);
                                        }
                                }
                        } else {
                                Pet pet = petRepository.findById(request.getPetId())
                                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thú cưng"));
                                if (!pet.getUser().getUserId().equals(petOwnerId)) {
                                        throw new ForbiddenException("Thú cưng không thuộc quyền sở hữu của bạn");
                                }
                                primaryPetId = pet.getId();
                                List<ClinicService> services = clinicServiceRepository.findAllById(request.getServiceIds());
                                if (services.isEmpty()) {
                                        throw new BadRequestException("Vui lòng chọn ít nhất một dịch vụ hợp lệ");
                                }
                                if (services.size() != request.getServiceIds().size()) {
                                        throw new ResourceNotFoundException("Một số dịch vụ không tồn tại");
                                }
                                for (ClinicService s : services) {
                                        if (!s.getClinic().getClinicId().equals(clinic.getClinicId())) {
                                                throw new BadRequestException("Dịch vụ không thuộc phòng khám đã chọn");
                                        }
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
                                        throw new BadRequestException("Các dịch vụ sau không hỗ trợ khám tại nhà: "
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
                        BigDecimal distanceKm = request.getDistanceKm();
                        BigDecimal distanceFee = pricingService.calculateBookingDistanceFee(clinic.getClinicId(),
                                        distanceKm, request.getType());
                        BigDecimal totalPrice = servicesTotal.add(distanceFee);

                        Booking booking = Booking.builder()
                                        .pet(primaryPet)
                                        .petOwner(petOwner)
                                        .clinic(clinic)
                                        .bookingDate(request.getBookingDate())
                                        .bookingTime(request.getBookingTime())
                                        .type(request.getType())
                                        .totalPrice(totalPrice)
                                        .distanceFee(distanceFee)
                                        .status(BookingStatus.PENDING)
                                        .notes(request.getNotes())
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

                        // ========== RETRY LOGIC FOR BOOKING CODE COLLISION ==========
                        int maxRetries = 3;
                        Booking savedBooking = null;

                        for (int attempt = 0; attempt < maxRetries; attempt++) {
                                try {
                                        // Generate unique booking code on each attempt
                                        String bookingCode = generateUniqueBookingCode(clinic.getClinicId(),
                                                        request.getBookingDate());
                                        booking.setBookingCode(bookingCode);

                                        // Save booking
                                        savedBooking = bookingRepository.save(booking);
                                        log.info("Booking created successfully: {}", savedBooking.getBookingCode());
                                        break; // Success, exit retry loop

                                } catch (org.springframework.dao.DataIntegrityViolationException ex) {
                                        String rootCause = ex.getMostSpecificCause().getMessage();

                                        // Retry ONLY for booking_code collision
                                        if (rootCause != null && rootCause.contains("booking_code")) {
                                                log.warn("Booking code collision, retry {}/{}", attempt + 1,
                                                                maxRetries);
                                                if (attempt == maxRetries - 1) {
                                                        throw new IllegalStateException(
                                                                        "Không thể tạo mã booking sau " + maxRetries
                                                                                        + " lần thử. Vui lòng thử lại.");
                                                }
                                                continue; // Retry
                                        }
                                        // Re-throw for other constraints (e.g., unique_active_booking_per_pet_time)
                                        throw ex;
                                }
                        }

                        if (savedBooking == null) {
                                throw new IllegalStateException("Không thể lưu booking");
                        }

                        // ========== NOTIFICATION AFTER SUCCESSFUL SAVE ==========
                        try {
                                notificationService.sendBookingNotificationToClinic(savedBooking);
                                log.debug("Notification sent to clinic");
                        } catch (Exception e) {
                                log.error("Failed to send notification (non-blocking): {}", e.getMessage());
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
                        throw new RuntimeException("Lỗi tạo booking: " + e.getMessage());
                }
        }

        // ========== PROXY BOOKING (ĐẶT HỘ) ==========

        /**
         * Create a proxy booking on behalf of someone else.
         * The logged-in user (proxyBooker) creates a booking for a recipient who may not have an account.
         *
         * @param request      ProxyBookingRequest with recipient info, pet info, and booking details
         * @param proxyBookerId UUID of the logged-in user who is booking on behalf of the recipient
         * @return BookingResponse
         */
        @Transactional
        public BookingResponse createProxyBooking(ProxyBookingRequest request, UUID proxyBookerId) {
                log.info("Creating proxy booking by user {} for recipient {}",
                                proxyBookerId, request.getRecipient().getPhone());

                try {
                        // Get the proxy booker (the person making the booking on behalf of someone)
                        User proxyBooker = userRepository.findById(proxyBookerId)
                                        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

                        // Step 1: Create a new guest user for the recipient
                        ProxyRecipientInfo recipientInfo = request.getRecipient();
                        User recipient = createRecipientUser(recipientInfo);

                        // Step 2: Validate clinic
                        Clinic clinic = clinicRepository.findById(request.getClinicId())
                                        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

                        // Step 3: Collect all service IDs and create pets
                        List<Pet> createdPets = new ArrayList<>();
                        List<UUID> allServiceIds = new ArrayList<>();
                        Map<UUID, Pet> serviceIdToPetMap = new java.util.HashMap<>();

                        for (ProxyPetServiceItem item : request.getItems()) {
                                // Create pet for recipient
                                Pet pet = createPetForRecipient(item.getPet(), recipient);
                                createdPets.add(pet);
                                log.info("Created new pet {} for recipient", pet.getName());

                                // Map each service ID to this pet
                                for (UUID serviceId : item.getServiceIds()) {
                                        allServiceIds.add(serviceId);
                                        serviceIdToPetMap.put(serviceId, pet);
                                }
                        }

                        // Step 4: Validate services
                        List<ClinicService> services = clinicServiceRepository.findAllById(allServiceIds)
                                        .stream()
                                        .filter(ClinicService::getIsActive)
                                        .collect(Collectors.toList());

                        if (services.isEmpty()) {
                                throw new BadRequestException("Không tìm thấy dịch vụ hợp lệ");
                        }

                        // Step 5: Validate home visit services if applicable
                        if (request.getType() == BookingType.HOME_VISIT || request.getType() == BookingType.SOS) {
                                List<String> ineligibleServices = services.stream()
                                                .filter(s -> s.getIsHomeVisit() == null || !s.getIsHomeVisit())
                                                .map(ClinicService::getName)
                                                .collect(Collectors.toList());
                                if (!ineligibleServices.isEmpty()) {
                                        throw new BadRequestException("Các dịch vụ sau không hỗ trợ khám tại nhà: "
                                                        + String.join(", ", ineligibleServices));
                                }
                        }

                        // Step 6: Calculate pricing (use first pet for distance calculation)
                        Pet firstPet = createdPets.get(0);
                        BigDecimal servicesTotal = BigDecimal.ZERO;
                        for (ClinicService svc : services) {
                                Pet petForService = serviceIdToPetMap.get(svc.getServiceId());
                                servicesTotal = servicesTotal.add(pricingService.calculateServicePrice(svc, petForService));
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
                                        .notes(request.getNotes())
                                        .homeAddress(request.getHomeAddress() != null ? request.getHomeAddress() : recipientInfo.getAddress())
                                        .homeLat(request.getHomeLat() != null ? request.getHomeLat() : recipientInfo.getLat())
                                        .homeLong(request.getHomeLong() != null ? request.getHomeLong() : recipientInfo.getLng())
                                        .distanceKm(distanceKm)
                                        .build();

                        // Step 8: Add services to booking with proper pet assignment
                        for (ClinicService service : services) {
                                Pet petForService = serviceIdToPetMap.get(service.getServiceId());
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

                        // Step 9: Save with retry for booking code collision
                        int maxRetries = 3;
                        Booking savedBooking = null;

                        for (int attempt = 0; attempt < maxRetries; attempt++) {
                                try {
                                        String bookingCode = generateUniqueBookingCode(clinic.getClinicId(), request.getBookingDate());
                                        booking.setBookingCode(bookingCode);
                                        savedBooking = bookingRepository.save(booking);
                                        log.info("Proxy booking created successfully: {} by user {} for recipient {} with {} pets",
                                                        savedBooking.getBookingCode(), proxyBookerId, recipientInfo.getPhone(), createdPets.size());
                                        break;
                                } catch (org.springframework.dao.DataIntegrityViolationException ex) {
                                        String rootCause = ex.getMostSpecificCause().getMessage();
                                        if (rootCause != null && rootCause.contains("booking_code")) {
                                                log.warn("Booking code collision, retry {}/{}", attempt + 1, maxRetries);
                                                if (attempt == maxRetries - 1) {
                                                        throw new IllegalStateException(
                                                                        "Không thể tạo mã booking sau " + maxRetries + " lần thử. Vui lòng thử lại.");
                                                }
                                                continue;
                                        }
                                        throw ex;
                                }
                        }

                        if (savedBooking == null) {
                                throw new IllegalStateException("Không thể lưu booking");
                        }

                        // Step 10: Send notification to clinic
                        try {
                                notificationService.sendBookingNotificationToClinic(savedBooking);
                        } catch (Exception e) {
                                log.error("Failed to send notification (non-blocking): {}", e.getMessage());
                        }

                        return bookingMapper.mapToResponse(savedBooking);

                } catch (BadRequestException | IllegalStateException | IllegalArgumentException e) {
                        log.warn("Business exception during proxy booking creation: {}", e.getMessage());
                        throw e;
                } catch (Exception e) {
                        log.error("Error creating proxy booking: ", e);
                        throw new RuntimeException("Lỗi tạo proxy booking: " + e.getMessage());
                }
        }

        /**
         * Create a new guest user for proxy booking.
         * In proxy booking flow, we always create a new guest user without checking existing records.
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
                log.info("Created new guest user for proxy booking: {} ({})", newUser.getUserId(), recipientInfo.getPhone());
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
                                .species(petInfo.getSpecies()) // String type
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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch hẹn"));

                if (booking.getStatus() != BookingStatus.PENDING) {
                        throw new IllegalStateException("Booking is not in PENDING status");
                }

                // ========== VALIDATE: Prevent confirming past bookings ==========
                LocalDate today = LocalDate.now();
                LocalTime now = LocalTime.now();

                if (booking.getBookingDate().isBefore(today)) {
                        throw new IllegalStateException(
                                        "Không thể xác nhận booking đã qua ngày. Vui lòng hủy và đặt lại.");
                }

                // Allow a 30-minute grace period for confirming today's bookings
                if (booking.getBookingDate().isEqual(today)) {
                        LocalTime graceTime = booking.getBookingTime().plusMinutes(30);
                        if (now.isAfter(graceTime)) {
                                throw new IllegalStateException(
                                                "Không thể xác nhận booking đã quá 30 phút so với giờ hẹn. Vui lòng gán bác sĩ thủ công hoặc đặt lại.");
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
                        throw new IllegalStateException("Không còn dịch vụ nào sau khi loại bỏ. Vui lòng hủy booking.");
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
                                                                "Không tìm thấy nhân viên"));
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
                                                        "Hệ thống không tìm thấy đủ nhân viên còn trống lịch để gán tự động. Vui lòng gán thủ công.");
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
                        throw new IllegalStateException("Lỗi khi gán lịch: " + e.getMessage());
                }

                Booking updatedBooking = bookingRepository.save(booking);
                log.info("Booking {} confirmed. Status: {}",
                                updatedBooking.getBookingCode(), updatedBooking.getStatus());

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
        public Page<BookingResponse> getBookingsByStaff(UUID staffId, BookingStatus status, Pageable pageable) {
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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch hẹn"));
                return bookingMapper.mapToResponse(booking);
        }

        /**
         * Get booking by code
         */
        @Transactional(readOnly = true)
        public BookingResponse getBookingByCode(String bookingCode) {
                Booking booking = bookingRepository.findByBookingCode(bookingCode)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch hẹn"));
                return bookingMapper.mapToResponse(booking);
        }

        // ========== CANCEL BOOKING ==========

        /**
         * Cancel booking
         */
        @Transactional
        public BookingResponse cancelBooking(UUID bookingId, String reason, UUID cancelledBy) {
                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch hẹn"));

                if (!booking.canBeCancelled()) {
                        throw new IllegalStateException("Booking cannot be cancelled in current status");
                }

                // Release slots back to AVAILABLE before cancelling
                staffAssignmentService.releaseSlotsForBooking(booking);

                booking.setStatus(BookingStatus.CANCELLED);
                booking.setCancellationReason(reason);
                booking.setCancelledBy(cancelledBy);

                Booking savedBooking = bookingRepository.save(booking);
                log.info("Booking {} cancelled", savedBooking.getBookingCode());

                // Push SSE event for real-time sync
                bookingNotificationService.pushBookingUpdateToUsers(savedBooking, "CANCELLED");

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
                        throw new IllegalStateException("Chỉ có thể kiểm tra availability cho booking PENDING");
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

                if (booking.getStatus() != BookingStatus.PENDING) {
                        throw new IllegalStateException("Chỉ có thể lấy danh sách nhân viên cho booking PENDING");
                }

                return staffAssignmentService.getAvailableStaffForBookingConfirm(booking);
        }

        // ========== STAFF REASSIGNMENT ==========

        /**
         * Get available staff for reassigning a specific service
         *
         * @param bookingId Booking ID
         * @param serviceId BookingServiceItem ID
         * @return List of available staff with their status
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
                                : StaffSpecialty.VET_GENERAL;

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
         * Calculate the start time for a specific service in a booking
         * Based on the order of services and their durations
         */
        private LocalTime calculateServiceStartTime(Booking booking, UUID serviceId) {
                LocalTime startTime = booking.getBookingTime();

                for (BookingServiceItem item : booking.getBookingServices()) {
                        if (item.getBookingServiceId().equals(serviceId)) {
                                return startTime;
                        }

                        // Add duration of previous services
                        Integer duration = item.getService().getDurationTime();
                        int slots = (duration != null && duration > 0)
                                        ? (int) Math.ceil(duration / 30.0)
                                        : 1;
                        startTime = startTime.plusMinutes(slots * 30L);
                }

                return booking.getBookingTime(); // Fallback
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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch hẹn"));

                // Validate status - only allow for active bookings
                if (booking.getStatus() != BookingStatus.IN_PROGRESS
                                && booking.getStatus() != BookingStatus.ARRIVED) {
                        throw new IllegalStateException(
                                        "Chỉ có thể thêm dịch vụ khi booking đang ở trạng thái ARRIVED hoặc IN_PROGRESS");
                }

                // Fetch service
                ClinicService service = clinicServiceRepository.findById(serviceId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy dịch vụ"));

                // Validate service belongs to the same clinic
                if (!service.getClinic().getClinicId().equals(booking.getClinic().getClinicId())) {
                        throw new IllegalArgumentException("Dịch vụ không thuộc phòng khám này");
                }

                // Check if service already exists in booking
                boolean alreadyExists = booking.getBookingServices().stream()
                                .anyMatch(item -> item.getService().getServiceId().equals(serviceId));
                if (alreadyExists) {
                        throw new IllegalArgumentException("Dịch vụ này đã có trong đơn hàng");
                }

                // ============ SPECIALTY VALIDATION FOR HOME_VISIT STAFF ============
                // If booking is HOME_VISIT and current user is STAFF,
                // they can only add services within their specialty
                if (booking.getType() == BookingType.HOME_VISIT
                                && currentUser.getRole() == Role.STAFF) {

                        StaffSpecialty staffSpecialty = currentUser.getSpecialty();
                        StaffSpecialty requiredSpecialty = service.getServiceCategory() != null
                                        ? service.getServiceCategory().getRequiredSpecialty()
                                        : StaffSpecialty.VET_GENERAL;

                        // VET_GENERAL can do any service, but specialized staff must match
                        boolean isSpecialtyMatch = staffSpecialty == StaffSpecialty.VET_GENERAL
                                        || staffSpecialty == requiredSpecialty;

                        if (!isSpecialtyMatch) {
                                log.warn("Staff {} with specialty {} cannot add service {} requiring specialty {}",
                                                currentUser.getUserId(), staffSpecialty, service.getName(),
                                                requiredSpecialty);
                                throw new IllegalArgumentException(
                                                String.format("Bạn không thể thêm dịch vụ này vì nằm ngoài chuyên môn của bạn. "
                                                                +
                                                                "Chuyên môn của bạn: %s, Dịch vụ yêu cầu: %s",
                                                                staffSpecialty, requiredSpecialty));
                        }
                }
                // IN_CLINIC: Manager can add any service (no specialty restriction)

                // Calculate price (weight-based, NO distance fee)
                Pet pet = booking.getPet();
                BigDecimal basePrice = service.getBasePrice();
                BigDecimal weightPrice = pricingService.calculateServicePrice(service, pet);

                // Create new service item
                BookingServiceItem newItem = BookingServiceItem.builder()
                                .booking(booking)
                                .service(service)
                                .unitPrice(weightPrice)
                                .basePrice(basePrice)
                                .weightPrice(weightPrice)
                                .quantity(1)
                                .assignedStaff(null) // Arising services are not auto-assigned
                                .isAddOn(true)
                                .build();

                booking.getBookingServices().add(newItem);

                // Update total price (add new service price, NO additional distance fee)
                BigDecimal newTotal = booking.getTotalPrice().add(weightPrice);
                booking.setTotalPrice(newTotal);

                bookingRepository.save(booking);

                log.info("Added service '{}' to booking {}. New total: {} (added: {})",
                                service.getName(), booking.getBookingCode(), newTotal, weightPrice);

                // Push SSE event for real-time sync
                bookingNotificationService.pushBookingUpdateToUsers(booking, "SERVICE_ADDED");

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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch hẹn"));

                BookingServiceItem itemToRemove = booking.getBookingServices().stream()
                                .filter(item -> item.getBookingServiceId().equals(bookingServiceId))
                                .findFirst()
                                .orElseThrow(() -> new ResourceNotFoundException("Service item not found in booking"));

                // Validate: Only allow removing add-on services
                if (!Boolean.TRUE.equals(itemToRemove.getIsAddOn())) {
                        throw new IllegalStateException(
                                        "Không thể xóa dịch vụ gốc của booking. Chỉ có thể xóa dịch vụ phát sinh.");
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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch hẹn"));

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
                                                // 1. IN_CLINIC: Only show services with isHomeVisit = false
                                                if (booking.getType() == BookingType.IN_CLINIC) {
                                                        if (Boolean.TRUE.equals(service.getIsHomeVisit())) {
                                                                return false;
                                                        }
                                                }

                                                // 2. Specialty filtering for Staff in Home Visit
                                                if (booking.getType() == BookingType.HOME_VISIT
                                                                && currentUser.getRole() == Role.STAFF) {

                                                        StaffSpecialty staffSpecialty = currentUser.getSpecialty();
                                                        StaffSpecialty requiredSpecialty = service
                                                                        .getServiceCategory() != null
                                                                                        ? service.getServiceCategory()
                                                                                                        .getRequiredSpecialty()
                                                                                        : StaffSpecialty.VET_GENERAL;

                                                        return staffSpecialty == StaffSpecialty.VET_GENERAL
                                                                        || staffSpecialty == requiredSpecialty;
                                                }
                                                return true; // Managers or In-Clinic bookings see all (subject to above
                                                             // filter)
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
         * Transitions: CONFIRMED → IN_PROGRESS
         *
         * @param bookingId Booking ID
         * @return Updated booking response
         */
        @Transactional
        public BookingResponse checkIn(UUID bookingId) {
                log.info("Check-in booking {}", bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch hẹn"));

                // Validate status - allow CONFIRMED or ARRIVED
                if (booking.getStatus() != BookingStatus.CONFIRMED && booking.getStatus() != BookingStatus.ARRIVED) {
                        throw new IllegalStateException(
                                        "Chỉ có thể check-in khi booking ở trạng thái CONFIRMED hoặc ARRIVED. Trạng thái hiện tại: "
                                                        + booking.getStatus());
                }

                // Update status to IN_PROGRESS
                booking.setStatus(BookingStatus.IN_PROGRESS);
                bookingRepository.save(booking);

                log.info("Booking {} checked in successfully. Status: IN_PROGRESS", booking.getBookingCode());

                // Push SSE event for real-time sync
                bookingNotificationService.pushBookingUpdateToUsers(booking, "CHECK_IN");

                // Notify pet owner
                try {
                        notificationService.sendCheckinNotification(booking);
                } catch (Exception e) {
                        log.warn("Failed to send check-in notification: {}", e.getMessage());
                }

                return bookingMapper.mapToResponse(booking);
        }

        /**
         * Complete booking (Manager action - after payment confirmed)
         * Transitions: IN_PROGRESS → COMPLETED
         * 
         * @param bookingId Booking ID
         * @return Updated booking response
         */
        @Transactional
        public BookingResponse complete(UUID bookingId) {
                log.info("Completing booking {}", bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch hẹn"));

                // Validate status
                if (booking.getStatus() != BookingStatus.IN_PROGRESS) {
                        throw new IllegalStateException(
                                        "Chỉ có thể hoàn thành khi booking ở trạng thái IN_PROGRESS. Trạng thái hiện tại: "
                                                        + booking.getStatus());
                }

                // Update status to COMPLETED
                booking.setStatus(BookingStatus.COMPLETED);
                bookingRepository.save(booking);

                log.info("Booking {} completed successfully", booking.getBookingCode());

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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch hẹn"));

                // Validate status - should be CONFIRMED (staff assigned but not yet started)
                if (booking.getStatus() != BookingStatus.CONFIRMED) {
                        throw new IllegalStateException(
                                        "Chỉ có thể gửi thông báo khi booking ở trạng thái CONFIRMED. Trạng thái hiện tại: "
                                                        + booking.getStatus());
                }

                // Validate booking type - only for HOME_VISIT or SOS
                if (booking.getType() != BookingType.HOME_VISIT
                                && booking.getType() != BookingType.SOS) {
                        throw new IllegalStateException("Chỉ áp dụng cho lịch hẹn tại nhà hoặc SOS");
                }

                // Send notification
                try {
                        notificationService.sendStaffOnWayNotification(booking);
                        log.info("Sent 'staff on the way' notification for booking {}", booking.getBookingCode());
                } catch (Exception e) {
                        log.error("Failed to send 'staff on the way' notification: {}", e.getMessage());
                        throw new RuntimeException("Không thể gửi thông báo: " + e.getMessage());
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
                        List<BookingStatus> activeStatuses = List.of(
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
         * Get bookings by pet owner
         */

        @Transactional(readOnly = true)
        public Page<BookingResponse> getMyBookings(UUID petOwnerId, Pageable pageable) {
                log.info("Fetching bookings for user: {}", petOwnerId);
                Page<Booking> bookings = bookingRepository.findByPetOwnerId(petOwnerId, pageable);
                return bookings.map(bookingMapper::mapToResponse);
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
                                        "Bạn không có quyền xem lịch hẹn của phòng khám này");
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
         * Calculate estimated completion time based on pet info, services, and start time
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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng khám"));

                // Get operating hours for the specific day
                String dayOfWeek = request.getStartDateTime().getDayOfWeek().name();
                OperatingHours oh = clinic.getOperatingHours() != null ? clinic.getOperatingHours().get(dayOfWeek) : null;

                if (oh != null && Boolean.TRUE.equals(oh.getIsClosed())) {
                        throw new com.petties.petties.exception.BadRequestException("Phòng khám đóng cửa vào ngày này (" + dayOfWeek + ")");
                }

                LocalDateTime currentStartDateTime = request.getStartDateTime();
                int grandTotalDurationMinutes = 0;
                int grandTotalSlotsRequired = 0;
                List<EstimatedCompletionResponse.PetDuration> petDurations = new ArrayList<>();

                for (PetEstimation petEst : request.getPets()) {
                        // Fetch services for this pet
                        List<ClinicService> services = clinicServiceRepository.findAllById(petEst.getServiceIds());

                        if (services.isEmpty()) {
                                throw new ResourceNotFoundException("Không tìm thấy dịch vụ nào cho pet: " + petEst.getPetId());
                        }

                        // Validate all services belong to the same clinic
                        boolean allBelongToClinic = services.stream()
                                        .allMatch(s -> s.getClinic().getClinicId().equals(clinicId));
                        if (!allBelongToClinic) {
                                throw new BadRequestException("Một số dịch vụ không thuộc phòng khám này");
                        }

                        // Calculate durations for this pet's services
                        List<EstimatedCompletionResponse.ServiceDuration> serviceDurations = new ArrayList<>();
                        int petTotalDuration = 0;

                        for (ClinicService service : services) {
                                int durationMinutes = service.getDurationTime() != null ? service.getDurationTime() : 30;
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

                                        LocalDateTime serviceEndDateTime = currentStartDateTime.plusMinutes(durationMinutes);
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
                                        LocalDateTime serviceEndDateTime = currentStartDateTime.plusMinutes(durationMinutes);

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

