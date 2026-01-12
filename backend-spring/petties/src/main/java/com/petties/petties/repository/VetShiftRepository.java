package com.petties.petties.repository;

import com.petties.petties.model.VetShift;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for VetShift entity
 */
@Repository
public interface VetShiftRepository extends JpaRepository<VetShift, UUID> {

        // Find all shifts for a clinic on a specific date
        List<VetShift> findByClinic_ClinicIdAndWorkDate(UUID clinicId, LocalDate workDate);

        // Find all shifts for a clinic in a date range
        @Query("SELECT vs FROM VetShift vs WHERE vs.clinic.clinicId = :clinicId " +
                        "AND vs.workDate BETWEEN :startDate AND :endDate " +
                        "ORDER BY vs.workDate, vs.startTime")
        List<VetShift> findByClinicAndDateRange(
                        @Param("clinicId") UUID clinicId,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        // Find all shifts for a vet on a specific date (for overlap check)
        List<VetShift> findByVet_UserIdAndWorkDate(UUID vetId, LocalDate workDate);

        // Find all shifts for a vet in a date range
        @Query("SELECT vs FROM VetShift vs WHERE vs.vet.userId = :vetId " +
                        "AND vs.workDate BETWEEN :startDate AND :endDate " +
                        "ORDER BY vs.workDate, vs.startTime")
        List<VetShift> findByVetAndDateRange(
                        @Param("vetId") UUID vetId,
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        // Check if vet already has a shift on a specific date
        boolean existsByVet_UserIdAndWorkDate(UUID vetId, LocalDate workDate);

        // Find single shift by vet and date (for update/delete)
        @Query("SELECT vs FROM VetShift vs WHERE vs.vet.userId = :vetId AND vs.workDate = :workDate")
        Optional<VetShift> findOneByVet_UserIdAndWorkDate(
                        @Param("vetId") UUID vetId,
                        @Param("workDate") LocalDate workDate);

        // Find shift with slots eagerly loaded
        @Query("SELECT vs FROM VetShift vs LEFT JOIN FETCH vs.slots WHERE vs.shiftId = :shiftId")
        Optional<VetShift> findByIdWithSlots(@Param("shiftId") UUID shiftId);

        // Check if vet has a shift that overlaps with the given timeframe
        @Query("SELECT COUNT(vs) > 0 FROM VetShift vs " +
                        "WHERE vs.vet.userId = :vetId " +
                        "AND vs.workDate = :workDate " +
                        "AND ((vs.startTime < :endTime AND vs.endTime > :startTime))")
        boolean existsByVet_UserIdAndWorkDateAndTimeRange(
                        @Param("vetId") UUID vetId,
                        @Param("workDate") LocalDate workDate,
                        @Param("startTime") java.time.LocalTime startTime,
                        @Param("endTime") java.time.LocalTime endTime);

        // Find overnight shifts from the day BEFORE the start date that extend into the
        // range
        // These are shifts with isOvernight=true and workDate = startDate - 1 day
        @Query("SELECT vs FROM VetShift vs WHERE vs.clinic.clinicId = :clinicId " +
                        "AND vs.isOvernight = true " +
                        "AND vs.workDate = :dayBefore " +
                        "ORDER BY vs.startTime")
        List<VetShift> findOvernightShiftsFromPreviousDay(
                        @Param("clinicId") UUID clinicId,
                        @Param("dayBefore") LocalDate dayBefore);

        // Find overnight shifts for a SPECIFIC VET from the day BEFORE the start date
        @Query("SELECT vs FROM VetShift vs WHERE vs.vet.userId = :vetId " +
                        "AND vs.isOvernight = true " +
                        "AND vs.workDate = :dayBefore " +
                        "ORDER BY vs.startTime")
        List<VetShift> findOvernightShiftsByVetFromPreviousDay(
                        @Param("vetId") UUID vetId,
                        @Param("dayBefore") LocalDate dayBefore);
}
