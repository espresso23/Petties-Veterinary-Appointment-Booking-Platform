package com.petties.petties.repository;

import com.petties.petties.model.Report;
import com.petties.petties.model.enums.ReportStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
public interface ReportRepository extends JpaRepository<Report, UUID> {
    
    // Admin list: load associations for mapper (reporter, reported, booking)
    @EntityGraph(attributePaths = {"booking", "reporter", "reportedClinic", "reportedUser"})
    @Query("SELECT r FROM Report r")
    Page<Report> findAllPaged(Pageable pageable);

    @EntityGraph(attributePaths = {"booking", "reporter", "reportedClinic", "reportedUser"})
    Page<Report> findByStatus(ReportStatus status, Pageable pageable);

    // Get reports created by a specific user
    Page<Report> findByReporterUserId(UUID reporterId, Pageable pageable);
    
    // Get reports against a specific clinic
    Page<Report> findByReportedClinicClinicId(UUID clinicId, Pageable pageable);

    // Prevents duplicate reports from the same user for the same booking
    boolean existsByBookingBookingIdAndReporterUserId(UUID bookingId, UUID reporterId);
    
    // Count reports by status for dashboard
    long countByStatus(ReportStatus status);

    /**
     * Đếm số report APPROVED của clinic trong cửa sổ thời gian (từ fromDate đến now).
     * Dùng cho logic strike khi Admin approve report.
     */
    @Query("SELECT COUNT(r) FROM Report r WHERE r.reportedClinic.clinicId = :clinicId " +
            "AND r.status = :status AND r.updatedAt >= :fromDate")
    long countApprovedReportsByClinicInWindow(
            @Param("clinicId") UUID clinicId,
            @Param("fromDate") LocalDateTime fromDate,
            @Param("status") ReportStatus status);

    /**
     * Đếm số report APPROVED của pet owner (reportedUser) trong cửa sổ thời gian.
     * Dùng cho logic strike khi Admin approve report từ clinic.
     */
    @Query("SELECT COUNT(r) FROM Report r WHERE r.reportedUser.userId = :userId " +
            "AND r.status = :status AND r.updatedAt >= :fromDate")
    long countApprovedReportsByUserInWindow(
            @Param("userId") UUID userId,
            @Param("fromDate") LocalDateTime fromDate,
            @Param("status") ReportStatus status);
}
