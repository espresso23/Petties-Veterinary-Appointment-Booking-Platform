package com.petties.petties.controller;

import com.petties.petties.dto.booking.AddServiceRequest;
import com.petties.petties.dto.booking.AvailableStaffResponse;
import com.petties.petties.dto.booking.AvailableSlotsResponse;
import com.petties.petties.dto.booking.BookingConfirmRequest;
import com.petties.petties.dto.booking.BookingRequest;
import com.petties.petties.dto.booking.BookingResponse;
import com.petties.petties.dto.booking.CheckoutRequest;
import com.petties.petties.dto.booking.EstimatedCompletionRequest;
import com.petties.petties.dto.booking.EstimatedCompletionResponse;
import com.petties.petties.dto.booking.ProxyBookingRequest;
import com.petties.petties.dto.booking.ReassignStaffRequest;
import com.petties.petties.dto.booking.StaffAvailabilityCheckResponse;
import com.petties.petties.dto.booking.StaffOptionDTO;
import com.petties.petties.exception.ResourceNotFoundException;
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

    /**
     * Calculate estimated completion time (Public endpoint)
     * Returns total duration and estimated end time based on pets with services and start time
     * Request format: { startTime, pets: [{ petId, petWeight, serviceIds: [...] }] }
     */
    @PostMapping("/public/estimated-completion")
    public ResponseEntity<EstimatedCompletionResponse> getEstimatedCompletion(
            @RequestParam UUID clinicId,
            @Valid @RequestBody EstimatedCompletionRequest request) {

        log.info("POST /bookings/public/estimated-completion - clinicId: {}, startDateTime: {}, pets: {}",
                clinicId, request.getStartDateTime(), request.getPets().size());

        EstimatedCompletionResponse response = bookingService.calculateEstimatedCompletion(
                clinicId, request);

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

    /**
     * Create a proxy booking (Đặt hộ - booking on behalf of someone else)
     * The logged-in user creates a booking for another person who may not have an account.
     */
    @PreAuthorize("hasRole('PET_OWNER')")
    @PostMapping("/proxy")
    public ResponseEntity<BookingResponse> createProxyBooking(
            @Valid @RequestBody ProxyBookingRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        log.info("POST /bookings/proxy - Creating proxy booking for recipient: {}", 
                request.getRecipient().getFullName());
        
        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        BookingResponse response = bookingService.createProxyBooking(request, userPrincipal.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ========== GET BOOKINGS ==========

    /**
     * Get bookings by clinic (Manager/Owner views bookings for their clinic)
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'CLINIC_OWNER', 'ADMIN')")
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
     * Get current pet owner's bookings
     */
    @PreAuthorize("hasRole('PET_OWNER')")
    @GetMapping("/my-bookings")
    public ResponseEntity<Page<BookingResponse>> getMyBookings(
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 10, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC) Pageable pageable) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        Page<BookingResponse> bookings = bookingService.getMyBookings(userPrincipal.getUserId(), pageable);
        return ResponseEntity.ok(bookings);
    }

    /**
     * Get my proxy bookings (Bookings I created on behalf of others)
     */
    @PreAuthorize("hasRole('PET_OWNER')")
    @GetMapping("/my/proxy")
    public ResponseEntity<Page<BookingResponse>> getMyProxyBookings(
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 20) Pageable pageable) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        Page<BookingResponse> bookings = bookingService.getMyProxyBookings(userPrincipal.getUserId(), pageable);
        return ResponseEntity.ok(bookings);
    }

    // ========== STAFF REASSIGNMENT ==========

    /**
     * Get booking details by ID
     */
    @PreAuthorize("hasAnyRole('PET_OWNER', 'STAFF', 'CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/{bookingId}")
    public ResponseEntity<BookingResponse> getBookingById(@PathVariable UUID bookingId) {
        BookingResponse booking = bookingService.getBookingById(bookingId);
        return ResponseEntity.ok(booking);
    }

    /**
     * Get available staff for reassigning a specific service item
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'CLINIC_OWNER', 'ADMIN')")
    @GetMapping("/{bookingId}/services/{serviceId}/available-staff")
    public ResponseEntity<List<AvailableStaffResponse>> getAvailableStaffForReassign(
            @PathVariable UUID bookingId,
            @PathVariable UUID serviceId) {

        List<AvailableStaffResponse> availableStaff = bookingService.getAvailableStaffForReassign(bookingId, serviceId);
        return ResponseEntity.ok(availableStaff);
    }

    /**
     * Get booking details by Code
     */
    @PreAuthorize("hasAnyRole('PET_OWNER', 'STAFF', 'CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/code/{bookingCode}")
    public ResponseEntity<BookingResponse> getBookingByCode(@PathVariable String bookingCode) {
        BookingResponse booking = bookingService.getBookingByCode(bookingCode);
        return ResponseEntity.ok(booking);
    }

    // ========== ASSIGNMENT & ALTERNATIVES ==========

    /**
     * Get detailed availability info for a specific booking
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/{bookingId}/availability")
    public ResponseEntity<StaffAvailabilityCheckResponse> getStaffAvailability(@PathVariable UUID bookingId) {
        StaffAvailabilityCheckResponse response = bookingService.checkStaffAvailability(bookingId);
        return ResponseEntity.ok(response);
    }

    /**
     * Get available staff for manual confirmation of a booking
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @GetMapping({ "/{bookingId}/staff-options", "/{bookingId}/available-staff-for-confirm" })
    public ResponseEntity<List<StaffOptionDTO>> getStaffOptions(@PathVariable UUID bookingId) {
        List<StaffOptionDTO> options = bookingService.getAvailableStaffForConfirm(bookingId);
        return ResponseEntity.ok(options);
    }

    /**
     * Get available staff for reassigning a specific service item (alternatives)
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/{bookingId}/services/{serviceId}/alternatives")
    public ResponseEntity<List<AvailableStaffResponse>> getReassignAlternatives(
            @PathVariable UUID bookingId,
            @PathVariable UUID serviceId) {
        List<AvailableStaffResponse> alternatives = bookingService.getAvailableStaffForReassign(bookingId, serviceId);
        return ResponseEntity.ok(alternatives);
    }

    // ========== UPDATES & STATUS ==========

    /**
     * Confirm booking (Clinic Manager action)
     * Auto-assigns or manual-assigns staff and reserves slots
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/confirm")
    public ResponseEntity<BookingResponse> confirmBooking(
            @PathVariable UUID bookingId,
            @Valid @RequestBody(required = false) BookingConfirmRequest request) {

        BookingResponse response = bookingService.confirmBooking(bookingId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Reassign staff for a specific service item
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @PutMapping("/{bookingId}/services/{serviceId}/reassign")
    public ResponseEntity<BookingResponse> reassignStaff(
            @PathVariable UUID bookingId,
            @PathVariable UUID serviceId,
            @Valid @RequestBody ReassignStaffRequest request) {

        BookingResponse response = bookingService.reassignStaffForService(bookingId, serviceId,
                request.getNewStaffId());
        return ResponseEntity.ok(response);
    }

    /**
     * Add service to an active booking (Staff/Manager action)
     */
    @PreAuthorize("hasAnyRole('STAFF', 'CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/services")
    public ResponseEntity<BookingResponse> addService(
            @PathVariable UUID bookingId,
            @Valid @RequestBody AddServiceRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        com.petties.petties.model.User currentUser = bookingService.getCurrentUserById(userPrincipal.getUserId());

        BookingResponse response = bookingService.addServiceToBooking(bookingId, request.getServiceId(), currentUser);
        return ResponseEntity.ok(response);
    }

    /**
     * Get available services that can be added to a booking
     */
    @PreAuthorize("hasAnyRole('STAFF', 'CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/{bookingId}/available-add-ons")
    public ResponseEntity<List<com.petties.petties.dto.clinicService.ClinicServiceResponse>> getAvailableAddOns(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal UserDetails userDetails) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        com.petties.petties.model.User currentUser = bookingService.getCurrentUserById(userPrincipal.getUserId());

        List<com.petties.petties.dto.clinicService.ClinicServiceResponse> response = bookingService
                .getAvailableServicesForAddOn(bookingId, currentUser);
        return ResponseEntity.ok(response);
    }

    /**
     * Cancel booking
     */
    @PreAuthorize("hasAnyRole('PET_OWNER', 'CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/cancel")
    public ResponseEntity<BookingResponse> cancelBooking(
            @PathVariable UUID bookingId,
            @RequestParam String reason,
            @AuthenticationPrincipal UserDetails userDetails) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        BookingResponse response = bookingService.cancelBooking(bookingId, reason, userPrincipal.getUserId());
        return ResponseEntity.ok(response);
    }

    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    @PostMapping("/{bookingId}/check-in")
    public ResponseEntity<BookingResponse> checkIn(@PathVariable UUID bookingId) {
        BookingResponse response = bookingService.checkIn(bookingId);
        return ResponseEntity.ok(response);
    }

    /**
     * Start moving to customer location (Staff action)
     * Transitions: CONFIRMED → IN_PROGRESS (simplified flow)
     */
    @PreAuthorize("hasAnyRole('STAFF', 'CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/start-moving")
    public ResponseEntity<BookingResponse> startMoving(@PathVariable UUID bookingId) {
        BookingResponse response = bookingService.startMoving(bookingId);
        return ResponseEntity.ok(response);
    }
    /**
     * Staff arrived at customer location (Staff action)
     * Transitions: IN_PROGRESS (Movement) -> IN_PROGRESS (Arrival recorded)
     */
    @PreAuthorize("hasAnyRole('STAFF', 'CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/arrived")
    public ResponseEntity<BookingResponse> arrived(@PathVariable UUID bookingId) {
        BookingResponse response = bookingService.arrived(bookingId);
        return ResponseEntity.ok(response);
    }

    /**
     * Checkout booking (Staff action)
     * For SOS bookings, allows overriding the SOS fee
     */
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    @PostMapping("/{bookingId}/checkout")
    public ResponseEntity<BookingResponse> checkout(
            @PathVariable UUID bookingId,
            @RequestBody @Valid CheckoutRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        com.petties.petties.model.User currentUser = bookingService.getCurrentUserById(userPrincipal.getUserId());

        BookingResponse response = bookingService.processCheckout(bookingId, request, currentUser);
        return ResponseEntity.ok(response);
    }

    /**
     * Complete booking (Manager action - after payment confirmed)
          * Transitions: IN_PROGRESS → COMPLETED
     */
    @PreAuthorize("hasAnyRole('STAFF', 'CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/complete")
    public ResponseEntity<BookingResponse> complete(
            @PathVariable UUID bookingId,
            @RequestBody(required = false) CheckoutRequest request) {
        throw new ResourceNotFoundException("Endpoint đã ngừng hỗ trợ. Vui lòng sử dụng /bookings/{bookingId}/checkout");
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

    /**
     * Remove a service from booking (Only add-on services)
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'STAFF', 'ADMIN')")
    @DeleteMapping("/{bookingId}/services/{serviceId}")
    public ResponseEntity<BookingResponse> removeServiceFromBooking(
            @PathVariable UUID bookingId,
            @PathVariable UUID serviceId) {
        BookingResponse response = bookingService.removeServiceFromBooking(bookingId, serviceId);
        return ResponseEntity.ok(response);
    }

    // ========== SHARED VISIBILITY (STAFF) ==========

    /**
     * Get all bookings for a clinic today - Shared Visibility for Staff
     * All staff in the clinic can see ALL bookings, with isMyAssignment flag
     * to identify their own assignments.
     *
     * This enables collaborative care: any staff can view booking details
     * and add EMR for IN_PROGRESS bookings at the same clinic.
     *
     * @param clinicId Clinic ID
     * @return List of ClinicTodayBookingResponse with isMyAssignment flag
     */
    @PreAuthorize("hasRole('STAFF')")
    @GetMapping("/clinic/{clinicId}/today")
    public ResponseEntity<List<com.petties.petties.dto.booking.ClinicTodayBookingResponse>> getClinicTodayBookings(
            @PathVariable UUID clinicId,
            @AuthenticationPrincipal UserDetails userDetails) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        UUID userId = userPrincipal.getUserId();
        com.petties.petties.model.User currentStaff = bookingService.getCurrentUserById(userId);

        List<com.petties.petties.dto.booking.ClinicTodayBookingResponse> response = bookingService
                .getClinicTodayBookings(clinicId, currentStaff);
        return ResponseEntity.ok(response);
    }
}
