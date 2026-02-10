package com.petties.petties.model.enums;

/**
 * Booking status state machine
 *
 * Regular Flow:
 * PENDING → CONFIRMED → [ON_THE_WAY → ARRIVED] → IN_PROGRESS → COMPLETED
 *
 * SOS Flow:
 * SEARCHING → PENDING_CLINIC_CONFIRM → CONFIRMED → ON_THE_WAY → ARRIVED →
 * IN_PROGRESS → COMPLETED
 *
 * ON_THE_WAY, ARRIVED: Only for HOME_VISIT and SOS bookings
 *
 * Actions (not statuses):
 * - checkIn(): CONFIRMED/ARRIVED → IN_PROGRESS
 * - checkout(): IN_PROGRESS → COMPLETED
 */
public enum BookingStatus {
    SEARCHING, // SOS: Đang tìm clinic phù hợp
    PENDING_CLINIC_CONFIRM, // SOS: Chờ clinic xác nhận
    PENDING, // Pet Owner tạo, chờ Clinic xác nhận
    CONFIRMED, // Clinic đã xác nhận + Staff đã được phân công
    ON_THE_WAY, // Staff đang đến (HOME_VISIT/SOS)
    ARRIVED, // Staff đã đến (HOME_VISIT/SOS)
    IN_PROGRESS, // Đang khám (Staff đã check-in)
    COMPLETED, // Hoàn thành (Staff đã checkout + thanh toán)
    CANCELLED, // Đã hủy
    NO_SHOW // Khách không đến
}
