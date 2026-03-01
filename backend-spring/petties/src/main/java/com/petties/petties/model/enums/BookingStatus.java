package com.petties.petties.model.enums;

/**
 * Booking status state machine
 *
 * Regular Flow:
 * PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
 *
 * SOS/HOME_VISIT Flow (simplified):
 * SEARCHING → PENDING_CLINIC_CONFIRM → CONFIRMED → IN_PROGRESS → COMPLETED
 *
 * Actions (not statuses):
 * - startMoving(): CONFIRMED → IN_PROGRESS (SOS/HOME_VISIT)
 * - arrived(): IN_PROGRESS (sets arrivedAt timestamp)
 * - checkIn(): CONFIRMED → IN_PROGRESS
 * - checkout(): IN_PROGRESS → COMPLETED
 */
public enum BookingStatus {
    PENDING, // Pet Owner tạo, chờ Clinic xác nhận
    SEARCHING, // SOS Auto-Match: Đang tìm kiếm phòng khám gần nhất
    PENDING_CLINIC_CONFIRM, // SOS Auto-Match: Chờ phòng khám xác nhận
    CONFIRMED, // Clinic đã xác nhận + Staff đã được phân công
    IN_PROGRESS, // Đang khám hoặc đang di chuyển (Staff đã check-in hoặc startMoving)
    COMPLETED, // Hoàn thành (Staff đã checkout + thanh toán)
    CANCELLED, // Đã hủy
    NO_SHOW // Khách không đến
}
