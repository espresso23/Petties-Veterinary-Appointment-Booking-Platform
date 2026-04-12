package com.petties.petties.model.enums;

/**
 * Loại giao dịch balance
 */
public enum BalanceTransactionType {
    WITHDRAWAL,     // Rút tiền
    PLATFORM_FEE,   // Phí nền tảng
    TRANSACTION_FEE, // Phí giao dịch
    ADJUSTMENT      // Điều chỉnh thủ công
}
