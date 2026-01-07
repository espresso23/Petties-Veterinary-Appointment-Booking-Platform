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
 * VetShift-related (for Vet):
 * - VET_SHIFT_ASSIGNED: Vet được gán ca làm việc mới
 * - VET_SHIFT_UPDATED: Ca làm việc của Vet bị sửa đổi
 * - VET_SHIFT_DELETED: Ca làm việc của Vet bị xóa
 */
public enum NotificationType {
    // Clinic status notifications (for Clinic Owner)
    APPROVED,
    REJECTED,
    PENDING,

    // Clinic registration notification (for Admin)
    CLINIC_PENDING_APPROVAL,

    // VetShift notifications (for Vet)
    VET_SHIFT_ASSIGNED,
    VET_SHIFT_UPDATED,
    VET_SHIFT_DELETED,

    // Booking notifications
    BOOKING_CREATED,
    BOOKING_CONFIRMED,
    BOOKING_CANCELLED,

    // Additional Clinic notifications
    CLINIC_VERIFIED
}
