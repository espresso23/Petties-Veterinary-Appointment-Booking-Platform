package com.petties.petties.service;

import com.petties.petties.dto.file.UploadResponse;
import com.petties.petties.dto.report.ReportResponse;
import com.petties.petties.dto.report.ResolveReportRequest;
import com.petties.petties.exception.BadRequestException;
import com.petties.petties.exception.ForbiddenException;
import com.petties.petties.mapper.ReportMapper;
import com.petties.petties.model.Booking;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Report;
import com.petties.petties.model.User;
import com.petties.petties.model.enums.ReportStatus;
import com.petties.petties.model.enums.Role;
import com.petties.petties.repository.BookingRepository;
import com.petties.petties.repository.ReportRepository;
import com.petties.petties.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock
    private ReportRepository reportRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private ReportMapper reportMapper;

    @Mock
    private ClinicStrikeService strikeService;

    @Mock
    private UserStrikeService userStrikeService;

    @Mock
    private CloudinaryService cloudinaryService;

    @InjectMocks
    private ReportService reportService;

    private User petOwner;
    private User clinicOwner;
    private Clinic clinic;
    private Booking booking;
    private Report report;

    private UUID petOwnerId;
    private UUID clinicOwnerId;
    private UUID clinicId;
    private UUID bookingId;
    private UUID reportId;

    @BeforeEach
    void setUp() {
        petOwnerId = UUID.randomUUID();
        clinicOwnerId = UUID.randomUUID();
        clinicId = UUID.randomUUID();
        bookingId = UUID.randomUUID();
        reportId = UUID.randomUUID();

        petOwner = User.builder()
                .userId(petOwnerId)
                .role(Role.PET_OWNER)
                .build();

        clinicOwner = User.builder()
                .userId(clinicOwnerId)
                .role(Role.CLINIC_OWNER)
                .build();

        clinic = Clinic.builder()
                .clinicId(clinicId)
                .owner(clinicOwner)
                .build();
        
        clinicOwner.setWorkingClinic(clinic);

        booking = Booking.builder()
                .bookingId(bookingId)
                .petOwner(petOwner)
                .clinic(clinic)
                .build();

        report = Report.builder()
                .id(reportId)
                .booking(booking)
                .reporter(petOwner)
                .reportedClinic(clinic)
                .reason("Test Reason")
                .attachmentUrls(new java.util.ArrayList<>())
                .status(ReportStatus.PENDING)
                .build();
    }

    @Test
    void createReport_Success_ByPetOwner() {
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(userRepository.findById(petOwnerId)).thenReturn(Optional.of(petOwner));
        when(reportRepository.existsByBookingBookingIdAndReporterUserId(bookingId, petOwnerId)).thenReturn(false);
        when(reportRepository.save(any(Report.class))).thenReturn(report);

        ReportResponse mockResponse = ReportResponse.builder().id(reportId).build();
        when(reportMapper.mapToResponse(any(Report.class))).thenReturn(mockResponse);

        ReportResponse response = reportService.createReport(bookingId, "Service was bad", List.of(), petOwnerId);

        assertNotNull(response);
        assertEquals(reportId, response.getId());
        verify(reportRepository, times(1)).save(any(Report.class));
        verify(notificationService, times(1)).sendReportCreatedNotificationToAdmin(any(Report.class));
        verify(cloudinaryService, never()).uploadFile(any(), any());
    }

    @Test
    void createReport_PersistsAttachmentUrls_AfterCloudinaryUpload() {
        MockMultipartFile img = new MockMultipartFile("files", "a.jpg", "image/jpeg", "data".getBytes());
        when(cloudinaryService.uploadFile(any(MultipartFile.class), eq("reports")))
                .thenReturn(UploadResponse.builder().url("https://res.cloudinary.com/demo/image1.jpg").build());

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(userRepository.findById(petOwnerId)).thenReturn(Optional.of(petOwner));
        when(reportRepository.existsByBookingBookingIdAndReporterUserId(bookingId, petOwnerId)).thenReturn(false);
        when(reportRepository.save(any(Report.class))).thenAnswer(inv -> inv.getArgument(0));

        ReportResponse mockResponse = ReportResponse.builder().id(reportId).build();
        when(reportMapper.mapToResponse(any(Report.class))).thenReturn(mockResponse);

        reportService.createReport(bookingId, "Service was bad with proof", List.of(img), petOwnerId);

        ArgumentCaptor<Report> captor = ArgumentCaptor.forClass(Report.class);
        verify(reportRepository).save(captor.capture());
        assertEquals(List.of("https://res.cloudinary.com/demo/image1.jpg"), captor.getValue().getAttachmentUrls());
        verify(cloudinaryService, times(1)).uploadFile(any(MultipartFile.class), eq("reports"));
    }

    @Test
    void createReport_Fail_NotOwnerOfBooking() {
        User otherOwner = User.builder().userId(UUID.randomUUID()).role(Role.PET_OWNER).build();

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(userRepository.findById(otherOwner.getUserId())).thenReturn(Optional.of(otherOwner));

        assertThrows(ForbiddenException.class, () -> reportService.createReport(bookingId, "Service was bad", List.of(), otherOwner.getUserId()));
    }

    @Test
    void createReport_Success_ByClinicOwner() {
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(userRepository.findById(clinicOwnerId)).thenReturn(Optional.of(clinicOwner));
        when(reportRepository.existsByBookingBookingIdAndReporterUserId(bookingId, clinicOwnerId)).thenReturn(false);

        Report mockSavedReport = Report.builder().id(reportId).reporter(clinicOwner).reportedUser(petOwner).booking(booking).build();
        when(reportRepository.save(any(Report.class))).thenReturn(mockSavedReport);

        ReportResponse mockResponse = ReportResponse.builder().id(reportId).build();
        when(reportMapper.mapToResponse(any(Report.class))).thenReturn(mockResponse);

        ReportResponse response = reportService.createReport(bookingId, "Customer didn't show up", List.of(), clinicOwnerId);

        assertNotNull(response);
        verify(reportRepository, times(1)).save(any(Report.class));
    }
    
    @Test
    void createReport_Fail_AlreadyReported() {
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(userRepository.findById(petOwnerId)).thenReturn(Optional.of(petOwner));
        when(reportRepository.existsByBookingBookingIdAndReporterUserId(bookingId, petOwnerId)).thenReturn(true);

        assertThrows(BadRequestException.class, () -> reportService.createReport(bookingId, "Test Reason", List.of(), petOwnerId));
    }

    @Test
    void resolveReport_Success() {
        ResolveReportRequest request = new ResolveReportRequest();
        request.setStatus(ReportStatus.APPROVED);
        request.setAdminNote("Ok, approved");

        UUID adminId = UUID.randomUUID();

        when(reportRepository.findById(reportId)).thenReturn(Optional.of(report));
        when(reportRepository.save(any(Report.class))).thenReturn(report);

        ReportResponse mockResponse = ReportResponse.builder().id(reportId).status(ReportStatus.APPROVED).build();
        when(reportMapper.mapToResponse(any(Report.class))).thenReturn(mockResponse);

        ReportResponse response = reportService.resolveReport(reportId, request, adminId);

        assertNotNull(response);
        assertEquals(ReportStatus.APPROVED, response.getStatus());
        verify(notificationService, times(1)).sendReportResolvedNotification(any(Report.class));
        verify(reportRepository, times(1)).save(any(Report.class));
    }

    @Test
    void resolveReport_Fail_AlreadyResolved() {
        report.setStatus(ReportStatus.APPROVED);

        ResolveReportRequest request = new ResolveReportRequest();
        request.setStatus(ReportStatus.REJECTED);
        request.setAdminNote("Try again");

        UUID adminId = UUID.randomUUID();

        when(reportRepository.findById(reportId)).thenReturn(Optional.of(report));

        assertThrows(BadRequestException.class, () -> reportService.resolveReport(reportId, request, adminId));
    }

    @Test
    void getReports_NoStatusFilter() {
        Page<Report> page = new PageImpl<>(List.of(report));
        when(reportRepository.findAllPaged(any(Pageable.class))).thenReturn(page);
        
        Page<ReportResponse> result = reportService.getReports(null, Pageable.unpaged());
        
        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        verify(reportRepository, times(1)).findAllPaged(any(Pageable.class));
    }

    @Test
    void updateMyReport_Success() {
        report.setAttachmentUrls(new java.util.ArrayList<>());
        when(cloudinaryService.uploadFile(any(MultipartFile.class), eq("reports")))
                .thenReturn(UploadResponse.builder().url("https://res.cloudinary.com/test/new.jpg").build());
        MockMultipartFile img = new MockMultipartFile("files", "b.jpg", "image/jpeg", "x".getBytes());

        when(reportRepository.findById(reportId)).thenReturn(Optional.of(report));
        when(reportRepository.save(any(Report.class))).thenAnswer(inv -> inv.getArgument(0));
        when(reportMapper.mapToResponse(any(Report.class))).thenReturn(ReportResponse.builder().id(reportId).build());

        ReportResponse out = reportService.updateMyReport(
                reportId,
                "Updated reason text here ok",
                List.of(img),
                List.of("https://res.cloudinary.com/test/image.jpg"),
                petOwnerId);

        assertNotNull(out);
        verify(reportRepository, times(1)).save(any(Report.class));
        ArgumentCaptor<Report> captor = ArgumentCaptor.forClass(Report.class);
        verify(reportRepository).save(captor.capture());
        assertEquals(
                List.of("https://res.cloudinary.com/test/image.jpg", "https://res.cloudinary.com/test/new.jpg"),
                captor.getValue().getAttachmentUrls());
    }

    @Test
    void withdrawMyReport_Success() {
        when(reportRepository.findById(reportId)).thenReturn(Optional.of(report));
        when(reportRepository.save(any(Report.class))).thenAnswer(inv -> inv.getArgument(0));
        when(reportMapper.mapToResponse(any(Report.class))).thenReturn(
                ReportResponse.builder().id(reportId).status(ReportStatus.WITHDRAWN).build());

        ReportResponse out = reportService.withdrawMyReport(reportId, petOwnerId);

        assertNotNull(out);
        assertEquals(ReportStatus.WITHDRAWN, out.getStatus());
        verify(reportRepository, times(1)).save(any(Report.class));
    }

    @Test
    void resolveReport_Fail_WhenWithdrawnStatusInRequest() {
        ResolveReportRequest request = new ResolveReportRequest();
        request.setStatus(ReportStatus.WITHDRAWN);
        request.setAdminNote("n/a");

        when(reportRepository.findById(reportId)).thenReturn(Optional.of(report));

        assertThrows(BadRequestException.class, () -> reportService.resolveReport(reportId, request, UUID.randomUUID()));
    }
}
