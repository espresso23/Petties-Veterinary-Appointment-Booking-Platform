package com.petties.petties.repository;

import com.petties.petties.model.Booking;
import com.petties.petties.model.enums.BookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * BookingRepository - Data access layer for Booking entity
 */
@Repository
public interface BookingRepository extends JpaRepository<Booking, UUID> {

        // ========== FIND BY CLINIC ==========

        /**
         * Find all bookings for a clinic with optional status and type filter
         */
        @Query("SELECT b FROM Booking b WHERE b.clinic.clinicId = :clinicId " +
                        "AND (:status IS NULL OR b.status = :status) " +
                        "AND (:type IS NULL OR b.type = :type) " +
                        "ORDER BY b.createdAt DESC")
        Page<Booking> findByClinicIdAndStatusAndType(
                        @Param("clinicId") UUID clinicId,
                        @Param("status") BookingStatus status,
                        @Param("type") com.petties.petties.model.enums.BookingType type,
                        Pageable pageable);

        /**
         * Find all bookings for a clinic on a specific date
         */
        @Query("SELECT b FROM Booking b WHERE b.clinic.clinicId = :clinicId " +
                        "AND b.bookingDate = :date ORDER BY b.bookingTime ASC")
        List<Booking> findByClinicIdAndDate(
                        @Param("clinicId") UUID clinicId,
                        @Param("date") LocalDate date);

        // ========== FIND BY VET ==========

        /**
         * Find all bookings where vet is assigned to at least one service
         * This is more accurate than checking only booking.assignedVet because
         * a vet can be assigned to specific services within a booking
         */
        @Query("SELECT DISTINCT b FROM Booking b " +
                        "JOIN b.bookingServices bs " +
                        "WHERE bs.assignedVet.userId = :vetId " +
                        "AND (:status IS NULL OR b.status = :status) " +
                        "ORDER BY b.bookingDate ASC, b.bookingTime ASC")
        Page<Booking> findByAssignedVetIdAndStatus(
                        @Param("vetId") UUID vetId,
                        @Param("status") BookingStatus status,
                        Pageable pageable);

        /**
         * Find bookings for a vet on a specific date
         * Checks if vet is assigned to any service in the booking
         */
        @Query("SELECT DISTINCT b FROM Booking b " +
                        "JOIN b.bookingServices bs " +
                        "WHERE bs.assignedVet.userId = :vetId " +
                        "AND b.bookingDate = :date " +
                        "AND b.status NOT IN (com.petties.petties.model.enums.BookingStatus.CANCELLED, " +
                        "com.petties.petties.model.enums.BookingStatus.NO_SHOW) " +
                        "ORDER BY b.bookingTime ASC")
        List<Booking> findByVetIdAndDate(
                        @Param("vetId") UUID vetId,
                        @Param("date") LocalDate date);

        /**
         * Count active bookings for a vet on a specific date (for load balancing)
         * Checks if vet is assigned to any service in the booking
         */
        @Query("SELECT COUNT(DISTINCT b) FROM Booking b " +
                        "JOIN b.bookingServices bs " +
                        "WHERE bs.assignedVet.userId = :vetId " +
                        "AND b.bookingDate = :date " +
                        "AND b.status NOT IN (com.petties.petties.model.enums.BookingStatus.CANCELLED, " +
                        "com.petties.petties.model.enums.BookingStatus.NO_SHOW)")
        long countActiveBookingsByVetAndDate(
                        @Param("vetId") UUID vetId,
                        @Param("date") LocalDate date);

        // ========== FIND BY PET OWNER ==========

        /**
         * Find all bookings for a pet owner
         */
        @Query("SELECT b FROM Booking b WHERE b.petOwner.userId = :ownerId " +
                        "ORDER BY b.createdAt DESC")
        Page<Booking> findByPetOwnerId(
                        @Param("ownerId") UUID ownerId,
                        Pageable pageable);

        // ========== UTILITY QUERIES ==========

        /**
         * Find booking by booking code
         */
        Optional<Booking> findByBookingCode(String bookingCode);

        /**
         * Count bookings for a clinic on a date (for generating booking code)
         */
        @Query("SELECT COUNT(b) FROM Booking b WHERE b.clinic.clinicId = :clinicId " +
                        "AND b.bookingDate = :date")
        long countByClinicAndDate(
                        @Param("clinicId") UUID clinicId,
                        @Param("date") LocalDate date);

        /**
         * Find pending bookings for a clinic (for notifications)
         */
        @Query("SELECT b FROM Booking b WHERE b.clinic.clinicId = :clinicId " +
                        "AND b.status = com.petties.petties.model.enums.BookingStatus.PENDING " +
                        "ORDER BY b.createdAt DESC")
        List<Booking> findPendingByClinicId(@Param("clinicId") UUID clinicId);

        // ========== VET HOME SUMMARY QUERIES ==========

        /**
         * Find all bookings assigned to a vet on a specific date
         * Uses booking-service-level assignedVet to ensure all vets assigned to the
         * booking can see it
         * JOIN FETCH pet, petOwner to avoid LazyInitializationException
         */
        @Query("SELECT DISTINCT b FROM Booking b " +
                        "LEFT JOIN FETCH b.pet " +
                        "LEFT JOIN FETCH b.petOwner " +
                        "JOIN b.bookingServices bs " +
                        "WHERE bs.assignedVet.userId = :vetId " +
                        "AND b.bookingDate = :date " +
                        "AND b.status NOT IN (com.petties.petties.model.enums.BookingStatus.CANCELLED, " +
                        "com.petties.petties.model.enums.BookingStatus.NO_SHOW)")
        List<Booking> findByAssignedVetIdAndBookingDate(
                        @Param("vetId") UUID vetId,
                        @Param("date") LocalDate date);

        /**
         * Find upcoming bookings for a vet within a date range and with specific
         * statuses
         * JOIN FETCH pet, petOwner to avoid LazyInitializationException
         */
        @Query("SELECT DISTINCT b FROM Booking b " +
                        "LEFT JOIN FETCH b.pet " +
                        "LEFT JOIN FETCH b.petOwner " +
                        "JOIN b.bookingServices bs " +
                        "WHERE bs.assignedVet.userId = :vetId " +
                        "AND b.bookingDate BETWEEN :startDate AND :endDate " +
                        "AND b.status IN :statuses")
        List<Booking> findByAssignedVetIdAndBookingDateBetweenAndStatusIn(
                        @Param("vetId") UUID vetId,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate,
                        @Param("statuses") List<BookingStatus> statuses);
}
