package com.petties.petties.controller;

import com.petties.petties.dto.booking.AddServiceRequest;
import com.petties.petties.dto.booking.AvailableVetResponse;
import com.petties.petties.dto.booking.AvailableSlotsResponse;
import com.petties.petties.dto.booking.BookingConfirmRequest;
import com.petties.petties.dto.booking.BookingRequest;
import com.petties.petties.dto.booking.BookingResponse;
import com.petties.petties.dto.booking.ReassignVetRequest;
import com.petties.petties.dto.booking.VetAvailabilityCheckResponse;
import com.petties.petties.dto.booking.VetOptionDTO;
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
     * Get bookings by vet (Vet views their assigned bookings)
     */
    @PreAuthorize("hasAnyRole('VET', 'CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/vet/{vetId}")
    public ResponseEntity<Page<BookingResponse>> getBookingsByVet(
            @PathVariable UUID vetId,
            @RequestParam(required = false) BookingStatus status,
            @PageableDefault(size = 20) Pageable pageable) {

        Page<BookingResponse> bookings = bookingService.getBookingsByVet(vetId, status, pageable);
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
     * Check vet availability before confirming booking
     * Returns detailed availability for each service and alternative time slot
     * suggestions
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/{bookingId}/check-vet-availability")
    public ResponseEntity<VetAvailabilityCheckResponse> checkVetAvailability(@PathVariable UUID bookingId) {
        VetAvailabilityCheckResponse response = bookingService.checkVetAvailability(bookingId);
        return ResponseEntity.ok(response);
    }

    /**
     * Get available vets for manual selection when confirming booking
     * Returns list of vets with matching specialty, availability status, and
     * workload info
     * Used for the dropdown to allow Clinic Manager to manually select a vet
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/{bookingId}/available-vets-for-confirm")
    public ResponseEntity<List<VetOptionDTO>> getAvailableVetsForConfirm(@PathVariable UUID bookingId) {
        List<VetOptionDTO> availableVets = bookingService.getAvailableVetsForConfirm(bookingId);
        return ResponseEntity.ok(availableVets);
    }

    /**
     * Confirm booking (Manager confirms booking and triggers auto-assign vet)
     * Supports partial confirmation options:
     * - allowPartial: Confirm even if some services don't have available vets
     * - removeUnavailableServices: Remove services without available vets and
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

        // Note: This will need UserRepository to get bookings by pet owner
        // For now, return empty - will be implemented with proper auth context
        return ResponseEntity.ok(Page.empty());
    }

    // ========== VET REASSIGNMENT ==========

    /**
     * Get available vets for reassigning a specific service
     * Returns list of vets with matching specialty and availability status
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/{bookingId}/services/{serviceId}/available-vets")
    public ResponseEntity<List<AvailableVetResponse>> getAvailableVetsForReassign(
            @PathVariable UUID bookingId,
            @PathVariable UUID serviceId) {

        List<AvailableVetResponse> availableVets = bookingService.getAvailableVetsForReassign(bookingId, serviceId);
        return ResponseEntity.ok(availableVets);
    }

    /**
     * Reassign vet for a specific service in a booking
     * Releases old slots and reserves new slots with the new vet
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/services/{serviceId}/reassign")
    public ResponseEntity<BookingResponse> reassignVet(
            @PathVariable UUID bookingId,
            @PathVariable UUID serviceId,
            @Valid @RequestBody ReassignVetRequest request) {

        BookingResponse response = bookingService.reassignVetForService(bookingId, serviceId, request.getNewVetId());
        return ResponseEntity.ok(response);
    }

    // ========== ADD-ON SERVICE ==========

    /**
     * Add a service to an active booking (IN_PROGRESS or ARRIVED)
     * Used when vet wants to add extra services during home visit
     * Distance fee is NOT recalculated
     * 
     * For HOME_VISIT: VET can only add services within their specialty
     * For IN_CLINIC: Manager can add any service
     */
    @PreAuthorize("hasAnyRole('VET', 'CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/add-service")
    public ResponseEntity<BookingResponse> addServiceToBooking(
            @PathVariable UUID bookingId,
            @RequestBody AddServiceRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        UUID userId = UUID.fromString(userDetails.getUsername());
        com.petties.petties.model.User currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new com.petties.petties.exception.ResourceNotFoundException("User not found"));

        BookingResponse response = bookingService.addServiceToBooking(bookingId, request.getServiceId(), currentUser);
        return ResponseEntity.ok(response);
    }

    /**
     * Get available services that can be added to this booking
     * Filters by specialty for HOME_VISIT and VET role
     */
    @PreAuthorize("hasAnyRole('VET', 'CLINIC_MANAGER', 'ADMIN')")
    @GetMapping("/{bookingId}/available-services")
    public ResponseEntity<List<com.petties.petties.dto.clinicService.ClinicServiceResponse>> getAvailableServices(
            @PathVariable UUID bookingId,
            @AuthenticationPrincipal UserDetails userDetails) {

        UUID userId = UUID.fromString(userDetails.getUsername());
        com.petties.petties.model.User currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new com.petties.petties.exception.ResourceNotFoundException("User not found"));

        List<com.petties.petties.dto.clinicService.ClinicServiceResponse> services = bookingService
                .getAvailableServicesForAddOn(bookingId, currentUser);
        return ResponseEntity.ok(services);
    }

    // ========== STATUS TRANSITIONS ==========

    /**
     * Check-in booking (Vet action)
     * Transitions: ASSIGNED → IN_PROGRESS
     */
    @PreAuthorize("hasAnyRole('VET', 'CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/check-in")
    public ResponseEntity<BookingResponse> checkIn(@PathVariable UUID bookingId) {
        BookingResponse response = bookingService.checkIn(bookingId);
        return ResponseEntity.ok(response);
    }

    /**
     * Complete booking (Manager action - after payment confirmed)
     * Transitions: IN_PROGRESS → COMPLETED
     */
    @PreAuthorize("hasAnyRole('VET', 'CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/complete")
    public ResponseEntity<BookingResponse> complete(@PathVariable UUID bookingId) {
        BookingResponse response = bookingService.complete(bookingId);
        return ResponseEntity.ok(response);
    }

    /**
     * Notify pet owner that vet is on the way (Manager action)
     * Does NOT change booking status - just sends notification
     * Only for HOME_VISIT and SOS bookings
     */
    @PreAuthorize("hasAnyRole('CLINIC_MANAGER', 'ADMIN')")
    @PostMapping("/{bookingId}/notify-on-way")
    public ResponseEntity<BookingResponse> notifyOnWay(@PathVariable UUID bookingId) {
        BookingResponse response = bookingService.notifyOnWay(bookingId);
        return ResponseEntity.ok(response);
    }

    // ========== VET HOME SUMMARY ==========

    /**
     * Get vet home screen summary (Vet views their dashboard data)
     * Aggregates: today's booking count, pending count, upcoming bookings list
     * Optimized single API call for mobile home screen
     */
    @PreAuthorize("hasAnyRole('VET', 'ADMIN')")
    @GetMapping("/vet/home-summary")
    public ResponseEntity<com.petties.petties.dto.booking.VetHomeSummaryResponse> getVetHomeSummary(
            @AuthenticationPrincipal UserDetails userDetails) {

        com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal userPrincipal = (com.petties.petties.config.UserDetailsServiceImpl.UserPrincipal) userDetails;
        com.petties.petties.dto.booking.VetHomeSummaryResponse response = bookingService
                .getVetHomeSummary(userPrincipal.getUserId());
        return ResponseEntity.ok(response);
    }
}
