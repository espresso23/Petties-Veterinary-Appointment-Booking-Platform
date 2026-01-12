package com.petties.petties.model.enums;

/**
 * Payment status
 */
public enum PaymentStatus {
    PENDING, // Chờ thanh toán
    PAID, // Đã thanh toán
    REFUNDED, // Đã hoàn tiền
    FAILED // Thanh toán thất bại
}
