package com.petties.petties.model.enums;

/**
 * Types of notifications in the system
 *
 * Clinic-related:
 * - APPROVED: Clinic đã được duyệt (for Owner)
 * - REJECTED: Clinic bị từ chối (for Owner)
 * - PENDING: Clinic đang chờ duyệt (for Owner - legacy)
 * - CLINIC_PENDING_APPROVAL: Clinic mới đăng ký chờ duyệt (for Admin)
 *
 * StaffShift-related (for Staff):
 * - STAFF_SHIFT_ASSIGNED: Staff được gán ca làm việc mới
 * - STAFF_SHIFT_UPDATED: Ca làm việc của Staff bị sửa đổi
 * - STAFF_SHIFT_DELETED: Ca làm việc của Staff bị xóa
 */
public enum NotificationType {
    // Clinic status notifications (for Clinic Owner)
    APPROVED,
    REJECTED,
    PENDING,

    // Clinic registration notification (for Admin)
    CLINIC_PENDING_APPROVAL,

    // StaffShift notifications (for Staff)
    STAFF_SHIFT_ASSIGNED,
    STAFF_SHIFT_UPDATED,
    STAFF_SHIFT_DELETED,

    // Booking notifications
    BOOKING_CREATED,
    BOOKING_CONFIRMED,
    BOOKING_ASSIGNED,
    BOOKING_CANCELLED,
    BOOKING_CHECKIN, // Staff đã check-in và bắt đầu khám
    BOOKING_COMPLETED, // Lịch hẹn đã hoàn thành
    STAFF_ON_WAY, // Nhân viên đang trên đường đến (HOME_VISIT/SOS)

    // Additional Clinic notifications
    CLINIC_VERIFIED,

    // Re-examination
    RE_EXAMINATION_REMINDER,

    // Vaccination
    VACCINATION_REMINDER
}
