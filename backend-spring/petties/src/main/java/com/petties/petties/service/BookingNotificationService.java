package com.petties.petties.service;

import com.petties.petties.dto.sse.SseEventDto;
import com.petties.petties.model.Booking;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Service responsible for sending booking-related notifications via SSE
 * Extracted from BookingService to follow Single Responsibility Principle
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BookingNotificationService {

    private final SseEmitterService sseEmitterService;
    private final UserRepository userRepository;

    /**
     * Push SSE event to all relevant users when booking changes
     * - Assigned staff (if any)
     * - All managers of the clinic
     *
     * @param booking The updated booking
     * @param action  Action type: CONFIRMED, STATUS_CHANGED, CANCELLED,
     *                SERVICE_ADDED, etc.
     */
    public void pushBookingUpdateToUsers(Booking booking, String action) {
        try {
            Map<String, Object> eventData = Map.of(
                    "bookingId", booking.getBookingId().toString(),
                    "bookingCode", booking.getBookingCode(),
                    "action", action,
                    "status", booking.getStatus().name());

            SseEventDto event = SseEventDto.bookingUpdate(eventData);

            // Push to assigned staff
            if (booking.getAssignedStaff() != null) {
                sseEmitterService.pushToUser(booking.getAssignedStaff().getUserId(), event);
                log.debug("Pushed BOOKING_UPDATE to staff: {}", booking.getAssignedStaff().getUserId());
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

    /**
     * Push SSE event specifically for staff reassignment
     * Notifies both old and new staff, plus all clinic managers
     *
     * @param booking    The updated booking
     * @param action     Action type (STAFF_REASSIGNED)
     * @param oldStaffId Old staff ID (who is being removed from booking)
     * @param newStaffId New staff ID (who is being assigned)
     */
    public void pushBookingUpdateToStaff(Booking booking, String action, UUID oldStaffId, UUID newStaffId) {
        try {
            Map<String, Object> eventData = new HashMap<>();
            eventData.put("bookingId", booking.getBookingId().toString());
            eventData.put("bookingCode", booking.getBookingCode());
            eventData.put("action", action);
            eventData.put("status", booking.getStatus().name());
            eventData.put("oldStaffId", oldStaffId != null ? oldStaffId.toString() : "");
            eventData.put("newStaffId", newStaffId != null ? newStaffId.toString() : "");

            SseEventDto event = SseEventDto.bookingUpdate(eventData);

            // Push to OLD staff (so they can remove from their schedule)
            if (oldStaffId != null) {
                sseEmitterService.pushToUser(oldStaffId, event);
                log.debug("Pushed BOOKING_UPDATE to OLD staff: {}", oldStaffId);
            }

            // Push to NEW staff (so they can add to their schedule)
            if (newStaffId != null) {
                sseEmitterService.pushToUser(newStaffId, event);
                log.debug("Pushed BOOKING_UPDATE to NEW staff: {}", newStaffId);
            }

            // Push to all managers of the clinic
            List<User> managers = userRepository.findByWorkingClinicIdAndRole(
                    booking.getClinic().getClinicId(), Role.CLINIC_MANAGER);
            for (User manager : managers) {
                sseEmitterService.pushToUser(manager.getUserId(), event);
                log.debug("Pushed BOOKING_UPDATE to manager: {}", manager.getUserId());
            }

            log.info("STAFF_REASSIGN event pushed for booking {}: oldStaff={}, newStaff={}",
                    booking.getBookingCode(), oldStaffId, newStaffId);
        } catch (Exception e) {
            log.warn("Failed to push SSE event for staff reassign {}: {}",
                    booking.getBookingCode(), e.getMessage());
        }
    }
}
