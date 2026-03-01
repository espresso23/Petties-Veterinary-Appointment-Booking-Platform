package com.petties.petties.service;

import com.petties.petties.dto.sos.SosMatchingStatusMessage;
import com.petties.petties.dto.sos.SosMatchingStatusMessage.MatchingEvent;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.BookingStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * SOS Notification Service
 *
 * Handles all WebSocket broadcasting for SOS matching process.
 * Extracted from SosMatchingService for better separation of concerns.
 *
 * WebSocket topics:
 * - /topic/sos-matching/{bookingId} - Status updates for Pet Owner
 * - /topic/clinic/{clinicId}/sos-alert - Alert notifications for Clinic
 * Managers
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SosNotificationService {

        private final SimpMessagingTemplate messagingTemplate;
        private final SosSessionManager sessionManager;

        // ========== Pet Owner Notifications ==========

        /**
         * Notify pet owner that a clinic is being contacted
         *
         * @param bookingId    Booking ID
         * @param clinic       Clinic being contacted
         * @param clinicIndex  Current clinic index (0-based)
         * @param totalClinics Total clinics in range
         * @param distanceKm   Distance to clinic
         */
        public void notifyOwnerClinicContacted(UUID bookingId, Clinic clinic, int clinicIndex,
                        int totalClinics, double distanceKm) {
                broadcastToOwner(bookingId, SosMatchingStatusMessage.builder()
                                .bookingId(bookingId)
                                .status(BookingStatus.PENDING_CLINIC_CONFIRM)
                                .event(MatchingEvent.CLINIC_NOTIFIED)
                                .message("Đang chờ phòng khám " + clinic.getName() + " xác nhận")
                                .currentClinicIndex(clinicIndex + 1)
                                .totalClinicsInRange(totalClinics)
                                .clinicName(clinic.getName())
                                .distanceKm(distanceKm)
                                .remainingSeconds((long) sessionManager.getClinicTimeoutSeconds())
                                .build());
        }

        /**
         * Notify pet owner that system is trying the next clinic
         *
         * @param bookingId    Booking ID
         * @param clinic       Next clinic being contacted
         * @param clinicIndex  Current clinic index (0-based)
         * @param totalClinics Total clinics in range
         */
        public void notifyOwnerWaitingNext(UUID bookingId, Clinic clinic, int clinicIndex, int totalClinics) {
                broadcastToOwner(bookingId, SosMatchingStatusMessage.builder()
                                .bookingId(bookingId)
                                .status(BookingStatus.PENDING_CLINIC_CONFIRM)
                                .event(MatchingEvent.WAITING_NEXT)
                                .message("Đang liên hệ phòng khám " + clinic.getName())
                                .currentClinicIndex(clinicIndex + 1)
                                .totalClinicsInRange(totalClinics)
                                .clinicName(clinic.getName())
                                .remainingSeconds((long) sessionManager.getClinicTimeoutSeconds())
                                .build());
        }

        /**
         * Notify pet owner that a clinic has confirmed the SOS request
         *
         * @param bookingId Booking ID
         * @param clinic    Confirmed clinic
         * @param staff     Assigned staff
         */
        public void notifyOwnerConfirmed(UUID bookingId, Clinic clinic, User staff, Double distanceKm,
                        Integer estimatedMinutes) {
                broadcastToOwner(bookingId, SosMatchingStatusMessage.builder()
                                .bookingId(bookingId)
                                .status(BookingStatus.CONFIRMED)
                                .event(MatchingEvent.CONFIRMED)
                                .message("Phòng khám " + clinic.getName() + " đã xác nhận yêu cầu cấp cứu")
                                .clinicId(clinic.getClinicId())
                                .clinicName(clinic.getName())
                                .clinicPhone(clinic.getPhone())
                                .clinicLat(clinic.getLatitude() != null ? clinic.getLatitude().doubleValue() : null)
                                .clinicLng(clinic.getLongitude() != null ? clinic.getLongitude().doubleValue() : null)
                                .distanceKm(distanceKm)
                                .estimatedMinutes(estimatedMinutes)
                                .staffId(staff != null ? staff.getUserId() : null)
                                .staffName(staff != null ? staff.getFullName() : null)
                                .staffPhone(staff != null ? staff.getPhone() : null)
                                .staffAvatarUrl(staff != null ? staff.getAvatar() : null)
                                .build());
        }

        /**
         * Notify pet owner that no clinic is available
         *
         * @param bookingId Booking ID
         */
        public void notifyOwnerNoClinic(UUID bookingId) {
                broadcastToOwner(bookingId, SosMatchingStatusMessage.builder()
                                .bookingId(bookingId)
                                .status(BookingStatus.CANCELLED)
                                .event(MatchingEvent.NO_CLINIC)
                                .message("Rất tiếc, không có phòng khám nào khả dụng trong khu vực của bạn.")
                                .build());
        }

        /**
         * Notify pet owner that booking was cancelled
         *
         * @param bookingId Booking ID
         */
        public void notifyOwnerCancelled(UUID bookingId) {
                broadcastToOwner(bookingId, SosMatchingStatusMessage.builder()
                                .bookingId(bookingId)
                                .status(BookingStatus.CANCELLED)
                                .event(MatchingEvent.CANCELLED)
                                .message("Bạn đã hủy yêu cầu cấp cứu.")
                                .build());
        }

        // ========== Clinic Manager Notifications ==========

        /**
         * Send SOS alert to a clinic
         * Clinic managers subscribe to: /topic/clinic/{clinicId}/sos-alert
         *
         * @param booking      Booking details
         * @param clinic       Clinic to notify
         * @param clinicIndex  Current clinic index (0-based)
         * @param totalClinics Total clinics being tried
         */
        public void alertClinic(Booking booking, Clinic clinic, int clinicIndex, int totalClinics) {
                log.info("Alerting clinic {} ({}/{}) for SOS booking {}",
                                clinic.getName(), clinicIndex + 1, totalClinics, booking.getBookingId());

                // Build message with full booking details for clinic manager
                SosMatchingStatusMessage.SosMatchingStatusMessageBuilder builder = SosMatchingStatusMessage.builder()
                                .bookingId(booking.getBookingId())
                                .event(MatchingEvent.CLINIC_NOTIFIED)
                                .message("Yêu cầu cấp cứu mới!")
                                .clinicId(clinic.getClinicId())
                                .clinicName(clinic.getName())
                                .remainingSeconds((long) sessionManager.getClinicTimeoutSeconds())
                                .symptoms(booking.getSymptoms())
                                .homeAddress(booking.getHomeAddress())
                                .homeLat(booking.getHomeLat() != null ? booking.getHomeLat().doubleValue() : null)
                                .homeLong(booking.getHomeLong() != null ? booking.getHomeLong().doubleValue() : null);

                // Pet info
                if (booking.getPet() != null) {
                        builder.petName(booking.getPet().getName())
                                        .petSpecies(booking.getPet().getSpecies())
                                        .petBreed(booking.getPet().getBreed())
                                        .petWeight(booking.getPet().getWeight())
                                        .petAvatarUrl(booking.getPet().getImageUrl());
                }

                // Pet Owner info
                if (booking.getPetOwner() != null) {
                        builder.petOwnerName(booking.getPetOwner().getFullName())
                                        .petOwnerPhone(booking.getPetOwner().getPhone());
                }

                // Distance
                if (booking.getDistanceKm() != null) {
                        builder.distanceKm(booking.getDistanceKm().doubleValue());
                }

                messagingTemplate.convertAndSend(
                                "/topic/clinic/" + clinic.getClinicId() + "/sos-alert",
                                builder.build());

                log.debug("Sent SOS alert to /topic/clinic/{}/sos-alert for booking {}",
                                clinic.getClinicId(), booking.getBookingId());
        }

        /**
         * Notify clinic that an SOS alert is no longer valid (stale)
         * Used to close modals when booking is confirmed by another clinic/manager or
         * cancelled.
         *
         * @param bookingId Booking ID
         * @param clinicId  Clinic ID to notify
         * @param event     The event that made it stale (CONFIRMED, CANCELLED, etc.)
         */
        public void notifyClinicStaleAlert(UUID bookingId, UUID clinicId, MatchingEvent event) {
                log.debug("Notifying clinic {} that SOS alert {} is stale due to {}", clinicId, bookingId, event);

                SosMatchingStatusMessage message = SosMatchingStatusMessage.builder()
                                .bookingId(bookingId)
                                .event(event)
                                .message("Yêu cầu cấp cứu này đã được xử lý hoặc không còn hiệu lực.")
                                .build();

                messagingTemplate.convertAndSend(
                                "/topic/clinic/" + clinicId + "/sos-alert",
                                message);
        }

        // ========== Private Helpers ==========

        /**
         * Broadcast status message to pet owner via WebSocket
         * Pet owners subscribe to: /topic/sos-matching/{bookingId}
         *
         * @param bookingId Booking ID
         * @param message   Status message to broadcast
         */
        private void broadcastToOwner(UUID bookingId, SosMatchingStatusMessage message) {
                String topic = "/topic/sos-matching/" + bookingId;
                messagingTemplate.convertAndSend(topic, message);
                log.debug("Broadcast SOS status to {}: event={}, status={}",
                                topic, message.getEvent(), message.getStatus());
        }

        // ========== Configuration Getters ==========

        public int getClinicTimeoutSeconds() {
                return sessionManager.getClinicTimeoutSeconds();
        }
}
