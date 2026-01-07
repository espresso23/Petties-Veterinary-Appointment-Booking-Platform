package com.petties.petties.service;

import com.petties.petties.dto.vetshift.SlotResponse;
import com.petties.petties.dto.vetshift.VetShiftRequest;
import com.petties.petties.dto.vetshift.VetShiftResponse;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.OperatingHours;
import com.petties.petties.model.Slot;
import com.petties.petties.model.User;
import com.petties.petties.model.VetShift;
import com.petties.petties.model.enums.SlotStatus;
import com.petties.petties.repository.ClinicRepository;
import com.petties.petties.repository.SlotRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.repository.VetShiftRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for VetShift management
 *
 * Handles:
 * - Creating shifts with auto slot generation
 * - Validating shift overlaps
 * - Validating against clinic operating hours
 * - Blocking/unblocking slots
 * - Sending notifications to Vets via SSE
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VetShiftService {

    private final VetShiftRepository vetShiftRepository;
    private final SlotRepository slotRepository;
    private final UserRepository userRepository;
    private final ClinicRepository clinicRepository;
    private final NotificationService notificationService;

    private static final int SLOT_DURATION_MINUTES = 30;

    /**
     * Create one or more VetShifts with auto-generated slots
     */
    @Transactional
    public List<VetShiftResponse> createShifts(UUID clinicId, VetShiftRequest request) {
        // 1. Validate vet exists and belongs to this clinic
        User vet = userRepository.findById(request.getVetId())
                .orElseThrow(() -> new ResourceNotFoundException("Vet not found"));

        if (vet.getWorkingClinic() == null || !vet.getWorkingClinic().getClinicId().equals(clinicId)) {
            throw new BadRequestException("Bác sĩ không thuộc phòng khám này");
        }

        // 2. Get clinic
        Clinic clinic = clinicRepository.findById(clinicId)
                .orElseThrow(() -> new ResourceNotFoundException("Clinic not found"));

        // 3. Validate and smart-detect overnight requirement
        boolean isOvernight = Boolean.TRUE.equals(request.getIsOvernight());
        boolean endBeforeStart = request.getEndTime().isBefore(request.getStartTime());

        // If end < start (e.g., 22:00 -> 06:00), overnight MUST be true
        if (endBeforeStart && !isOvernight) {
            throw new BadRequestException(
                    "Thời gian kết thúc trước thời gian bắt đầu - hãy bật chế độ Ca đêm (Overnight)");
        }

        // If end >= start (e.g., 00:00 -> 05:00), overnight is NOT needed -
        // auto-disable
        if (!endBeforeStart && isOvernight) {
            log.info("Auto-disabling overnight flag: endTime {} >= startTime {}", request.getEndTime(),
                    request.getStartTime());
            isOvernight = false;
        }

        // Normal validation for regular shifts
        if (!isOvernight && request.getEndTime().equals(request.getStartTime())) {
            throw new BadRequestException("Thời gian kết thúc phải khác thời gian bắt đầu");
        }

        // 6. Validate break time if provided
        if (request.getBreakStart() != null && request.getBreakEnd() != null) {
            if (request.getBreakEnd().isBefore(request.getBreakStart())) {
                throw new BadRequestException("Thời gian nghỉ kết thúc phải sau thời gian nghỉ bắt đầu");
            }
            if (request.getBreakStart().isBefore(request.getStartTime()) ||
                    request.getBreakEnd().isAfter(request.getEndTime())) {
                throw new BadRequestException("Thời gian nghỉ phải nằm trong ca làm việc");
            }
        }

        if (request.getWorkDates() == null || request.getWorkDates().isEmpty()) {
            throw new BadRequestException("Phải chọn ít nhất một ngày làm việc");
        }

        if (request.getWorkDates().size() > 14) {
            throw new BadRequestException("Không thể tạo quá 14 ca làm việc cùng lúc");
        }

        List<VetShiftResponse> responses = new ArrayList<>();
        List<VetShift> newShifts = new ArrayList<>();
        List<VetShift> updatedShifts = new ArrayList<>();
        int repeatWeeks = request.getRepeatWeeks() != null ? request.getRepeatWeeks() : 1;

        for (int week = 0; week < repeatWeeks; week++) {
            for (LocalDate baseDate : request.getWorkDates()) {
                LocalDate workDate = baseDate.plusWeeks(week);

                // 4. Validate workDate is not in the past
                if (workDate.isBefore(LocalDate.now())) {
                    log.warn("Skipping day {} because it is in the past", workDate);
                    continue;
                }

                // 5. Validate against clinic operating hours for each day
                try {
                    validateOperatingHours(clinic, workDate, request.getStartTime(), request.getEndTime());
                } catch (BadRequestException e) {
                    log.warn("Skipping day {}: {}", workDate, e.getMessage());
                    continue;
                }

                // 6. Check for overlapping shifts for this vet on this specific date
                boolean forceUpdate = Boolean.TRUE.equals(request.getForceUpdate());
                Optional<VetShift> existingShift = vetShiftRepository.findOneByVet_UserIdAndWorkDate(
                        vet.getUserId(), workDate);

                boolean isUpdating = false;
                if (existingShift.isPresent()) {
                    if (forceUpdate) {
                        // Delete existing shift (only if no BOOKED slots)
                        VetShift oldShift = existingShift.get();
                        boolean hasBookedSlots = slotRepository.existsByShift_ShiftIdAndStatus(
                                oldShift.getShiftId(), SlotStatus.BOOKED);
                        if (hasBookedSlots) {
                            log.warn("Skipping day {}: Cannot update shift with active bookings", workDate);
                            continue;
                        }
                        log.info("Force update: Deleting existing shift {} for vet {} on {}",
                                oldShift.getShiftId(), vet.getFullName(), workDate);
                        vetShiftRepository.delete(oldShift);
                        isUpdating = true;
                    } else {
                        log.warn("Skipping day {}: Shift already exists for vet {} (use forceUpdate=true to override)",
                                workDate, vet.getFullName());
                        continue;
                    }
                }

                // 7. Determine break times - ALWAYS from clinic operating hours
                LocalTime breakStart = null;
                LocalTime breakEnd = null;

                String dayOfWeek = workDate.getDayOfWeek().toString(); // MONDAY, TUESDAY, etc.
                OperatingHours dayHours = clinic.getOperatingHours().get(dayOfWeek);

                if (dayHours != null && dayHours.getBreakStart() != null && dayHours.getBreakEnd() != null) {
                    LocalTime clinicBreakStart = dayHours.getBreakStart();
                    LocalTime clinicBreakEnd = dayHours.getBreakEnd();

                    // Only use clinic break if it falls within the shift time
                    boolean breakWithinShift = !clinicBreakStart.isBefore(request.getStartTime()) &&
                            !clinicBreakEnd.isAfter(request.getEndTime());

                    if (breakWithinShift) {
                        breakStart = clinicBreakStart;
                        breakEnd = clinicBreakEnd;
                        log.info("Using clinic break time for {}: {} - {}", workDate, breakStart, breakEnd);
                    }
                }

                // 8. Create Shift Entity
                VetShift shift = VetShift.builder()
                        .clinic(clinic)
                        .vet(vet)
                        .workDate(workDate)
                        .startTime(request.getStartTime())
                        .endTime(request.getEndTime())
                        .breakStart(breakStart)
                        .breakEnd(breakEnd)
                        .isOvernight(isOvernight)
                        .build();

                // 9. Generate slots and save
                List<Slot> slots = generateSlots(shift, breakStart, breakEnd);
                shift.setSlots(slots);

                VetShift savedShift = vetShiftRepository.save(shift);

                // 10. Collect shifts for batch notification (instead of notifying individually)
                if (isUpdating) {
                    updatedShifts.add(savedShift);
                } else {
                    newShifts.add(savedShift);
                }

                responses.add(mapToResponse(savedShift, false));
            }
        }

        if (responses.isEmpty()) {
            throw new BadRequestException(
                    "Không thể tạo ca làm việc (phòng khám đóng cửa hoặc đã có ca trong những ngày đã chọn)");
        }

        // 11. Send batch notifications (ONE notification per category instead of N
        // individual ones)
        if (!newShifts.isEmpty()) {
            notificationService.notifyVetShiftsBatchAssigned(vet, newShifts, clinic);
        }
        if (!updatedShifts.isEmpty()) {
            notificationService.notifyVetShiftsBatchUpdated(vet, updatedShifts, clinic);
        }

        log.info("Bulk created {} shifts for vet {} (new: {}, updated: {})",
                responses.size(), vet.getFullName(), newShifts.size(), updatedShifts.size());

        return responses;
    }

    /**
     * Get all shifts for a clinic in a date range.
     * Also includes overnight shifts from the previous day that extend into the
     * range.
     */
    @Transactional(readOnly = true)
    public List<VetShiftResponse> getShiftsByClinic(UUID clinicId, LocalDate startDate, LocalDate endDate) {
        List<VetShiftResponse> responses = new ArrayList<>();

        // 1. Get regular shifts in the date range
        List<VetShift> shifts = vetShiftRepository.findByClinicAndDateRange(clinicId, startDate, endDate);
        for (VetShift shift : shifts) {
            VetShiftResponse response = mapToResponse(shift, false);
            response.setDisplayDate(shift.getWorkDate());
            response.setIsContinuation(false);
            responses.add(response);
        }

        // 2. Get overnight shifts from the day BEFORE startDate (they extend into
        // startDate)
        LocalDate dayBefore = startDate.minusDays(1);
        List<VetShift> overnightShifts = vetShiftRepository.findOvernightShiftsFromPreviousDay(clinicId, dayBefore);
        for (VetShift shift : overnightShifts) {
            VetShiftResponse continuation = mapToResponse(shift, false);
            continuation.setDisplayDate(startDate); // Show on the next day
            continuation.setIsContinuation(true); // Mark as continuation
            responses.add(continuation);
        }

        // Sort by displayDate, then startTime
        responses.sort((a, b) -> {
            int dateCompare = a.getDisplayDate().compareTo(b.getDisplayDate());
            if (dateCompare != 0)
                return dateCompare;
            return a.getStartTime().compareTo(b.getStartTime());
        });

        return responses;
    }

    /**
     * Get all shifts for a specific vet in a date range.
     * Also includes overnight shifts from the previous day that extend into the
     * range.
     */
    @Transactional(readOnly = true)
    public List<VetShiftResponse> getShiftsByVet(UUID vetId, LocalDate startDate, LocalDate endDate) {
        List<VetShiftResponse> responses = new ArrayList<>();

        // 1. Get regular shifts for this vet in the date range
        List<VetShift> shifts = vetShiftRepository.findByVetAndDateRange(vetId, startDate, endDate);
        for (VetShift shift : shifts) {
            VetShiftResponse response = mapToResponse(shift, false);
            response.setDisplayDate(shift.getWorkDate());
            response.setIsContinuation(false);
            responses.add(response);
        }

        // 2. Get overnight shifts for this vet from the day BEFORE startDate
        LocalDate dayBefore = startDate.minusDays(1);
        List<VetShift> overnightShifts = vetShiftRepository.findOvernightShiftsByVetFromPreviousDay(vetId, dayBefore);
        for (VetShift shift : overnightShifts) {
            VetShiftResponse continuation = mapToResponse(shift, false);
            continuation.setDisplayDate(startDate);
            continuation.setIsContinuation(true);
            responses.add(continuation);
        }

        // Sort by displayDate, then startTime
        responses.sort((a, b) -> {
            int dateCompare = a.getDisplayDate().compareTo(b.getDisplayDate());
            if (dateCompare != 0)
                return dateCompare;
            return a.getStartTime().compareTo(b.getStartTime());
        });

        return responses;
    }

    /**
     * Get shift detail with slots
     */
    @Transactional(readOnly = true)
    public VetShiftResponse getShiftDetail(UUID shiftId) {
        VetShift shift = vetShiftRepository.findByIdWithSlots(shiftId)
                .orElseThrow(() -> new ResourceNotFoundException("Shift not found"));
        return mapToResponse(shift, true);
    }

    /**
     * Delete a shift (only if no booked slots)
     */
    @Transactional
    public void deleteShift(UUID shiftId) {
        VetShift shift = vetShiftRepository.findByIdWithSlots(shiftId)
                .orElseThrow(() -> new ResourceNotFoundException("Shift not found"));

        // Check for booked slots
        boolean hasBookedSlots = slotRepository.existsByShift_ShiftIdAndStatus(shiftId, SlotStatus.BOOKED);
        if (hasBookedSlots) {
            throw new BadRequestException("Không thể xóa ca có lịch hẹn đang hoạt động");
        }

        // Save info for notification before deleting
        User vet = shift.getVet();
        LocalDate workDate = shift.getWorkDate();
        String clinicName = shift.getClinic().getName();

        vetShiftRepository.delete(shift);
        log.info("Deleted shift {}", shiftId);

        // Notify Vet about deleted shift via SSE
        notificationService.notifyVetShiftDeleted(vet, workDate, clinicName);
    }

    /**
     * Delete multiple shifts
     */
    @Transactional
    public void bulkDeleteShifts(List<UUID> shiftIds) {
        for (UUID id : shiftIds) {
            deleteShift(id);
        }
    }

    /**
     * Block a slot
     */
    @Transactional
    public SlotResponse blockSlot(UUID slotId) {
        Slot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("Slot not found"));

        if (slot.getStatus() == SlotStatus.BOOKED) {
            throw new BadRequestException("Không thể khóa slot đã được đặt");
        }

        slot.setStatus(SlotStatus.BLOCKED);
        Slot saved = slotRepository.save(slot);
        log.info("Blocked slot {}", slotId);
        return mapSlotToResponse(saved);
    }

    /**
     * Unblock a slot
     */
    @Transactional
    public SlotResponse unblockSlot(UUID slotId) {
        Slot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("Slot not found"));

        if (slot.getStatus() != SlotStatus.BLOCKED) {
            throw new BadRequestException("Slot không ở trạng thái bị khóa");
        }

        slot.setStatus(SlotStatus.AVAILABLE);
        Slot saved = slotRepository.save(slot);
        log.info("Unblocked slot {}", slotId);
        return mapSlotToResponse(saved);
    }

    // ===== PRIVATE METHODS =====

    /**
     * Generate 30-minute slots for a shift, excluding break time
     * Supports overnight shifts (e.g., 22:00 -> 06:00 next day)
     */
    private List<Slot> generateSlots(VetShift shift, LocalTime breakStart, LocalTime breakEnd) {
        List<Slot> slots = new ArrayList<>();
        LocalTime currentTime = shift.getStartTime();
        LocalTime endTime = shift.getEndTime();
        boolean isOvernight = Boolean.TRUE.equals(shift.getIsOvernight());

        if (isOvernight) {
            // Part 1: Generate slots from startTime to midnight (24:00)
            // Stop when we reach 23:30 (last slot before midnight)
            LocalTime lastSlotBeforeMidnight = LocalTime.of(23, 30);
            while (currentTime.isBefore(lastSlotBeforeMidnight) || currentTime.equals(lastSlotBeforeMidnight)) {
                LocalTime slotEnd = currentTime.plusMinutes(SLOT_DURATION_MINUTES);

                // Safety check: if slotEnd wrapped around (is before currentTime), we've passed
                // midnight
                if (slotEnd.isBefore(currentTime)) {
                    break;
                }

                if (!isInBreakTime(currentTime, slotEnd, breakStart, breakEnd)) {
                    Slot slot = new Slot();
                    slot.setShift(shift);
                    slot.setStartTime(currentTime);
                    slot.setEndTime(slotEnd);
                    slot.setStatus(SlotStatus.AVAILABLE);
                    slots.add(slot);
                }
                currentTime = slotEnd;

                // If we've reached or passed midnight (00:00), stop Part 1
                if (currentTime.equals(LocalTime.MIDNIGHT) || currentTime.isBefore(shift.getStartTime())) {
                    break;
                }
            }

            // Part 2: Generate slots from midnight (00:00) to endTime
            currentTime = LocalTime.of(0, 0);
            while (currentTime.plusMinutes(SLOT_DURATION_MINUTES).compareTo(endTime) <= 0) {
                LocalTime slotEnd = currentTime.plusMinutes(SLOT_DURATION_MINUTES);
                if (!isInBreakTime(currentTime, slotEnd, breakStart, breakEnd)) {
                    Slot slot = new Slot();
                    slot.setShift(shift);
                    slot.setStartTime(currentTime);
                    slot.setEndTime(slotEnd);
                    slot.setStatus(SlotStatus.AVAILABLE);
                    slots.add(slot);
                }
                currentTime = slotEnd;
            }
        } else {
            // Normal shift: generate slots from startTime to endTime
            while (currentTime.plusMinutes(SLOT_DURATION_MINUTES).compareTo(endTime) <= 0) {
                LocalTime slotEnd = currentTime.plusMinutes(SLOT_DURATION_MINUTES);
                if (!isInBreakTime(currentTime, slotEnd, breakStart, breakEnd)) {
                    Slot slot = new Slot();
                    slot.setShift(shift);
                    slot.setStartTime(currentTime);
                    slot.setEndTime(slotEnd);
                    slot.setStatus(SlotStatus.AVAILABLE);
                    slots.add(slot);
                }
                currentTime = slotEnd;
            }
        }

        return slots;
    }

    /**
     * Check if slot time overlaps with break time
     */
    private boolean isInBreakTime(LocalTime slotStart, LocalTime slotEnd,
            LocalTime breakStart, LocalTime breakEnd) {
        if (breakStart == null || breakEnd == null) {
            return false;
        }
        // Slot overlaps with break if: slotStart < breakEnd AND slotEnd > breakStart
        return slotStart.isBefore(breakEnd) && slotEnd.isAfter(breakStart);
    }

    /**
     * Validate shift is within clinic operating hours
     */
    private void validateOperatingHours(Clinic clinic, LocalDate workDate,
            LocalTime startTime, LocalTime endTime) {
        Map<String, OperatingHours> operatingHours = clinic.getOperatingHours();
        if (operatingHours == null || operatingHours.isEmpty()) {
            return; // No operating hours set, allow any time
        }

        String dayOfWeek = workDate.getDayOfWeek().toString(); // MONDAY, TUESDAY, etc.
        OperatingHours hours = operatingHours.get(dayOfWeek);

        if (hours == null || (hours.getIsClosed() != null && hours.getIsClosed())) {
            String dayNameVi = switch (dayOfWeek) {
                case "MONDAY" -> "Thứ Hai";
                case "TUESDAY" -> "Thứ Ba";
                case "WEDNESDAY" -> "Thứ Tư";
                case "THURSDAY" -> "Thứ Năm";
                case "FRIDAY" -> "Thứ Sáu";
                case "SATURDAY" -> "Thứ Bảy";
                case "SUNDAY" -> "Chủ Nhật";
                default -> dayOfWeek;
            };
            throw new BadRequestException("Phòng khám đóng cửa vào " + dayNameVi);
        }

        LocalTime clinicOpen = hours.getOpenTime();
        LocalTime clinicClose = hours.getCloseTime();

        if (clinicOpen == null || clinicClose == null) {
            return; // No hours set for this day, allow any time
        }

        if (startTime.isBefore(clinicOpen) || endTime.isAfter(clinicClose)) {
            throw new BadRequestException(
                    String.format("Ca làm việc phải trong giờ mở cửa của phòng khám (%s - %s)",
                            clinicOpen, clinicClose));
        }
    }

    /**
     * Map VetShift entity to response DTO
     */
    private VetShiftResponse mapToResponse(VetShift shift, boolean includeSlots) {
        User vet = shift.getVet();

        // Calculate slot statistics
        int total = shift.getSlots().size();
        int available = (int) shift.getSlots().stream()
                .filter(s -> s.getStatus() == SlotStatus.AVAILABLE).count();
        int booked = (int) shift.getSlots().stream()
                .filter(s -> s.getStatus() == SlotStatus.BOOKED).count();
        int blocked = (int) shift.getSlots().stream()
                .filter(s -> s.getStatus() == SlotStatus.BLOCKED).count();

        VetShiftResponse response = VetShiftResponse.builder()
                .shiftId(shift.getShiftId())
                .vetId(vet.getUserId())
                .vetName(vet.getFullName())
                .vetAvatar(vet.getAvatar())
                .clinicId(shift.getClinic().getClinicId())
                .workDate(shift.getWorkDate())
                .startTime(shift.getStartTime())
                .endTime(shift.getEndTime())
                .breakStart(shift.getBreakStart())
                .breakEnd(shift.getBreakEnd())
                .isOvernight(shift.getIsOvernight())
                .notes(shift.getNotes())
                .createdAt(shift.getCreatedAt())
                .totalSlots(total)
                .availableSlots(available)
                .bookedSlots(booked)
                .blockedSlots(blocked)
                .build();

        if (includeSlots) {
            response.setSlots(shift.getSlots().stream()
                    .map(this::mapSlotToResponse)
                    .collect(Collectors.toList()));
        }

        return response;
    }

    /**
     * Map Slot entity to response DTO
     */
    private SlotResponse mapSlotToResponse(Slot slot) {
        return SlotResponse.builder()
                .slotId(slot.getSlotId())
                .startTime(slot.getStartTime())
                .endTime(slot.getEndTime())
                .status(slot.getStatus())
                .build();
    }
}
