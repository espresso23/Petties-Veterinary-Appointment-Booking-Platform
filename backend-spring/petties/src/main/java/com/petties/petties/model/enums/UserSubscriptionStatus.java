package com.petties.petties.model.enums;

/**
 * Status of a user subscription
 */
public enum UserSubscriptionStatus {
    PENDING_PAYMENT, // Chờ thanh toán
    ACTIVE, // Đang hoạt động
    CANCELLED, // Đã hủy (vẫn có thể dùng đến hết hạn)
    EXPIRED // Đã hết hạn
}
