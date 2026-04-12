package com.petties.petties.util;

import com.petties.petties.model.Booking;
import com.petties.petties.model.BookingServiceItem;
import com.petties.petties.model.Pet;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Utility for computing parallel (round-based) schedule for multi-pet bookings.
 * <p>
 * When multiple pets have the same booking time:
 * - Services of DIFFERENT PETS can run PARALLEL (at the same time)
 * - Services of THE SAME PET must run SEQUENTIAL (a pet cannot do two things at the same time)
 * <p>
 * Example: Pet1 [A,B,C], Pet2 [C,A] at 13:30
 * - Round 0 (13:30): Pet1.A, Pet2.C parallel
 * - Round 1 (14:00): Pet1.B, Pet2.A parallel
 * - Round 2 (15:00): Pet1.C (Pet2 done)
 */
public final class BookingScheduleUtil {

    private BookingScheduleUtil() {
    }

    /**
     * Compute scheduled start/end time for each service item.
     * Multi-pet: parallel by round. Single-pet: sequential (backward compatible).
     *
     * @param booking the booking with services
     * @return map of bookingServiceId -> [startTime, endTime]
     */
    public static Map<UUID, LocalTime[]> computeSchedule(Booking booking) {
        List<BookingServiceItem> items = booking.getBookingServices();
        LocalTime baseTime = booking.getBookingTime();

        if (items == null || items.isEmpty()) {
            return Map.of();
        }

        // Group by pet preserving order
        Map<UUID, List<BookingServiceItem>> byPet = new LinkedHashMap<>();
        for (BookingServiceItem item : items) {
            Pet p = item.getPet() != null ? item.getPet() : booking.getPet();
            UUID petId = p != null ? p.getId() : UUID.randomUUID();
            byPet.computeIfAbsent(petId, k -> new ArrayList<>()).add(item);
        }

        boolean multiPet = byPet.size() > 1;
        Map<UUID, LocalTime[]> result = new LinkedHashMap<>();

        if (!multiPet) {
            // Single pet: sequential (original behavior)
            LocalTime current = baseTime;
            for (BookingServiceItem item : items) {
                int duration = item.getService().getDurationTime() != null
                        ? item.getService().getDurationTime()
                        : 30;
                int slots = Math.max(1, (int) Math.ceil(duration / 30.0));
                int totalMin = slots * 30;

                LocalTime start = current;
                LocalTime end = current.plusMinutes(totalMin);
                result.put(item.getBookingServiceId(), new LocalTime[] { start, end });
                current = end;
            }
            return result;
        }

        // Multi-pet: round-based parallel
        Map<UUID, LocalTime> petNextAvailable = new LinkedHashMap<>();
        for (UUID petId : byPet.keySet()) {
            petNextAvailable.put(petId, baseTime);
        }

        Map<UUID, Integer> petIndex = new LinkedHashMap<>();
        for (UUID petId : byPet.keySet()) {
            petIndex.put(petId, 0);
        }

        boolean hasMore;
        do {
            // Round start = earliest time when at least one pet WITH pending work is ready
            LocalTime roundStart = null;
            for (Map.Entry<UUID, List<BookingServiceItem>> e : byPet.entrySet()) {
                UUID petId = e.getKey();
                if (petIndex.get(petId) < e.getValue().size()) {
                    LocalTime ready = petNextAvailable.get(petId);
                    if (roundStart == null || ready.isBefore(roundStart)) {
                        roundStart = ready;
                    }
                }
            }
            if (roundStart == null) {
                break;
            }

            LocalTime roundEnd = roundStart;
            for (Map.Entry<UUID, List<BookingServiceItem>> e : byPet.entrySet()) {
                UUID petId = e.getKey();
                List<BookingServiceItem> petItems = e.getValue();
                int idx = petIndex.get(petId);

                if (idx >= petItems.size()) {
                    continue;
                }

                LocalTime petReady = petNextAvailable.get(petId);
                if (petReady.isAfter(roundStart)) {
                    continue; // Pet chưa sẵn sàng cho round này
                }

                BookingServiceItem item = petItems.get(idx);
                int duration = item.getService().getDurationTime() != null
                        ? item.getService().getDurationTime()
                        : 30;
                int slots = Math.max(1, (int) Math.ceil(duration / 30.0));
                int totalMin = slots * 30;

                LocalTime start = roundStart;
                LocalTime end = roundStart.plusMinutes(totalMin);

                result.put(item.getBookingServiceId(), new LocalTime[] { start, end });
                petNextAvailable.put(petId, end);
                petIndex.put(petId, idx + 1);

                if (end.isAfter(roundEnd)) {
                    roundEnd = end;
                }
            }

            hasMore = petIndex.entrySet().stream()
                    .anyMatch(entry -> entry.getValue() < byPet.get(entry.getKey()).size());

        } while (hasMore);

        return result;
    }

    /**
     * Get scheduled start time for a service item from pre-computed schedule.
     */
    public static LocalTime getStartTime(Map<UUID, LocalTime[]> schedule, UUID bookingServiceId) {
        LocalTime[] range = schedule.get(bookingServiceId);
        return range != null ? range[0] : null;
    }

    /**
     * Get scheduled end time for a service item from pre-computed schedule.
     */
    public static LocalTime getEndTime(Map<UUID, LocalTime[]> schedule, UUID bookingServiceId) {
        LocalTime[] range = schedule.get(bookingServiceId);
        return range != null ? range[1] : null;
    }
}
