package com.petties.petties.model.enums;

/**
 * Booking status state machine
 *
 * Flow:
 * PENDING → CONFIRMED → [ON_THE_WAY → ARRIVED] → IN_PROGRESS → COMPLETED
 *
 * ON_THE_WAY, ARRIVED: Only for HOME_VISIT and SOS bookings
 *
 * Actions (not statuses):
 * - checkIn(): CONFIRMED/ARRIVED → IN_PROGRESS
 * - checkout(): IN_PROGRESS → COMPLETED
 */
public enum BookingStatus {
    PENDING, // Pet Owner tạờ Clinic xáco, ch nhận
    CONFIRMED, // Clinic đã xác nhận + Staff đã được phân công
    ON_THE_WAY, // Staff đang đến (HOME_VISIT/SOS)
    ARRIVED, // Staff đã đến (HOME_VISIT/SOS)
    IN_PROGRESS, // Đang khám (Staff đã check-in)
    COMPLETED, // Hoàn thành (Staff đã checkout + thanh toán)
    CANCELLED, // Đã hủy
    NO_SHOW // Khách không đến
}
