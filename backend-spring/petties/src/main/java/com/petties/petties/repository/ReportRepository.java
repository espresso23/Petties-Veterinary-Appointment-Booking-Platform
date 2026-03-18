package com.petties.petties.repository;

import com.petties.petties.model.Report;
import com.petties.petties.model.enums.ReportStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ReportRepository extends JpaRepository<Report, UUID> {
    
    // Find reports, optionally filter by status
    Page<Report> findByStatus(ReportStatus status, Pageable pageable);

    // Get reports created by a specific user
    Page<Report> findByReporterUserId(UUID reporterId, Pageable pageable);
    
    // Get reports against a specific clinic
    Page<Report> findByReportedClinicClinicId(UUID clinicId, Pageable pageable);

    // Prevents duplicate reports from the same user for the same booking
    boolean existsByBookingBookingIdAndReporterUserId(UUID bookingId, UUID reporterId);
    
    // Count reports by status for dashboard
    long countByStatus(ReportStatus status);
}
