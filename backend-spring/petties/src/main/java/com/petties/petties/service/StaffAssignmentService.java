package com.petties.petties.service;

import com.petties.petties.dto.booking.AlternativeTimeSlot;
import com.petties.petties.dto.booking.AvailableStaffResponse;
import com.petties.petties.dto.booking.ServiceAvailability;
import com.petties.petties.dto.booking.StaffAvailabilityCheckResponse;
import com.petties.petties.dto.booking.StaffOptionDTO;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Booking;
import com.petties.petties.model.BookingServiceItem;
import com.petties.petties.model.BookingSlot;
import com.petties.petties.model.Slot;
import com.petties.petties.model.User;
import com.petties.petties.model.StaffShift;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.ServiceCategory;
import com.petties.petties.model.enums.SlotStatus;
import com.petties.petties.model.enums.StaffSpecialty;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.BookingSlotRepository;
import com.petties.petties.repository.SlotRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.repository.StaffShiftRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * StaffAssignmentService - Auto-assign staff based on service category and
 * availability
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StaffAssignmentService {

    private final UserRepository userRepository;
    private final StaffShiftRepository staffShiftRepository;
    private final BookingRepository bookingRepository;
    private final SlotRepository slotRepository;
    private final BookingSlotRepository bookingSlotRepository;
    private final com.petties.petties.repository.ClinicServiceRepository clinicServiceRepository;

    /**
     * Auto-assign staff for a booking based on:
     * 1. Service category → required specialty
     * 2. Staff shift availability on booking date/time
     * 3. Load balancing: choose staff with least bookings on that date
     *
     * @param booking The booking to assign
     * @return Assigned staff, or null if no suitable staff found
     */
    public User autoAssignStaff(Booking booking) {
        log.info("Auto-assigning staff for booking {}", booking.getBookingCode());

        UUID clinicId = booking.getClinic().getClinicId();
        LocalDate bookingDate = booking.getBookingDate();
        LocalTime bookingTime = booking.getBookingTime();

        // Step 1: Determine required specialty from services
        StaffSpecialty requiredSpecialty = determineRequiredSpecialty(booking);
        log.info("Required specialty: {}", requiredSpecialty);

        // Step 2: Find staff with matching specialty in clinic
        List<User> matchingStaff = findStaffWithSpecialty(clinicId, requiredSpecialty);
        log.info("Found {} staff with specialty {}", matchingStaff.size(), requiredSpecialty);

        if (matchingStaff.isEmpty()) {
            // Fallback: try VET_GENERAL
            if (requiredSpecialty != StaffSpecialty.VET_GENERAL && requiredSpecialty != StaffSpecialty.GROOMER) {
                log.info("No staff with {} specialty, falling back to VET_GENERAL", requiredSpecialty);
                matchingStaff = findStaffWithSpecialty(clinicId, StaffSpecialty.VET_GENERAL);
            }
        }

        if (matchingStaff.isEmpty()) {
            log.warn("No suitable staff found for booking {}", booking.getBookingCode());
            return null;
        }

        // Step 3: Filter by shift availability
        List<User> availableStaff = filterByShiftAvailability(matchingStaff, clinicId, bookingDate, bookingTime);
        log.info("Found {} staff available on {} at {}", availableStaff.size(), bookingDate, bookingTime);

        if (availableStaff.isEmpty()) {
            log.warn("No staff available on {} at {} for booking {}", bookingDate, bookingTime,
                    booking.getBookingCode());
            return null;
        }

        // Step 4: Load balancing - choose staff with least bookings on that date
        User assignedStaff = selectStaffWithLeastBookings(availableStaff, bookingDate);
        log.info("Selected staff {} for booking {}", assignedStaff.getFullName(), booking.getBookingCode());

        return assignedStaff;
    }

    /**
     * Assign staff to all services in a booking
     * Groups services by required specialty and assigns same staff for same
     * specialty
     *
     * @param booking The booking to assign staff for
     * @return Map of service item ID to assigned staff
     */
    public Map<UUID, User> assignStaffToAllServices(Booking booking) {
        log.info("Assigning staff to all services for booking {}", booking.getBookingCode());

        UUID clinicId = booking.getClinic().getClinicId();
        LocalDate bookingDate = booking.getBookingDate();
        LocalTime bookingTime = booking.getBookingTime();

        Map<UUID, User> assignments = new HashMap<>();
        Map<StaffSpecialty, User> specialtyStaffCache = new HashMap<>();

        // Group services by required specialty
        Map<StaffSpecialty, List<BookingServiceItem>> servicesBySpecialty = new HashMap<>();

        for (BookingServiceItem item : booking.getBookingServices()) {
            StaffSpecialty specialty = getSpecialtyForService(item);
            servicesBySpecialty.computeIfAbsent(specialty, k -> new ArrayList<>()).add(item);
        }

        log.info("Services grouped by specialty: {}",
                servicesBySpecialty.entrySet().stream()
                        .collect(Collectors.toMap(
                                Map.Entry::getKey,
                                e -> e.getValue().size())));

        // Assign staff for each specialty group
        for (Map.Entry<StaffSpecialty, List<BookingServiceItem>> entry : servicesBySpecialty.entrySet()) {
            StaffSpecialty specialty = entry.getKey();
            List<BookingServiceItem> items = entry.getValue();

            // Find available staff for this specialty (reuse if already assigned)
            User staff = specialtyStaffCache.get(specialty);
            if (staff == null) {
                staff = findAvailableStaffForSpecialty(clinicId, bookingDate, bookingTime, specialty);
                if (staff != null) {
                    specialtyStaffCache.put(specialty, staff);
                }
            }

            // Assign same staff to all services of this specialty
            for (BookingServiceItem item : items) {
                if (staff != null) {
                    item.setAssignedStaff(staff);
                    assignments.put(item.getBookingServiceId(), staff);
                    log.info("Assigned staff {} to service {} (specialty: {})",
                            staff.getFullName(), item.getService().getName(), specialty);
                } else {
                    log.warn("No staff available for service {} (specialty: {})",
                            item.getService().getName(), specialty);
                }
            }
        }

        // Set primary staff on booking (first assigned staff or most specialized)
        if (!specialtyStaffCache.isEmpty()) {
            User primaryStaff = selectPrimaryStaff(specialtyStaffCache);
            booking.setAssignedStaff(primaryStaff);
            log.info("Primary staff for booking: {}", primaryStaff.getFullName());
        }

        return assignments;
    }

    /**
     * Get required specialty for a service item
     */
    private StaffSpecialty getSpecialtyForService(BookingServiceItem item) {
        ServiceCategory category = item.getService().getServiceCategory();
        if (category != null) {
            return category.getRequiredSpecialty();
        }
        return StaffSpecialty.VET_GENERAL;
    }

    /**
     * Find available staff for a specific specialty
     */
    private User findAvailableStaffForSpecialty(UUID clinicId, LocalDate date, LocalTime time,
            StaffSpecialty specialty) {
        log.info(">> Finding staff for specialty: {}", specialty);
        List<User> matchingStaff = findStaffWithSpecialty(clinicId, specialty);
        log.info(">> Found {} staff with specialty {}", matchingStaff.size(), specialty);

        if (matchingStaff.isEmpty() && specialty != StaffSpecialty.VET_GENERAL && specialty != StaffSpecialty.GROOMER) {
            log.info("No staff with {} specialty, falling back to VET_GENERAL", specialty);
            matchingStaff = findStaffWithSpecialty(clinicId, StaffSpecialty.VET_GENERAL);
            log.info(">> Fallback found {} VET_GENERAL staff", matchingStaff.size());
        }

        if (matchingStaff.isEmpty()) {
            return null;
        }

        List<User> availableStaff = filterByShiftAvailability(matchingStaff, clinicId, date, time);
        if (availableStaff.isEmpty()) {
            return null;
        }

        return selectStaffWithLeastBookings(availableStaff, date);
    }

    /**
     * Select primary staff (highest specialty priority)
     */
    private User selectPrimaryStaff(Map<StaffSpecialty, User> specialtyStaffCache) {
        List<StaffSpecialty> priorityOrder = Arrays.asList(
                StaffSpecialty.VET_SURGERY,
                StaffSpecialty.VET_DENTAL,
                StaffSpecialty.VET_DERMATOLOGY,
                StaffSpecialty.VET_GENERAL,
                StaffSpecialty.GROOMER);

        for (StaffSpecialty specialty : priorityOrder) {
            if (specialtyStaffCache.containsKey(specialty)) {
                return specialtyStaffCache.get(specialty);
            }
        }
        return specialtyStaffCache.values().iterator().next();
    }

    /**
     * Determine required specialty from booking services
     * Priority: highest specialty requirement wins
     */
    private StaffSpecialty determineRequiredSpecialty(Booking booking) {
        // Priority order (higher index = higher priority)
        List<StaffSpecialty> priorityOrder = Arrays.asList(
                StaffSpecialty.GROOMER,
                StaffSpecialty.VET_GENERAL,
                StaffSpecialty.VET_DERMATOLOGY,
                StaffSpecialty.VET_DENTAL,
                StaffSpecialty.VET_SURGERY);

        StaffSpecialty highestPriority = StaffSpecialty.VET_GENERAL;

        for (BookingServiceItem item : booking.getBookingServices()) {
            ServiceCategory category = item.getService().getServiceCategory();
            if (category != null) {
                StaffSpecialty required = category.getRequiredSpecialty();

                // Compare priority
                if (priorityOrder.indexOf(required) > priorityOrder.indexOf(highestPriority)) {
                    highestPriority = required;
                }
            }
        }

        return highestPriority;
    }

    /**
     * Find staff with specific specialty working at clinic
     */
    private List<User> findStaffWithSpecialty(UUID clinicId, StaffSpecialty specialty) {
        // Find all staff in clinic
        List<User> allStaff = userRepository.findByWorkingClinicIdAndRole(clinicId, Role.STAFF);

        log.info(">> All staff in clinic: {}",
                allStaff.stream()
                        .map(v -> v.getFullName() + "(" + v.getSpecialty() + ")")
                        .toList());

        log.info("Filtering staff for specialty {}. In clinic total: {}", specialty, allStaff.size());

        // Filter by matching specialty
        List<User> matching = allStaff.stream()
                .filter(user -> user.getSpecialty() == specialty)
                .collect(Collectors.toList());

        log.info("Found {} matching staff for specialty {}: {}",
                matching.size(), specialty,
                matching.stream().map(User::getFullName).collect(Collectors.toList()));

        return matching;
    }

    /**
     * Filter staff by shift availability on booking date/time
     */
    private List<User> filterByShiftAvailability(List<User> staff, UUID clinicId, LocalDate date, LocalTime time) {
        List<User> available = new ArrayList<>();

        for (User member : staff) {
            // Check if staff has a shift on this date that covers the booking time
            List<StaffShift> shifts = staffShiftRepository.findByStaff_UserIdAndWorkDate(member.getUserId(), date);

            for (StaffShift shift : shifts) {
                // Check if shift is at the same clinic
                if (shift.getClinic().getClinicId().equals(clinicId) && isTimeWithinShift(time, shift)) {
                    available.add(member);
                    break;
                }
            }
        }

        return available;
    }

    /**
     * Check if time falls within shift hours
     */
    private boolean isTimeWithinShift(LocalTime time, StaffShift shift) {
        LocalTime start = shift.getStartTime();
        LocalTime end = shift.getEndTime();
        boolean isOvernight = shift.getIsOvernight() != null && shift.getIsOvernight();

        if (isOvernight) {
            // Overnight shift: start before midnight, end after midnight
            return time.isAfter(start) || time.isBefore(end) || time.equals(start);
        } else {
            // Normal shift
            return !time.isBefore(start) && time.isBefore(end);
        }
    }

    /**
     * Select staff with least bookings on the given date (load balancing)
     */
    private User selectStaffWithLeastBookings(List<User> staff, LocalDate date) {
        User selectedStaff = null;
        long minBookings = Long.MAX_VALUE;

        for (User member : staff) {
            long bookingCount = bookingRepository.countActiveBookingsByStaffAndDate(member.getUserId(), date);

            if (bookingCount < minBookings) {
                minBookings = bookingCount;
                selectedStaff = member;
            }
        }

        return selectedStaff;
    }

    /**
     * Reserve slots for a booking after staff assignment
     * - Find matching slots based on booking time and assigned staff's shift
     * - Create BookingSlot records to link Booking ↔ Slot
     * - Update Slot.status = BOOKED
     *
     * @param booking The booking to reserve slots for
     */
    public void reserveSlotsForBooking(Booking booking) {
        log.info("Reserving slots for booking {}", booking.getBookingCode());

        LocalDate bookingDate = booking.getBookingDate();
        LocalTime currentSlotTime = booking.getBookingTime(); // Track current time position

        // Process services IN ORDER (sequentially, not grouped by staff)
        // This ensures services are scheduled one after another
        for (BookingServiceItem item : booking.getBookingServices()) {
            if (item.getAssignedStaff() == null) {
                log.warn("Service '{}' has no assigned staff, skipping", item.getService().getName());
                continue;
            }

            UUID staffId = item.getAssignedStaff().getUserId();
            Integer duration = item.getService().getDurationTime();
            int slotsNeeded = (duration != null && duration > 0)
                    ? (int) Math.ceil(duration / 30.0)
                    : 1;

            log.info("Service '{}' (staff {}) duration={}min needs {} slots starting at {}",
                    item.getService().getName(), staffId, duration, slotsNeeded, currentSlotTime);

            // Create final copy for use in lambdas
            final LocalTime slotStartTime = currentSlotTime;

            // Find staff's shift on booking date
            List<StaffShift> shifts = staffShiftRepository.findByStaff_UserIdAndWorkDate(staffId, bookingDate);
            StaffShift matchingShift = shifts.stream()
                    .filter(s -> isTimeWithinShift(slotStartTime, s))
                    .findFirst()
                    .orElse(null);

            if (matchingShift == null) {
                log.warn("No matching shift found for staff {} on {} at {}", staffId, bookingDate, slotStartTime);
                continue;
            }

            // Find CONSECUTIVE available slots starting EXACTLY at slotStartTime
            List<Slot> allAvailableSlots = slotRepository
                    .findByShift_ShiftIdAndStatusOrderByStartTime(matchingShift.getShiftId(), SlotStatus.AVAILABLE);

            List<Slot> consecutiveSlots = new ArrayList<>();
            LocalTime expectedStart = slotStartTime;

            for (Slot slot : allAvailableSlots) {
                if (slot.getStartTime().equals(expectedStart)) {
                    consecutiveSlots.add(slot);
                    expectedStart = slot.getEndTime();
                    if (consecutiveSlots.size() >= slotsNeeded)
                        break;
                } else if (slot.getStartTime().isAfter(slotStartTime) && consecutiveSlots.isEmpty()) {
                    // First slot must start exactly at slotStartTime, skip slots before
                    continue;
                } else if (!consecutiveSlots.isEmpty() && !slot.getStartTime().equals(expectedStart)) {
                    // Gap in consecutive slots - stop looking
                    break;
                }
            }

            if (consecutiveSlots.size() < slotsNeeded) {
                log.error("Cannot find {} consecutive slots starting at {} for service '{}' (found: {})",
                        slotsNeeded, slotStartTime, item.getService().getName(), consecutiveSlots.size());
                throw new RuntimeException("Không đủ slot liên tiếp cho dịch vụ: " + item.getService().getName());
            }

            // Reserve each slot
            for (Slot slot : consecutiveSlots) {
                slot.setStatus(SlotStatus.BOOKED);
                slotRepository.save(slot);

                BookingSlot bookingSlot = BookingSlot.builder()
                        .booking(booking)
                        .slot(slot)
                        .bookingServiceItem(item)
                        .build();
                bookingSlotRepository.save(bookingSlot);

                log.debug("Reserved slot {} ({}-{}) for service '{}'",
                        slot.getSlotId(), slot.getStartTime(), slot.getEndTime(), item.getService().getName());
            }

            // Advance current time position to end of last reserved slot
            Slot lastSlot = consecutiveSlots.get(consecutiveSlots.size() - 1);
            currentSlotTime = lastSlot.getEndTime();
            log.info("Advanced time position to {} after service '{}'",
                    currentSlotTime, item.getService().getName());
        }

        log.info("Completed slot reservation for booking {}", booking.getBookingCode());
    }

    /**
     * Release slots when a booking is cancelled
     * - Find all BookingSlot records for this booking
     * - Update Slot.status = AVAILABLE
     * - Delete BookingSlot records
     *
     * @param booking The booking being cancelled
     */
    public void releaseSlotsForBooking(Booking booking) {
        log.info("Releasing slots for cancelled booking {} (ID: {})",
                booking.getBookingCode(), booking.getBookingId());

        List<BookingSlot> bookingSlots = bookingSlotRepository.findByBooking_BookingId(booking.getBookingId());

        if (bookingSlots.isEmpty()) {
            log.warn("No BookingSlot records found for booking {} - slots may not have been reserved",
                    booking.getBookingCode());
            return;
        }

        log.info("Found {} BookingSlot records to release", bookingSlots.size());

        for (BookingSlot bookingSlot : bookingSlots) {
            Slot slot = bookingSlot.getSlot();

            if (slot == null) {
                log.error("BookingSlot {} has null Slot reference", bookingSlot.getBookingSlotId());
                continue;
            }

            log.debug("Releasing slot {} ({}-{}) from status {} to AVAILABLE",
                    slot.getSlotId(), slot.getStartTime(), slot.getEndTime(), slot.getStatus());

            // Update slot status back to AVAILABLE
            slot.setStatus(SlotStatus.AVAILABLE);
            slotRepository.save(slot);
        }

        // Delete all BookingSlot records
        bookingSlotRepository.deleteAll(bookingSlots);

        log.info("Successfully released {} slots for cancelled booking {}",
                bookingSlots.size(), booking.getBookingCode());
    }

    // ========== REASSIGN STAFF FEATURE ==========

    /**
     * Get available staff for reassignment
     * Returns all staff with matching specialty, with availability status
     * Excludes the currently assigned staff from the list
     *
     * @param clinicId       Clinic context
     * @param date           Booking date
     * @param time           Booking time
     * @param specialty      Required specialty
     * @param slotsNeeded    Number of slots required
     * @param currentStaffId Currently assigned staff to exclude (can be null)
     * @return List of available staff with their status
     */
    public List<AvailableStaffResponse> getAvailableStaffForReassign(
            UUID clinicId, LocalDate date, LocalTime time,
            StaffSpecialty specialty, int slotsNeeded, UUID currentStaffId) {

        log.info(
                "Getting available staff for reassign: clinic={}, date={}, time={}, specialty={}, slots={}, excludeStaff={}",
                clinicId, date, time, specialty, slotsNeeded, currentStaffId);

        List<AvailableStaffResponse> result = new ArrayList<>();

        // Find all staff with matching specialty at clinic
        List<User> staff = findStaffWithSpecialty(clinicId, specialty);

        // Also add VET_GENERAL as fallback (they can handle most services except
        // GROOMER)
        if (specialty != StaffSpecialty.VET_GENERAL && specialty != StaffSpecialty.GROOMER) {
            List<User> generalStaff = findStaffWithSpecialty(clinicId, StaffSpecialty.VET_GENERAL);
            staff.addAll(generalStaff);
        }

        log.info("Found {} staff with specialty {} (including fallback) at clinic", staff.size(), specialty);

        for (User member : staff) {
            // Skip the currently assigned staff - they should not appear in the list
            if (currentStaffId != null && member.getUserId().equals(currentStaffId)) {
                log.debug("Skipping currently assigned staff: {}", member.getFullName());
                continue;
            }
            AvailableStaffResponse response = AvailableStaffResponse.builder()
                    .staffId(member.getUserId())
                    .staffName(member.getFullName())
                    .avatarUrl(member.getAvatar())
                    .specialty(member.getSpecialty() != null ? member.getSpecialty().name() : null)
                    .build();

            // Check if staff has shift on this date
            List<StaffShift> shifts = staffShiftRepository.findByStaff_UserIdAndWorkDate(member.getUserId(), date);
            StaffShift matchingShift = shifts.stream()
                    .filter(s -> isTimeWithinShift(time, s))
                    .findFirst()
                    .orElse(null);

            if (matchingShift == null) {
                response.setAvailable(false);
                response.setUnavailableReason("Không có ca làm việc");
                response.setBookedCount(0);
                response.setAvailableSlots(new ArrayList<>());
            } else {
                // Get available slots
                List<Slot> availableSlots = slotRepository
                        .findByShift_ShiftIdAndStatusOrderByStartTime(matchingShift.getShiftId(), SlotStatus.AVAILABLE)
                        .stream()
                        .filter(s -> !s.getStartTime().isBefore(time))
                        .collect(Collectors.toList());

                // Count booked slots for this staff today
                long bookedCount = slotRepository
                        .findByShift_ShiftIdAndStatusOrderByStartTime(matchingShift.getShiftId(), SlotStatus.BOOKED)
                        .size();

                List<String> slotTimes = availableSlots.stream()
                        .map(s -> s.getStartTime().toString().substring(0, 5))
                        .collect(Collectors.toList());

                boolean hasEnoughSlots = availableSlots.size() >= slotsNeeded;

                response.setAvailable(hasEnoughSlots);
                response.setBookedCount((int) bookedCount);
                response.setAvailableSlots(slotTimes);

                if (!hasEnoughSlots) {
                    response.setUnavailableReason(
                            "Không đủ slot trống (cần " + slotsNeeded + ", còn " + availableSlots.size() + ")");
                }
            }

            result.add(response);
        }

        // Sort: available first, then by booked count (ascending)
        result.sort((a, b) -> {
            if (a.isAvailable() != b.isAvailable()) {
                return a.isAvailable() ? -1 : 1;
            }
            return Integer.compare(a.getBookedCount(), b.getBookedCount());
        });

        return result;
    }

    /**
     * Reassign staff for a specific booking service item
     * - Release old slots for this service FIRST
     * - Update BookingServiceItem.assignedStaff
     * - Reserve new slots with new staff at the EXACT start time
     *
     * @param bookingServiceItemId         The service item to reassign
     * @param newStaffId                   The new staff to assign
     * @param bookingServiceItemRepository Repository for service items
     */
    @org.springframework.transaction.annotation.Transactional
    public void reassignStaffForService(
            UUID bookingServiceItemId,
            UUID newStaffId,
            com.petties.petties.repository.BookingServiceItemRepository bookingServiceItemRepository) {

        log.info("Reassigning staff for service item {} to staff {}", bookingServiceItemId, newStaffId);

        // Get the service item
        BookingServiceItem serviceItem = bookingServiceItemRepository.findById(bookingServiceItemId)
                .orElseThrow(
                        () -> new ResourceNotFoundException("BookingServiceItem not found: " + bookingServiceItemId));

        // Get new staff
        User newStaff = userRepository.findById(newStaffId)
                .orElseThrow(() -> new ResourceNotFoundException("Staff not found: " + newStaffId));

        Booking booking = serviceItem.getBooking();
        User oldStaff = serviceItem.getAssignedStaff();

        log.info("Reassigning service '{}' from {} to {}",
                serviceItem.getService().getName(),
                oldStaff != null ? oldStaff.getFullName() : "unassigned",
                newStaff.getFullName());

        // Calculate slots needed for this service
        Integer duration = serviceItem.getService().getDurationTime();
        int slotsNeeded = (duration != null && duration > 0)
                ? (int) Math.ceil(duration / 30.0)
                : 1;

        // Find order index of this service to calculate start time
        List<BookingServiceItem> allServices = booking.getBookingServices();
        int serviceIndex = -1;
        for (int i = 0; i < allServices.size(); i++) {
            if (allServices.get(i).getBookingServiceId().equals(bookingServiceItemId)) {
                serviceIndex = i;
                break;
            }
        }

        // Calculate start time for this service
        LocalTime calculatedStartTime = booking.getBookingTime();
        for (int i = 0; i < serviceIndex; i++) {
            Integer prevDuration = allServices.get(i).getService().getDurationTime();
            int prevSlots = (prevDuration != null && prevDuration > 0)
                    ? (int) Math.ceil(prevDuration / 30.0)
                    : 1;
            calculatedStartTime = calculatedStartTime.plusMinutes(prevSlots * 30L);
        }
        final LocalTime startTime = calculatedStartTime;

        log.info("Service starts at {}, needs {} slots", startTime, slotsNeeded);

        // ========== STEP 1: RELEASE OLD SLOTS FOR THIS SERVICE ==========
        // Find BookingSlots linked to this specific BookingServiceItem
        List<BookingSlot> oldBookingSlots = bookingSlotRepository
                .findByBookingServiceItem_BookingServiceId(bookingServiceItemId);
        log.info("Found {} old booking slots to release for service item {}", oldBookingSlots.size(),
                bookingServiceItemId);

        for (BookingSlot bookingSlot : oldBookingSlots) {
            Slot slot = bookingSlot.getSlot();
            if (slot != null) {
                log.debug("Releasing slot {} ({}-{}) from status {} to AVAILABLE",
                        slot.getSlotId(), slot.getStartTime(), slot.getEndTime(), slot.getStatus());
                slot.setStatus(SlotStatus.AVAILABLE);
                slotRepository.save(slot);
            }
        }

        // Delete old BookingSlot records
        if (!oldBookingSlots.isEmpty()) {
            bookingSlotRepository.deleteAll(oldBookingSlots);
            log.info("Deleted {} old BookingSlot records", oldBookingSlots.size());
        }

        // ========== STEP 2: UPDATE ASSIGNED STAFF ==========
        serviceItem.setAssignedStaff(newStaff);
        bookingServiceItemRepository.save(serviceItem);

        // ========== STEP 3: RESERVE NEW SLOTS AT EXACT START TIME ==========
        LocalDate bookingDate = booking.getBookingDate();
        List<StaffShift> shifts = staffShiftRepository.findByStaff_UserIdAndWorkDate(newStaffId, bookingDate);
        StaffShift matchingShift = shifts.stream()
                .filter(s -> isTimeWithinShift(startTime, s))
                .findFirst()
                .orElse(null);

        if (matchingShift != null) {
            // Find CONSECUTIVE available slots starting EXACTLY at startTime
            List<Slot> allAvailableSlots = slotRepository
                    .findByShift_ShiftIdAndStatusOrderByStartTime(matchingShift.getShiftId(), SlotStatus.AVAILABLE);

            List<Slot> consecutiveSlots = new ArrayList<>();
            LocalTime expectedStart = startTime;

            for (Slot slot : allAvailableSlots) {
                if (slot.getStartTime().equals(expectedStart)) {
                    consecutiveSlots.add(slot);
                    expectedStart = slot.getEndTime();
                    if (consecutiveSlots.size() >= slotsNeeded)
                        break;
                } else if (!consecutiveSlots.isEmpty() && !slot.getStartTime().equals(expectedStart)) {
                    // Gap in consecutive slots - stop looking
                    break;
                }
            }

            if (consecutiveSlots.size() < slotsNeeded) {
                log.error("Cannot find {} consecutive slots starting at {} for reassigned service (found: {})",
                        slotsNeeded, startTime, consecutiveSlots.size());
                throw new RuntimeException("Không đủ slot liên tiếp cho dịch vụ tại thời gian " + startTime);
            }

            for (Slot slot : consecutiveSlots) {
                slot.setStatus(SlotStatus.BOOKED);
                slotRepository.save(slot);

                BookingSlot bookingSlot = BookingSlot.builder()
                        .booking(booking)
                        .slot(slot)
                        .bookingServiceItem(serviceItem)
                        .build();
                bookingSlotRepository.save(bookingSlot);

                log.debug("Reserved slot {} ({}-{}) for reassigned service",
                        slot.getSlotId(), slot.getStartTime(), slot.getEndTime());
            }

            log.info("Reserved {} consecutive slots starting at {} for reassigned service",
                    consecutiveSlots.size(), startTime);
        } else {
            log.warn("No matching shift found for new staff {} on {} at {}",
                    newStaffId, bookingDate, startTime);
            throw new RuntimeException("Nhân viên không có ca làm việc phù hợp tại thời gian " + startTime);
        }

        log.info("Successfully reassigned service to staff {}", newStaff.getFullName());
    }

    // ========== STAFF AVAILABILITY CHECK ==========

    /**
     * Check staff availability for all services in a booking
     * Used BEFORE confirming a booking to warn the manager
     *
     * @param booking The booking to check
     * @return Availability check result with suggestions
     */
    public StaffAvailabilityCheckResponse checkStaffAvailabilityForBooking(Booking booking) {
        log.info("Checking staff availability for booking {}", booking.getBookingCode());

        UUID clinicId = booking.getClinic().getClinicId();
        LocalDate bookingDate = booking.getBookingDate();
        LocalTime currentTime = booking.getBookingTime();

        List<ServiceAvailability> serviceResults = new ArrayList<>();
        Set<StaffSpecialty> missingSpecialties = new HashSet<>();
        BigDecimal priceReduction = BigDecimal.ZERO;
        boolean allHaveStaff = true;

        // Check each service
        for (BookingServiceItem item : booking.getBookingServices()) {
            StaffSpecialty requiredSpecialty = getSpecialtyForService(item);
            String specialtyLabel = requiredSpecialty != null
                    ? requiredSpecialty.getVietnameseLabel()
                    : "Chưa xác định";

            // Calculate slots needed
            Integer duration = item.getService().getDurationTime();
            int slotsNeeded = (duration != null && duration > 0)
                    ? (int) Math.ceil(duration / 30.0)
                    : 1;

            // Find available staff for this specialty at this time
            User availableStaff = findAvailableStaffForSpecialtyAtTime(
                    clinicId, bookingDate, currentTime, requiredSpecialty, slotsNeeded);

            ServiceAvailability.ServiceAvailabilityBuilder builder = ServiceAvailability.builder()
                    .bookingServiceId(item.getBookingServiceId())
                    .serviceName(item.getService().getName())
                    .serviceCategory(item.getService().getServiceCategory() != null
                            ? item.getService().getServiceCategory().name()
                            : null)
                    .requiredSpecialty(requiredSpecialty != null ? requiredSpecialty.name() : null)
                    .requiredSpecialtyLabel(specialtyLabel)
                    .price(item.getUnitPrice());

            if (availableStaff != null) {
                builder.hasAvailableStaff(true)
                        .suggestedStaffId(availableStaff.getUserId())
                        .suggestedStaffName(availableStaff.getFullName())
                        .suggestedStaffAvatarUrl(availableStaff.getAvatar())
                        .suggestedStaffSpecialty(availableStaff.getSpecialty() != null
                                ? availableStaff.getSpecialty().name()
                                : null);
            } else {
                builder.hasAvailableStaff(false)
                        .unavailableReason("Không có " + specialtyLabel + " có ca làm việc");
                allHaveStaff = false;
                missingSpecialties.add(requiredSpecialty);
                priceReduction = priceReduction.add(
                        item.getUnitPrice() != null ? item.getUnitPrice() : BigDecimal.ZERO);
            }

            serviceResults.add(builder.build());

            // Advance time for next service
            currentTime = currentTime.plusMinutes(slotsNeeded * 30L);
        }

        // Find alternative time slots for missing specialties
        List<AlternativeTimeSlot> alternatives = new ArrayList<>();
        if (!missingSpecialties.isEmpty()) {
            alternatives = findAlternativeTimeSlots(
                    clinicId, bookingDate, missingSpecialties, 7, 5);
        }

        StaffAvailabilityCheckResponse response = StaffAvailabilityCheckResponse.builder()
                .allServicesHaveStaff(allHaveStaff)
                .services(serviceResults)
                .alternativeTimeSlots(alternatives)
                .priceReductionIfRemoved(priceReduction)
                .build();

        log.info("Availability check result: allHaveStaff={}, servicesChecked={}, alternatives={}",
                allHaveStaff, serviceResults.size(), alternatives.size());

        return response;
    }

    /**
     * Find available staff for a specialty at EXACT time (checking consecutive
     * slots)
     */
    private User findAvailableStaffForSpecialtyAtTime(
            UUID clinicId, LocalDate date, LocalTime time,
            StaffSpecialty specialty, int slotsNeeded) {

        List<User> matchingStaff = findStaffWithSpecialty(clinicId, specialty);

        if (matchingStaff.isEmpty() && specialty != StaffSpecialty.VET_GENERAL && specialty != StaffSpecialty.GROOMER) {
            matchingStaff = findStaffWithSpecialty(clinicId, StaffSpecialty.VET_GENERAL);
        }

        if (matchingStaff.isEmpty()) {
            return null;
        }

        // Filter by shift availability at EXACT time
        for (User member : matchingStaff) {
            List<StaffShift> shifts = staffShiftRepository.findByStaff_UserIdAndWorkDate(member.getUserId(), date);
            StaffShift matchingShift = shifts.stream()
                    .filter(s -> s.getClinic().getClinicId().equals(clinicId) && isTimeWithinShift(time, s))
                    .findFirst()
                    .orElse(null);

            if (matchingShift == null) {
                continue;
            }

            // Check for consecutive available slots starting at exact time
            List<Slot> allAvailableSlots = slotRepository
                    .findByShift_ShiftIdAndStatusOrderByStartTime(matchingShift.getShiftId(), SlotStatus.AVAILABLE);

            List<Slot> consecutiveSlots = new ArrayList<>();
            LocalTime expectedStart = time;

            for (Slot slot : allAvailableSlots) {
                if (slot.getStartTime().equals(expectedStart)) {
                    consecutiveSlots.add(slot);
                    expectedStart = slot.getEndTime();
                    if (consecutiveSlots.size() >= slotsNeeded) {
                        return member; // Found a staff with enough consecutive slots
                    }
                } else if (!consecutiveSlots.isEmpty() && !slot.getStartTime().equals(expectedStart)) {
                    break; // Gap in consecutive slots
                }
            }
        }

        return null;
    }

    /**
     * Find alternative time slots when staff are not available
     *
     * @param clinicId           Clinic context
     * @param originalDate       Original booking date
     * @param missingSpecialties Specialties that don't have available staff
     * @param daysToSearch       Number of days to search ahead
     * @param maxResults         Max number of alternatives to return
     * @return List of alternative time slot suggestions
     */
    public List<AlternativeTimeSlot> findAlternativeTimeSlots(
            UUID clinicId, LocalDate originalDate,
            Set<StaffSpecialty> missingSpecialties,
            int daysToSearch, int maxResults) {

        log.info("Finding alternative time slots for specialties: {}", missingSpecialties);

        List<AlternativeTimeSlot> alternatives = new ArrayList<>();

        for (StaffSpecialty specialty : missingSpecialties) {
            String specialtyLabel = specialty != null
                    ? specialty.getVietnameseLabel()
                    : "Chưa xác định";

            // Search for the next N days
            for (int dayOffset = 0; dayOffset <= daysToSearch && alternatives.size() < maxResults; dayOffset++) {
                LocalDate searchDate = originalDate.plusDays(dayOffset);

                // Find staff with this specialty
                List<User> staff = findStaffWithSpecialty(clinicId, specialty);

                for (User member : staff) {
                    if (alternatives.size() >= maxResults) {
                        break;
                    }

                    // Check if staff has shift on this date
                    List<StaffShift> shifts = staffShiftRepository.findByStaff_UserIdAndWorkDate(member.getUserId(),
                            searchDate);
                    StaffShift matchingShift = shifts.stream()
                            .filter(s -> s.getClinic().getClinicId().equals(clinicId))
                            .findFirst()
                            .orElse(null);

                    if (matchingShift == null) {
                        continue;
                    }

                    // Get available slots
                    List<Slot> availableSlots = slotRepository
                            .findByShift_ShiftIdAndStatusOrderByStartTime(matchingShift.getShiftId(),
                                    SlotStatus.AVAILABLE);

                    if (availableSlots.isEmpty()) {
                        continue;
                    }

                    // Collect available times
                    List<String> availableTimes = availableSlots.stream()
                            .map(s -> s.getStartTime().toString().substring(0, 5))
                            .limit(5) // Max 5 times per entry
                            .collect(java.util.stream.Collectors.toList());

                    if (!availableTimes.isEmpty()) {
                        alternatives.add(AlternativeTimeSlot.builder()
                                .specialty(specialty != null ? specialty.name() : null)
                                .specialtyLabel(specialtyLabel)
                                .date(searchDate)
                                .availableTimes(availableTimes)
                                .staffName(member.getFullName())
                                .staffId(member.getUserId())
                                .build());
                    }
                }
            }
        }

        log.info("Found {} alternative time slots", alternatives.size());
        return alternatives;
    }

    // ========== GET AVAILABLE STAFF FOR BOOKING CONFIRM ==========

    /**
     * Get all available staff for a booking confirmation
     * Used for the dropdown to allow manual staff selection
     *
     * Logic:
     * 1. Get all services in booking
     * 2. For each service, determine required specialty
     * 3. Find ALL staff in clinic that can handle ANY of the required specialties
     * 4. Check each staff's availability (has shift with available slots)
     * 5. Mark suggested staff (from checkStaffAvailabilityForBooking)
     *
     * @param booking The booking to get available staff for
     * @return List of StaffOptionDTO sorted by availability and workload
     */
    public List<StaffOptionDTO> getAvailableStaffForBookingConfirm(Booking booking) {
        log.info("Getting available staff for booking confirm: {}", booking.getBookingCode());

        UUID clinicId = booking.getClinic().getClinicId();
        LocalDate bookingDate = booking.getBookingDate();
        LocalTime bookingTime = booking.getBookingTime();

        // Step 1: Get all required specialties from services
        Set<StaffSpecialty> requiredSpecialties = new HashSet<>();
        int totalSlotsNeeded = 0;

        log.info("Getting available staff for booking confirmation {}. Services categories: {}",
                booking.getBookingCode(),
                booking.getBookingServices().stream().map(s -> s.getService().getServiceCategory())
                        .collect(Collectors.toList()));

        for (BookingServiceItem item : booking.getBookingServices()) {
            StaffSpecialty specialty = getSpecialtyForService(item);
            requiredSpecialties.add(specialty);

            Integer duration = item.getService().getDurationTime();
            int slotsNeeded = (duration != null && duration > 0)
                    ? (int) Math.ceil(duration / 30.0)
                    : 1;
            totalSlotsNeeded += slotsNeeded;
        }

        log.info("Required specialties for booking: {}, total slots needed: {}", requiredSpecialties, totalSlotsNeeded);

        // Step 2: Find all staff that can handle ANY of the required specialties
        Set<User> allMatchingStaff = new HashSet<>();
        for (StaffSpecialty specialty : requiredSpecialties) {
            List<User> staff = findStaffWithSpecialty(clinicId, specialty);
            allMatchingStaff.addAll(staff);

            // Also add VET_GENERAL as fallback (they can handle most services)
            if (specialty != StaffSpecialty.VET_GENERAL && specialty != StaffSpecialty.GROOMER) {
                List<User> generalStaff = findStaffWithSpecialty(clinicId, StaffSpecialty.VET_GENERAL);
                allMatchingStaff.addAll(generalStaff);
            }
        }

        log.info("Found {} matching staff for all required specialties", allMatchingStaff.size());

        // Step 3: Get suggested staff from availability check
        UUID suggestedStaffId = null;
        StaffAvailabilityCheckResponse availabilityCheck = checkStaffAvailabilityForBooking(booking);
        if (availabilityCheck.isAllServicesHaveStaff() && !availabilityCheck.getServices().isEmpty()) {
            // Get the first service's suggested staff as the primary suggested staff
            suggestedStaffId = availabilityCheck.getServices().get(0).getSuggestedStaffId();
        }
        final UUID finalSuggestedStaffId = suggestedStaffId;

        // Step 4: Build StaffOptionDTO for each staff
        List<StaffOptionDTO> result = new ArrayList<>();

        for (User member : allMatchingStaff) {
            StaffOptionDTO.StaffOptionDTOBuilder builder = StaffOptionDTO.builder()
                    .staffId(member.getUserId())
                    .fullName(member.getFullName())
                    .avatarUrl(member.getAvatar())
                    .specialty(member.getSpecialty() != null ? member.getSpecialty().name() : null)
                    .specialtyLabel(member.getSpecialty() != null ? member.getSpecialty().getVietnameseLabel() : null)
                    .isSuggested(member.getUserId().equals(finalSuggestedStaffId));

            // Check if staff has shift on booking date
            List<StaffShift> shifts = staffShiftRepository.findByStaff_UserIdAndWorkDate(member.getUserId(),
                    bookingDate);
            StaffShift matchingShift = shifts.stream()
                    .filter(s -> s.getClinic().getClinicId().equals(clinicId) && isTimeWithinShift(bookingTime, s))
                    .findFirst()
                    .orElse(null);

            if (matchingShift == null) {
                builder.hasAvailableSlots(false)
                        .unavailableReason("Không có ca làm việc vào thời gian này")
                        .bookingCount(0);
            } else {
                // Count available slots at exact booking time
                List<Slot> availableSlots = slotRepository
                        .findByShift_ShiftIdAndStatusOrderByStartTime(matchingShift.getShiftId(), SlotStatus.AVAILABLE);

                // Find consecutive slots starting at booking time
                List<Slot> consecutiveSlots = new ArrayList<>();
                LocalTime expectedStart = bookingTime;

                for (Slot slot : availableSlots) {
                    if (slot.getStartTime().equals(expectedStart)) {
                        consecutiveSlots.add(slot);
                        expectedStart = slot.getEndTime();
                        if (consecutiveSlots.size() >= totalSlotsNeeded)
                            break;
                    } else if (!consecutiveSlots.isEmpty() && !slot.getStartTime().equals(expectedStart)) {
                        break; // Gap in consecutive slots
                    }
                }

                boolean hasEnoughSlots = consecutiveSlots.size() >= totalSlotsNeeded;

                // Count bookings for this staff on booking date
                long bookingCount = bookingRepository.countActiveBookingsByStaffAndDate(member.getUserId(),
                        bookingDate);

                builder.hasAvailableSlots(hasEnoughSlots)
                        .bookingCount((int) bookingCount);

                if (!hasEnoughSlots) {
                    builder.unavailableReason(
                            "Không đủ slot trống (cần " + totalSlotsNeeded + ", có " + consecutiveSlots.size() + ")");
                }
            }

            result.add(builder.build());
        }

        // Step 5: Sort by: suggested first, then available, then by booking count
        result.sort((a, b) -> {
            // Suggested staff first
            if (a.isSuggested() != b.isSuggested()) {
                return a.isSuggested() ? -1 : 1;
            }
            // Available staff before unavailable
            if (a.isHasAvailableSlots() != b.isHasAvailableSlots()) {
                return a.isHasAvailableSlots() ? -1 : 1;
            }
            // Lower booking count first (load balancing)
            return Integer.compare(a.getBookingCount(), b.getBookingCount());
        });

        log.info("Returning {} staff options for booking {}", result.size(), booking.getBookingCode());
        return result;
    }

    /**
     * Find available time slots using Smart Availability Algorithm
     * Returns list of start times where ALL services can be fulfilled consecutively
     *
     * Algorithm:
     * 1. Fetch all services with their required specialties
     * 2. Query staff with matching specialties for each service
     * 3. Check staff shifts for the specified date
     * 4. Filter out already booked slots
     * 5. For multi-service: validate consecutive slots can be fulfilled
     *
     * @param clinicId   Clinic ID
     * @param date       Booking date
     * @param serviceIds List of service IDs
     * @return List of valid start times (LocalTime)
     */
    public List<LocalTime> findAvailableSlots(UUID clinicId, LocalDate date, List<UUID> serviceIds) {
        log.info("Finding available slots for clinic {}, date {}, services {}", clinicId, date, serviceIds);

        // Step 1: Fetch services and determine required specialties
        List<com.petties.petties.model.ClinicService> services = new ArrayList<>();
        Map<com.petties.petties.model.ClinicService, StaffSpecialty> requiredSpecialties = new HashMap<>();

        for (UUID serviceId : serviceIds) {
            com.petties.petties.model.ClinicService service = clinicServiceRepository.findById(serviceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Service not found: " + serviceId));

            services.add(service);

            StaffSpecialty required = service.getServiceCategory() != null
                    ? service.getServiceCategory().getRequiredSpecialty()
                    : StaffSpecialty.VET_GENERAL;
            requiredSpecialties.put(service, required);

            log.debug("Service {} requires specialty {}", service.getName(), required);
        }

        // Step 2: Get all staff in clinic
        List<User> allStaff = userRepository.findByWorkingClinicIdAndRole(clinicId, Role.STAFF);
        log.debug("Found {} staff in clinic", allStaff.size());

        // Step 3: Filter staff by specialty for EACH service
        Map<com.petties.petties.model.ClinicService, List<User>> matchingStaff = new HashMap<>();
        for (com.petties.petties.model.ClinicService service : services) {
            StaffSpecialty required = requiredSpecialties.get(service);
            List<User> staffForService = allStaff.stream()
                    .filter(member -> member.getSpecialty() == required)
                    .collect(Collectors.toList());
            matchingStaff.put(service, staffForService);

            log.debug("Service {} matched with {} staff", service.getName(), staffForService.size());

            if (staffForService.isEmpty()) {
                log.warn("No staff found for specialty {}", required);
                return Collections.emptyList(); // Cannot fulfill this service
            }
        }

        // Step 4: Get all staff shifts for the date
        List<StaffShift> shifts = staffShiftRepository.findByClinic_ClinicIdAndWorkDate(clinicId, date);
        log.debug("Found {} shifts on date {}", shifts.size(), date);

        // Step 5: Generate all possible 30-minute slots (08:00 - 20:00)
        List<LocalTime> allPossibleSlots = new ArrayList<>();
        LocalTime start = LocalTime.of(8, 0);
        LocalTime end = LocalTime.of(20, 0);
        LocalTime current = start;

        while (current.isBefore(end)) {
            allPossibleSlots.add(current);
            current = current.plusMinutes(30);
        }

        log.debug("Checking {} possible time slots", allPossibleSlots.size());

        // Step 6: Check EACH slot for validity
        List<LocalTime> availableSlots = new ArrayList<>();

        for (LocalTime startTime : allPossibleSlots) {
            boolean isValid = true;
            LocalTime currentTime = startTime;

            // Check EACH service in sequence (consecutive slots)
            for (com.petties.petties.model.ClinicService service : services) {
                // Calculate end time for this service
                int durationMinutes = service.getDurationTime();
                LocalTime endTime = currentTime.plusMinutes(durationMinutes);
                final LocalTime slotStart = currentTime; // Effective final for lambda

                // Check if ANY staff with required specialty is free
                List<User> staffForService = matchingStaff.get(service);
                boolean hasAvailableStaff = false;

                for (User member : staffForService) {
                    // Check if staff has shift covering this time range
                    boolean hasShift = shifts.stream()
                            .anyMatch(shift -> shift.getStaff().getUserId().equals(member.getUserId()) &&
                                    !shift.getStartTime().isAfter(slotStart) && // Use slotStart here
                                    !shift.getEndTime().isBefore(endTime));

                    if (!hasShift) {
                        continue;
                    }

                    // Check if staff is free (no bookings in this time range)
                    boolean isStaffFree = !hasBookingInTimeRange(member.getUserId(), date, currentTime, endTime);

                    if (isStaffFree) {
                        hasAvailableStaff = true;
                        break; // Found one available staff, that's enough
                    }
                }

                if (!hasAvailableStaff) {
                    isValid = false;
                    break; // This service can't be fulfilled at this time
                }

                // Move time cursor to next service
                currentTime = endTime;
            }

            if (isValid) {
                availableSlots.add(startTime);
            }
        }

        log.info("Found {} available slots for services {}", availableSlots.size(), serviceIds);
        return availableSlots;
    }

    /**
     * Helper: Check if staff has any booking in the specified time range
     */
    private boolean hasBookingInTimeRange(UUID staffId, LocalDate date, LocalTime startTime, LocalTime endTime) {
        List<Booking> staffBookings = bookingRepository.findByStaffIdAndDate(staffId, date);

        for (Booking booking : staffBookings) {
            LocalTime bookingStart = booking.getBookingTime();

            // Calculate total duration from all booking services
            int totalDuration = booking.getBookingServices().stream()
                    .mapToInt(item -> item.getService().getDurationTime())
                    .sum();
            LocalTime bookingEnd = bookingStart.plusMinutes(totalDuration);

            // Check for overlap
            boolean overlaps = !bookingEnd.isBefore(startTime) && !bookingStart.isAfter(endTime);
            if (overlaps) {
                return true;
            }
        }

        return false;
    }
}
