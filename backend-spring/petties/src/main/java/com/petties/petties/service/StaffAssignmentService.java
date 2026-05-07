package com.petties.petties.service;

import com.petties.petties.dto.booking.*;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.*;
import com.petties.petties.model.enums.Role;
import com.petties.petties.model.enums.SlotStatus;
import com.petties.petties.model.enums.StaffSpecialty;
import com.petties.petties.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StaffAssignmentService {

    private final UserRepository userRepository;
    private final StaffShiftRepository staffShiftRepository;
    private final SlotRepository slotRepository;
    private final BookingRepository bookingRepository;
    private final BookingSlotRepository bookingSlotRepository;
    private final ClinicServiceRepository clinicServiceRepository;
    private final BookingServiceItemRepository bookingServiceItemRepository;

    // ========== PUBLIC METHODS FOR BOOKING WORKFLOW ==========

    /**
     * Auto-assign staff to all services in a booking (Smart Assignment)
     */
    @Transactional
    public void autoAssignStaff(UUID bookingId) {
        log.info("Auto-assigning staff for booking {}", bookingId);

        Booking booking = bookingRepository.findByIdWithDetails(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found: " + bookingId));

        assignStaffToAllServices(booking);
    }

    /**
     * Overload for autoAssignStaff using Booking object directly
     */
    @Transactional
    public User autoAssignStaff(Booking booking) {
        assignStaffToAllServices(booking);
        return booking.getAssignedStaff();
    }

    /**
     * Core logic for assigning staff to all services in a booking
     */
    @Transactional
    public Map<UUID, User> assignStaffToAllServices(Booking booking) {
        log.info("Assigning staff to all services for booking {}", booking.getBookingCode());
        boolean isSOS = booking.getType() == com.petties.petties.model.enums.BookingType.SOS;
        Map<UUID, User> assignments = new HashMap<>();
        UUID clinicId = booking.getClinic().getClinicId();

        // Special case: SOS booking with no services yet
        if (isSOS && (booking.getBookingServices() == null || booking.getBookingServices().isEmpty())) {
            User sosStaff = userRepository.findByWorkingClinicIdAndRole(clinicId, Role.STAFF).stream().findFirst().orElse(null);
            if (sosStaff != null) {
                booking.setAssignedStaff(sosStaff);
                bookingRepository.save(booking);
                return assignments;
            }
        }

        // Group services by required specialty
        Map<StaffSpecialty, List<BookingServiceItem>> specialtyGroups = new HashMap<>();
        if (booking.getBookingServices() != null) {
            for (BookingServiceItem item : booking.getBookingServices()) {
                StaffSpecialty specialty = isSOS ? null : getSpecialtyForService(item);
                specialtyGroups.computeIfAbsent(specialty, k -> new ArrayList<>()).add(item);
            }
        }

        Map<StaffSpecialty, User> specialtyStaffCache = new HashMap<>();
        LocalDate bookingDate = booking.getBookingDate();

        for (Map.Entry<StaffSpecialty, List<BookingServiceItem>> entry : specialtyGroups.entrySet()) {
            StaffSpecialty specialty = entry.getKey();
            List<BookingServiceItem> items = entry.getValue();

            int totalSlotsNeeded = items.stream()
                    .mapToInt(item -> {
                        int duration = item.getService().getDurationTime() != null ? item.getService().getDurationTime() : 30;
                        return (int) Math.ceil(duration / 30.0);
                    })
                    .sum();

            User staff = findAvailableStaffForSpecialty(clinicId, bookingDate, booking.getBookingTime(), specialty, totalSlotsNeeded);

            if (staff != null) {
                specialtyStaffCache.put(specialty, staff);
                for (BookingServiceItem item : items) {
                    item.setAssignedStaff(staff);
                    assignments.put(item.getBookingServiceId(), staff);
                }
            } else if (isSOS) {
                User sosStaff = userRepository.findByWorkingClinicIdAndRole(clinicId, Role.STAFF).stream().findFirst().orElse(null);
                if (sosStaff != null) {
                    specialtyStaffCache.put(null, sosStaff);
                    for (BookingServiceItem item : items) {
                        item.setAssignedStaff(sosStaff);
                        assignments.put(item.getBookingServiceId(), sosStaff);
                    }
                }
            }
        }

        User primaryStaff = selectPrimaryStaff(specialtyStaffCache);
        if (primaryStaff != null) {
            booking.setAssignedStaff(primaryStaff);
        }

        bookingRepository.save(booking);
        // Reserve slots for the assigned staff
        reserveSlotsForBooking(booking);
        return assignments;
    }

    @Transactional
    public void reserveSlotsForBooking(Booking booking) {
        log.info("Reserving slots for booking {}", booking.getBookingCode());
        if (booking.getBookingServices() == null) return;
        
        for (BookingServiceItem item : booking.getBookingServices()) {
            if (item.getAssignedStaff() == null) continue;

            LocalTime itemStartTime = calculateServiceStartTime(booking, item);
            int duration = item.getService().getDurationTime() != null ? item.getService().getDurationTime() : 30;
            int slotsNeeded = (int) Math.ceil(duration / 30.0);

            reserveStaffSlots(item.getAssignedStaff().getUserId(), booking.getBookingDate(), itemStartTime, slotsNeeded, item);
        }
    }

    @Transactional
    public void releaseSlotsForBooking(Booking booking) {
        log.info("Releasing slots for booking {}", booking.getBookingCode());
        List<BookingSlot> bookingSlots = bookingSlotRepository.findByBooking_BookingId(booking.getBookingId());
        for (BookingSlot bs : bookingSlots) {
            Slot slot = bs.getSlot();
            slot.setStatus(SlotStatus.AVAILABLE);
            slotRepository.save(slot);
            bookingSlotRepository.delete(bs);
        }
    }

    @Transactional
    public void reassignStaffForService(UUID serviceId, UUID newStaffId, BookingServiceItemRepository repo) {
        BookingServiceItem item = repo.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service item not found"));
        
        User newStaff = userRepository.findById(newStaffId)
                .orElseThrow(() -> new ResourceNotFoundException("Staff not found"));

        StaffSpecialty required = item.getService().getServiceCategory().getRequiredSpecialty();
        if (!isSpecialtyCompatible(newStaff.getSpecialty(), required)) {
            String message = String.format("Nhân viên %s không có chuyên môn phù hợp với dịch vụ %s", 
                    newStaff.getFullName(), item.getService().getName());
            throw new BadRequestException(message);
        }

        LocalTime startTime = calculateServiceStartTime(item.getBooking(), item);
        int duration = item.getService().getDurationTime() != null ? item.getService().getDurationTime() : 30;
        int slotsNeeded = (int) Math.ceil(duration / 30.0);

        if (!isStaffAvailable(newStaffId, item.getBooking().getBookingDate(), startTime, slotsNeeded)) {
             throw new RuntimeException("Nhân viên không có ca làm việc phù hợp tại thời gian " + startTime);
        }

        List<BookingSlot> oldSlots = bookingSlotRepository.findByBookingServiceItem_BookingServiceId(serviceId);
        for (BookingSlot os : oldSlots) {
            Slot s = os.getSlot();
            s.setStatus(SlotStatus.AVAILABLE);
            slotRepository.save(s);
            bookingSlotRepository.delete(os);
        }

        item.setAssignedStaff(newStaff);
        repo.save(item);
        reserveStaffSlots(newStaffId, item.getBooking().getBookingDate(), startTime, slotsNeeded, item);
    }

    @Transactional(readOnly = true)
    public StaffAvailabilityCheckResponse checkStaffAvailabilityForBooking(Booking booking) {
        List<ServiceAvailability> serviceAvailabilities = new ArrayList<>();
        boolean allAvailable = true;
        
        if (booking.getBookingServices() != null) {
            for (BookingServiceItem item : booking.getBookingServices()) {
                StaffSpecialty required = getSpecialtyForService(item);
                int duration = item.getService().getDurationTime() != null ? item.getService().getDurationTime() : 30;
                int slotsNeeded = (int) Math.ceil(duration / 30.0);
                LocalTime startTime = calculateServiceStartTime(booking, item);

                User suggested = findAvailableStaffForSpecialty(booking.getClinic().getClinicId(), 
                        booking.getBookingDate(), startTime, required, slotsNeeded);
                
                if (suggested == null) allAvailable = false;

                serviceAvailabilities.add(ServiceAvailability.builder()
                        .bookingServiceId(item.getBookingServiceId())
                        .serviceName(item.getService().getName())
                        .hasAvailableStaff(suggested != null)
                        .suggestedStaffId(suggested != null ? suggested.getUserId() : null)
                        .suggestedStaffName(suggested != null ? suggested.getFullName() : null)
                        .build());
            }
        }
        
        return StaffAvailabilityCheckResponse.builder()
                .allServicesHaveStaff(allAvailable)
                .services(serviceAvailabilities)
                .build();
    }

    @Transactional(readOnly = true)
    public List<StaffOptionDTO> getAvailableStaffForBookingConfirm(Booking booking) {
        List<StaffOptionDTO> options = new ArrayList<>();
        List<User> clinicStaff = userRepository.findByWorkingClinicIdAndRole(booking.getClinic().getClinicId(), Role.STAFF);
        
        StaffAvailabilityCheckResponse availability = checkStaffAvailabilityForBooking(booking);
        Set<UUID> suggestedIds = availability.getServices().stream()
                .map(ServiceAvailability::getSuggestedStaffId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        for (User staff : clinicStaff) {
             List<UUID> availableServiceIds = new ArrayList<>();
             String unavailableReason = null;

             if (booking.getBookingServices() != null) {
                 for (BookingServiceItem item : booking.getBookingServices()) {
                     LocalTime startTime = calculateServiceStartTime(booking, item);
                     int duration = item.getService().getDurationTime() != null ? item.getService().getDurationTime() : 30;
                     int slotsNeeded = (int) Math.ceil(duration / 30.0);
                     
                     if (isStaffAvailable(staff.getUserId(), booking.getBookingDate(), startTime, slotsNeeded)) {
                         availableServiceIds.add(item.getBookingServiceId());
                     } else {
                         unavailableReason = "Không đủ slot trống";
                     }
                 }
             }

             options.add(StaffOptionDTO.builder()
                     .staffId(staff.getUserId())
                     .fullName(staff.getFullName())
                     .specialty(staff.getSpecialty() != null ? staff.getSpecialty().name() : null)
                     .avatarUrl(staff.getAvatar())
                     .isSuggested(suggestedIds.contains(staff.getUserId()))
                     .hasAvailableSlots(!availableServiceIds.isEmpty())
                     .availableServiceItemIds(availableServiceIds)
                     .unavailableReason(availableServiceIds.isEmpty() ? unavailableReason : null)
                     .build());
        }
        return options;
    }

    @Transactional(readOnly = true)
    public List<AvailableStaffResponse> getAvailableStaffForReassign(UUID clinicId, LocalDate date, LocalTime startTime, 
            StaffSpecialty specialty, int slotsNeeded, UUID currentStaffId) {
        List<User> clinicStaff = userRepository.findByWorkingClinicIdAndRole(clinicId, Role.STAFF);
        List<AvailableStaffResponse> options = new ArrayList<>();

        for (User staff : clinicStaff) {
            if (currentStaffId != null && staff.getUserId().equals(currentStaffId)) continue;
            
            boolean compatible = isSpecialtyCompatible(staff.getSpecialty(), specialty);
            String unavailableReason = null;
            boolean hasShift = true;
            boolean hasSlots = true;

            if (!compatible) {
                unavailableReason = "Chuyên môn không phù hợp";
            } else {
                List<StaffShift> shifts = staffShiftRepository.findByStaff_UserIdAndWorkDate(staff.getUserId(), date);
                LocalTime endTime = startTime.plusMinutes(slotsNeeded * 30L);
                StaffShift matchingShift = shifts.stream()
                        .filter(s -> !s.getStartTime().isAfter(startTime) && !s.getEndTime().isBefore(endTime))
                        .findFirst().orElse(null);
                
                if (matchingShift == null) {
                    hasShift = false;
                    unavailableReason = "Không có ca làm việc";
                } else {
                    List<Slot> availableSlots = slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(matchingShift.getShiftId(), SlotStatus.AVAILABLE);
                    if (!hasEnoughConsecutiveSlots(availableSlots, startTime, slotsNeeded)) {
                        hasSlots = false;
                        unavailableReason = "Không đủ slot trống";
                    }
                }
            }

            int bookedCount = bookingRepository.findByStaffIdAndDate(staff.getUserId(), date).size();

            options.add(AvailableStaffResponse.builder()
                    .staffId(staff.getUserId())
                    .staffName(staff.getFullName())
                    .avatarUrl(staff.getAvatar())
                    .specialty(staff.getSpecialty() != null ? staff.getSpecialty().name() : null)
                    .available(compatible && hasShift && hasSlots)
                    .unavailableReason(unavailableReason)
                    .bookedCount(bookedCount)
                    .build());
        }
        // Sort: available first, then by bookedCount ASC
        options.sort(Comparator.comparing(AvailableStaffResponse::isAvailable).reversed()
                .thenComparing(AvailableStaffResponse::getBookedCount));
        return options;
    }

    @Transactional(readOnly = true)
    public List<LocalTime> findAvailableSlots(UUID clinicId, LocalDate date, List<UUID> serviceIds) {
        log.info("Finding available slots for clinic {}, date {}, services {}", clinicId, date, serviceIds);

        List<com.petties.petties.model.ClinicService> services = new ArrayList<>();
        Map<com.petties.petties.model.ClinicService, StaffSpecialty> requiredSpecialties = new HashMap<>();

        for (UUID serviceId : serviceIds) {
            com.petties.petties.model.ClinicService service = clinicServiceRepository.findById(serviceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Service not found: " + serviceId));
            services.add(service);
            StaffSpecialty required = service.getServiceCategory() != null
                    ? service.getServiceCategory().getRequiredSpecialty()
                    : StaffSpecialty.VET;
            requiredSpecialties.put(service, required);
        }

        List<User> allStaff = userRepository.findByWorkingClinicIdAndRole(clinicId, Role.STAFF);
        List<StaffShift> shifts = staffShiftRepository.findByClinic_ClinicIdAndWorkDate(clinicId, date);
        List<Booking> clinicBookings = bookingRepository.findByClinicIdAndDateWithDetails(clinicId, date).stream()
                .filter(b -> b.getStatus() != com.petties.petties.model.enums.BookingStatus.CANCELLED
                        && b.getStatus() != com.petties.petties.model.enums.BookingStatus.NO_SHOW)
                .toList();

        if (shifts.isEmpty()) return generateAllSlots();

        List<LocalTime> availableSlots = new ArrayList<>();
        List<LocalTime> allPossibleSlots = generateAllSlots();

        for (LocalTime startTime : allPossibleSlots) {
            boolean isValid = true;
            LocalTime currentTime = startTime;

            int totalDurationMinutes = services.stream()
                    .mapToInt(s -> s.getDurationTime() != null ? s.getDurationTime() : 30)
                    .sum();
            LocalTime slotEndTime = startTime.plusMinutes(totalDurationMinutes);

            List<User> staffOnShift = shifts.stream()
                    .filter(s -> !s.getStartTime().isAfter(startTime) && !s.getEndTime().isBefore(slotEndTime))
                    .map(StaffShift::getStaff)
                    .toList();

            if (staffOnShift.isEmpty()) continue;

            long concurrentBookings = clinicBookings.stream()
                    .filter(b -> isBookingOverlapping(b, startTime, slotEndTime))
                    .count();

            if (concurrentBookings >= staffOnShift.size()) continue;

            for (com.petties.petties.model.ClinicService service : services) {
                int duration = service.getDurationTime() != null ? service.getDurationTime() : 30;
                LocalTime serviceEndTime = currentTime.plusMinutes(duration);
                StaffSpecialty required = requiredSpecialties.get(service);

                final LocalTime currentStart = currentTime;
                final LocalTime currentEnd = serviceEndTime;

                boolean foundStaff = false;
                for (User member : allStaff) {
                    if (!isSpecialtyCompatible(member.getSpecialty(), required)) continue;

                    boolean hasShift = shifts.stream().anyMatch(s -> 
                        s.getStaff().getUserId().equals(member.getUserId()) &&
                        !s.getStartTime().isAfter(currentStart) &&
                        !s.getEndTime().isBefore(currentEnd));
                    
                    if (!hasShift) continue;

                    boolean isBusy = clinicBookings.stream()
                        .filter(b -> b.getAssignedStaff() != null && b.getAssignedStaff().getUserId().equals(member.getUserId()))
                        .anyMatch(b -> isBookingOverlapping(b, currentStart, currentEnd));

                    if (!isBusy) {
                        foundStaff = true;
                        break;
                    }
                }

                if (!foundStaff) {
                    isValid = false;
                    break;
                }
                currentTime = serviceEndTime;
            }

            if (isValid) availableSlots.add(startTime);
        }
        return availableSlots;
    }

    public boolean hasShiftsOnDate(UUID clinicId, LocalDate date) {
        return !staffShiftRepository.findByClinic_ClinicIdAndWorkDate(clinicId, date).isEmpty();
    }

    // ========== PRIVATE HELPER METHODS ==========

    private boolean isSpecialtyCompatible(StaffSpecialty staffSpecialty, StaffSpecialty requiredSpecialty) {
        if (requiredSpecialty == null) return true; // No requirement (e.g. SOS)
        if (staffSpecialty == null) return false;
        if (staffSpecialty == StaffSpecialty.VET) return true;
        return staffSpecialty == requiredSpecialty;
    }

    private User findAvailableStaffForSpecialty(UUID clinicId, LocalDate date, LocalTime startTime, StaffSpecialty specialty, int slotsNeeded) {
        List<User> qualifiedStaff = userRepository.findByWorkingClinicIdAndRole(clinicId, Role.STAFF).stream()
                .filter(s -> isSpecialtyCompatible(s.getSpecialty(), specialty))
                .toList();

        for (User staff : qualifiedStaff) {
            if (isStaffAvailable(staff.getUserId(), date, startTime, slotsNeeded)) {
                return staff;
            }
        }
        return null;
    }

    private boolean isStaffAvailable(UUID staffId, LocalDate date, LocalTime startTime, int slotsNeeded) {
        List<StaffShift> shifts = staffShiftRepository.findByStaff_UserIdAndWorkDate(staffId, date);
        LocalTime endTime = startTime.plusMinutes(slotsNeeded * 30L);
        StaffShift matchingShift = shifts.stream()
                .filter(s -> !s.getStartTime().isAfter(startTime) && !s.getEndTime().isBefore(endTime))
                .findFirst().orElse(null);

        if (matchingShift == null) return false;

        List<Slot> availableSlots = slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(matchingShift.getShiftId(), SlotStatus.AVAILABLE);
        return hasEnoughConsecutiveSlots(availableSlots, startTime, slotsNeeded);
    }

    private boolean hasEnoughConsecutiveSlots(List<Slot> availableSlots, LocalTime startTime, int slotsNeeded) {
        int count = 0;
        LocalTime expectedTime = startTime;
        for (Slot slot : availableSlots) {
            if (slot.getStartTime().equals(expectedTime)) {
                count++;
                expectedTime = slot.getEndTime();
                if (count >= slotsNeeded) return true;
            } else if (slot.getStartTime().isAfter(expectedTime)) {
                if (count == 0) continue;
                return false;
            }
        }
        return false;
    }

    private StaffSpecialty getSpecialtyForService(BookingServiceItem item) {
        if (item.getService().getServiceCategory() != null) {
            return item.getService().getServiceCategory().getRequiredSpecialty();
        }
        return StaffSpecialty.VET;
    }

    private LocalTime calculateServiceStartTime(Booking booking, BookingServiceItem targetItem) {
        LocalTime current = booking.getBookingTime();
        if (booking.getBookingServices() == null) return current;
        for (BookingServiceItem item : booking.getBookingServices()) {
            if (item.equals(targetItem)) return current;
            int duration = item.getService().getDurationTime() != null ? item.getService().getDurationTime() : 30;
            current = current.plusMinutes(duration);
        }
        return booking.getBookingTime();
    }

    private void reserveStaffSlots(UUID staffId, LocalDate date, LocalTime startTime, int slotsNeeded, BookingServiceItem item) {
        List<StaffShift> shifts = staffShiftRepository.findByStaff_UserIdAndWorkDate(staffId, date);
        LocalTime endTime = startTime.plusMinutes(slotsNeeded * 30L);
        StaffShift matchingShift = shifts.stream()
                .filter(s -> !s.getStartTime().isAfter(startTime) && !s.getEndTime().isBefore(endTime))
                .findFirst().orElse(null);
        if (matchingShift == null) return;

        List<Slot> availableSlots = slotRepository.findByShift_ShiftIdAndStatusOrderByStartTime(matchingShift.getShiftId(), SlotStatus.AVAILABLE);
        List<Slot> toBook = new ArrayList<>();
        LocalTime expected = startTime;
        for (Slot s : availableSlots) {
            if (s.getStartTime().equals(expected)) {
                toBook.add(s);
                expected = s.getEndTime();
                if (toBook.size() == slotsNeeded) break;
            }
        }

        if (toBook.size() == slotsNeeded) {
            for (Slot s : toBook) {
                s.setStatus(SlotStatus.BOOKED);
                slotRepository.save(s);
                BookingSlot bs = new BookingSlot();
                bs.setSlot(s);
                bs.setBookingServiceItem(item);
                bs.setBooking(item.getBooking());
                bookingSlotRepository.save(bs);
            }
        }
    }

    private User selectPrimaryStaff(Map<StaffSpecialty, User> specialtyStaffCache) {
        if (specialtyStaffCache.containsKey(StaffSpecialty.VET)) return specialtyStaffCache.get(StaffSpecialty.VET);
        if (specialtyStaffCache.containsKey(StaffSpecialty.GROOMER)) return specialtyStaffCache.get(StaffSpecialty.GROOMER);
        return specialtyStaffCache.values().stream().findFirst().orElse(null);
    }

    private boolean isBookingOverlapping(Booking b, LocalTime start, LocalTime end) {
        LocalTime bStart = b.getBookingTime();
        if (b.getBookingServices() == null || b.getBookingServices().isEmpty()) {
            // If no services, assume a default 30 min duration for overlap check
            LocalTime bEnd = bStart.plusMinutes(30);
            return bEnd.isAfter(start) && bStart.isBefore(end);
        }
        int bDuration = b.getBookingServices().stream()
                .mapToInt(item -> item.getService().getDurationTime() != null ? item.getService().getDurationTime() : 30)
                .sum();
        LocalTime bEnd = bStart.plusMinutes(bDuration);
        return bEnd.isAfter(start) && bStart.isBefore(end);
    }

    private List<LocalTime> generateAllSlots() {
        List<LocalTime> slots = new ArrayList<>();
        LocalTime current = LocalTime.of(8, 0);
        LocalTime end = LocalTime.of(20, 0);
        while (current.isBefore(end)) {
            slots.add(current);
            current = current.plusMinutes(30);
        }
        return slots;
    }
}
