package com.petties.petties.controller;

import com.petties.petties.dto.booking.AddServiceRequest;
import com.petties.petties.dto.booking.AvailableStaffResponse;
import com.petties.petties.dto.booking.AvailableSlotsResponse;
import com.petties.petties.dto.booking.BookingConfirmRequest;
import com.petties.petties.dto.booking.BookingRequest;
import com.petties.petties.dto.booking.BookingResponse;
import com.petties.petties.dto.booking.ReassignStaffRequest;
import com.petties.petties.dto.booking.StaffAvailabilityCheckResponse;
import com.petties.petties.dto.booking.StaffOptionDTO;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * BookingController - REST endpoints for booking management
 */
@RestController
@RequestMapping("/bookings")
@RequiredArgsConstructor
@Slf4j
public class BookingController {

    private final BookingService bookingService;
    private final com.petties.petties.repository.UserRepository userRepository;

    // ========== SMART AVAILABILITY ==========

    /**
     * Get available time slots for booking (Public endpoint for Pet Owners)
     * Used in Mobile Booking Wizard - Step 2: Time Selection
     * Returns list of valid start times based on Smart Availability algorithm
     */
    @GetMapping("/public/available-slots")
    public ResponseEntity<AvailableSlotsResponse> getAvailableSlots(
            @RequestParam UUID clinicId,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate date,
            @RequestParam List<UUID> serviceIds) {

        log.info("GET /bookings/public/available-slots - clinicId: {}, date: {}, serviceIds: {}",
                clinicId, date, serviceIds);

        AvailableSlotsResponse response = bookingService.getAvailableSlots(clinicId, date, serviceIds);
        return ResponseEntity.ok(response);
    }

    // ========== CREATE BOOKING ==========

