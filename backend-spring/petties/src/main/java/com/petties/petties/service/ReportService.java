package com.petties.petties.service;

import com.petties.petties.dto.file.UploadResponse;
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
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReportService {

    private static final int MAX_ATTACHMENTS = 5;

    private final ReportRepository reportRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ReportMapper reportMapper;
    private final ClinicStrikeService strikeService;
    private final UserStrikeService userStrikeService;
    private final CloudinaryService cloudinaryService;

    /**
     * Tạo báo cáo: ảnh gửi kèm multipart, upload Cloudinary trên BE.
     */
    @Transactional
    public ReportResponse createReport(UUID bookingId, String reason, List<MultipartFile> imageFiles, UUID reporterId) {
        validateReason(reason);
        List<String> uploaded = uploadReportImages(imageFiles);
        ReportRequest request = new ReportRequest();
        request.setBookingId(bookingId);
        request.setReason(reason.trim());
        request.setAttachmentUrls(uploaded.isEmpty() ? null : uploaded);
        return createReportFromRequest(request, reporterId);
    }

    /**
     * Cập nhật báo cáo PENDING: file mới upload BE; ảnh giữ lại gửi JSON trong field {@code existingAttachmentUrlsJson}.
     * {@code existingKeptUrls == null}: chỉ thêm file mới vào danh sách hiện có trên DB (không đổi ảnh cũ nếu không gửi JSON).
     * {@code existingKeptUrls != null}: thay phần ảnh giữ lại bằng danh sách này + file mới.
     */
    @Transactional
    public ReportResponse updateMyReport(
            UUID reportId,
            String reason,
            List<MultipartFile> newFiles,
            List<String> existingKeptUrls,
            UUID reporterId) {
        validateReason(reason);
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy báo cáo"));
        if (!report.getReporter().getUserId().equals(reporterId)) {
            throw new ForbiddenException("Bạn không phải người gửi báo cáo này");
        }
        if (report.getStatus() != ReportStatus.PENDING) {
            throw new BadRequestException("Chỉ có thể sửa báo cáo đang chờ xử lý");
        }

        List<String> newUrls = uploadReportImages(newFiles);
        List<String> merged;
        if (existingKeptUrls == null) {
            merged = new ArrayList<>(report.getAttachmentUrls() != null ? report.getAttachmentUrls() : List.of());
            merged.addAll(newUrls);
        } else {
            merged = new ArrayList<>(existingKeptUrls);
            merged.addAll(newUrls);
        }

        report.setReason(reason.trim());
        report.setAttachmentUrls(normalizeAttachmentUrls(merged));
        report = reportRepository.save(report);
        return reportMapper.mapToResponse(report);
    }

    private void validateReason(String reason) {
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("Lý do báo cáo không được để trống");
        }
        String t = reason.trim();
        if (t.length() < 10 || t.length() > 2000) {
            throw new BadRequestException("Lý do báo cáo phải từ 10 đến 2000 ký tự");
        }
    }

    private List<String> uploadReportImages(List<MultipartFile> files) {
        if (files == null) {
            return new ArrayList<>();
        }
        List<String> urls = new ArrayList<>();
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            if (urls.size() >= MAX_ATTACHMENTS) {
                throw new BadRequestException("Tối đa 5 ảnh đính kèm");
            }
            UploadResponse response = cloudinaryService.uploadFile(file, "reports");
            urls.add(response.getUrl());
        }
        return urls;
    }

    private ReportResponse createReportFromRequest(ReportRequest request, UUID reporterId) {
        log.debug("createReport: bookingId={}, reporterId={}", request.getBookingId(), reporterId);

        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch hẹn"));

        User reporter = userRepository.findById(reporterId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

        boolean alreadyReported = reportRepository.existsByBookingBookingIdAndReporterUserId(booking.getBookingId(), reporterId);
        log.debug("createReport: alreadyReported={} for booking={}, reporter={}", alreadyReported, booking.getBookingId(), reporterId);

        if (alreadyReported) {
            throw new BadRequestException("Bạn đã gửi báo cáo cho lịch hẹn này rồi");
        }

        Report report = Report.builder()
                .booking(booking)
                .reporter(reporter)
                .reason(request.getReason())
                .status(ReportStatus.PENDING)
                .build();

        if (reporter.getRole() == Role.PET_OWNER) {
            if (!booking.getPetOwner().getUserId().equals(reporterId)) {
                throw new ForbiddenException("Bạn không phải người đặt lịch hẹn này");
            }
            report.setReportedClinic(booking.getClinic());
        } else if (reporter.getRole() == Role.CLINIC_OWNER || reporter.getRole() == Role.CLINIC_MANAGER || reporter.getRole() == Role.STAFF) {
            if (reporter.getWorkingClinic() == null || booking.getClinic() == null ||
                !reporter.getWorkingClinic().getClinicId().equals(booking.getClinic().getClinicId())) {
                throw new ForbiddenException("Bạn không có quyền báo cáo lịch hẹn của phòng khám khác");
            }
            report.setReportedUser(booking.getPetOwner());
        } else {
            throw new ForbiddenException("Vai trò của bạn không được phép tạo báo cáo");
        }

        if (request.getAttachmentUrls() != null) {
            report.setAttachmentUrls(normalizeAttachmentUrls(request.getAttachmentUrls()));
        }

        report = reportRepository.save(report);
        notificationService.sendReportCreatedNotificationToAdmin(report);
        return reportMapper.mapToResponse(report);
    }

    @Transactional
    public ReportResponse withdrawMyReport(UUID reportId, UUID reporterId) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy báo cáo"));
        if (!report.getReporter().getUserId().equals(reporterId)) {
            throw new ForbiddenException("Bạn không phải người gửi báo cáo này");
        }
        if (report.getStatus() != ReportStatus.PENDING) {
            throw new BadRequestException("Chỉ có thể rút báo cáo đang chờ xử lý");
        }
        report.setStatus(ReportStatus.WITHDRAWN);
        report = reportRepository.save(report);
        return reportMapper.mapToResponse(report);
    }

    private static List<String> normalizeAttachmentUrls(List<String> urls) {
        if (urls == null || urls.isEmpty()) {
            return new ArrayList<>();
        }
        validateAttachmentUrls(urls);
        return urls.stream().map(String::trim).collect(Collectors.toList());
    }

    private static void validateAttachmentUrls(List<String> urls) {
        if (urls.size() > MAX_ATTACHMENTS) {
            throw new BadRequestException("Tối đa 5 ảnh đính kèm");
        }
        for (String url : urls) {
            if (url == null || url.isBlank()) {
                throw new BadRequestException("URL ảnh không hợp lệ");
            }
            String t = url.trim();
            if (!t.startsWith("https://")) {
                throw new BadRequestException("Chỉ chấp nhận URL ảnh bắt đầu bằng https://");
            }
        }
    }

    @Transactional(readOnly = true)
    public Page<ReportResponse> getReports(ReportStatus status, Pageable pageable) {
        Page<Report> reports;
        if (status != null) {
            reports = reportRepository.findByStatus(status, pageable);
        } else {
            reports = reportRepository.findAllPaged(pageable);
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

        if (request.getStatus() == ReportStatus.PENDING || request.getStatus() == ReportStatus.WITHDRAWN) {
            throw new BadRequestException("Trạng thái giải quyết không hợp lệ");
        }

        report.setStatus(request.getStatus());
        report.setAdminNote(request.getAdminNote());

        report = reportRepository.save(report);

        if (request.getStatus() == ReportStatus.APPROVED && report.getReportedClinic() != null) {
            strikeService.checkAndApplyStrike(report);
        }
        if (request.getStatus() == ReportStatus.APPROVED && report.getReportedUser() != null) {
            userStrikeService.checkAndApplyStrike(report);
        }

        notificationService.sendReportResolvedNotification(report);

        return reportMapper.mapToResponse(report);
    }
}
