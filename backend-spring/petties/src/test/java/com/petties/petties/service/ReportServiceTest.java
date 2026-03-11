package com.petties.petties.service;

import com.petties.petties.dto.report.ReportRequest;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
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
                .status(ReportStatus.PENDING)
                .build();
    }

    @Test
    void createReport_Success_ByPetOwner() {
        // Arrange
        ReportRequest request = new ReportRequest();
        request.setBookingId(bookingId);
        request.setReason("Service was bad");

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(userRepository.findById(petOwnerId)).thenReturn(Optional.of(petOwner));
        when(reportRepository.existsByBookingBookingIdAndReporterUserId(bookingId, petOwnerId)).thenReturn(false);
        when(reportRepository.save(any(Report.class))).thenReturn(report);

        ReportResponse mockResponse = ReportResponse.builder().id(reportId).build();
        when(reportMapper.mapToResponse(any(Report.class))).thenReturn(mockResponse);

        // Act
        ReportResponse response = reportService.createReport(request, petOwnerId);

        // Assert
        assertNotNull(response);
        assertEquals(reportId, response.getId());
        verify(reportRepository, times(1)).save(any(Report.class));
        verify(notificationService, times(1)).sendReportCreatedNotificationToAdmin(any(Report.class));
    }

    @Test
    void createReport_Fail_NotOwnerOfBooking() {
        // Arrange
        ReportRequest request = new ReportRequest();
        request.setBookingId(bookingId);
        request.setReason("Service was bad");

        User otherOwner = User.builder().userId(UUID.randomUUID()).role(Role.PET_OWNER).build();

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(userRepository.findById(otherOwner.getUserId())).thenReturn(Optional.of(otherOwner));

        // Act & Assert
        assertThrows(ForbiddenException.class, () -> reportService.createReport(request, otherOwner.getUserId()));
    }

    @Test
    void createReport_Success_ByClinicOwner() {
        // Arrange
        ReportRequest request = new ReportRequest();
        request.setBookingId(bookingId);
        request.setReason("Customer didn't show up");

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(userRepository.findById(clinicOwnerId)).thenReturn(Optional.of(clinicOwner));
        when(reportRepository.existsByBookingBookingIdAndReporterUserId(bookingId, clinicOwnerId)).thenReturn(false);
        
        Report mockSavedReport = Report.builder().id(reportId).reporter(clinicOwner).reportedUser(petOwner).booking(booking).build();
        when(reportRepository.save(any(Report.class))).thenReturn(mockSavedReport);
        
        ReportResponse mockResponse = ReportResponse.builder().id(reportId).build();
        when(reportMapper.mapToResponse(any(Report.class))).thenReturn(mockResponse);

        // Act
        ReportResponse response = reportService.createReport(request, clinicOwnerId);

        // Assert
        assertNotNull(response);
        verify(reportRepository, times(1)).save(any(Report.class));
    }
    
    @Test
    void createReport_Fail_AlreadyReported() {
        ReportRequest request = new ReportRequest();
        request.setBookingId(bookingId);
        request.setReason("Test Reason");

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));
        when(userRepository.findById(petOwnerId)).thenReturn(Optional.of(petOwner));
        when(reportRepository.existsByBookingBookingIdAndReporterUserId(bookingId, petOwnerId)).thenReturn(true);

        assertThrows(BadRequestException.class, () -> reportService.createReport(request, petOwnerId));
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
        when(reportRepository.findAll(any(Pageable.class))).thenReturn(page);
        
        Page<ReportResponse> result = reportService.getReports(null, Pageable.unpaged());
        
        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        verify(reportRepository, times(1)).findAll(any(Pageable.class));
    }
}
