package com.petties.petties.repository;

import com.petties.petties.model.StaffShift;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for StaffShift entity
 */
@Repository
public interface StaffShiftRepository extends JpaRepository<StaffShift, UUID> {

        // Find all shifts for a clinic on a specific date
        List<StaffShift> findByClinic_ClinicIdAndWorkDate(UUID clinicId, LocalDate workDate);

        // Find all shifts for a clinic in a date range
        @Query("SELECT ss FROM StaffShift ss WHERE ss.clinic.clinicId = :clinicId " +
                        "AND ss.workDate BETWEEN :startDate AND :endDate " +
                        "ORDER BY ss.workDate, ss.startTime")
        List<StaffShift> findByClinicAndDateRange(
                        @Param("clinicId") UUID clinicId,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        // Find all shifts for a staff on a specific date (for overlap check)
        List<StaffShift> findByStaff_UserIdAndWorkDate(UUID staffId, LocalDate workDate);

        // Find all shifts for a staff in a date range
        @Query("SELECT ss FROM StaffShift ss WHERE ss.staff.userId = :staffId " +
                        "AND ss.workDate BETWEEN :startDate AND :endDate " +
                        "ORDER BY ss.workDate, ss.startTime")
        List<StaffShift> findByStaffAndDateRange(
                        @Param("staffId") UUID staffId,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        // Check if staff already has a shift on a specific date
        boolean existsByStaff_UserIdAndWorkDate(UUID staffId, LocalDate workDate);

        // Find single shift by staff and date (for update/delete)
        @Query("SELECT ss FROM StaffShift ss WHERE ss.staff.userId = :staffId AND ss.workDate = :workDate")
        Optional<StaffShift> findOneByStaff_UserIdAndWorkDate(
                        @Param("staffId") UUID staffId,
                        @Param("workDate") LocalDate workDate);

        // Find shift with slots eagerly loaded
        @Query("SELECT ss FROM StaffShift ss LEFT JOIN FETCH ss.slots WHERE ss.shiftId = :shiftId")
        Optional<StaffShift> findByIdWithSlots(@Param("shiftId") UUID shiftId);

        // Check if staff has a shift that overlaps with the given timeframe
        @Query("SELECT COUNT(ss) > 0 FROM StaffShift ss " +
                        "WHERE ss.staff.userId = :staffId " +
                        "AND ss.workDate = :workDate " +
                        "AND ((ss.startTime < :endTime AND ss.endTime > :startTime))")
        boolean existsByStaff_UserIdAndWorkDateAndTimeRange(
                        @Param("staffId") UUID staffId,
                        @Param("workDate") LocalDate workDate,
                        @Param("startTime") java.time.LocalTime startTime,
                        @Param("endTime") java.time.LocalTime endTime);

        // Find overnight shifts from the day BEFORE the start date that extend into the
        // range
        // These are shifts with isOvernight=true and workDate = startDate - 1 day
        @Query("SELECT ss FROM StaffShift ss WHERE ss.clinic.clinicId = :clinicId " +
                        "AND ss.isOvernight = true " +
                        "AND ss.workDate = :dayBefore " +
                        "ORDER BY ss.startTime")
        List<StaffShift> findOvernightShiftsFromPreviousDay(
                        @Param("clinicId") UUID clinicId,
                        @Param("dayBefore") LocalDate dayBefore);

        // Find overnight shifts for a SPECIFIC STAFF from the day BEFORE the start date
        @Query("SELECT ss FROM StaffShift ss WHERE ss.staff.userId = :staffId " +
                        "AND ss.isOvernight = true " +
                        "AND ss.workDate = :dayBefore " +
                        "ORDER BY ss.startTime")
        List<StaffShift> findOvernightShiftsByStaffFromPreviousDay(
                        @Param("staffId") UUID staffId,
                        @Param("dayBefore") LocalDate dayBefore);
}
