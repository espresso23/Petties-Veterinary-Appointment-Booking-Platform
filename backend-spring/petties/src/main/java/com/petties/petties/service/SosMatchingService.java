package com.petties.petties.service;

import com.petties.petties.dto.sos.SosConfirmRequest;
import com.petties.petties.dto.sos.SosMatchRequest;
import com.petties.petties.dto.sos.SosMatchResponse;
import com.petties.petties.dto.sos.SosMatchingStatusMessage;
import com.petties.petties.dto.sos.SosMatchingStatusMessage.MatchingEvent;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Booking;
import com.petties.petties.model.BookingServiceItem;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.ClinicPricePerKm;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.ClinicPricePerKmRepository;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.PetRepository;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * SOS Auto-Match Service
 * 
 * Handles automatic matching of SOS emergency requests to nearby clinics.
 * The matching process:
 * 1. Pet Owner sends SOS request with GPS coordinates
 * 2. System finds nearby clinics (sorted by distance)
 * 3. System notifies first clinic and waits for confirmation (60s timeout)
 * 4. If no response or declined, escalate to next clinic
 * 5. If all clinics exhausted, notify user with hotline
 * 
 * Uses Redis for session storage and WebSocket for real-time updates.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SosMatchingService {

        private final BookingRepository bookingRepository;
        private final ClinicRepository clinicRepository;
        private final PetRepository petRepository;
        private final UserRepository userRepository;
        private final ClinicPricePerKmRepository pricePerKmRepository;
        private final NotificationService notificationService;
        private final LocationService locationService;
        private final SimpMessagingTemplate messagingTemplate;
        private final RedisTemplate<String, Object> redisTemplate;

        // Configuration constants
        private static final double SOS_SEARCH_RADIUS_KM = 10.0;
        private static final int MAX_CLINICS_TO_TRY = 5;
        private static final int CLINIC_TIMEOUT_SECONDS = 60;
        private static final String SOS_HOTLINE = "1900-PETTIES";

        // Redis key prefixes
        private static final String REDIS_KEY_PREFIX = "sos:matching:";
        private static final String REDIS_CLINICS_KEY = ":clinics";
        private static final String REDIS_INDEX_KEY = ":index";
        private static final String REDIS_CREATED_AT_KEY = ":createdAt";
        private static final String REDIS_NOTIFIED_AT_KEY = ":notifiedAt";
        private static final String REDIS_LOCK_PREFIX = "sos:lock:user:";

        /**
         * Start SOS matching process
         * Creates a new SOS booking and begins searching for nearby clinics
         */
        @Transactional
        public SosMatchResponse startMatching(SosMatchRequest request, UUID petOwnerId) {
                log.info("Starting SOS matching for pet owner: {}", petOwnerId);

                // 0. Acquire distributed lock to prevent race condition
                String lockKey = REDIS_LOCK_PREFIX + petOwnerId;
                Boolean lockAcquired = redisTemplate.opsForValue().setIfAbsent(lockKey, "LOCKED", 30, TimeUnit.SECONDS);

                if (!Boolean.TRUE.equals(lockAcquired)) {
                        log.warn("Failed to acquire lock for pet owner {}, request already in progress", petOwnerId);
                        throw new BadRequestException("Yêu cầu SOS đang được xử lý. Vui lòng đợi giây lát.");
                }

                try {
                        // 1. Check if user already has an active SOS booking (within lock)
                        List<Booking> activeBookings = bookingRepository.findActiveSosBookingsByPetOwner(petOwnerId);
                        if (!activeBookings.isEmpty()) {
                                Booking existingBooking = activeBookings.get(0);
                                log.warn("Pet owner {} already has active SOS booking: {}", petOwnerId,
                                                existingBooking.getBookingId());
                                throw new BadRequestException("Bạn đã có một yêu cầu SOS đang hoạt động. " +
                                                "Vui lòng đợi hoặc hủy yêu cầu cũ trước khi tạo mới. " +
                                                "Mã booking: " + existingBooking.getBookingCode());
                        }

                        // 2. Validate pet ownership
                        Pet pet = petRepository.findById(request.getPetId())
                                        .orElseThrow(() -> new ResourceNotFoundException("Pet not found"));

                        if (!pet.getUser().getUserId().equals(petOwnerId)) {
                                throw new BadRequestException("You don't own this pet");
                        }

                        // 3. Find nearby clinics
                        List<Clinic> nearbyClinics = clinicRepository.findNearbyClinics(
                                        request.getLatitude(),
                                        request.getLongitude(),
                                        SOS_SEARCH_RADIUS_KM);

                        if (nearbyClinics.isEmpty()) {
                                return buildNoClinicResponse(null);
                        }

                        // 4. Create SOS booking with SEARCHING status
                        Booking booking = createSosBooking(pet, request, petOwnerId);

                        // 5. Store matching session in Redis
                        storeMatchingSession(booking.getBookingId(), nearbyClinics);

                        // 6. Notify first clinic and update notifiedAt timestamp
                        notifyClinic(booking, nearbyClinics.get(0), 0, nearbyClinics.size());
                        updateClinicNotifiedAt(booking.getBookingId());

                        // 7. Update booking status to PENDING_CLINIC_CONFIRM
                        booking.setStatus(BookingStatus.PENDING_CLINIC_CONFIRM);
                        bookingRepository.save(booking);

                        // 8. Broadcast status to Pet Owner
                        broadcastStatus(booking.getBookingId(), SosMatchingStatusMessage.builder()
                                        .bookingId(booking.getBookingId())
                                        .bookingStatus(BookingStatus.PENDING_CLINIC_CONFIRM)
                                        .event(MatchingEvent.CLINIC_NOTIFIED)
                                        .message("Đang chờ phòng khám " + nearbyClinics.get(0).getName() + " xác nhận")
                                        .currentClinicIndex(1)
                                        .totalClinicsInRange(Math.min(nearbyClinics.size(), MAX_CLINICS_TO_TRY))
                                        .clinicName(nearbyClinics.get(0).getName())
                                        .distanceKm(calculateDistance(request, nearbyClinics.get(0)))
                                        .remainingSeconds((long) CLINIC_TIMEOUT_SECONDS)
                                        .build());

                        return buildMatchingStartedResponse(booking, nearbyClinics.get(0), request);
                } finally {
                        // Always release the lock
                        redisTemplate.delete(lockKey);
                        log.debug("Released SOS lock for pet owner: {}", petOwnerId);
                }
        }

        /**
         * Process clinic confirmation or decline
         */
        @Transactional
        public SosMatchResponse processConfirmation(SosConfirmRequest request, UUID clinicManagerId) {
                log.info("Processing SOS confirmation for booking: {}", request.getBookingId());

                Booking booking = bookingRepository.findById(request.getBookingId())
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

                if (booking.getStatus() != BookingStatus.PENDING_CLINIC_CONFIRM) {
                        throw new BadRequestException("Booking is not awaiting confirmation");
                }

                // Verify clinic manager has access
                User manager = userRepository.findById(clinicManagerId)
                                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

                if (manager.getRole() != Role.CLINIC_MANAGER) {
                        throw new BadRequestException("Only clinic managers can confirm SOS requests");
                }

                if (request.isAccepted()) {
                        return confirmSos(booking, manager, request.getAssignedStaffId());
                } else {
                        return declineSos(booking, request.getDeclineReason());
                }
        }

        /**
         * Confirm SOS - Clinic accepts the request
         */
        private SosMatchResponse confirmSos(Booking booking, User manager, UUID assignedStaffId) {
                Clinic clinic = manager.getWorkingClinic();
                if (clinic == null) {
                        throw new BadRequestException("Manager is not assigned to any clinic");
                }

                // Update booking
                booking.setClinic(clinic);
                booking.setStatus(BookingStatus.CONFIRMED);
                booking.setConfirmedAt(LocalDateTime.now());

                // Assign staff if provided
                if (assignedStaffId != null) {
                        User staff = userRepository.findById(assignedStaffId)
                                        .orElseThrow(() -> new ResourceNotFoundException("Staff not found"));

                        // For SOS, bypass specialty check - any staff can be assigned
                        for (BookingServiceItem item : booking.getBookingServices()) {
                                item.setAssignedStaff(staff);
                        }
                }

                bookingRepository.save(booking);

                // Clear Redis session
                clearMatchingSession(booking.getBookingId());

                // Broadcast confirmation to Pet Owner
                broadcastStatus(booking.getBookingId(), SosMatchingStatusMessage.builder()
                                .bookingId(booking.getBookingId())
                                .bookingStatus(BookingStatus.CONFIRMED)
                                .event(MatchingEvent.CONFIRMED)
                                .message("Phòng khám " + clinic.getName() + " đã xác nhận yêu cầu cấp cứu")
                                .clinicId(clinic.getClinicId())
                                .clinicName(clinic.getName())
                                .clinicPhone(clinic.getPhone())
                                .build());

                return SosMatchResponse.builder()
                                .bookingId(booking.getBookingId())
                                .status(BookingStatus.CONFIRMED)
                                .message("Đã xác nhận! Phòng khám sẽ liên hệ với bạn ngay.")
                                .clinicId(clinic.getClinicId())
                                .clinicName(clinic.getName())
                                .clinicPhone(clinic.getPhone())
                                .clinicAddress(clinic.getAddress())
                                .build();
        }

        /**
         * Decline SOS - Clinic declines, escalate to next
         */
        private SosMatchResponse declineSos(Booking booking, String reason) {
                log.info("Clinic declined SOS booking: {}, reason: {}", booking.getBookingId(), reason);
                return escalateToNextClinic(booking.getBookingId());
        }

        /**
         * Escalate to next clinic when current one times out or declines
         * Called by scheduled job or decline handler
         */
        @Transactional
        public SosMatchResponse escalateToNextClinic(UUID bookingId) {
                log.info("Escalating SOS to next clinic for booking: {}", bookingId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

                if (booking.getStatus() != BookingStatus.PENDING_CLINIC_CONFIRM
                                && booking.getStatus() != BookingStatus.SEARCHING) {
                        log.warn("Booking {} is not in escalation-eligible status: {}", bookingId, booking.getStatus());
                        return null;
                }

                // Get current index and clinics from Redis
                Integer currentIndex = (Integer) redisTemplate.opsForValue()
                                .get(REDIS_KEY_PREFIX + bookingId + REDIS_INDEX_KEY);

                @SuppressWarnings("unchecked")
                List<String> clinicIds = (List<String>) redisTemplate.opsForValue()
                                .get(REDIS_KEY_PREFIX + bookingId + REDIS_CLINICS_KEY);

                if (currentIndex == null || clinicIds == null) {
                        log.error("Redis session not found for booking: {}", bookingId);
                        return buildNoClinicResponse(bookingId);
                }

                int nextIndex = currentIndex + 1;

                // Check if we've exhausted all clinics
                if (nextIndex >= clinicIds.size() || nextIndex >= MAX_CLINICS_TO_TRY) {
                        return handleNoClinicAvailable(booking);
                }

                // Get next clinic
                UUID nextClinicId = UUID.fromString(clinicIds.get(nextIndex));
                Clinic nextClinic = clinicRepository.findById(nextClinicId)
                                .orElse(null);

                if (nextClinic == null) {
                        // Skip to next if clinic not found
                        redisTemplate.opsForValue().set(
                                        REDIS_KEY_PREFIX + bookingId + REDIS_INDEX_KEY,
                                        nextIndex,
                                        CLINIC_TIMEOUT_SECONDS * 2,
                                        TimeUnit.SECONDS);
                        return escalateToNextClinic(bookingId);
                }

                // Update Redis index
                redisTemplate.opsForValue().set(
                                REDIS_KEY_PREFIX + bookingId + REDIS_INDEX_KEY,
                                nextIndex,
                                CLINIC_TIMEOUT_SECONDS * 2,
                                TimeUnit.SECONDS);

                // Notify next clinic and reset notifiedAt for new timeout calculation
                notifyClinic(booking, nextClinic, nextIndex, Math.min(clinicIds.size(), MAX_CLINICS_TO_TRY));
                updateClinicNotifiedAt(bookingId);

                // Broadcast status to Pet Owner
                broadcastStatus(bookingId, SosMatchingStatusMessage.builder()
                                .bookingId(bookingId)
                                .bookingStatus(BookingStatus.PENDING_CLINIC_CONFIRM)
                                .event(MatchingEvent.WAITING_NEXT)
                                .message("Đang liên hệ phòng khám " + nextClinic.getName())
                                .currentClinicIndex(nextIndex + 1)
                                .totalClinicsInRange(Math.min(clinicIds.size(), MAX_CLINICS_TO_TRY))
                                .clinicName(nextClinic.getName())
                                .remainingSeconds((long) CLINIC_TIMEOUT_SECONDS)
                                .build());

                return SosMatchResponse.builder()
                                .bookingId(bookingId)
                                .status(BookingStatus.PENDING_CLINIC_CONFIRM)
                                .message("Đang liên hệ phòng khám tiếp theo...")
                                .clinicId(nextClinic.getClinicId())
                                .clinicName(nextClinic.getName())
                                .build();
        }

        /**
         * Handle case when no clinic is available
         */
        private SosMatchResponse handleNoClinicAvailable(Booking booking) {
                log.warn("No clinic available for SOS booking: {}", booking.getBookingId());

                booking.setStatus(BookingStatus.CANCELLED);
                booking.setCancellationReason("Không tìm thấy phòng khám khả dụng trong khu vực");
                bookingRepository.save(booking);

                clearMatchingSession(booking.getBookingId());

                // Broadcast NO_CLINIC status
                broadcastStatus(booking.getBookingId(), SosMatchingStatusMessage.builder()
                                .bookingId(booking.getBookingId())
                                .bookingStatus(BookingStatus.CANCELLED)
                                .event(MatchingEvent.NO_CLINIC)
                                .message("Rất tiếc, không có phòng khám nào khả dụng. Vui lòng liên hệ hotline.")
                                .hotlineNumber(SOS_HOTLINE)
                                .build());

                return buildNoClinicResponse(booking.getBookingId());
        }

        /**
         * Check for timed-out SOS bookings
         * Called by scheduled job every 5 seconds
         * Uses notifiedAt (when current clinic was notified) instead of createdAt for
         * accurate timeout
         */
        @Transactional
        public void checkTimeouts() {
                List<Booking> pendingBookings = bookingRepository
                                .findByStatusAndBookingType(BookingStatus.PENDING_CLINIC_CONFIRM, BookingType.SOS);

                for (Booking booking : pendingBookings) {
                        // Use notifiedAt for timeout calculation - this is when current clinic was
                        // notified
                        Long notifiedAt = (Long) redisTemplate.opsForValue()
                                        .get(REDIS_KEY_PREFIX + booking.getBookingId() + REDIS_NOTIFIED_AT_KEY);

                        // Fallback to createdAt for backward compatibility
                        if (notifiedAt == null) {
                                notifiedAt = (Long) redisTemplate.opsForValue()
                                                .get(REDIS_KEY_PREFIX + booking.getBookingId() + REDIS_CREATED_AT_KEY);
                        }

                        if (notifiedAt == null) {
                                continue;
                        }

                        long elapsedSeconds = (System.currentTimeMillis() - notifiedAt) / 1000;
                        Integer currentIndex = (Integer) redisTemplate.opsForValue()
                                        .get(REDIS_KEY_PREFIX + booking.getBookingId() + REDIS_INDEX_KEY);

                        if (currentIndex == null) {
                                continue;
                        }

                        // Each clinic gets CLINIC_TIMEOUT_SECONDS (60s) from when they were notified
                        if (elapsedSeconds >= CLINIC_TIMEOUT_SECONDS) {
                                log.info("SOS booking {} timed out at index {} after {}s, escalating...",
                                                booking.getBookingId(), currentIndex, elapsedSeconds);
                                escalateToNextClinic(booking.getBookingId());
                        }
                }
        }

        /**
         * Get active SOS booking for current user
         * Returns the most recent active SOS booking if exists
         */
        public Optional<Booking> getActiveSosBooking(UUID petOwnerId) {
                List<Booking> activeBookings = bookingRepository.findActiveSosBookingsByPetOwner(petOwnerId);
                return activeBookings.isEmpty() ? Optional.empty() : Optional.of(activeBookings.get(0));
        }

        /**
         * Get current matching status
         */
        public SosMatchResponse getMatchingStatus(UUID bookingId) {
                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

                Integer currentIndex = (Integer) redisTemplate.opsForValue()
                                .get(REDIS_KEY_PREFIX + bookingId + REDIS_INDEX_KEY);

                @SuppressWarnings("unchecked")
                List<String> clinicIds = (List<String>) redisTemplate.opsForValue()
                                .get(REDIS_KEY_PREFIX + bookingId + REDIS_CLINICS_KEY);

                SosMatchResponse.SosMatchResponseBuilder response = SosMatchResponse.builder()
                                .bookingId(bookingId)
                                .status(booking.getStatus())
                                .wsTopicUrl("/topic/sos-matching/" + bookingId);

                if (booking.getClinic() != null) {
                        Clinic clinic = booking.getClinic();
                        response.clinicId(clinic.getClinicId())
                                        .clinicName(clinic.getName())
                                        .clinicPhone(clinic.getPhone())
                                        .clinicAddress(clinic.getAddress());
                }

                if (currentIndex != null && clinicIds != null && currentIndex < clinicIds.size()) {
                        UUID currentClinicId = UUID.fromString(clinicIds.get(currentIndex));
                        clinicRepository.findById(currentClinicId).ifPresent(clinic -> {
                                response.clinicName(clinic.getName());
                        });
                }

                return response.build();
        }

        /**
         * Cancel SOS matching (Pet Owner only, before confirmation)
         */
        @Transactional
        public void cancelMatching(UUID bookingId, UUID petOwnerId) {
                log.info("Cancelling SOS matching for booking: {} by user: {}", bookingId, petOwnerId);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

                // Validate ownership
                if (!booking.getPetOwner().getUserId().equals(petOwnerId)) {
                        throw new BadRequestException("You don't have permission to cancel this booking");
                }

                // Can only cancel if still searching or pending clinic confirmation
                if (booking.getStatus() != BookingStatus.SEARCHING
                                && booking.getStatus() != BookingStatus.PENDING_CLINIC_CONFIRM) {
                        throw new BadRequestException("Cannot cancel booking in status: " + booking.getStatus());
                }

                // Update booking
                booking.setStatus(BookingStatus.CANCELLED);
                booking.setCancellationReason("Hủy bởi người dùng");
                bookingRepository.save(booking);

                // Clear Redis session
                clearMatchingSession(bookingId);

                // Broadcast status to Pet Owner
                broadcastStatus(bookingId, SosMatchingStatusMessage.builder()
                                .bookingId(bookingId)
                                .bookingStatus(BookingStatus.CANCELLED)
                                .event(MatchingEvent.CANCELLED)
                                .message("Bạn đã hủy yêu cầu cấp cứu.")
                                .build());
        }

        // ========== Helper Methods ==========

        private Booking createSosBooking(Pet pet, SosMatchRequest request, UUID petOwnerId) {
                User petOwner = userRepository.findById(petOwnerId)
                                .orElseThrow(() -> new ResourceNotFoundException("Pet owner not found"));

                Booking booking = new Booking();
                booking.setPet(pet);
                booking.setPetOwner(petOwner);
                booking.setType(BookingType.SOS);
                booking.setStatus(BookingStatus.SEARCHING);
                booking.setBookingDate(LocalDateTime.now().toLocalDate());
                booking.setBookingTime(LocalDateTime.now().toLocalTime());
                booking.setNotes(request.getNotes());
                booking.setSymptoms(request.getSymptoms());
                booking.setHomeLat(request.getLatitude());
                booking.setHomeLong(request.getLongitude());
                booking.setTotalPrice(BigDecimal.ZERO); // Will be calculated later

                // Generate unique booking code with retry logic
                String bookingCode = generateUniqueBookingCode();
                booking.setBookingCode(bookingCode);

                return bookingRepository.save(booking);
        }

        private void storeMatchingSession(UUID bookingId, List<Clinic> clinics) {
                List<String> clinicIds = clinics.stream()
                                .map(c -> c.getClinicId().toString())
                                .limit(MAX_CLINICS_TO_TRY)
                                .toList();

                // Store with TTL = timeout * max clinics + buffer
                long ttlSeconds = CLINIC_TIMEOUT_SECONDS * MAX_CLINICS_TO_TRY + 60;

                redisTemplate.opsForValue().set(
                                REDIS_KEY_PREFIX + bookingId + REDIS_CLINICS_KEY,
                                clinicIds,
                                ttlSeconds,
                                TimeUnit.SECONDS);

                redisTemplate.opsForValue().set(
                                REDIS_KEY_PREFIX + bookingId + REDIS_INDEX_KEY,
                                0,
                                ttlSeconds,
                                TimeUnit.SECONDS);

                redisTemplate.opsForValue().set(
                                REDIS_KEY_PREFIX + bookingId + REDIS_CREATED_AT_KEY,
                                System.currentTimeMillis(),
                                ttlSeconds,
                                TimeUnit.SECONDS);
        }

        private void clearMatchingSession(UUID bookingId) {
                redisTemplate.delete(REDIS_KEY_PREFIX + bookingId + REDIS_CLINICS_KEY);
                redisTemplate.delete(REDIS_KEY_PREFIX + bookingId + REDIS_INDEX_KEY);
                redisTemplate.delete(REDIS_KEY_PREFIX + bookingId + REDIS_CREATED_AT_KEY);
                redisTemplate.delete(REDIS_KEY_PREFIX + bookingId + REDIS_NOTIFIED_AT_KEY);
        }

        /**
         * Update notifiedAt timestamp when a new clinic is notified
         * This is used for accurate timeout calculation per clinic
         */
        private void updateClinicNotifiedAt(UUID bookingId) {
                long ttlSeconds = CLINIC_TIMEOUT_SECONDS * MAX_CLINICS_TO_TRY + 60;
                redisTemplate.opsForValue().set(
                                REDIS_KEY_PREFIX + bookingId + REDIS_NOTIFIED_AT_KEY,
                                System.currentTimeMillis(),
                                ttlSeconds,
                                TimeUnit.SECONDS);
        }

        private void notifyClinic(Booking booking, Clinic clinic, int index, int total) {
                log.info("Notifying clinic {} ({}/{}) for SOS booking {}",
                                clinic.getName(), index + 1, total, booking.getBookingId());

                // Broadcast via WebSocket to clinic's SOS alert topic
                // Web manager subscribes to: /topic/clinic/{clinicId}/sos-alert
                messagingTemplate.convertAndSend(
                                "/topic/clinic/" + clinic.getClinicId() + "/sos-alert",
                                SosMatchingStatusMessage.builder()
                                                .bookingId(booking.getBookingId())
                                                .event(MatchingEvent.CLINIC_NOTIFIED)
                                                .message("Yêu cầu cấp cứu mới!")
                                                .clinicId(clinic.getClinicId())
                                                .clinicName(clinic.getName())
                                                .remainingSeconds((long) CLINIC_TIMEOUT_SECONDS)
                                                .build());

                log.debug("Sent SOS alert to /topic/clinic/{}/sos-alert for booking {}",
                                clinic.getClinicId(), booking.getBookingId());
        }

        private void broadcastStatus(UUID bookingId, SosMatchingStatusMessage message) {
                messagingTemplate.convertAndSend(
                                "/topic/sos-matching/" + bookingId,
                                message);
        }

        private double calculateDistance(SosMatchRequest request, Clinic clinic) {
                return locationService.calculateDistance(
                                request.getLatitude(),
                                request.getLongitude(),
                                clinic.getLatitude(),
                                clinic.getLongitude());
        }

        private SosMatchResponse buildMatchingStartedResponse(Booking booking, Clinic firstClinic,
                        SosMatchRequest request) {
                return SosMatchResponse.builder()
                                .bookingId(booking.getBookingId())
                                .status(BookingStatus.PENDING_CLINIC_CONFIRM)
                                .message("Đang tìm phòng khám gần bạn...")
                                .clinicId(firstClinic.getClinicId())
                                .clinicName(firstClinic.getName())
                                .distanceKm(calculateDistance(request, firstClinic))
                                .wsTopicUrl("/topic/sos-matching/" + booking.getBookingId())
                                .createdAt(LocalDateTime.now())
                                .expiresAt(LocalDateTime.now().plusSeconds(CLINIC_TIMEOUT_SECONDS * MAX_CLINICS_TO_TRY))
                                .build();
        }

        private SosMatchResponse buildNoClinicResponse(UUID bookingId) {
                return SosMatchResponse.builder()
                                .bookingId(bookingId)
                                .status(BookingStatus.CANCELLED)
                                .message("Không tìm thấy phòng khám nào trong phạm vi " + SOS_SEARCH_RADIUS_KM
                                                + "km. Vui lòng gọi hotline: " + SOS_HOTLINE)
                                .build();
        }

        /**
         * Generate unique booking code for SOS with retry logic
         * Format: SOS-{timestamp}{random} to minimize collision
         */
        private String generateUniqueBookingCode() {
                int maxRetries = 5;
                for (int i = 0; i < maxRetries; i++) {
                        // Use timestamp + random suffix for better uniqueness
                        String bookingCode = String.format("SOS-%d%03d",
                                        System.currentTimeMillis() % 10000000,
                                        (int) (Math.random() * 1000));

                        if (!bookingRepository.existsByBookingCode(bookingCode)) {
                                return bookingCode;
                        }
                        log.warn("Booking code collision detected: {}, retrying...", bookingCode);
                }
                // Fallback with UUID suffix if all retries fail
                return "SOS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        }
}
