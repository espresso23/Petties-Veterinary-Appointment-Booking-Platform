package com.petties.petties.model.enums;

/**
 * Trạng thái đơn hoàn tiền (rút tiền sau khấu trừ 5% nền tảng).
 */
public enum RefundApplicationStatus {
    PENDING,   // Chờ admin duyệt
    APPROVED,  // Đã duyệt
    REJECTED   // Từ chối
}
