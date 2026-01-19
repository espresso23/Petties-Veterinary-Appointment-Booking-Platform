package com.petties.petties.dto.booking;

import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Response DTO for Vet Home Screen Summary
 * Aggregates today's bookings count and upcoming appointments
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VetHomeSummaryResponse {

    // ========== TODAY'S STATS ==========
    private int todayBookingsCount; // Total unique bookings assigned to vet today
    private int pendingCount; // Bookings with status CONFIRMED/ASSIGNED waiting to be checked-in
    private int inProgressCount; // Bookings currently in IN_PROGRESS status

    // ========== UPCOMING BOOKINGS ==========
    private List<UpcomingBookingDTO> upcomingBookings;

}
