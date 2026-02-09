package com.petties.petties.scheduler;

import com.petties.petties.model.Booking;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduler that automatically cancels PENDING bookings 
 * that have not been confirmed by the clinic within 30 minutes of creation.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BookingAutoCancellationScheduler {

    private final BookingRepository bookingRepository;
    private final NotificationService notificationService;

    private static final int PENDING_TIMEOUT_MINUTES = 30;

    /**
     * Runs every 1 minute to check for stale PENDING bookings.
     * If a PENDING booking was created more than 30 minutes ago without confirmation,
     * it will be automatically cancelled.
     */
    @Scheduled(fixedRate = 10000) // Every 1 minute
    @Transactional
    public void autoCancelStalePendingBookings() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(PENDING_TIMEOUT_MINUTES);
        
        List<Booking> staleBookings = bookingRepository.findByStatusAndCreatedAtBefore(
                BookingStatus.PENDING, cutoff);

        if (staleBookings.isEmpty()) {
            return;
        }

        log.info("Found {} stale PENDING bookings to auto-cancel (created before {})",
                staleBookings.size(), cutoff);

        for (Booking booking : staleBookings) {
            try {
                cancelBooking(booking);
            } catch (Exception e) {
                log.error("Failed to auto-cancel booking {}: {}", 
                        booking.getBookingCode(), e.getMessage(), e);
            }
        }
    }

    private void cancelBooking(Booking booking) {
        log.info("Auto-cancelling booking {} (created at {})",
                booking.getBookingCode(), booking.getCreatedAt());

        // Update status to CANCELLED
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setNotes("Tự động hủy do không được xác nhận trong thời gian quy định (30 phút)");
        bookingRepository.save(booking);

        // Send notification to pet owner
        notificationService.sendBookingAutoCancelledNotification(booking);

        log.info("Successfully auto-cancelled booking {}", booking.getBookingCode());
    }
}
