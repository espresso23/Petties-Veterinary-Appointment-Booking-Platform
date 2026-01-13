package com.petties.petties.model.enums;

/**
 * Booking status state machine
 * 
 * Flow:
 * PENDING → CONFIRMED → ASSIGNED → [ON_THE_WAY → ARRIVED] → CHECK_IN →
 * IN_PROGRESS → CHECK_OUT → COMPLETED
 * 
 * ON_THE_WAY, ARRIVED: Only for HOME_VISIT and SOS bookings
 */
public enum BookingStatus {
    PENDING, // Pet Owner tạo, chờ Clinic xác nhận
    CONFIRMED, // Clinic đã xác nhận
    ASSIGNED, // Đã phân công Vet
    ON_THE_WAY, // Vet đang đến (HOME_VISIT/SOS)
    ARRIVED, // Vet đã đến (HOME_VISIT/SOS)
    CHECK_IN, // Vet bắt đầu khám
    IN_PROGRESS, // Đang khám
    CHECK_OUT, // Kết thúc khám, chờ thanh toán
    COMPLETED, // Hoàn thành (đã thanh toán)
    CANCELLED, // Đã hủy
    NO_SHOW // Khách không đến
}
