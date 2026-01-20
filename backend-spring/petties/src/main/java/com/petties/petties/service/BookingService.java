package com.petties.petties.service;

import com.petties.petties.dto.booking.AvailableVetResponse;
import com.petties.petties.dto.booking.AvailableSlotsResponse;
import com.petties.petties.dto.booking.BookingConfirmRequest;
import com.petties.petties.dto.booking.BookingRequest;
import com.petties.petties.dto.booking.BookingResponse;
import com.petties.petties.dto.booking.VetAvailabilityCheckResponse;
import com.petties.petties.dto.booking.VetOptionDTO;
import com.petties.petties.dto.booking.VetHomeSummaryResponse;
import com.petties.petties.dto.sse.SseEventDto;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Booking;
import com.petties.petties.model.BookingServiceItem;
import com.petties.petties.dto.booking.UpcomingBookingDTO;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.StaffSpecialty;
import com.petties.petties.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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
        private final VetAssignmentService vetAssignmentService;
        private final NotificationService notificationService;
        private final PricingService pricingService;
        private final BookingServiceItemRepository bookingServiceItemRepository;
        private final SseEmitterService sseEmitterService;

        // ========== CREATE BOOKING ==========

        /**
         * Create a new booking (from pet owner)
         */
        @Transactional
        public BookingResponse createBooking(BookingRequest request, UUID petOwnerId) {
                log.info("Creating booking for pet {} at clinic {}", request.getPetId(), request.getClinicId());

                // Validate and fetch entities
                Pet pet = petRepository.findById(request.getPetId())
                                .orElseThrow(() -> new ResourceNotFoundException("Pet not found"));

                User petOwner = userRepository.findById(petOwnerId)
                                .orElseThrow(() -> new ResourceNotFoundException("Pet owner not found"));

                Clinic clinic = clinicRepository.findById(request.getClinicId())
                                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

                // Fetch services
                List<com.petties.petties.model.ClinicService> services = clinicServiceRepository
                                .findAllById(request.getServiceIds());
                if (services.isEmpty()) {
                        throw new IllegalArgumentException("At least one valid service is required");
                }

                // Home Visit Validation: All services must support home visits and share the
                // same specialty
                if (request.getType() == com.petties.petties.model.enums.BookingType.HOME_VISIT
                                || request.getType() == com.petties.petties.model.enums.BookingType.SOS) {

                        // 1. Check isHomeVisit flag
                        List<String> ineligibleServices = services.stream()
                                        .filter(s -> s.getIsHomeVisit() == null || !s.getIsHomeVisit())
                                        .map(com.petties.petties.model.ClinicService::getName)
                                        .collect(Collectors.toList());

                        if (!ineligibleServices.isEmpty()) {
                                throw new IllegalArgumentException("Các dịch vụ sau không hỗ trợ khám tại nhà: "
                                                + String.join(", ", ineligibleServices));
                        }

                        // 2. Check specialty consistency
                        java.util.Set<com.petties.petties.model.enums.StaffSpecialty> specialties = services.stream()
                                        .map(s -> s.getServiceCategory() != null
                                                        ? s.getServiceCategory().getRequiredSpecialty()
                                                        : com.petties.petties.model.enums.StaffSpecialty.VET_GENERAL)
                                        .collect(Collectors.toSet());

                        if (specialties.size() > 1) {
                                throw new IllegalArgumentException(
                                                "Khám tại nhà yêu cầu các dịch vụ đặt cùng lúc phải có cùng chuyên môn (ví dụ: Tất cả đều là Thú y hoặc tất cả đều là Grooming).");
                        }
                }

                // Generate booking code
                long sequence = bookingRepository.countByClinicAndDate(clinic.getClinicId(), request.getBookingDate())
                                + 1;
                String bookingCode = Booking.generateBookingCode(request.getBookingDate(), (int) sequence);

                // Calculate total price using PricingService
                // 1. Sum weight-based prices for all services
                BigDecimal servicesTotal = BigDecimal.ZERO;
                for (com.petties.petties.model.ClinicService service : services) {
                        BigDecimal servicePrice = pricingService.calculateServicePrice(service, pet);
                        servicesTotal = servicesTotal.add(servicePrice);
                }

                // 2. Calculate single distance fee for the whole booking
                BigDecimal distanceKm = request.getDistanceKm();
                BigDecimal distanceFee = pricingService.calculateBookingDistanceFee(services, distanceKm,
                                request.getType());

                // 3. Final total
                BigDecimal totalPrice = servicesTotal.add(distanceFee);
                log.info("Total booking price: {} (services: {} + distance fee: {})", totalPrice, servicesTotal,
                                distanceFee);

                // Build booking entity
                Booking booking = Booking.builder()
                                .bookingCode(bookingCode)
                                .pet(pet)
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

                // Add service items with calculated prices (including pricing breakdown)
                for (com.petties.petties.model.ClinicService service : services) {
                        BigDecimal basePrice = service.getBasePrice();
                        BigDecimal weightPrice = pricingService.calculateServicePrice(service, pet);

                        BookingServiceItem item = BookingServiceItem.builder()
                                        .booking(booking)
                                        .service(service)
                                        .unitPrice(weightPrice) // Use weight-based price as unit price
                                        .basePrice(basePrice) // Store original base price for display
                                        .weightPrice(weightPrice) // Store calculated weight-based price
                                        .quantity(1)
                                        .build();
                        booking.getBookingServices().add(item);
                }

                // Save booking
                Booking savedBooking = bookingRepository.save(booking);
                log.info("Booking created: {}", savedBooking.getBookingCode());

                // Send notification to clinic manager
                notificationService.sendBookingNotificationToClinic(savedBooking);

                return mapToResponse(savedBooking);
        }

        // ========== CONFIRM BOOKING ==========

        /**
         * Confirm booking and auto-assign vets to all services (Manager action)
         * Groups services by specialty and assigns appropriate vet for each
         *
         * Supports partial confirmation options:
         * - allowPartial: Confirm even if some services don't have available vets
         * - removeUnavailableServices: Remove services without available vets and
         * recalculate price
         */
        @Transactional
        public BookingResponse confirmBooking(UUID bookingId, BookingConfirmRequest request) {
                log.info("Confirming booking {}", bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

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

                if (booking.getBookingDate().isEqual(today) && booking.getBookingTime().isBefore(now)) {
                        throw new IllegalStateException(
                                        "Không thể xác nhận booking đã qua giờ hẹn. Vui lòng hủy và đặt lại.");
                }

                boolean allowPartial = request != null && Boolean.TRUE.equals(request.getAllowPartial());
                boolean removeUnavailable = request != null
                                && Boolean.TRUE.equals(request.getRemoveUnavailableServices());

                // Handle removeUnavailableServices option
                if (removeUnavailable) {
                        VetAvailabilityCheckResponse availability = vetAssignmentService
                                        .checkVetAvailabilityForBooking(booking);

                        if (!availability.isAllServicesHaveVets()) {
                                // Remove services without available vets
                                List<UUID> servicesToRemove = availability.getServices().stream()
                                                .filter(s -> !s.isHasAvailableVet())
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

                // Determine which vet to use for manual assignment
                // Priority: selectedVetId > assignedVetId (both serve same purpose)
                UUID manualVetId = null;
                if (request != null) {
                        manualVetId = request.getSelectedVetId() != null
                                        ? request.getSelectedVetId()
                                        : request.getAssignedVetId();
                }

                // Auto-assign vets to all services (or manual-assign if specified)
                if (manualVetId != null) {
                        // Manual assignment - assign same vet to all services
                        final UUID finalManualVetId = manualVetId;
                        User manualVet = userRepository.findById(finalManualVetId)
                                        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bác sĩ"));
                        log.info("Manual vet assignment: {}", manualVet.getFullName());

                        booking.setAssignedVet(manualVet);
                        booking.getBookingServices().forEach(item -> item.setAssignedVet(manualVet));
                        booking.setStatus(BookingStatus.ASSIGNED);

                        // Reserve slots for the booking
                        vetAssignmentService.reserveSlotsForBooking(booking);

                        notificationService.sendBookingAssignedNotificationToVet(booking);

                        // Push SSE event to assigned vet and clinic managers for real-time sync
                        pushBookingUpdateToUsers(booking, "ASSIGNED");
                } else {
                        // Auto-assign vets based on service specialty
                        Map<UUID, User> assignments = vetAssignmentService.assignVetsToAllServices(booking);

                        boolean allAssigned = assignments.size() == booking.getBookingServices().size();

                        if (allAssigned) {
                                booking.setStatus(BookingStatus.ASSIGNED);
                                // Reserve slots for the booking
                                vetAssignmentService.reserveSlotsForBooking(booking);
                                // Send notification to all assigned vets
                                notificationService.sendBookingAssignedNotificationToVet(booking);

                                // Push SSE event to assigned vets and clinic managers for real-time sync
                                pushBookingUpdateToUsers(booking, "ASSIGNED");
                        } else if (allowPartial && !assignments.isEmpty()) {
                                // Partial assignment allowed
                                booking.setStatus(BookingStatus.CONFIRMED);
                                log.info("Partial assignment: {} of {} services assigned",
                                                assignments.size(), booking.getBookingServices().size());
                                // Don't reserve slots for partial assignment - manager will assign manually
                                // later
                        } else if (!assignments.isEmpty()) {
                                // Some assignments made, treat as partial
                                booking.setStatus(BookingStatus.CONFIRMED);
                        }

                        log.info("Auto-assigned {} vets to services", assignments.size());
                }

                Booking updatedBooking = bookingRepository.save(booking);
                log.info("Booking {} confirmed. Status: {}",
                                updatedBooking.getBookingCode(), updatedBooking.getStatus());

                return mapToResponse(updatedBooking);
        }

        // ========== GET BOOKINGS ==========

        /**
         * Get bookings for a clinic with optional status and type filter (Manager view)
         */
        @Transactional(readOnly = true)
        public Page<BookingResponse> getBookingsByClinic(UUID clinicId, BookingStatus status,
                        com.petties.petties.model.enums.BookingType type, Pageable pageable) {
                return bookingRepository.findByClinicIdAndStatusAndType(clinicId, status, type, pageable)
                                .map(this::mapToResponse);
        }

        /**
         * Get bookings assigned to a vet
         */
        @Transactional(readOnly = true)
        public Page<BookingResponse> getBookingsByVet(UUID vetId, BookingStatus status, Pageable pageable) {
                return bookingRepository.findByAssignedVetIdAndStatus(vetId, status, pageable)
                                .map(this::mapToResponse);
        }

        /**
         * Get booking by ID
         */
        @Transactional(readOnly = true)
        public BookingResponse getBookingById(UUID bookingId) {
                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
                return mapToResponse(booking);
        }

        /**
         * Get booking by code
         */
        @Transactional(readOnly = true)
        public BookingResponse getBookingByCode(String bookingCode) {
                Booking booking = bookingRepository.findByBookingCode(bookingCode)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
                return mapToResponse(booking);
        }

        // ========== CANCEL BOOKING ==========

        /**
         * Cancel booking
         */
        @Transactional
        public BookingResponse cancelBooking(UUID bookingId, String reason, UUID cancelledBy) {
                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

                if (!booking.canBeCancelled()) {
                        throw new IllegalStateException("Booking cannot be cancelled in current status");
                }

                // Release slots back to AVAILABLE before cancelling
                vetAssignmentService.releaseSlotsForBooking(booking);

                booking.setStatus(BookingStatus.CANCELLED);
                booking.setCancellationReason(reason);
                booking.setCancelledBy(cancelledBy);

                Booking savedBooking = bookingRepository.save(booking);
                log.info("Booking {} cancelled", savedBooking.getBookingCode());

                // Push SSE event for real-time sync
                pushBookingUpdateToUsers(savedBooking, "CANCELLED");

                return mapToResponse(savedBooking);
        }

        // ========== HELPER METHODS ==========

        /**
         * Map Booking entity to BookingResponse DTO
         */
        private BookingResponse mapToResponse(Booking booking) {
                Pet pet = booking.getPet();
                User owner = booking.getPetOwner();
                Clinic clinic = booking.getClinic();
                User vet = booking.getAssignedVet();

                // Calculate pet age
                String petAge = "N/A";
                if (pet.getDateOfBirth() != null) {
                        Period age = Period.between(pet.getDateOfBirth(), LocalDate.now());
                        petAge = age.getYears() > 0
                                        ? age.getYears() + " tuổi"
                                        : age.getMonths() + " tháng";
                }

                // Map services with assigned vet info and calculate scheduled times
                // Use slotsRequired * 30 minutes (slot duration) for consistency with schedule
                LocalTime currentTime = booking.getBookingTime();
                List<BookingResponse.BookingServiceItemResponse> serviceResponses = new java.util.ArrayList<>();

                for (BookingServiceItem item : booking.getBookingServices()) {
                        User itemVet = item.getAssignedVet();
                        int durationMinutes = item.getService().getDurationTime() != null
                                        ? item.getService().getDurationTime()
                                        : 30; // Default 30 minutes

                        // Calculate slots from duration: ceil(duration / 30)
                        // This ensures consistency with slot reservation logic
                        int slotsRequired = (int) Math.ceil(durationMinutes / 30.0);
                        int slotDurationMinutes = slotsRequired * 30; // Each slot is 30 min

                        LocalTime startTime = currentTime;
                        LocalTime endTime = currentTime.plusMinutes(slotDurationMinutes);

                        serviceResponses.add(BookingResponse.BookingServiceItemResponse.builder()
                                        .bookingServiceId(item.getBookingServiceId()) // BookingServiceItem ID
                                        .serviceId(item.getService().getServiceId())
                                        .serviceName(item.getService().getName())
                                        .serviceCategory(item.getService().getServiceCategory() != null
                                                        ? item.getService().getServiceCategory().name()
                                                        : null)
                                        .price(item.getUnitPrice())
                                        .slotsRequired(slotsRequired)
                                        .durationMinutes(durationMinutes)
                                        // Pricing breakdown fields
                                        .basePrice(item.getBasePrice())
                                        .weightPrice(item.getWeightPrice())
                                        // Vet info for this specific service
                                        .assignedVetId(itemVet != null ? itemVet.getUserId() : null)
                                        .assignedVetName(itemVet != null ? itemVet.getFullName() : null)
                                        .assignedVetAvatarUrl(itemVet != null ? itemVet.getAvatar() : null)
                                        .assignedVetSpecialty(itemVet != null && itemVet.getSpecialty() != null
                                                        ? itemVet.getSpecialty().name()
                                                        : null)
                                        // Scheduled time (based on slot allocation, not service duration)
                                        .scheduledStartTime(startTime)
                                        .scheduledEndTime(endTime)
                                        .build());

                        // Move to next time slot
                        currentTime = endTime;
                }

                return BookingResponse.builder()
                                .bookingId(booking.getBookingId())
                                .bookingCode(booking.getBookingCode())
                                // Pet info
                                .petId(pet.getId())
                                .petName(pet.getName())
                                .petSpecies(pet.getSpecies())
                                .petBreed(pet.getBreed())
                                .petAge(petAge)
                                .petPhotoUrl(pet.getImageUrl())
                                .petWeight(pet.getWeight())
                                // Owner info
                                .ownerId(owner.getUserId())
                                .ownerName(owner.getFullName())
                                .ownerPhone(owner.getPhone())
                                .ownerEmail(owner.getEmail())
                                .ownerAvatarUrl(owner.getAvatar())
                                .ownerAddress(owner.getAddress())
                                // Clinic info
                                .clinicId(clinic.getClinicId())
                                .clinicName(clinic.getName())
                                .clinicAddress(clinic.getAddress())
                                // Vet info
                                .assignedVetId(vet != null ? vet.getUserId() : null)
                                .assignedVetName(vet != null ? vet.getFullName() : null)
                                .assignedVetSpecialty(
                                                vet != null && vet.getSpecialty() != null ? vet.getSpecialty().name()
                                                                : null)
                                .assignedVetAvatarUrl(vet != null ? vet.getAvatar() : null)
                                // Payment info
                                .paymentStatus(booking.getPayment() != null
                                                ? booking.getPayment().getStatus().name()
                                                : "PENDING")
                                .paymentMethod(booking.getPayment() != null && booking.getPayment().getMethod() != null
                                                ? booking.getPayment().getMethod().name()
                                                : null)
                                // Booking info
                                .bookingDate(booking.getBookingDate())
                                .bookingTime(booking.getBookingTime())
                                .type(booking.getType())
                                .status(booking.getStatus())
                                .totalPrice(booking.getTotalPrice())
                                .notes(booking.getNotes())
                                .services(serviceResponses)
                                // Home visit info
                                .homeAddress(booking.getHomeAddress())
                                .homeLat(booking.getHomeLat())
                                .homeLong(booking.getHomeLong())
                                .distanceKm(booking.getDistanceKm())
                                .distanceFee(booking.getDistanceFee())
                                // Timestamps
                                .createdAt(booking.getCreatedAt())
                                .build();
        }

        // ========== VET AVAILABILITY CHECK ==========

        /**
         * Check vet availability for a booking before confirmation
         * Returns detailed info about which services have available vets
         * and suggests alternative time slots if needed
         *
         * @param bookingId Booking ID to check
         * @return VetAvailabilityCheckResponse with availability details
         */
        @Transactional(readOnly = true)
        public VetAvailabilityCheckResponse checkVetAvailability(UUID bookingId) {
                log.info("Checking vet availability for booking {}", bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found: " + bookingId));

                if (booking.getStatus() != BookingStatus.PENDING) {
                        throw new IllegalStateException("Chỉ có thể kiểm tra availability cho booking PENDING");
                }

                return vetAssignmentService.checkVetAvailabilityForBooking(booking);
        }

        /**
         * Get available vets for manual selection when confirming a booking
         *
         * @param bookingId Booking ID to get available vets for
         * @return List of VetOptionDTO with availability and workload info
         */
        @Transactional(readOnly = true)
        public List<VetOptionDTO> getAvailableVetsForConfirm(UUID bookingId) {
                log.info("Getting available vets for confirm: booking {}", bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found: " + bookingId));

                if (booking.getStatus() != BookingStatus.PENDING) {
                        throw new IllegalStateException("Chỉ có thể lấy danh sách bác sĩ cho booking PENDING");
                }

                return vetAssignmentService.getAvailableVetsForBookingConfirm(booking);
        }

        // ========== VET REASSIGNMENT ==========

        /**
         * Get available vets for reassigning a specific service
         *
         * @param bookingId Booking ID
         * @param serviceId BookingServiceItem ID
         * @return List of available vets with their status
         */
        @Transactional(readOnly = true)
        public List<AvailableVetResponse> getAvailableVetsForReassign(UUID bookingId, UUID serviceId) {
                log.info("Getting available vets for reassign: booking={}, service={}", bookingId, serviceId);

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

                // Get currently assigned vet ID to exclude from list
                UUID currentVetId = serviceItem.getAssignedVet() != null
                                ? serviceItem.getAssignedVet().getUserId()
                                : null;

                return vetAssignmentService.getAvailableVetsForReassign(
                                booking.getClinic().getClinicId(),
                                booking.getBookingDate(),
                                startTime,
                                requiredSpecialty,
                                slotsNeeded,
                                currentVetId);
        }

        /**
         * Reassign vet for a specific service
         *
         * @param bookingId Booking ID
         * @param serviceId BookingServiceItem ID
         * @param newVetId  New vet ID to assign
         * @return Updated booking response
         */
        @Transactional
        public BookingResponse reassignVetForService(UUID bookingId, UUID serviceId, UUID newVetId) {
                log.info("Reassigning vet for booking={}, service={}, newVet={}", bookingId, serviceId, newVetId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found: " + bookingId));

                // SAVE old vet BEFORE reassigning
                BookingServiceItem serviceItem = booking.getBookingServices().stream()
                                .filter(s -> s.getBookingServiceId().equals(serviceId))
                                .findFirst()
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Service not found in booking: " + serviceId));

                User oldVet = serviceItem.getAssignedVet();
                UUID oldVetId = oldVet != null ? oldVet.getUserId() : null;
                String serviceName = serviceItem.getService().getName();

                log.info("Old vet for service {}: {}", serviceId, oldVetId);

                // Perform the reassignment (this will replace oldVet with newVet)
                vetAssignmentService.reassignVetForService(serviceId, newVetId, bookingServiceItemRepository);

                // Refresh booking from DB
                booking = bookingRepository.findById(bookingId).orElseThrow();

                // Get new vet for notification
                User newVet = userRepository.findById(newVetId)
                                .orElseThrow(() -> new ResourceNotFoundException("Vet not found: " + newVetId));

                // Send in-app notification + FCM push to both vets
                notificationService.sendVetReassignedNotification(booking, newVet, oldVet, serviceName);

                // Push SSE event to BOTH old and new vet for real-time sync
                pushBookingUpdateToVets(booking, "VET_REASSIGNED", oldVetId, newVetId);

                return mapToResponse(booking);
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
         * Used when vet wants to add extra services during home visit
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
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

                // Validate status - only allow for active bookings
                if (booking.getStatus() != BookingStatus.IN_PROGRESS
                                && booking.getStatus() != BookingStatus.ARRIVED) {
                        throw new IllegalStateException(
                                        "Chỉ có thể thêm dịch vụ khi booking đang ở trạng thái ARRIVED hoặc IN_PROGRESS");
                }

                // Fetch service
                com.petties.petties.model.ClinicService service = clinicServiceRepository.findById(serviceId)
                                .orElseThrow(() -> new ResourceNotFoundException("Service not found"));

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

                // ============ SPECIALTY VALIDATION FOR HOME_VISIT VET ============
                // If booking is HOME_VISIT and current user is VET,
                // they can only add services within their specialty
                if (booking.getType() == com.petties.petties.model.enums.BookingType.HOME_VISIT
                                && currentUser.getRole() == com.petties.petties.model.enums.Role.VET) {

                        StaffSpecialty vetSpecialty = currentUser.getSpecialty();
                        StaffSpecialty requiredSpecialty = service.getServiceCategory() != null
                                        ? service.getServiceCategory().getRequiredSpecialty()
                                        : StaffSpecialty.VET_GENERAL;

                        // VET_GENERAL can do any service, but specialized vets must match
                        boolean isSpecialtyMatch = vetSpecialty == StaffSpecialty.VET_GENERAL
                                        || vetSpecialty == requiredSpecialty;

                        if (!isSpecialtyMatch) {
                                log.warn("Vet {} with specialty {} cannot add service {} requiring specialty {}",
                                                currentUser.getUserId(), vetSpecialty, service.getName(),
                                                requiredSpecialty);
                                throw new IllegalArgumentException(
                                                String.format("Bạn không thể thêm dịch vụ này vì nằm ngoài chuyên môn của bạn. "
                                                                +
                                                                "Chuyên môn của bạn: %s, Dịch vụ yêu cầu: %s",
                                                                vetSpecialty, requiredSpecialty));
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
                                .assignedVet(booking.getAssignedVet()) // Same vet as booking
                                .build();

                booking.getBookingServices().add(newItem);

                // Update total price (add new service price, NO additional distance fee)
                BigDecimal newTotal = booking.getTotalPrice().add(weightPrice);
                booking.setTotalPrice(newTotal);

                bookingRepository.save(booking);

                log.info("Added service '{}' to booking {}. New total: {} (added: {})",
                                service.getName(), booking.getBookingCode(), newTotal, weightPrice);

                // Push SSE event for real-time sync
                pushBookingUpdateToUsers(booking, "SERVICE_ADDED");

                return mapToResponse(booking);
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
        public List<com.petties.petties.dto.clinicService.ClinicServiceResponse> getAvailableServicesForAddOn(
                        UUID bookingId, User currentUser) {
                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

                // Get all active services for the clinic
                List<com.petties.petties.model.ClinicService> allActiveServices = clinicServiceRepository
                                .findByClinicClinicIdAndIsActiveTrue(booking.getClinic().getClinicId());

                // IDs of services already in the booking
                Set<UUID> existingServiceIds = booking.getBookingServices().stream()
                                .map(item -> item.getService().getServiceId())
                                .collect(Collectors.toSet());

                // Filter and Map
                return allActiveServices.stream()
                                .filter(service -> !existingServiceIds.contains(service.getServiceId()))
                                .filter(service -> {
                                        // Specialty filtering for Vets in Home Visit
                                        if (booking.getType() == com.petties.petties.model.enums.BookingType.HOME_VISIT
                                                        && currentUser.getRole() == com.petties.petties.model.enums.Role.VET) {

                                                StaffSpecialty vetSpecialty = currentUser.getSpecialty();
                                                StaffSpecialty requiredSpecialty = service.getServiceCategory() != null
                                                                ? service.getServiceCategory().getRequiredSpecialty()
                                                                : StaffSpecialty.VET_GENERAL;

                                                return vetSpecialty == StaffSpecialty.VET_GENERAL
                                                                || vetSpecialty == requiredSpecialty;
                                        }
                                        return true; // Managers or In-Clinic bookings see all
                                })
                                .map(this::mapServiceToResponse)
                                .collect(Collectors.toList());
        }

        private com.petties.petties.dto.clinicService.ClinicServiceResponse mapServiceToResponse(
                        com.petties.petties.model.ClinicService service) {
                return com.petties.petties.dto.clinicService.ClinicServiceResponse.builder()
                                .serviceId(service.getServiceId())
                                .name(service.getName())
                                .description(service.getDescription())
                                .basePrice(service.getBasePrice())
                                .durationTime(service.getDurationTime())
                                .slotsRequired(service.getSlotsRequired())
                                .serviceCategory(service.getServiceCategory())
                                .isHomeVisit(service.getIsHomeVisit())
                                .pricePerKm(service.getPricePerKm())
                                .isActive(service.getIsActive())
                                .build();
        }

        // ========== SMART AVAILABILITY ==========

        /**
         * Get available time slots for booking
         * Delegates to VetAssignmentService for Smart Availability algorithm
         * 
         * @param clinicId   Clinic ID
         * @param date       Booking date
         * @param serviceIds List of service IDs
         * @return Available slots response with start times
         */
        public AvailableSlotsResponse getAvailableSlots(
                        UUID clinicId, LocalDate date, List<UUID> serviceIds) {

                log.info("Getting available slots for clinic {}, date {}, services {}", clinicId, date, serviceIds);

                // Delegate to VetAssignmentService for Smart Availability algorithm
                List<LocalTime> availableStartTimes = vetAssignmentService.findAvailableSlots(clinicId, date,
                                serviceIds);

                return AvailableSlotsResponse.builder()
                                .availableSlots(availableStartTimes)
                                .totalSlots(availableStartTimes.size())
                                .build();
        }

        // ========== STATUS TRANSITIONS ==========

        /**
         * Check-in booking (Vet action)
         * Transitions: ASSIGNED → IN_PROGRESS
         * 
         * @param bookingId Booking ID
         * @return Updated booking response
         */
        @Transactional
        public BookingResponse checkIn(UUID bookingId) {
                log.info("Check-in booking {}", bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

                // Validate status
                if (booking.getStatus() != BookingStatus.ASSIGNED) {
                        throw new IllegalStateException(
                                        "Chỉ có thể check-in khi booking ở trạng thái ASSIGNED. Trạng thái hiện tại: "
                                                        + booking.getStatus());
                }

                // Update status to IN_PROGRESS
                booking.setStatus(BookingStatus.IN_PROGRESS);
                bookingRepository.save(booking);

                log.info("Booking {} checked in successfully. Status: IN_PROGRESS", booking.getBookingCode());

                // Push SSE event for real-time sync
                pushBookingUpdateToUsers(booking, "CHECK_IN");

                // Notify pet owner
                try {
                        notificationService.sendCheckinNotification(booking);
                } catch (Exception e) {
                        log.warn("Failed to send check-in notification: {}", e.getMessage());
                }

                return mapToResponse(booking);
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
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

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
                pushBookingUpdateToUsers(booking, "COMPLETED");

                // Notify pet owner
                try {
                        notificationService.sendCompletedNotification(booking);
                } catch (Exception e) {
                        log.warn("Failed to send completed notification: {}", e.getMessage());
                }

                return mapToResponse(booking);
        }

        /**
         * Notify pet owner that vet is on the way (Manager action)
         * Does NOT change booking status - just sends notification
         * 
         * @param bookingId Booking ID
         * @return Booking response
         */
        @Transactional(readOnly = true)
        public BookingResponse notifyOnWay(UUID bookingId) {
                log.info("Sending 'vet on the way' notification for booking {}", bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

                // Validate status - should be ASSIGNED (vet assigned but not yet started)
                if (booking.getStatus() != BookingStatus.ASSIGNED) {
                        throw new IllegalStateException(
                                        "Chỉ có thể gửi thông báo khi booking ở trạng thái ASSIGNED. Trạng thái hiện tại: "
                                                        + booking.getStatus());
                }

                // Validate booking type - only for HOME_VISIT or SOS
                if (booking.getType() != com.petties.petties.model.enums.BookingType.HOME_VISIT
                                && booking.getType() != com.petties.petties.model.enums.BookingType.SOS) {
                        throw new IllegalStateException("Chỉ áp dụng cho lịch hẹn tại nhà hoặc SOS");
                }

                // Send notification
                try {
                        notificationService.sendVetOnWayNotification(booking);
                        log.info("Sent 'vet on the way' notification for booking {}", booking.getBookingCode());
                } catch (Exception e) {
                        log.error("Failed to send 'vet on the way' notification: {}", e.getMessage());
                        throw new RuntimeException("Không thể gửi thông báo: " + e.getMessage());
                }

                return mapToResponse(booking);
        }

        // ========== PRIVATE HELPER METHODS ==========

        /**
         * Push SSE event when reassigning vet
         * Notifies BOTH old vet (to remove from schedule) and new vet (to add to
         * schedule)
         *
         * @param booking  The updated booking
         * @param action   Action type (VET_REASSIGNED)
         * @param oldVetId Old vet ID (who is being removed from booking)
         * @param newVetId New vet ID (who is being assigned)
         */
        private void pushBookingUpdateToVets(Booking booking, String action, UUID oldVetId, UUID newVetId) {
                try {
                        java.util.Map<String, Object> eventData = new java.util.HashMap<>();
                        eventData.put("bookingId", booking.getBookingId().toString());
                        eventData.put("bookingCode", booking.getBookingCode());
                        eventData.put("action", action);
                        eventData.put("status", booking.getStatus().name());
                        eventData.put("oldVetId", oldVetId != null ? oldVetId.toString() : "");
                        eventData.put("newVetId", newVetId != null ? newVetId.toString() : "");

                        SseEventDto event = SseEventDto.bookingUpdate(eventData);

                        // Push to OLD vet (so they can remove from their schedule)
                        if (oldVetId != null) {
                                sseEmitterService.pushToUser(oldVetId, event);
                                log.debug("Pushed BOOKING_UPDATE to OLD vet: {}", oldVetId);
                        }

                        // Push to NEW vet (so they can add to their schedule)
                        if (newVetId != null) {
                                sseEmitterService.pushToUser(newVetId, event);
                                log.debug("Pushed BOOKING_UPDATE to NEW vet: {}", newVetId);
                        }

                        // Push to all managers of the clinic
                        List<User> managers = userRepository.findByWorkingClinicIdAndRole(
                                        booking.getClinic().getClinicId(), Role.CLINIC_MANAGER);
                        for (User manager : managers) {
                                sseEmitterService.pushToUser(manager.getUserId(), event);
                                log.debug("Pushed BOOKING_UPDATE to manager: {}", manager.getUserId());
                        }

                        log.info("VET_REASSIGN event pushed for booking {}: oldVet={}, newVet={}",
                                        booking.getBookingCode(), oldVetId, newVetId);
                } catch (Exception e) {
                        log.warn("Failed to push SSE event for vet reassign {}: {}",
                                        booking.getBookingCode(), e.getMessage());
                }
        }

        /**
         * Push SSE event to all relevant users when booking changes
         * - Assigned vet (if any)
         * - All managers of the clinic
         *
         * @param booking The updated booking
         * @param action  Action type: ASSIGNED, STATUS_CHANGED, CANCELLED, etc.
         */
        private void pushBookingUpdateToUsers(Booking booking, String action) {
                try {
                        java.util.Map<String, Object> eventData = java.util.Map.of(
                                        "bookingId", booking.getBookingId().toString(),
                                        "bookingCode", booking.getBookingCode(),
                                        "action", action,
                                        "status", booking.getStatus().name());

                        SseEventDto event = SseEventDto.bookingUpdate(eventData);

                        // Push to assigned vet
                        if (booking.getAssignedVet() != null) {
                                sseEmitterService.pushToUser(booking.getAssignedVet().getUserId(), event);
                                log.debug("Pushed BOOKING_UPDATE to vet: {}", booking.getAssignedVet().getUserId());
                        }

                        // Push to all managers of the clinic
                        List<User> managers = userRepository.findByWorkingClinicIdAndRole(
                                        booking.getClinic().getClinicId(), Role.CLINIC_MANAGER);
                        for (User manager : managers) {
                                sseEmitterService.pushToUser(manager.getUserId(), event);
                                log.debug("Pushed BOOKING_UPDATE to manager: {}", manager.getUserId());
                        }

                        log.info("BOOKING_UPDATE event pushed for booking {} action {}", booking.getBookingCode(),
                                        action);
                } catch (Exception e) {
                        log.warn("Failed to push SSE event for booking {}: {}", booking.getBookingCode(),
                                        e.getMessage());
                }
        }

        // ========== VET HOME SUMMARY ==========

        /**
         * Get vet home screen summary - optimized single API call for mobile
         * Returns: today's booking count, pending count, in-progress count, and
         * upcoming bookings
         *
         * @param vetId Vet user ID
         * @return VetHomeSummaryResponse with aggregated data
         */
        @Transactional(readOnly = true)
        public VetHomeSummaryResponse getVetHomeSummary(UUID vetId) {
                log.info("Getting home summary for vet {}", vetId);

                try {
                        LocalDate today = LocalDate.now();

                        // Get all bookings assigned to this vet for today
                        List<Booking> todayBookings = bookingRepository.findByAssignedVetIdAndBookingDate(vetId, today);

                        // Get upcoming bookings (today and next 7 days) with active statuses
                        LocalDate endDate = today.plusDays(7);
                        List<BookingStatus> activeStatuses = List.of(
                                        BookingStatus.CONFIRMED,
                                        BookingStatus.ASSIGNED,
                                        BookingStatus.IN_PROGRESS);
                        List<Booking> upcomingBookings = bookingRepository
                                        .findByAssignedVetIdAndBookingDateBetweenAndStatusIn(
                                                        vetId, today, endDate, activeStatuses);

                        // Calculate stats for today
                        int todayCount = todayBookings != null ? todayBookings.size() : 0;
                        int pendingCount = todayBookings != null ? (int) todayBookings.stream()
                                        .filter(b -> b.getStatus() == BookingStatus.CONFIRMED
                                                        || b.getStatus() == BookingStatus.ASSIGNED)
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
                                                .map(this::mapToUpcomingDTO)
                                                .collect(Collectors.toList());
                        }

                        return VetHomeSummaryResponse.builder()
                                        .todayBookingsCount(todayCount)
                                        .pendingCount(pendingCount)
                                        .inProgressCount(inProgressCount)
                                        .upcomingBookings(upcomingDTOs)
                                        .build();
                } catch (Exception e) {
                        log.error("Error getting vet home summary for vet {}: {}", vetId, e.getMessage(), e);
                        throw e;
                }
        }

        /**
         * Map Booking entity to UpcomingBookingDTO for home screen display
         * Note: bookingServices may not be fetched, so we use default values
         */
        private UpcomingBookingDTO mapToUpcomingDTO(Booking booking) {
                Pet pet = booking.getPet();
                User owner = booking.getPetOwner();

                // Null safety for pet and owner
                String petName = pet != null ? pet.getName() : "N/A";
                String petSpecies = pet != null ? pet.getSpecies() : null;
                String petPhotoUrl = pet != null ? pet.getImageUrl() : null;
                String ownerName = owner != null ? owner.getFullName() : "N/A";
                String ownerPhone = owner != null ? owner.getPhone() : null;

                // Default values for service info (bookingServices not eager-fetched to avoid
                // MultipleBagFetchException)
                int totalMinutes = 30;
                String primaryService = "Dịch vụ khám";
                int servicesCount = 0;

                // Try to get service info if available (within transaction)
                try {
                        List<BookingServiceItem> services = booking.getBookingServices();
                        if (services != null && !services.isEmpty()) {
                                servicesCount = services.size();
                                totalMinutes = services.stream()
                                                .mapToInt(item -> {
                                                        if (item.getService() == null)
                                                                return 30;
                                                        Integer duration = item.getService().getDurationTime();
                                                        return duration != null ? duration : 30;
                                                })
                                                .sum();
                                BookingServiceItem firstItem = services.get(0);
                                if (firstItem.getService() != null && firstItem.getService().getName() != null) {
                                        primaryService = firstItem.getService().getName();
                                }
                        }
                } catch (Exception e) {
                        // LazyInitializationException - use defaults
                        log.debug("Could not load booking services for booking {}, using defaults",
                                        booking.getBookingId());
                }

                LocalTime endTime = booking.getBookingTime().plusMinutes(totalMinutes);

                return UpcomingBookingDTO.builder()
                                .bookingId(booking.getBookingId())
                                .bookingCode(booking.getBookingCode())
                                .petName(petName)
                                .petSpecies(petSpecies)
                                .petPhotoUrl(petPhotoUrl)
                                .ownerName(ownerName)
                                .ownerPhone(ownerPhone)
                                .bookingDate(booking.getBookingDate())
                                .bookingTime(booking.getBookingTime())
                                .endTime(endTime)
                                .type(booking.getType())
                                .status(booking.getStatus())
                                .totalPrice(booking.getTotalPrice())
                                .primaryServiceName(primaryService)
                                .servicesCount(servicesCount)
                                .homeAddress(booking.getHomeAddress())
                                .build();
        }
}
