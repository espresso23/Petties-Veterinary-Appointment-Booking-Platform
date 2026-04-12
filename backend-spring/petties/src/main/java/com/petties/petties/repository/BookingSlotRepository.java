package com.petties.petties.repository;

import com.petties.petties.model.BookingSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for BookingSlot entity - Junction table Booking ↔ Slot
 */
@Repository
public interface BookingSlotRepository extends JpaRepository<BookingSlot, UUID> {

    /**
     * Find all booking slots for a booking
     */
    List<BookingSlot> findByBooking_BookingId(UUID bookingId);

    /**
     * Find booking slot by slot ID (to get booking info for a slot)
     */
    Optional<BookingSlot> findBySlot_SlotId(UUID slotId);

    /**
     * Check if a slot is already booked
     */
    boolean existsBySlot_SlotId(UUID slotId);

    /**
     * Find all booking slots for a specific BookingServiceItem
     * Used when reassigning staff to release old slots
     */
    List<BookingSlot> findByBookingServiceItem_BookingServiceId(UUID bookingServiceId);

    /**
     * Find booking info for multiple slots at once (batch query for performance)
     */
    @Query("SELECT bs FROM BookingSlot bs " +
            "JOIN FETCH bs.booking b " +
            "JOIN FETCH b.pet " +
            "JOIN FETCH b.petOwner " +
            "WHERE bs.slot.slotId IN :slotIds")
    List<BookingSlot> findBySlotIdsWithBookingDetails(@Param("slotIds") List<UUID> slotIds);
}
