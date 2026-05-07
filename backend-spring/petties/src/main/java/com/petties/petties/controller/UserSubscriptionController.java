package com.petties.petties.controller;

import com.petties.petties.dto.subscription.ClinicSubscriptionStatusDto;
import com.petties.petties.dto.subscription.MySubscriptionStatusDto;
import com.petties.petties.dto.subscription.SubscribeRequestDto;
import com.petties.petties.dto.subscription.UserSubscriptionResponseDto;
import com.petties.petties.model.User;
import com.petties.petties.service.AuthService;
import com.petties.petties.service.UserSubscriptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/subscriptions")
@RequiredArgsConstructor
@Slf4j
public class UserSubscriptionController {

    private final UserSubscriptionService userSubscriptionService;
    private final AuthService authService;

    /**
     * Clinic Owner: Initiate a new subscription
     */
    @PostMapping("/subscribe")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<UserSubscriptionResponseDto> subscribe(
            @Valid @RequestBody SubscribeRequestDto request) {
        User currentUser = authService.getCurrentUser();
        log.info("User {} initiating subscription for clinic {}", currentUser.getUserId(), request.getClinicId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(userSubscriptionService.initiateSubscription(currentUser.getUserId(), request));
    }

    /**
     * Clinic Owner: Get current subscription status for a clinic
     */
    @GetMapping("/my-clinic/{clinicId}")
    @PreAuthorize("hasRole('CLINIC_OWNER') or hasRole('CLINIC_MANAGER') or hasRole('STAFF')")
    public ResponseEntity<UserSubscriptionResponseDto> getClinicSubscription(@PathVariable UUID clinicId) {
        return ResponseEntity.ok(userSubscriptionService.getClinicSubscription(clinicId));
    }

    /**
     * Clinic Owner: Get detailed subscription status (active + pending)
     */
    @GetMapping("/my-clinic/{clinicId}/status")
    @PreAuthorize("hasRole('CLINIC_OWNER') or hasRole('CLINIC_MANAGER')")
    public ResponseEntity<ClinicSubscriptionStatusDto> getClinicSubscriptionStatus(@PathVariable UUID clinicId) {
        return ResponseEntity.ok(userSubscriptionService.getClinicSubscriptionStatus(clinicId));
    }

    /**
     * Clinic Owner: Get all subscription history
     */
    @GetMapping("/my-clinic/{clinicId}/history")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<List<UserSubscriptionResponseDto>> getClinicSubscriptionHistory(
            @PathVariable UUID clinicId) {
        return ResponseEntity.ok(userSubscriptionService.getClinicSubscriptionHistory(clinicId));
    }

    /**
     * Platform Admin: Get all subscription history across all clinics
     */
    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserSubscriptionResponseDto>> getAllSubscriptions() {
        log.info("Admin retrieving all subscriptions history");
        return ResponseEntity.ok(userSubscriptionService.getAllSubscriptions());
    }

    /**
     * Clinic Owner: Cancel the active subscription
     */
    @PutMapping("/my-clinic/{clinicId}/cancel")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<UserSubscriptionResponseDto> cancelClinicSubscription(@PathVariable UUID clinicId) {
        return ResponseEntity
                .ok(userSubscriptionService.cancelClinicSubscription(clinicId));
    }

    /**
     * Clinic Owner: Cancel any subscription by ID (Active or Pending)
     */
    @PutMapping("/{subscriptionId}/cancel")
    @PreAuthorize("hasRole('CLINIC_OWNER')")
    public ResponseEntity<UserSubscriptionResponseDto> cancelSubscriptionById(
            @PathVariable UUID subscriptionId) {
        log.info("Request to cancel subscription by ID: {}", subscriptionId);
        return ResponseEntity.ok(userSubscriptionService.cancelSubscriptionById(subscriptionId));
    }

    /**
     * Get current subscription status for the current user's working clinic
     */
    @GetMapping("/my-status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MySubscriptionStatusDto> getMySubscriptionStatus() {
        User currentUser = authService.getCurrentUser();
        log.info("Getting subscription status for user: {} with role: {}", currentUser.getUserId(), currentUser.getRole());
        return ResponseEntity.ok(userSubscriptionService.getMySubscriptionStatus(currentUser));
    }
}
