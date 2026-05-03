package com.petties.petties.service;

import com.petties.petties.dto.sos.SosConfirmRequest;
import com.petties.petties.dto.sos.SosMatchRequest;
import com.petties.petties.dto.sos.SosMatchResponse;
import com.petties.petties.dto.sos.SosMatchingStatusMessage;
import com.petties.petties.dto.sos.SosMatchingStatusMessage.MatchingEvent;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.exception.SosMatchingException;
import com.petties.petties.exception.SosMatchingException.SosErrorCode;
import com.petties.petties.model.Booking;
import com.petties.petties.model.BookingServiceItem;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Pet;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.PetRepository;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * SOS Auto-Match Service (Refactored)
 *
 * Handles automatic matching of SOS emergency requests to nearby clinics.
 * The matching process:
 * 1. Pet Owner sends SOS request with GPS coordinates
 * 2. System finds nearby clinics (sorted by distance)
 * 3. System notifies first clinic and waits for confirmation (60s timeout)
 * 4. If no response or declined, escalate to next clinic
 * 5. If all clinics exhausted, notify user with hotline
 *
 * Delegates to:
 * - SosSessionManager: Redis session operations
 * - SosNotificationService: WebSocket notifications
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SosMatchingService {

    private final BookingRepository bookingRepository;
    private final ClinicRepository clinicRepository;
    private final PetRepository petRepository;
    private final UserRepository userRepository;
    private final LocationService locationService;
    private final ClinicPriceService clinicPriceService;

    // Extracted services
    private final SosSessionManager sessionManager;
    private final SosNotificationService sosNotificationService;
    private final NotificationService notificationService;
    private final BookingNotificationService bookingNotificationService;

    // Configuration constants
    private static final double SOS_SEARCH_RADIUS_KM = 10.0;

    // ========== Start Matching ==========

    /**
     * Start SOS matching process
     * Creates a new SOS booking and begins searching for nearby clinics
     */
    @Transactional
    public SosMatchResponse startMatching(SosMatchRequest request, UUID petOwnerId) {
        log.info("Starting SOS matching for pet owner: {}", petOwnerId);

        // 0. Acquire distributed lock to prevent race condition
        if (!sessionManager.acquireUserLock(petOwnerId)) {
            throw new SosMatchingException(
                    "Yêu cầu SOS đang được xử lý. Vui lòng đợi giây lát.",
                    SosErrorCode.GENERAL_ERROR);
        }

        try {
            // 1. Check if user already has an active SOS booking
            Optional<Booking> activeBooking = getActiveSosBooking(petOwnerId);
            if (activeBooking.isPresent()) {
                log.info("Pet owner {} already has active SOS booking: {}, returning existing",
                        petOwnerId, activeBooking.get().getBookingId());
                return buildResumeResponse(activeBooking.get());
            }

            // 2. Validate pet ownership
            Pet pet = validatePetOwnership(request.getPetId(), petOwnerId);

            // 3. Find nearby clinics
            List<Clinic> nearbyClinics = findNearbyClinics(request);
            if (nearbyClinics.isEmpty()) {
                return buildNoClinicResponse(null);
            }

            // 4. Create SOS booking with SEARCHING status
            Booking booking = createSosBooking(pet, request, petOwnerId);

            // 5. Store matching session in Redis
            sessionManager.createSession(booking.getBookingId(), nearbyClinics);

            // 6. Notify first clinic and update notifiedAt timestamp
            Clinic firstClinic = nearbyClinics.get(0);
            int totalClinics = Math.min(nearbyClinics.size(), sessionManager.getMaxClinicsToTry());

            sosNotificationService.alertClinic(booking, firstClinic, 0, totalClinics);
            sessionManager.updateNotifiedAt(booking.getBookingId());

            // 7. Update booking status to PENDING_CLINIC_CONFIRM
            booking.setStatus(BookingStatus.PENDING_CLINIC_CONFIRM);
            // Gán clinic đầu tiên vào DB ngay để Manager có thể thấy ở trang "Chờ xác nhận"
            booking.setClinic(firstClinic);
            bookingRepository.save(booking);

            // 8. Broadcast status to Pet Owner
            double distanceKm = calculateDistance(request, firstClinic);
                booking.setDistanceKm(BigDecimal.valueOf(distanceKm));
                bookingRepository.save(booking);
            sosNotificationService.notifyOwnerClinicContacted(
                    booking.getBookingId(), firstClinic, 0, totalClinics, distanceKm);

            return buildMatchingStartedResponse(booking, firstClinic, request);
        } finally {
            sessionManager.releaseUserLock(petOwnerId);
        }
    }

    // ========== Process Confirmation ==========

    /**
     * Process clinic confirmation or decline
     */
    @Transactional
    public SosMatchResponse processConfirmation(SosConfirmRequest request, UUID clinicManagerId) {
        log.info("Processing SOS confirmation for booking: {}", request.getBookingId());

        if (!sessionManager.acquireBookingLock(request.getBookingId())) {
            throw new SosMatchingException("Yêu cầu đang được xử lý, vui lòng thử lại sau.",
                    SosErrorCode.GENERAL_ERROR);
        }

        try {
            Booking booking = findBookingById(request.getBookingId());

            if (booking.getStatus() != BookingStatus.PENDING_CLINIC_CONFIRM) {
                throw new SosMatchingException(
                        "Booking không ở trạng thái chờ xác nhận",
                        SosErrorCode.BOOKING_NOT_PENDING);
            }

            // Verify clinic manager has access
            User manager = findUserById(clinicManagerId);
            if (manager.getRole() != Role.CLINIC_MANAGER) {
                throw new SosMatchingException(
                        "Chỉ Clinic Manager mới có quyền xác nhận yêu cầu SOS",
                        SosErrorCode.MANAGER_NOT_AUTHORIZED);
            }

            // SECURITY FIX: Validate clinic ownership - manager can only confirm booking
            // assigned to their clinic
            Clinic managerClinic = manager.getWorkingClinic();
            if (managerClinic == null) {
                throw new SosMatchingException(
                        "Manager chưa được gán cho phòng khám nào",
                        SosErrorCode.MANAGER_NOT_AUTHORIZED);
            }

            Clinic bookingClinic = booking.getClinic();
            if (bookingClinic == null || !bookingClinic.getClinicId().equals(managerClinic.getClinicId())) {
                log.warn("Manager {} from clinic {} attempted to confirm booking {} assigned to clinic {}",
                        clinicManagerId, managerClinic.getClinicId(),
                        request.getBookingId(), bookingClinic != null ? bookingClinic.getClinicId() : "null");
                throw new SosMatchingException(
                        "Bạn không có quyền xác nhận yêu cầu SOS này. Yêu cầu thuộc về phòng khám khác.",
                        SosErrorCode.MANAGER_NOT_AUTHORIZED);
            }

            if (request.isAccepted()) {
                return confirmSos(booking, manager, request.getAssignedStaffId());
            } else {
                return declineSos(booking, request.getDeclineReason());
            }
        } finally {
            sessionManager.releaseBookingLock(request.getBookingId());
        }
    }

    /**
     * Confirm SOS - Clinic accepts the request
     */
    private SosMatchResponse confirmSos(Booking booking, User manager, UUID assignedStaffId) {
        Clinic clinic = manager.getWorkingClinic();
        if (clinic == null) {
            throw new SosMatchingException(
                    "Manager chưa được gán cho phòng khám nào",
                    SosErrorCode.MANAGER_NOT_AUTHORIZED);
        }

        // Update booking
        booking.setClinic(clinic);
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setConfirmedAt(LocalDateTime.now());

        // Assign SOS Fee from clinic pricing
        BigDecimal sosFee = clinicPriceService.getSosFee(clinic.getClinicId()).orElse(BigDecimal.valueOf(50000)); // Default
                                                                                                                  // if
                                                                                                                  // not
                                                                                                                  // config
        booking.setSosFee(sosFee);

        // Update Total Price (SOS baseline)
        // If there are services, we might need to add them, but SOS usually starts with
        // just the fee
        BigDecimal currentTotalPrice = booking.getTotalPrice() != null ? booking.getTotalPrice() : BigDecimal.ZERO;
        booking.setTotalPrice(currentTotalPrice.add(sosFee));

        // Assign staff if provided
        User staff = null;
        if (assignedStaffId != null) {
            staff = findUserById(assignedStaffId);
            validateAssignedStaffForSos(staff, clinic);
            // 1. Gán vào đơn hàng chính (để đồng bộ với Manager Web)
            booking.setAssignedStaff(staff);
            // 2. Gán vào các mục dịch vụ (nếu có - though SOS often empty)
            for (BookingServiceItem item : booking.getBookingServices()) {
                item.setAssignedStaff(staff);
            }
        }

        bookingRepository.save(booking);

        // Notify assigned staff via push notification + FCM
        notificationService.sendBookingAssignedNotificationToStaff(booking);

        // Push SSE event for real-time sync (staff + clinic managers)
        bookingNotificationService.pushBookingUpdateToUsers(booking, "CONFIRMED");

        // Clear Redis session
        sessionManager.clearSession(booking.getBookingId());

        // Broadcast confirmation to Pet Owner with staff info and clinic distance/ETA
        sosNotificationService.notifyOwnerConfirmed(
                booking.getBookingId(),
                clinic,
                staff,
                booking.getDistanceKm() != null ? booking.getDistanceKm().doubleValue() : null,
                null);

        // Notify clinic that this alert is now handled (to close modal)
        sosNotificationService.notifyClinicStaleAlert(booking.getBookingId(), clinic.getClinicId(),
                MatchingEvent.CONFIRMED);

        return SosMatchResponse.builder()
                .bookingId(booking.getBookingId())
                .status(BookingStatus.CONFIRMED)
                .message("Đã xác nhận! Phòng khám sẽ liên hệ với bạn ngay.")
                .petId(booking.getPet() != null ? booking.getPet().getId() : null)
                .petName(booking.getPet() != null ? booking.getPet().getName() : null)
                .petAvatarUrl(booking.getPet() != null ? booking.getPet().getImageUrl() : null)
                .clinicId(clinic.getClinicId())
                .clinicName(clinic.getName())
                .clinicPhone(clinic.getPhone())
                .clinicAddress(clinic.getAddress())
                .clinicLat(clinic.getLatitude() != null ? clinic.getLatitude().doubleValue() : null)
                .clinicLng(clinic.getLongitude() != null ? clinic.getLongitude().doubleValue() : null)
                .staffId(staff != null ? staff.getUserId() : null)
                .staffName(staff != null ? staff.getFullName() : null)
                .staffPhone(staff != null ? staff.getPhone() : null)
                .staffAvatarUrl(staff != null ? staff.getAvatar() : null)
                .build();
    }

    /**
     * Decline SOS - Clinic declines, escalate to next
     */
    private SosMatchResponse declineSos(Booking booking, String reason) {
        log.info("Clinic declined SOS booking: {}, reason: {}", booking.getBookingId(), reason);

        // Clear clinic field as it's no longer with this clinic
        booking.setClinic(null);
        bookingRepository.save(booking);

        return escalateToNextClinic(booking.getBookingId());
    }

    // ========== Escalation ==========

    /**
     * Escalate to next clinic when current one times out or declines
     * Called by scheduled job or decline handler
     */
    @Transactional
    public SosMatchResponse escalateToNextClinic(UUID bookingId) {
        log.info("Escalating SOS to next clinic for booking: {}", bookingId);

        boolean lockedLocally = false;
        if (sessionManager.acquireBookingLock(bookingId)) {
            lockedLocally = true;
        }

        try {
            Booking booking = findBookingById(bookingId);

            if (booking.getStatus() != BookingStatus.PENDING_CLINIC_CONFIRM
                    && booking.getStatus() != BookingStatus.SEARCHING) {
                log.warn("Booking {} is not in escalation-eligible status: {}", bookingId, booking.getStatus());
                return null;
            }

            // Get session data from Redis
            Optional<Integer> currentIndexOpt = sessionManager.getCurrentIndex(bookingId);
            Optional<List<String>> clinicIdsOpt = sessionManager.getClinicIds(bookingId);

            if (currentIndexOpt.isEmpty() || clinicIdsOpt.isEmpty()) {
                log.error("Redis session not found for booking: {}", bookingId);
                return buildNoClinicResponse(bookingId);
            }

            int currentIndex = currentIndexOpt.get();
            List<String> clinicIds = clinicIdsOpt.get();
            int maxClinics = sessionManager.getMaxClinicsToTry();

            // Notify OLD clinic that the alert is now stale (timed out/declined)
            if (currentIndex >= 0 && currentIndex < clinicIds.size()) {
                UUID oldClinicId = UUID.fromString(clinicIds.get(currentIndex));
                sosNotificationService.notifyClinicStaleAlert(bookingId, oldClinicId, MatchingEvent.WAITING_NEXT);
            }

            // Use loop instead of recursion to avoid stack overflow
            while (true) {
                int nextIndex = currentIndex + 1;

                // Check if we've exhausted all clinics
                if (nextIndex >= clinicIds.size() || nextIndex >= maxClinics) {
                    return handleNoClinicAvailable(booking);
                }

                String nextClinicIdStr = clinicIds.get(nextIndex);
                UUID nextClinicId = UUID.fromString(nextClinicIdStr);
                Optional<Clinic> nextClinicOpt = clinicRepository.findById(nextClinicId);

                if (nextClinicOpt.isEmpty()) {
                    log.error("Clinic not found: {}. Skipping to next.", nextClinicId);
                    currentIndex = nextIndex;
                    continue;
                }

                Clinic nextClinic = nextClinicOpt.get();

                // Update Session
                sessionManager.updateIndex(bookingId, nextIndex);
                sessionManager.updateNotifiedAt(bookingId);

                // Update Booking
                double distanceKm = calculateDistance(booking, nextClinic);
                booking.setDistanceKm(BigDecimal.valueOf(distanceKm));
                booking.setClinic(nextClinic);
                booking.setStatus(BookingStatus.PENDING_CLINIC_CONFIRM);
                bookingRepository.save(booking);

                // Notify Pet Owner
                sosNotificationService.notifyOwnerWaitingNext(bookingId, nextClinic, nextIndex, clinicIds.size());

                // Alert Next Clinic
                sosNotificationService.alertClinic(booking, nextClinic, nextIndex, clinicIds.size());

                return SosMatchResponse.builder()
                        .bookingId(bookingId)
                        .status(BookingStatus.PENDING_CLINIC_CONFIRM)
                        .message("Đang chuyển tiếp yêu cầu sang phòng khám tiếp theo: " + nextClinic.getName())
                        .clinicId(nextClinic.getClinicId())
                        .clinicName(nextClinic.getName())
                        .clinicPhone(nextClinic.getPhone())
                        .clinicLat(nextClinic.getLatitude() != null ? nextClinic.getLatitude().doubleValue() : null)
                        .clinicLng(nextClinic.getLongitude() != null ? nextClinic.getLongitude().doubleValue() : null)
                        .build();
            }
        } finally {
            if (lockedLocally) {
                sessionManager.releaseBookingLock(bookingId);
            }
        }
    }

    /**
     * Handle case when no clinic is available
     */
    private SosMatchResponse handleNoClinicAvailable(Booking booking) {
        log.warn("No clinic available for SOS booking: {}", booking.getBookingId());

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason("Không tìm thấy phòng khám khả dụng trong khu vực");
        bookingRepository.save(booking);

        sessionManager.clearSession(booking.getBookingId());

        // Broadcast NO_CLINIC status
        sosNotificationService.notifyOwnerNoClinic(booking.getBookingId());

        return buildNoClinicResponse(booking.getBookingId());
    }

    // ========== Timeout Check (for Scheduler) ==========

    /**
     * Check for timed-out SOS bookings
     * Called by scheduled job every 15 seconds
     */
    @Transactional
    public void checkTimeouts() {
        if (!sessionManager.hasActiveSessions()) {
            log.debug("No active SOS sessions in Redis, skipping timeout check");
            return;
        }

        List<Booking> pendingBookings = bookingRepository
                .findByStatusAndBookingType(BookingStatus.PENDING_CLINIC_CONFIRM, BookingType.SOS);

        for (Booking booking : pendingBookings) {
            UUID bookingId = booking.getBookingId();

            if (!sessionManager.sessionExists(bookingId)) {
                continue;
            }

            if (sessionManager.hasCurrentClinicTimedOut(bookingId)) {
                long elapsed = sessionManager.getElapsedSeconds(bookingId);
                if (sessionManager.acquireBookingLock(bookingId)) {
                    try {
                        Optional<Integer> indexOpt = sessionManager.getCurrentIndex(bookingId);

                        log.info("SOS booking {} timed out at index {} after {}s, escalating...",
                                bookingId, indexOpt.orElse(-1), elapsed);
                        escalateToNextClinic(bookingId);
                    } finally {
                        sessionManager.releaseBookingLock(bookingId);
                    }
                }
            }
        }
    }

    // ========== Get Status / Active Booking ==========

    /**
     * Get active SOS booking for current user
     */
    public Optional<Booking> getActiveSosBooking(UUID petOwnerId) {
        List<Booking> activeBookings = bookingRepository.findActiveSosBookingsByPetOwner(petOwnerId);
        return activeBookings.isEmpty() ? Optional.empty() : Optional.of(activeBookings.get(0));
    }

    /**
     * Get current matching status
     */
    @Transactional(readOnly = true)
    public SosMatchResponse getMatchingStatus(UUID bookingId) {
        Booking booking = findBookingById(bookingId);

        SosMatchResponse.SosMatchResponseBuilder response = SosMatchResponse.builder()
                .bookingId(bookingId)
                .status(booking.getStatus())
                .petId(booking.getPet() != null ? booking.getPet().getId() : null)
                .petName(booking.getPet() != null ? booking.getPet().getName() : null)
                .petAvatarUrl(booking.getPet() != null ? booking.getPet().getImageUrl() : null)
                .wsTopicUrl("/topic/sos-matching/" + bookingId);

        if (booking.getClinic() != null) {
            Clinic clinic = booking.getClinic();
            response.clinicId(clinic.getClinicId())
                    .clinicName(clinic.getName())
                    .clinicPhone(clinic.getPhone())
                    .clinicAddress(clinic.getAddress())
                    .clinicLat(clinic.getLatitude() != null ? clinic.getLatitude().doubleValue() : null)
                    .clinicLng(clinic.getLongitude() != null ? clinic.getLongitude().doubleValue() : null);
        }

        // Get current clinic from session
        Optional<Integer> indexOpt = sessionManager.getCurrentIndex(bookingId);
        Optional<List<String>> clinicIdsOpt = sessionManager.getClinicIds(bookingId);

        if (indexOpt.isPresent() && clinicIdsOpt.isPresent()) {
            int index = indexOpt.get();
            List<String> clinicIds = clinicIdsOpt.get();
            long remainingSeconds = Math.max(0,
                sessionManager.getClinicTimeoutSeconds() - sessionManager.getElapsedSeconds(bookingId));

            response.currentClinicIndex(index + 1)
                .totalClinicsInRange(clinicIds.size())
                .remainingSeconds(remainingSeconds);

            if (index < clinicIds.size()) {
                UUID currentClinicId = UUID.fromString(clinicIds.get(index));
                clinicRepository.findById(currentClinicId)
                        .ifPresent(clinic -> response.clinicName(clinic.getName()));
            }
        }

        return response.build();
    }

    /**
     * Get active SOS alerts for a manager
     * Used by Clinic Manager to sync alerts (catch-up mechanism)
     */
    @Transactional(readOnly = true)
    public List<SosMatchingStatusMessage> getActiveSosAlertsForManager(UUID managerId) {
        log.debug("getActiveSosAlertsForManager called for manager: {}", managerId);
        User manager = findUserById(managerId);
        Clinic clinic = manager.getWorkingClinic();
        if (clinic == null) {
            log.warn("Manager {} has no working clinic assigned!", managerId);
            return Collections.emptyList();
        }
        log.debug("Manager {} belongs to clinic: {}", managerId, clinic.getClinicId());
        return getActiveSosAlertsForClinic(clinic.getClinicId());
    }

    /**
     * Get active SOS alerts for a clinic
     * Used by Clinic Manager to sync alerts (catch-up mechanism)
     */
    @Transactional(readOnly = true)
    public List<SosMatchingStatusMessage> getActiveSosAlertsForClinic(UUID clinicId) {
        log.debug("Fetching active SOS alerts for clinic: {}", clinicId);

        // Find all SOS bookings pending confirmation for this clinic
        List<Booking> pendingBookings = bookingRepository.findByClinicIdAndStatusAndType(
                clinicId,
                BookingStatus.PENDING_CLINIC_CONFIRM,
                BookingType.SOS,
                Pageable.ofSize(10)).getContent();

        log.debug("Found {} pending SOS bookings in DB for clinic {}", pendingBookings.size(), clinicId);

        return pendingBookings.stream()
                .filter(booking -> {
                    boolean sessionExists = sessionManager.sessionExists(booking.getBookingId());
                    if (!sessionExists) {
                        log.warn("Booking {} is PENDING_CLINIC_CONFIRM but NO session found in Redis. Skipping.",
                                booking.getBookingId());
                    }
                    return sessionExists;
                })
                .map(booking -> {
                    long elapsed = sessionManager.getElapsedSeconds(booking.getBookingId());
                    long remaining = Math.max(0, sessionManager.getClinicTimeoutSeconds() - elapsed);
                    log.debug("Building SOS alert message for booking {}. Remaining: {}s", booking.getBookingId(),
                            remaining);

                    return buildSosAlertMessage(booking, remaining);
                })
                .filter(msg -> msg.getRemainingSeconds() > 0)
                .collect(Collectors.toList());
    }

    private SosMatchingStatusMessage buildSosAlertMessage(Booking booking, long remainingSeconds) {
        SosMatchingStatusMessage.SosMatchingStatusMessageBuilder builder = SosMatchingStatusMessage.builder()
                .bookingId(booking.getBookingId())
                .event(MatchingEvent.CLINIC_NOTIFIED)
                .message("Yêu cầu cấp cứu mới!")
                .clinicId(booking.getClinic().getClinicId())
                .clinicName(booking.getClinic().getName())
                .remainingSeconds(remainingSeconds)
                .symptoms(booking.getSymptoms())
                .homeAddress(booking.getHomeAddress())
                .homeLat(booking.getHomeLat() != null ? booking.getHomeLat().doubleValue() : null)
                .homeLong(booking.getHomeLong() != null ? booking.getHomeLong().doubleValue() : null);

        if (booking.getPet() != null) {
            builder.petName(booking.getPet().getName())
                    .petAvatarUrl(booking.getPet().getImageUrl())
                    .petSpecies(booking.getPet().getSpecies() != null ? booking.getPet().getSpecies().name() : null)
                    .petBreed(booking.getPet().getBreed())
                    .petWeight(booking.getPet().getWeight());
        }

        if (booking.getPetOwner() != null) {
            builder.petOwnerName(booking.getPetOwner().getFullName())
                    .petOwnerPhone(booking.getPetOwner().getPhone());
        }

        if (booking.getDistanceKm() != null) {
            builder.distanceKm(booking.getDistanceKm().doubleValue());
        }

        return builder.build();
    }

    // ========== Cancel Matching ==========

    /**
     * Cancel SOS matching (Pet Owner only, before confirmation)
     */
    @Transactional
    public void cancelMatching(UUID bookingId, UUID petOwnerId) {
        log.info("Cancelling SOS matching for booking: {} by user: {}", bookingId, petOwnerId);

        Booking booking = findBookingById(bookingId);

        // Validate ownership
        if (!booking.getPetOwner().getUserId().equals(petOwnerId)) {
            throw new SosMatchingException(
                    "Bạn không có quyền hủy yêu cầu này",
                    SosErrorCode.NOT_OWNER);
        }

        // Can only cancel if still searching or pending clinic confirmation
        if (booking.getStatus() != BookingStatus.SEARCHING
                && booking.getStatus() != BookingStatus.PENDING_CLINIC_CONFIRM) {
            throw new SosMatchingException(
                    "Không thể hủy booking ở trạng thái: " + booking.getStatus(),
                    SosErrorCode.CANNOT_CANCEL);
        }

        // Update booking
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason("Hủy bởi người dùng");
        bookingRepository.save(booking);

        // Clear Redis session
        sessionManager.clearSession(bookingId);

        // Broadcast status to Pet Owner
        sosNotificationService.notifyOwnerCancelled(bookingId);

        // Notify current clinic (if any) to close modal
        if (booking.getClinic() != null) {
            sosNotificationService.notifyClinicStaleAlert(bookingId, booking.getClinic().getClinicId(),
                    MatchingEvent.CANCELLED);
        }
    }

    // ========== Private Validation Methods ==========

    private Pet validatePetOwnership(UUID petId, UUID petOwnerId) {
        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new SosMatchingException(
                        "Không tìm thấy thú cưng",
                        SosErrorCode.PET_NOT_FOUND));

        if (!pet.getUser().getUserId().equals(petOwnerId)) {
            throw new SosMatchingException(
                    "Bạn không sở hữu thú cưng này",
                    SosErrorCode.PET_NOT_OWNED);
        }

        return pet;
    }

    private Booking findBookingById(UUID bookingId) {
        return bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy booking: " + bookingId));
    }

    private User findUserById(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user: " + userId));
    }

    private List<Clinic> findNearbyClinics(SosMatchRequest request) {
        return clinicRepository.findNearbyClinics(
                request.getLatitude(),
                request.getLongitude(),
                SOS_SEARCH_RADIUS_KM);
    }

    // ========== Private Helper Methods ==========

    private Booking createSosBooking(Pet pet, SosMatchRequest request, UUID petOwnerId) {
        User petOwner = findUserById(petOwnerId);

        Booking booking = new Booking();
        booking.setPet(pet);
        booking.setPetOwner(petOwner);
        booking.setType(BookingType.SOS);
        booking.setStatus(BookingStatus.SEARCHING);
        booking.setBookingDate(LocalDateTime.now().toLocalDate());
        booking.setBookingTime(LocalDateTime.now().toLocalTime());
        booking.setNotes(request.getNotes());
        booking.setSymptoms(request.getSymptoms());
        booking.setHomeAddress(request.getAddress());
        booking.setHomeLat(request.getLatitude());
        booking.setHomeLong(request.getLongitude());
        booking.setTotalPrice(BigDecimal.ZERO);

        String bookingCode = generateUniqueBookingCode();
        booking.setBookingCode(bookingCode);

        return bookingRepository.save(booking);
    }

    private double calculateDistance(SosMatchRequest request, Clinic clinic) {
        return locationService.calculateDistance(
                request.getLatitude(),
                request.getLongitude(),
                clinic.getLatitude(),
                clinic.getLongitude());
    }

    private double calculateDistance(Booking booking, Clinic clinic) {
        return locationService.calculateDistance(
                booking.getHomeLat(),
                booking.getHomeLong(),
                clinic.getLatitude(),
                clinic.getLongitude());
    }

    private void validateAssignedStaffForSos(User staff, Clinic clinic) {
        if (staff.getRole() != Role.STAFF) {
            throw new SosMatchingException(
                    "Nhân sự được chọn phải có vai trò STAFF",
                    SosErrorCode.MANAGER_NOT_AUTHORIZED);
        }

        if (staff.getWorkingClinic() == null || !staff.getWorkingClinic().getClinicId().equals(clinic.getClinicId())) {
            throw new SosMatchingException(
                    "Nhân sự được chọn không thuộc phòng khám xác nhận yêu cầu SOS",
                    SosErrorCode.MANAGER_NOT_AUTHORIZED);
        }
    }

    private SosMatchResponse buildMatchingStartedResponse(Booking booking, Clinic firstClinic,
            SosMatchRequest request) {
        int maxClinics = sessionManager.getMaxClinicsToTry();
        int timeoutSeconds = sessionManager.getClinicTimeoutSeconds();

        return SosMatchResponse.builder()
                .bookingId(booking.getBookingId())
                .status(booking.getStatus())
                .message("Đang tìm phòng khám gần bạn...")
                .petId(booking.getPet() != null ? booking.getPet().getId() : null)
                .petName(booking.getPet() != null ? booking.getPet().getName() : null)
                .petAvatarUrl(booking.getPet() != null ? booking.getPet().getImageUrl() : null)
                .clinicId(firstClinic.getClinicId())
                .clinicName(firstClinic.getName())
                .clinicPhone(firstClinic.getPhone())
                .clinicAddress(firstClinic.getAddress())
                .clinicLat(firstClinic.getLatitude() != null ? firstClinic.getLatitude().doubleValue() : null)
                .clinicLng(firstClinic.getLongitude() != null ? firstClinic.getLongitude().doubleValue() : null)
                .distanceKm(calculateDistance(request, firstClinic))
                .wsTopicUrl("/topic/sos-matching/" + booking.getBookingId())
                .createdAt(booking.getCreatedAt() != null ? booking.getCreatedAt() : LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusSeconds((long) timeoutSeconds * maxClinics))
                .build();
    }

    private SosMatchResponse buildResumeResponse(Booking booking) {
        Clinic clinic = booking.getClinic();
        int maxClinics = sessionManager.getMaxClinicsToTry();
        int timeoutSeconds = sessionManager.getClinicTimeoutSeconds();

        return SosMatchResponse.builder()
                .bookingId(booking.getBookingId())
                .status(booking.getStatus())
                .message("Bạn đang có một yêu cầu SOS đang hoạt động")
                .petId(booking.getPet() != null ? booking.getPet().getId() : null)
                .petName(booking.getPet() != null ? booking.getPet().getName() : null)
                .petAvatarUrl(booking.getPet() != null ? booking.getPet().getImageUrl() : null)
                .clinicId(clinic != null ? clinic.getClinicId() : null)
                .clinicName(clinic != null ? clinic.getName() : null)
                .clinicPhone(clinic != null ? clinic.getPhone() : null)
                .clinicAddress(clinic != null ? clinic.getAddress() : null)
                .clinicLat(clinic != null && clinic.getLatitude() != null ? clinic.getLatitude().doubleValue() : null)
                .clinicLng(clinic != null && clinic.getLongitude() != null ? clinic.getLongitude().doubleValue() : null)
                .distanceKm(booking.getDistanceKm() != null ? booking.getDistanceKm().doubleValue() : null)
                .wsTopicUrl("/topic/sos-matching/" + booking.getBookingId())
                .createdAt(booking.getCreatedAt() != null ? booking.getCreatedAt() : LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusSeconds((long) timeoutSeconds * maxClinics))
                .build();
    }

    private SosMatchResponse buildNoClinicResponse(UUID bookingId) {
        return SosMatchResponse.builder()
                .bookingId(bookingId)
                .status(BookingStatus.CANCELLED)
                .message("Không tìm thấy phòng khám nào trong phạm vi " + SOS_SEARCH_RADIUS_KM + "km.")
                .build();
    }

    private String generateUniqueBookingCode() {
        int maxRetries = 5;
        for (int i = 0; i < maxRetries; i++) {
            String bookingCode = String.format("SOS-%d%03d",
                    System.currentTimeMillis() % 10000000,
                    (int) (Math.random() * 1000));

            if (!bookingRepository.existsByBookingCode(bookingCode)) {
                return bookingCode;
            }
            log.warn("Booking code collision detected: {}, retrying...", bookingCode);
        }
        return "SOS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
