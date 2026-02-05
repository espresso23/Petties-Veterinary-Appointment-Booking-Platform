package com.petties.petties.repository;

import com.petties.petties.model.Booking;
import com.petties.petties.model.enums.BookingStatus;
import com.petties.petties.model.enums.BookingType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
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
public interface BookingRepository extends JpaRepository<Booking, UUID>, JpaSpecificationExecutor<Booking> {

        @Query("SELECT DISTINCT b.pet.id FROM Booking b WHERE b.clinic.clinicId = :clinicId")
        List<UUID> findPetIdsByClinicId(@Param("clinicId") UUID clinicId);

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
                        @Param("type") BookingType type,
                        Pageable pageable);

        /**
         * Find all bookings for a clinic on a specific date
         */
        @Query("SELECT b FROM Booking b WHERE b.clinic.clinicId = :clinicId " +
                        "AND b.bookingDate = :date ORDER BY b.bookingTime ASC")
        List<Booking> findByClinicIdAndDate(
                        @Param("clinicId") UUID clinicId,
                        @Param("date") LocalDate date);

        // ========== FIND BY STAFF ==========

        /**
         * Find all bookings assigned to a staff member with pagination
         */
        @Query("SELECT DISTINCT b FROM Booking b " +
                        "JOIN b.bookingServices bs " +
                        "WHERE bs.assignedStaff.userId = :staffId " +
                        "AND (:status IS NULL OR b.status = :status) " +
                        "ORDER BY b.bookingDate ASC, b.bookingTime ASC")
        Page<Booking> findByAssignedStaffIdAndStatus(
                        @Param("staffId") UUID staffId,
                        @Param("status") BookingStatus status,
                        Pageable pageable);

        /**
         * Find all bookings assigned to a staff for a specific period with specific
         * statuses
         * JOIN FETCH pet, petOwner to avoid LazyInitializationException
         */
        @Query("SELECT DISTINCT b FROM Booking b " +
                        "LEFT JOIN FETCH b.pet " +
                        "LEFT JOIN FETCH b.petOwner " +
                        "JOIN b.bookingServices bs " +
                        "WHERE bs.assignedStaff.userId = :staffId " +
                        "AND b.bookingDate BETWEEN :startDate AND :endDate " +
                        "AND b.status IN :statuses")
        List<Booking> findByAssignedStaffIdAndBookingDateBetweenAndStatusIn(
                        @Param("staffId") UUID staffId,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate,
                        @Param("statuses") List<BookingStatus> statuses);

        // ========== DATA CONSISTENCY ==========

        /**
         * Find all bookings with all to-one relations loaded eagerly
         * Used by TransactionService for payment reconciliation
         */
        @Query("SELECT DISTINCT b FROM Booking b " +
                        "LEFT JOIN FETCH b.pet " +
                        "LEFT JOIN FETCH b.petOwner " +
                        "LEFT JOIN FETCH b.clinic " +
                        "LEFT JOIN FETCH b.assignedStaff " +
                        "LEFT JOIN FETCH b.payment")
        List<Booking> findAllWithToOneRelations();

        // ========== SHARED VISIBILITY QUERIES ==========

        /**
         * Find all bookings for a clinic on today with eager loading
         * Used for Staff Shared Visibility - all staff can see clinic's daily bookings
         * JOIN FETCH pet, petOwner, clinic, bookingServices to avoid N+1 queries
         */
        @Query("SELECT DISTINCT b FROM Booking b " +
                        "LEFT JOIN FETCH b.pet " +
                        "LEFT JOIN FETCH b.petOwner " +
                        "LEFT JOIN FETCH b.clinic " +
                        "LEFT JOIN FETCH b.assignedStaff " +
                        "LEFT JOIN FETCH b.bookingServices bs " +
                        "LEFT JOIN FETCH bs.assignedStaff " +
                        "WHERE b.clinic.clinicId = :clinicId " +
                        "AND b.bookingDate = :date " +
                        "AND b.status NOT IN (com.petties.petties.model.enums.BookingStatus.CANCELLED, " +
                        "com.petties.petties.model.enums.BookingStatus.NO_SHOW) " +
                        "ORDER BY b.bookingTime ASC")
        List<Booking> findByClinicIdAndDateWithDetails(
                        @Param("clinicId") UUID clinicId,
                        @Param("date") LocalDate date);

        // ========== FIND BY CODE ==========

        /**
         * Find booking by code
         */
        Optional<Booking> findByBookingCode(String bookingCode);

        // ========== FIND BY OWNER ==========

        /**
         * Find all bookings for a pet owner with pagination
         */
        @Query("SELECT b FROM Booking b WHERE b.petOwner.userId = :petOwnerId ORDER BY b.createdAt DESC")
        Page<Booking> findByPetOwnerId(@Param("petOwnerId") UUID petOwnerId, Pageable pageable);

        @Query("SELECT COUNT(b) FROM Booking b WHERE b.clinic.clinicId = :clinicId AND b.bookingDate = :date")
        long countByClinicAndDate(@Param("clinicId") UUID clinicId, @Param("date") LocalDate date);

        @Query("SELECT COUNT(DISTINCT b) FROM Booking b JOIN b.bookingServices bs " +
                        "WHERE bs.assignedStaff.userId = :staffId AND b.bookingDate = :date " +
                        "AND b.status IN (com.petties.petties.model.enums.BookingStatus.CONFIRMED, " +
                        "com.petties.petties.model.enums.BookingStatus.IN_PROGRESS, " +
                        "com.petties.petties.model.enums.BookingStatus.ARRIVED, " +
                        "com.petties.petties.model.enums.BookingStatus.ON_THE_WAY)")
        long countActiveBookingsByStaffAndDate(@Param("staffId") UUID staffId, @Param("date") LocalDate date);

        @Query("SELECT DISTINCT b FROM Booking b JOIN b.bookingServices bs " +
                        "WHERE bs.assignedStaff.userId = :staffId AND b.bookingDate = :date")
        List<Booking> findByStaffIdAndDate(@Param("staffId") UUID staffId, @Param("date") LocalDate date);

        /**
         * Find all bookings assigned to a staff for a specific date
         * Using join with booking services
         */
        @Query("SELECT DISTINCT b FROM Booking b JOIN b.bookingServices bs " +
                        "WHERE bs.assignedStaff.userId = :staffId AND b.bookingDate = :date")
        List<Booking> findByAssignedStaffIdAndBookingDate(@Param("staffId") UUID staffId,
                        @Param("date") LocalDate date);
}
