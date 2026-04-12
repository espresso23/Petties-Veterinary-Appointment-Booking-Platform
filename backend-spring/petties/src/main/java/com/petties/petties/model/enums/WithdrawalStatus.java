package com.petties.petties.model.enums;

/**
 * Trạng thái rút tiền
 */
public enum WithdrawalStatus {
    PENDING,        // Chờ xử lý
    PROCESSING,     // Đang xử lý
    COMPLETED,      // Đã chuyển tiền thành công
    FAILED,         // Giao dịch thất bại
    REVERSED        // Bị thu hồi
}
