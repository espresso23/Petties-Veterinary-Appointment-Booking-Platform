package com.petties.petties.service;

import com.petties.petties.dto.notification.NotificationResponse;
import com.petties.petties.dto.sse.SseEventDto;
import com.petties.petties.model.Clinic;
import com.petties.petties.model.Notification;
import com.petties.petties.model.User;
import com.petties.petties.model.StaffShift;
import com.petties.petties.model.enums.NotificationType;
import com.petties.petties.repository.NotificationRepository;
import com.petties.petties.repository.UserRepository;
import com.petties.petties.exception.ResourceNotFoundException;
import com.petties.petties.exception.ForbiddenException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.petties.petties.model.enums.Role;

/**
 * Service for managing notifications
 *
 * Handles:
 * - Clinic status notifications (APPROVED, REJECTED, PENDING)
 * - Clinic registration notifications (CLINIC_PENDING_APPROVAL for Admin)
 * - StaffShift notifications (STAFF_SHIFT_ASSIGNED, STAFF_SHIFT_UPDATED,
 * STAFF_SHIFT_DELETED)
 * - SSE push for real-time delivery
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

        private static final Set<NotificationType> CLINIC_MANAGER_VISIBLE_TYPES = EnumSet.of(
                        NotificationType.APPROVED,
                        NotificationType.REJECTED,
                        NotificationType.CLINIC_VERIFIED,
                        NotificationType.STAFF_SHIFT_ASSIGNED,
                        NotificationType.STAFF_SHIFT_UPDATED,
                        NotificationType.STAFF_SHIFT_DELETED,
                        NotificationType.BOOKING_CREATED,
                        NotificationType.BOOKING_CANCELLED);

        private final NotificationRepository notificationRepository;
        private final UserRepository userRepository;
        private final SseEmitterService sseEmitterService;// use for 1 direction real time notification
        private final FcmService fcmService; // use for mobile push notification

        private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
        private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

        private Notification buildNotification(User user, Clinic clinic, StaffShift shift,
                        NotificationType type, String message, String reason) {
                return Notification.builder()
                                .user(user)
                                .clinic(clinic)
                                .shift(shift)
                                .type(type)
                                .message(message)
                                .reason(reason)
                                .read(false)
                                .build();
        }

        private Notification saveAndDispatchNotification(Notification notification, String logTemplate,
                        Object... logArgs) {
                Notification savedNotification = notificationRepository.save(notification);
                Object[] finalLogArgs = new Object[logArgs.length + 1];
                finalLogArgs[0] = savedNotification.getNotificationId();
                System.arraycopy(logArgs, 0, finalLogArgs, 1, logArgs.length);
                log.info(logTemplate, finalLogArgs);
                pushNotificationToUser(savedNotification.getUser().getUserId(), savedNotification);
                return savedNotification;
        }

        private Notification createAndDispatchNotification(User user, Clinic clinic, StaffShift shift,
                        NotificationType type, String message, String reason,
                        String logTemplate, Object... logArgs) {
                Notification notification = buildNotification(user, clinic, shift, type, message, reason);
                return saveAndDispatchNotification(notification, logTemplate, logArgs);
        }

        private Notification createAndDispatchNotification(User user, Clinic clinic, NotificationType type,
                        String message, String reason, String logTemplate, Object... logArgs) {
                return createAndDispatchNotification(user, clinic, null, type, message, reason, logTemplate, logArgs);
        }

        private void createAndDispatchNotifications(Collection<User> users, Clinic clinic, StaffShift shift,
                        NotificationType type, String message, String reason,
                        String logTemplate, java.util.function.Function<User, Object[]> logArgsProvider) {
                if (users == null || users.isEmpty()) {
                        return;
                }

                users.forEach(user -> createAndDispatchNotification(
                                user,
                                clinic,
                                shift,
                                type,
                                message,
                                reason,
                                logTemplate,
                                logArgsProvider.apply(user)));
        }

        private List<User> getDeduplicatedClinicManagers(UUID clinicId) {
                return userRepository.findByWorkingClinicIdAndRole(clinicId, Role.CLINIC_MANAGER)
                                .stream()
                                .collect(Collectors.toMap(User::getUserId, user -> user, (first, second) -> first))
                                .values()
                                .stream()
                                .toList();
        }

        private Set<NotificationType> getVisibleTypesForUser(User user) {
                if (user != null && user.getRole() == Role.CLINIC_MANAGER) {
                        return CLINIC_MANAGER_VISIBLE_TYPES;
                }
                return null;
        }

        // ======================== CLINIC NOTIFICATIONS ========================

        /**
         * Create a notification for clinic owner when clinic status changes
         * Simple approach: Check if notification already exists for this clinic+type
         * Only create if no notification exists - prevents all duplicates
         */
        @Transactional
        public Notification createClinicNotification(Clinic clinic, NotificationType type, String reason) {
                User owner = clinic.getOwner();

                // Double-check: Verify no notification exists for this clinic+type
                // This prevents duplicate even if method is called multiple times concurrently
                boolean exists = notificationRepository.existsByClinicClinicIdAndType(
                                clinic.getClinicId(),
                                type);

                if (exists) {
                        log.debug("Notification already exists for clinic: {} type: {}. Skipping duplicate.",
                                        clinic.getClinicId(), type);
                        return null;
                }

                String message = switch (type) {
                        case APPROVED -> String.format(
                                        "Phòng khám \"%s\" đã được duyệt và có thể hoạt động trên nền tảng Petties.",
                                        clinic.getName());
                        case REJECTED -> String.format(
                                        "Phòng khám \"%s\" không được duyệt. Vui lòng xem lại thông tin và đăng ký lại.",
                                        clinic.getName());
                        case PENDING -> String.format("Phòng khám \"%s\" đang chờ duyệt.", clinic.getName());
                        default -> "Thông báo từ phòng khám " + clinic.getName();
                };

                return createAndDispatchNotification(
                                owner,
                                clinic,
                                type,
                                message,
                                reason,
                                "Notification created: {} for clinic: {} type: {} user: {}",
                                clinic.getClinicId(),
                                type,
                                owner.getUserId());
        }

        /**
         * Notify all Admins when a new clinic is registered and pending approval
         */
        @Transactional
        public void notifyAdminsNewClinicRegistration(Clinic clinic) {
                // Get all active admin users
                List<User> admins = userRepository.findByRoleAndDeletedAtIsNull(Role.ADMIN);

                if (admins.isEmpty()) {
                        log.warn("No active admin users found to notify about new clinic registration");
                        return;
                }

                String message = String.format(
                                "Phòng khám mới \"%s\" vừa đăng ký và đang chờ duyệt. Chủ sở hữu: %s",
                                clinic.getName(),
                                clinic.getOwner().getFullName());

                for (User admin : admins) {
                        // Check if notification already exists for this clinic+admin+type
                        boolean exists = notificationRepository.existsByUserUserIdAndClinicClinicIdAndType(
                                        admin.getUserId(),
                                        clinic.getClinicId(),
                                        NotificationType.CLINIC_PENDING_APPROVAL);

                        if (exists) {
                                log.debug("Admin notification already exists for clinic: {} admin: {}. Skipping.",
                                                clinic.getClinicId(), admin.getUserId());
                                continue;
                        }

                        createAndDispatchNotification(
                                        admin,
                                        clinic,
                                        NotificationType.CLINIC_PENDING_APPROVAL,
                                        message,
                                        null,
                                        "Admin notification created: {} for admin: {} clinic: {}",
                                        admin.getUserId(),
                                        clinic.getClinicId());
                }
        }

        /**
         * Broadcast the current count of pending clinics to all active admins
         */
        @Transactional(readOnly = true)
        public void broadcastClinicCounterUpdate(long count) {
                List<User> admins = userRepository.findByRoleAndDeletedAtIsNull(Role.ADMIN);
                if (admins.isEmpty())
                        return;

                SseEventDto event = SseEventDto.clinicCounterUpdate(count);
                log.info("Broadcasting pending clinic count ({}) to {} admins", count, admins.size());
                for (User admin : admins) {
                        sseEmitterService.pushToUser(admin.getUserId(), event);
                }
        }

        // ======================== STAFF SHIFT NOTIFICATIONS ========================

        /**
         * Notify Staff when a new shift is assigned (single shift)
         */
        @Transactional
        public Notification notifyStaffShiftAssigned(User staff, StaffShift shift) {
                String message = String.format(
                                "Bạn được gán ca làm việc ngày %s (%s - %s) tại %s",
                                shift.getWorkDate().format(DATE_FORMATTER),
                                shift.getStartTime().format(TIME_FORMATTER),
                                shift.getEndTime().format(TIME_FORMATTER),
                                shift.getClinic().getName());

                return createAndDispatchNotification(
                                staff,
                                shift.getClinic(),
                                shift,
                                NotificationType.STAFF_SHIFT_ASSIGNED,
                                message,
                                null,
                                "StaffShift notification created: {} for staff: {} shift: {}",
                                staff.getUserId(),
                                shift.getShiftId());
        }

        /**
         * Notify Staff when multiple shifts are assigned in batch
         * Creates ONE notification summarizing all shifts instead of N individual
         * notifications
         *
         * @param staff  The staff being notified
         * @param shifts List of shifts assigned (must not be empty)
         * @param clinic The clinic where shifts are assigned
         */
        @Transactional
        public Notification notifyStaffShiftsBatchAssigned(User staff, List<StaffShift> shifts, Clinic clinic) {
                if (shifts == null || shifts.isEmpty()) {
                        log.warn("notifyStaffShiftsBatchAssigned called with empty shifts list");
                        return null;
                }

                // If only 1 shift, use the single notification method
                if (shifts.size() == 1) {
                        return notifyStaffShiftAssigned(staff, shifts.get(0));
                }

                // Sort shifts by workDate to get date range
                List<StaffShift> sortedShifts = shifts.stream()
                                .sorted((a, b) -> a.getWorkDate().compareTo(b.getWorkDate()))
                                .toList();

                LocalDate startDate = sortedShifts.get(0).getWorkDate();
                LocalDate endDate = sortedShifts.get(sortedShifts.size() - 1).getWorkDate();
                int shiftCount = shifts.size();

                String message = String.format(
                                "Bạn được gán %d ca làm việc từ ngày %s đến ngày %s tại %s",
                                shiftCount,
                                startDate.format(DATE_FORMATTER),
                                endDate.format(DATE_FORMATTER),
                                clinic.getName());

                // Link to the first shift for navigation purposes
                StaffShift firstShift = sortedShifts.get(0);

                return createAndDispatchNotification(
                                staff,
                                clinic,
                                firstShift,
                                NotificationType.STAFF_SHIFT_ASSIGNED,
                                message,
                                null,
                                "Batch StaffShift notification created: {} for staff: {} ({} shifts from {} to {})",
                                staff.getUserId(),
                                shiftCount,
                                startDate,
                                endDate);
        }

        /**
         * Notify Staff when their shift is updated (single shift)
         */
        @Transactional
        public Notification notifyStaffShiftUpdated(User staff, StaffShift shift) {
                String message = String.format(
                                "Ca làm việc ngày %s đã được cập nhật (%s - %s) tại %s",
                                shift.getWorkDate().format(DATE_FORMATTER),
                                shift.getStartTime().format(TIME_FORMATTER),
                                shift.getEndTime().format(TIME_FORMATTER),
                                shift.getClinic().getName());

                return createAndDispatchNotification(
                                staff,
                                shift.getClinic(),
                                shift,
                                NotificationType.STAFF_SHIFT_UPDATED,
                                message,
                                null,
                                "StaffShift update notification created: {} for staff: {} shift: {}",
                                staff.getUserId(),
                                shift.getShiftId());
        }

        /**
         * Notify Staff when multiple shifts are updated in batch
         * Creates ONE notification summarizing all shifts instead of N individual
         * notifications
         */
        @Transactional
        public Notification notifyStaffShiftsBatchUpdated(User staff, List<StaffShift> shifts, Clinic clinic) {
                if (shifts == null || shifts.isEmpty()) {
                        log.warn("notifyStaffShiftsBatchUpdated called with empty shifts list");
                        return null;
                }

                // If only 1 shift, use the single notification method
                if (shifts.size() == 1) {
                        return notifyStaffShiftUpdated(staff, shifts.get(0));
                }

                // Sort shifts by workDate to get date range
                List<StaffShift> sortedShifts = shifts.stream()
                                .sorted((a, b) -> a.getWorkDate().compareTo(b.getWorkDate()))
                                .toList();

                LocalDate startDate = sortedShifts.get(0).getWorkDate();
                LocalDate endDate = sortedShifts.get(sortedShifts.size() - 1).getWorkDate();
                int shiftCount = shifts.size();

                String message = String.format(
                                "%d ca làm việc từ ngày %s đến ngày %s tại %s đã được cập nhật",
                                shiftCount,
                                startDate.format(DATE_FORMATTER),
                                endDate.format(DATE_FORMATTER),
                                clinic.getName());

                // Link to the first shift for navigation purposes
                StaffShift firstShift = sortedShifts.get(0);

                return createAndDispatchNotification(
                                staff,
                                clinic,
                                firstShift,
                                NotificationType.STAFF_SHIFT_UPDATED,
                                message,
                                null,
                                "Batch StaffShift update notification created: {} for staff: {} ({} shifts)",
                                staff.getUserId(),
                                shiftCount);
        }

        /**
         * Notify Staff when their shift is deleted
         */
        @Transactional
        public Notification notifyStaffShiftDeleted(User staff, LocalDate workDate, String clinicName) {
                String message = String.format(
                                "Ca làm việc ngày %s tại %s đã bị xóa",
                                workDate.format(DATE_FORMATTER),
                                clinicName);

                return createAndDispatchNotification(
                                staff,
                                null,
                                NotificationType.STAFF_SHIFT_DELETED,
                                message,
                                null,
                                "StaffShift delete notification created: {} for staff: {}",
                                staff.getUserId());
        }

        // ======================== BOOKING NOTIFICATIONS ========================

        /**
         * Notify clinic managers when a new booking is created
         */
        @Transactional
        public void sendBookingNotificationToClinic(com.petties.petties.model.Booking booking) {
                // Find all managers of this clinic (deduplicate by userId to avoid duplicate notifications)
                List<User> managers = getDeduplicatedClinicManagers(booking.getClinic().getClinicId());

                if (managers.isEmpty()) {
                        log.warn("No managers found for clinic: {}", booking.getClinic().getClinicId());
                        return;
                }

                String petName = booking.getPet().getName();
                String ownerName = booking.getPetOwner().getFullName();
                String message = String.format(
                                "Đơn đặt lịch mới #%s từ %s cho thú cưng %s cần xác nhận",
                                booking.getBookingCode(),
                                ownerName,
                                petName);

                createAndDispatchNotifications(
                                managers,
                                booking.getClinic(),
                                null,
                                NotificationType.BOOKING_CREATED,
                                message,
                                null,
                                "Booking notification created: {} for manager: {}",
                                manager -> new Object[] { manager.getUserId() });
        }

        /**
         * Notify staff when they are assigned to a booking
         */
        @Transactional
        public void sendBookingAssignedNotificationToStaff(com.petties.petties.model.Booking booking) {
                User staff = booking.getAssignedStaff();
                if (staff == null) {
                        log.warn("No staff assigned for booking: {}", booking.getBookingCode());
                        return;
                }

                String petName = booking.getPet().getName();
                String serviceName = booking.getBookingServices().isEmpty()
                                ? "Dịch vụ"
                                : booking.getBookingServices().get(0).getService().getName();
                String message = String.format(
                                "Bạn được gán cho booking #%s - %s cho %s vào lúc %s ngày %s",
                                booking.getBookingCode(),
                                serviceName,
                                petName,
                                booking.getBookingTime().format(TIME_FORMATTER),
                                booking.getBookingDate().format(DATE_FORMATTER));

                createAndDispatchNotification(
                                staff,
                                booking.getClinic(),
                                NotificationType.BOOKING_CONFIRMED,
                                message,
                                null,
                                "Booking assigned notification created: {} for staff: {}",
                                staff.getUserId());
        }

        /**
         * Notify new staff when reassigned to a booking service
         * Also optionally notify old staff that they were removed
         *
         * @param booking     The booking
         * @param newStaff    The newly assigned staff
         * @param oldStaff    The previously assigned staff (can be null)
         * @param serviceName The service being reassigned
         */
        @Transactional
        public void sendStaffReassignedNotification(
                        com.petties.petties.model.Booking booking,
                        User newStaff,
                        User oldStaff,
                        String serviceName) {

                String petName = booking.getPet().getName();

                // 1. Notify NEW staff - they are now assigned
                if (newStaff != null) {
                        String newStaffMessage = String.format(
                                        "Bạn được gán thực hiện dịch vụ \"%s\" cho booking #%s - %s vào lúc %s ngày %s",
                                        serviceName,
                                        booking.getBookingCode(),
                                        petName,
                                        booking.getBookingTime().format(TIME_FORMATTER),
                                        booking.getBookingDate().format(DATE_FORMATTER));

                        createAndDispatchNotification(
                                        newStaff,
                                        booking.getClinic(),
                                        NotificationType.BOOKING_CONFIRMED,
                                        newStaffMessage,
                                        null,
                                        "Staff reassigned notification created: {} for new staff: {}",
                                        newStaff.getUserId());
                }

                // 2. Notify OLD staff - they were removed from this service
                if (oldStaff != null && !oldStaff.getUserId().equals(newStaff != null ? newStaff.getUserId() : null)) {
                        String oldStaffMessage = String.format(
                                        "Bạn đã được gỡ khỏi dịch vụ \"%s\" trong booking #%s. Dịch vụ này đã được gán cho nhân viên khác.",
                                        serviceName,
                                        booking.getBookingCode());

                        createAndDispatchNotification(
                                        oldStaff,
                                        booking.getClinic(),
                                        NotificationType.BOOKING_CANCELLED,
                                        oldStaffMessage,
                                        null,
                                        "Staff removed notification created: {} for old staff: {}",
                                        oldStaff.getUserId());
                }
        }

        /**
         * Notify pet owner when staff checks in (starts the service)
         */
        @Transactional
        public void sendCheckinNotification(com.petties.petties.model.Booking booking) {
                User petOwner = booking.getPetOwner();
                if (petOwner == null) {
                        log.warn("No pet owner found for booking: {}", booking.getBookingCode());
                        return;
                }

                String staffName = booking.getAssignedStaff() != null
                                ? booking.getAssignedStaff().getFullName()
                                : "Nhân viên";
                String message = String.format(
                                "Nhân viên %s đã bắt đầu khám cho %s (Booking #%s)",
                                staffName,
                                booking.getPet().getName(),
                                booking.getBookingCode());

                createAndDispatchNotification(
                                petOwner,
                                booking.getClinic(),
                                NotificationType.BOOKING_CHECKIN,
                                message,
                                null,
                                "Check-in notification created: {} for owner: {}",
                                petOwner.getUserId());
        }

        /**
         * Notify pet owner when booking is completed
         */
        @Transactional
        public void sendCompletedNotification(com.petties.petties.model.Booking booking) {
                User petOwner = booking.getPetOwner();
                if (petOwner == null) {
                        log.warn("No pet owner found for booking: {}", booking.getBookingCode());
                        return;
                }

                String message = String.format(
                                "Lịch hẹn #%s cho %s đã hoàn thành. Cảm ơn bạn đã sử dụng dịch vụ!",
                                booking.getBookingCode(),
                                booking.getPet().getName());

                createAndDispatchNotification(
                                petOwner,
                                booking.getClinic(),
                                NotificationType.BOOKING_COMPLETED,
                                message,
                                null,
                                "Completed notification created: {} for owner: {}",
                                petOwner.getUserId());
        }

        @Transactional
        public void sendStaffOnWayNotification(com.petties.petties.model.Booking booking) {
                // Only send for SOS bookings
                if (booking.getType() != com.petties.petties.model.enums.BookingType.SOS &&
                                booking.getType() != com.petties.petties.model.enums.BookingType.HOME_VISIT) {
                        log.debug("STAFF_ON_WAY notification skipped - only applicable for SOS/HOME_VISIT bookings");
                        return;
                }

                User petOwner = booking.getPetOwner();
                if (petOwner == null) {
                        log.warn("No pet owner found for booking: {}", booking.getBookingCode());
                        return;
                }

                String staffName = booking.getAssignedStaff() != null
                                ? booking.getAssignedStaff().getFullName()
                                : "Nhân viên";
                String message = String.format(
                                "Nhân viên %s đang trên đường đến địa chỉ của bạn (Booking #%s)",
                                staffName,
                                booking.getBookingCode());

                createAndDispatchNotification(
                                petOwner,
                                booking.getClinic(),
                                NotificationType.STAFF_ON_WAY,
                                message,
                                null,
                                "Staff on way notification created: {} for owner: {}",
                                petOwner.getUserId());
        }

        @Transactional
        public void sendStaffArrivedNotification(com.petties.petties.model.Booking booking) {
                User petOwner = booking.getPetOwner();
                if (petOwner == null) {
                        log.warn("No pet owner found for booking: {}", booking.getBookingCode());
                        return;
                }

                String staffName = booking.getAssignedStaff() != null
                                ? booking.getAssignedStaff().getFullName()
                                : "Nhân viên";
                String message = String.format(
                                "Nhân viên %s đã đến địa chỉ của bạn (Booking #%s)",
                                staffName,
                                booking.getBookingCode());

                createAndDispatchNotification(
                                petOwner,
                                booking.getClinic(),
                                NotificationType.STAFF_ARRIVED,
                                message,
                                null,
                                "Staff arrived notification created: {} for owner: {}",
                                petOwner.getUserId());
        }

        /**
         * Notify pet owner when their booking is auto-cancelled
         * due to clinic not confirming within the timeout period.
         */
        @Transactional
        public void sendBookingAutoCancelledNotification(com.petties.petties.model.Booking booking) {
                User petOwner = booking.getPetOwner();
                if (petOwner == null) {
                        log.warn("No pet owner found for auto-cancelled booking: {}", booking.getBookingCode());
                        return;
                }

                String clinicName = booking.getClinic() != null ? booking.getClinic().getName() : "Phòng khám";
                String message = String.format(
                                "Lịch hẹn #%s tại %s đã bị hủy tự động do không được xác nhận trong thời gian quy định. Vui lòng đặt lịch lại hoặc liên hệ phòng khám.",
                                booking.getBookingCode(),
                                clinicName);

                createAndDispatchNotification(
                                petOwner,
                                booking.getClinic(),
                                NotificationType.BOOKING_CANCELLED,
                                message,
                                null,
                                "Auto-cancellation notification created: {} for owner: {}",
                                petOwner.getUserId());
        }

        // ======================== REPORT NOTIFICATIONS ========================

        @Transactional
        public void sendReportCreatedNotificationToAdmin(com.petties.petties.model.Report report) {
                List<User> admins = userRepository.findByRoleAndDeletedAtIsNull(Role.ADMIN);
                if (admins.isEmpty()) {
                        return;
                }

                String reporterName = report.getReporter().getFullName();
                String message = String.format(
                                "Người dùng %s vừa tạo một báo cáo về lịch hẹn #%s. Vui lòng kiểm tra và xử lý.",
                                reporterName,
                                report.getBooking().getBookingCode());

                for (User admin : admins) {
                        Notification notification = Notification.builder()
                                        .user(admin)
                                        .clinic(report.getBooking().getClinic())
                                        .type(NotificationType.REPORT_CREATED)
                                        .message(message)
                                        .read(false)
                                        .build();

                        notification = notificationRepository.save(notification);
                        pushNotificationToUser(admin.getUserId(), notification);
                }
        }

        @Transactional
        public void sendReportResolvedNotification(com.petties.petties.model.Report report) {
                String bookingCode = report.getBooking().getBookingCode();
                String resolutionContent = report.getStatus() == com.petties.petties.model.enums.ReportStatus.APPROVED 
                        ? "đã được chấp thuận" : "đã bị từ chối";
                        
                // 1. Notify Reporter
                String reporterMessage = String.format(
                                "Báo cáo của bạn về lịch hẹn #%s %s. Lời nhắn từ Admin: %s",
                                bookingCode,
                                resolutionContent,
                                report.getAdminNote());

                Notification reporterNotif = Notification.builder()
                                .user(report.getReporter())
                                .clinic(report.getBooking().getClinic())
                                .type(NotificationType.REPORT_RESOLVED)
                                .message(reporterMessage)
                                .read(false)
                                .build();
                reporterNotif = notificationRepository.save(reporterNotif);
                pushNotificationToUser(report.getReporter().getUserId(), reporterNotif);

                // 2. Notify Reported Party (if applicable)
                User reportedUserToNotify = null;
                boolean isClinicReported = false;

                if (report.getReportedUser() != null) {
                        reportedUserToNotify = report.getReportedUser();
                } else if (report.getReportedClinic() != null && report.getReportedClinic().getOwner() != null) {
                        reportedUserToNotify = report.getReportedClinic().getOwner();
                        isClinicReported = true;
                }

                if (reportedUserToNotify != null) {
                        String targetName = isClinicReported ? "phòng khám của bạn" : "bạn";
                        String reportedMessage = String.format(
                                        "Có quyết định xử lý liên quan đến báo cáo về %s trong lịch hẹn #%s. %s. Lời nhắn từ Admin: %s",
                                        targetName,
                                        bookingCode,
                                        resolutionContent,
                                        report.getAdminNote());

                        Notification reportedNotif = Notification.builder()
                                        .user(reportedUserToNotify)
                                        .clinic(report.getBooking().getClinic())
                                        .type(NotificationType.REPORT_RESOLVED)
                                        .message(reportedMessage)
                                        .read(false)
                                        .build();
                        reportedNotif = notificationRepository.save(reportedNotif);
                        pushNotificationToUser(reportedUserToNotify.getUserId(), reportedNotif);
                }
        }

        // ======================== COMMON OPERATIONS ========================

        /**
         * Push notification to user via SSE and FCM
         */
        private void pushNotificationToUser(UUID userId, Notification notification) {
                // 1. Push via SSE if user is online
                if (sseEmitterService.isUserConnected(userId)) {
                        NotificationResponse response = mapToResponse(notification);
                        SseEventDto event = SseEventDto.notification(response);
                        sseEmitterService.pushToUser(userId, event);
                        log.debug("Notification pushed via SSE to user: {}", userId);
                } else {
                        log.debug("User {} not connected to SSE, skipped SSE push", userId);
                }

                // 2. Push via FCM if user has a token
                User user = notification.getUser();
                if (user.getFcmToken() != null && !user.getFcmToken().isEmpty()) {
                        log.info("Attempting to send FCM push to user {}. Token: {}", userId, user.getFcmToken());
                        try {
                                boolean sent = fcmService.sendToUser(
                                                user,
                                                getNotificationTitle(notification.getType()),
                                                notification.getMessage(),
                                                Map.of(
                                                                "notificationId",
                                                                notification.getNotificationId().toString(),
                                                                "type", notification.getType().name()));
                                if (sent) {
                                        log.info("Push notification sent successfully via FCM to user: {}", userId);
                                } else {
                                        log.warn("FCM service returned false for user: {}", userId);
                                }
                        } catch (Exception e) {
                                log.error("Failed to send FCM push notification to user: {}", userId, e);
                        }
                } else {
                        log.warn("User {} has no FCM token, skipped FCM push", userId);
                }
        }

        private String getNotificationTitle(NotificationType type) {
                return switch (type) {
                        case STAFF_SHIFT_ASSIGNED -> "Lịch trực mới đã được gán";
                        case STAFF_SHIFT_UPDATED -> "Lịch trực đã thay đổi";
                        case STAFF_SHIFT_DELETED -> "Lịch trực đã bị xóa";
                        case BOOKING_CREATED -> "Lịch hẹn mới";
                        case BOOKING_CONFIRMED -> "Lịch hẹn đã xác nhận";
                        case BOOKING_CANCELLED -> "Lịch hẹn đã bị hủy";
                        case STAFF_ON_WAY -> "Nhân viên đang đến";
                        case STAFF_ARRIVED -> "Nhân viên đã đến nơi";
                        case CLINIC_VERIFIED, APPROVED -> "Phòng khám đã được xác minh";
                        case REJECTED -> "Phòng khám bị từ chối";
                        case REPORT_CREATED -> "Có báo cáo mới";
                        case REPORT_RESOLVED -> "Kết quả xử lý báo cáo";
                        default -> "Thông báo từ Petties";
                };
        }

        /**
         * Get all notifications for current user
         */
        @Transactional(readOnly = true)
        public Page<NotificationResponse> getNotificationsByUser(User user, Pageable pageable) {
                Set<NotificationType> visibleTypes = getVisibleTypesForUser(user);
                Page<Notification> notifications = visibleTypes == null
                                ? notificationRepository.findByUserUserIdOrderByCreatedAtDesc(user.getUserId(), pageable)
                                : notificationRepository.findByUserUserIdAndTypeInOrderByCreatedAtDesc(
                                                user.getUserId(),
                                                visibleTypes,
                                                pageable);
                return notifications.map(this::mapToResponse);
        }

        /**
         * Get unread notifications count for current user
         */
        @Transactional(readOnly = true)
        public long getUnreadCountByUser(User user) {
                Set<NotificationType> visibleTypes = getVisibleTypesForUser(user);
                return visibleTypes == null
                                ? notificationRepository.countByUserUserIdAndReadFalse(user.getUserId())
                                : notificationRepository.countByUserUserIdAndTypeInAndReadFalse(
                                                user.getUserId(),
                                                visibleTypes);
        }

        /**
         * Mark notification as read
         */
        @Transactional
        public void markAsRead(UUID notificationId, UUID userId) {
                Notification notification = notificationRepository.findById(notificationId)
                                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));

                // Verify ownership
                if (!notification.getUser().getUserId().equals(userId)) {
                        throw new ForbiddenException("Bạn chỉ có thể đánh dấu đã đọc thông báo của mình");
                }

                notificationRepository.markAsRead(notificationId);
                log.info("Notification marked as read: {} by user: {}", notificationId, userId);
        }

        /**
         * Mark all notifications as read for current user
         */
        @Transactional
        public void markAllAsReadByUserId(UUID userId) {
                int updated = notificationRepository.markAllAsReadByUserId(userId);
                log.info("Marked {} notifications as read for user: {}", updated, userId);
        }

        /**
         * Map Notification entity to response DTO
         */
        private NotificationResponse mapToResponse(Notification notification) {
                NotificationResponse.NotificationResponseBuilder builder = NotificationResponse.builder()
                                .notificationId(notification.getNotificationId())
                                .type(notification.getType())
                                .message(notification.getMessage())
                                .reason(notification.getReason())
                                .read(notification.getRead())
                                .actionType(notification.getActionType())
                                .actionData(notification.getActionData())
                                .createdAt(notification.getCreatedAt());

                // Add clinic fields if present
                if (notification.getClinic() != null) {
                        builder.clinicId(notification.getClinic().getClinicId())
                                        .clinicName(notification.getClinic().getName());
                }

                // Add shift fields if present
                if (notification.getShift() != null) {
                        StaffShift shift = notification.getShift();
                        builder.shiftId(shift.getShiftId())
                                        .shiftDate(shift.getWorkDate())
                                        .shiftStartTime(shift.getStartTime())
                                        .shiftEndTime(shift.getEndTime());
                }

                return builder.build();
        }
}