    /**
     * Create a new booking (Pet owner creates a booking for their pet)
     */
    @PreAuthorize("hasRole('PET_OWNER')")
    @PostMapping
    public ResponseEntity<BookingResponse> createBooking(
            @Valid @RequestBody BookingRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        BookingResponse response = bookingService.createBooking(request, userPrincipal.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ========== GET BOOKINGS ==========

    /**
     * Get bookings by clinic (Manager views bookings for their clinic)
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/clinic/{clinicId}")
    public ResponseEntity<Page<BookingResponse>> getBookingsByClinic(
            @PathVariable UUID clinicId,
            @RequestParam(required = false) BookingStatus status,
            @RequestParam(required = false) com.petties.petties.model.enums.BookingType type,
            @PageableDefault(size = 20) Pageable pageable) {

        Page<BookingResponse> bookings = bookingService.getBookingsByClinic(clinicId, status, type, pageable);
        return ResponseEntity.ok(bookings);
    }

    /**
     * Get bookings by staff (Staff views their assigned bookings)
     */
    @PreAuthorize("hasAnyRole('STAFF', 'CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/staff/{staffId}")
    public ResponseEntity<Page<BookingResponse>> getBookingsByStaff(
            @PathVariable UUID staffId,
            @RequestParam(required = false) BookingStatus status,
            @PageableDefault(size = 20) Pageable pageable) {

        Page<BookingResponse> bookings = bookingService.getBookingsByStaff(staffId, status, pageable);
        return ResponseEntity.ok(bookings);
    }

    /**
     * Get booking by ID (Get detailed booking information)
     */
    @GetMapping("/{bookingId}")
    public ResponseEntity<BookingResponse> getBookingById(@PathVariable UUID bookingId) {
        BookingResponse response = bookingService.getBookingById(bookingId);
        return ResponseEntity.ok(response);
    }

    /**
     * Get booking by code (Get booking by its unique code)
     */
    @GetMapping("/code/{bookingCode}")
    public ResponseEntity<BookingResponse> getBookingByCode(@PathVariable String bookingCode) {
        BookingResponse response = bookingService.getBookingByCode(bookingCode);
        return ResponseEntity.ok(response);
    }

    // ========== CONFIRM BOOKING ==========

    /**
     * Check staff availability before confirming booking
     * Returns detailed availability for each service and alternative time slot
     * suggestions
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/{bookingId}/check-staff-availability")
    public ResponseEntity<StaffAvailabilityCheckResponse> checkStaffAvailability(@PathVariable UUID bookingId) {
        StaffAvailabilityCheckResponse response = bookingService.checkStaffAvailability(bookingId);
        return ResponseEntity.ok(response);
    }

    /**
     * Get available staff for manual selection when confirming booking
     * Returns list of staff with matching specialty, availability status, and
     * workload info
     * Used for the dropdown to allow Clinic Manager to manually select a staff
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/{bookingId}/available-staff-for-confirm")
    public ResponseEntity<List<StaffOptionDTO>> getAvailableStaffForConfirm(@PathVariable UUID bookingId) {
        List<StaffOptionDTO> availableStaff = bookingService.getAvailableStaffForConfirm(bookingId);
        return ResponseEntity.ok(availableStaff);
    }

    /**
     * Confirm booking (Manager confirms booking and triggers auto-assign staff)
     * Supports partial confirmation options:
     * - allowPartial: Confirm even if some services don't have available staff
     * - removeUnavailableServices: Remove services without available staff and
     * recalculate price
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @PatchMapping("/{bookingId}/confirm")
    public ResponseEntity<BookingResponse> confirmBooking(
            @PathVariable UUID bookingId,
            @RequestBody(required = false) BookingConfirmRequest request) {

        BookingResponse response = bookingService.confirmBooking(bookingId, request);
        return ResponseEntity.ok(response);
    }

    // ========== CANCEL BOOKING ==========

    /**
     * Cancel booking (Cancel a booking with reason)
     */
    @PatchMapping("/{bookingId}/cancel")
    public ResponseEntity<BookingResponse> cancelBooking(
            @PathVariable UUID bookingId,
            @RequestParam String reason,
            @AuthenticationPrincipal UserDetails userDetails) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        BookingResponse response = bookingService.cancelBooking(bookingId, reason, userPrincipal.getUserId());
        return ResponseEntity.ok(response);
    }

    // ========== MY BOOKINGS (Pet Owner) ==========

    /**
     * Get my bookings (Pet owner views their own bookings)
     */
    @PreAuthorize("hasRole('PET_OWNER')")
    @GetMapping("/my")
    public ResponseEntity<Page<BookingResponse>> getMyBookings(
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 20) Pageable pageable) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        Page<BookingResponse> bookings = bookingService.getMyBookings(userPrincipal.getUserId(), pageable);
        return ResponseEntity.ok(bookings);
    }

    // ========== STAFF REASSIGNMENT ==========

    /**
     * Get available staff for reassigning a specific service
     * Returns list of staff with matching specialty and availability status
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/{bookingId}/services/{serviceId}/available-staff")
    public ResponseEntity<List<AvailableStaffResponse>> getAvailableStaffForReassign(
            @PathVariable UUID bookingId,
            @PathVariable UUID serviceId) {

        List<AvailableStaffResponse> availableStaff = bookingService.getAvailableStaffForReassign(bookingId, serviceId);
        return ResponseEntity.ok(availableStaff);
    }

    /**
     * Reassign staff for a specific service in a booking
     * Releases old slots and reserves new slots with the new staff
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/services/{serviceId}/reassign")
    public ResponseEntity<BookingResponse> reassignStaff(
            @PathVariable UUID bookingId,
            @PathVariable UUID serviceId,
            @Valid @RequestBody ReassignStaffRequest request) {

        BookingResponse response = bookingService.reassignStaffForService(bookingId, serviceId,
                request.getNewStaffId());
        return ResponseEntity.ok(response);
    }

    // ========== ADD-ON SERVICE ==========

    /**
     * Add a service to an active booking (IN_PROGRESS or ARRIVED)
     * Used when staff wants to add extra services during home visit
     * Distance fee is NOT recalculated
     *
     * For HOME_VISIT: STAFF can only add services within their specialty
     * For IN_CLINIC: Manager can add any service
     */
    @PreAuthorize("hasAnyRole('STAFF', 'CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/add-service")
    public ResponseEntity<BookingResponse> addServiceToBooking(
            @PathVariable UUID bookingId,
            @RequestBody AddServiceRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        UUID userId = userPrincipal.getUserId();
        com.petties.petties.model.User currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new com.petties.petties.exception.ResourceNotFoundException("User not found"));

        BookingResponse response = bookingService.addServiceToBooking(bookingId, request.getServiceId(), currentUser);
        return ResponseEntity.ok(response);
    }

    /**
     * Get available services that can be added to this booking
     * Filters by specialty for HOME_VISIT and STAFF role
     */
    @PreAuthorize("hasAnyRole('STAFF', 'CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/{bookingId}/available-services")
    public ResponseEntity<List<com.petties.petties.dto.clinicService.ClinicServiceResponse>> getAvailableServices(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal UserDetails userDetails) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        UUID userId = userPrincipal.getUserId();
        com.petties.petties.model.User currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new com.petties.petties.exception.ResourceNotFoundException("User not found"));

        try {
            List<com.petties.petties.dto.clinicService.ClinicServiceResponse> services = bookingService
                    .getAvailableServicesForAddOn(bookingId, currentUser);
            return ResponseEntity.ok(services);
        } catch (Exception e) {
            log.error("Error getting available services for booking {}: {}", bookingId, e.getMessage(), e);
            throw e;
        }
    }

    // ========== STATUS TRANSITIONS ==========

    /**
     * Check-in booking (Staff action)
     * Transitions: ASSIGNED → IN_PROGRESS
     */
    @PreAuthorize("hasAnyRole('STAFF', 'CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/check-in")
    public ResponseEntity<BookingResponse> checkIn(@PathVariable UUID bookingId) {
        BookingResponse response = bookingService.checkIn(bookingId);
        return ResponseEntity.ok(response);
    }

    /**
     * Complete booking (Manager action - after payment confirmed)
     * Transitions: IN_PROGRESS → COMPLETED
     */
    @PreAuthorize("hasAnyRole('STAFF', 'CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/complete")
    public ResponseEntity<BookingResponse> complete(@PathVariable UUID bookingId) {
        BookingResponse response = bookingService.complete(bookingId);
        return ResponseEntity.ok(response);
    }

    /**
     * Notify pet owner that staff is on the way (Manager action)
     * Does NOT change booking status - just sends notification
     * Only for HOME_VISIT and SOS bookings
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/notify-on-way")
    public ResponseEntity<BookingResponse> notifyOnWay(@PathVariable UUID bookingId) {
        BookingResponse response = bookingService.notifyOnWay(bookingId);
        return ResponseEntity.ok(response);
    }

    // ========== STAFF HOME SUMMARY ==========

    /**
     * Get staff home screen summary (Staff views their dashboard data)
     * Aggregates: today's booking count, pending count, upcoming bookings list
     * Optimized single API call for mobile home screen
     */
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    @GetMapping("/staff/home-summary")
    public ResponseEntity<com.petties.petties.dto.booking.StaffHomeSummaryResponse> getStaffHomeSummary(
            @AuthenticationPrincipal UserDetails userDetails) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        com.petties.petties.dto.booking.StaffHomeSummaryResponse response = bookingService
                .getStaffHomeSummary(userPrincipal.getUserId());
        return ResponseEntity.ok(response);
    }

}
