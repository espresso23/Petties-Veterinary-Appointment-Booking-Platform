package com.petties.petties.service;

import com.petties.petties.dto.report.ReportRequest;
import com.petties.petties.dto.report.ReportResponse;
import com.petties.petties.dto.report.ResolveReportRequest;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.mapper.ReportMapper;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Report;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ReportStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.ReportRepository;
import com.petties.petties.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReportService {

    private final ReportRepository reportRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ReportMapper reportMapper;
    private final ClinicStrikeService strikeService;
    private final UserStrikeService userStrikeService;

    @Transactional
    public ReportResponse createReport(ReportRequest request, UUID reporterId) {
        log.debug("createReport: bookingId={}, reporterId={}", request.getBookingId(), reporterId);

        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch hẹn"));

        User reporter = userRepository.findById(reporterId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

        boolean alreadyReported = reportRepository.existsByBookingBookingIdAndReporterUserId(booking.getBookingId(), reporterId);
        log.debug("createReport: alreadyReported={} for booking={}, reporter={}", alreadyReported, booking.getBookingId(), reporterId);

        // Check if user has already reported this booking
        if (alreadyReported) {
            throw new BadRequestException("Bạn đã gửi báo cáo cho lịch hẹn này rồi");
        }

        Report report = Report.builder()
                .booking(booking)
                .reporter(reporter)
                .reason(request.getReason())
                .status(ReportStatus.PENDING)
                .build();

        // Polymorphic reporting logic
        // If reporter is PET_OWNER -> They are reporting the Clinic
        // If reporter is CLINIC_MANAGER, CLINIC_OWNER, VET -> They are reporting the Pet Owner
        if (reporter.getRole() == Role.PET_OWNER) {
            // Only allow pet owner of this booking to report
            if (!booking.getPetOwner().getUserId().equals(reporterId)) {
                throw new ForbiddenException("Bạn không phải người đặt lịch hẹn này");
            }
            report.setReportedClinic(booking.getClinic());
        } else if (reporter.getRole() == Role.CLINIC_OWNER || reporter.getRole() == Role.CLINIC_MANAGER || reporter.getRole() == Role.STAFF) {
            // Verify staff belongs to this clinic
            if (reporter.getWorkingClinic() == null || booking.getClinic() == null ||
                !reporter.getWorkingClinic().getClinicId().equals(booking.getClinic().getClinicId())) {
                throw new ForbiddenException("Bạn không có quyền báo cáo lịch hẹn của phòng khám khác");
            }
            report.setReportedUser(booking.getPetOwner());
        } else {
            throw new ForbiddenException("Vai trò của bạn không được phép tạo báo cáo");
        }

        report = reportRepository.save(report);

        // Notify Admin
        notificationService.sendReportCreatedNotificationToAdmin(report);

        return reportMapper.mapToResponse(report);
    }

    @Transactional(readOnly = true)
    public Page<ReportResponse> getReports(ReportStatus status, Pageable pageable) {
        Page<Report> reports;
        if (status != null) {
            reports = reportRepository.findByStatus(status, pageable);
        } else {
            reports = reportRepository.findAll(pageable);
        }
        return reports.map(reportMapper::mapToResponse);
    }

    @Transactional(readOnly = true)
    public Page<ReportResponse> getMyReports(UUID reporterId, Pageable pageable) {
        return reportRepository.findByReporterUserId(reporterId, pageable)
                .map(reportMapper::mapToResponse);
    }

    @Transactional(readOnly = true)
    public Page<ReportResponse> getClinicReports(UUID clinicId, Pageable pageable) {
        return reportRepository.findByReportedClinicClinicId(clinicId, pageable)
                .map(reportMapper::mapToResponse);
    }

    @Transactional
    public ReportResponse resolveReport(UUID reportId, ResolveReportRequest request, UUID adminId) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy báo cáo"));

        if (report.getStatus() != ReportStatus.PENDING) {
            throw new BadRequestException("Báo cáo này đã được xử lý trước đó rồi");
        }

        if (request.getStatus() == ReportStatus.PENDING) {
            throw new BadRequestException("Trạng thái giải quyết không hợp lệ");
        }

        report.setStatus(request.getStatus());
        report.setAdminNote(request.getAdminNote());

        report = reportRepository.save(report);

        // Khi approve report về clinic → kiểm tra clinic strike
        if (request.getStatus() == ReportStatus.APPROVED && report.getReportedClinic() != null) {
            strikeService.checkAndApplyStrike(report);
        }
        // Khi approve report về pet owner → kiểm tra user strike
        if (request.getStatus() == ReportStatus.APPROVED && report.getReportedUser() != null) {
            userStrikeService.checkAndApplyStrike(report);
        }

        // Send notifications to Reporter and Reported
        notificationService.sendReportResolvedNotification(report);

        return reportMapper.mapToResponse(report);
    }
}
