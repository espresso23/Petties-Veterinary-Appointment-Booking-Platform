package com.petties.petties.repository;

import com.petties.petties.model.Slot;
import com.petties.petties.model.enums.SlotStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Repository for Slot entity
 */
@Repository
public interface SlotRepository extends JpaRepository<Slot, UUID> {

        // Find all slots for a shift
        List<Slot> findByShift_ShiftIdOrderByStartTime(UUID shiftId);

        // Find available slots for a shift
        List<Slot> findByShift_ShiftIdAndStatusOrderByStartTime(UUID shiftId, SlotStatus status);

        // Find all available slots for a clinic on a specific date
        @Query("SELECT s FROM Slot s " +
                        "JOIN s.shift vs " +
                        "WHERE vs.clinic.clinicId = :clinicId " +
                        "AND vs.workDate = :workDate " +
                        "AND s.status = 'AVAILABLE' " +
                        "ORDER BY vs.staff.fullName, s.startTime")
        List<Slot> findAvailableSlotsByClinicAndDate(
                        @Param("clinicId") UUID clinicId,
                        @Param("workDate") LocalDate workDate);

        // Find all slots (any status) for a clinic on a date range
        @Query("SELECT s FROM Slot s " +
                        "JOIN FETCH s.shift vs " +
                        "JOIN FETCH vs.staff " +
                        "WHERE vs.clinic.clinicId = :clinicId " +
                        "AND vs.workDate BETWEEN :startDate AND :endDate " +
                        "ORDER BY vs.workDate, vs.staff.fullName, s.startTime")
        List<Slot> findAllSlotsByClinicAndDateRange(
                        @Param("clinicId") UUID clinicId,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        // Count available slots for a shift
        long countByShift_ShiftIdAndStatus(UUID shiftId, SlotStatus status);

        // Check if shift has any booked slots
        boolean existsByShift_ShiftIdAndStatus(UUID shiftId, SlotStatus status);

        // Check if staff is booked in time range
        @Query("SELECT COUNT(s) > 0 FROM Slot s " +
                        "JOIN s.shift vs " +
                        "WHERE vs.staff.userId = :staffId " +
                        "AND vs.workDate = :workDate " +
                        "AND s.status = 'BOOKED' " +
                        "AND s.startTime < :endTime " +
                        "AND s.endTime > :startTime")
        boolean isStaffBookedInTimeRange(
                        @Param("staffId") UUID staffId,
                        @Param("workDate") LocalDate workDate,
                        @Param("startTime") java.time.LocalTime startTime,
                        @Param("endTime") java.time.LocalTime endTime);
}
