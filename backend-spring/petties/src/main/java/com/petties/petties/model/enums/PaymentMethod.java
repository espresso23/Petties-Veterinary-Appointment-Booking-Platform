package com.petties.petties.model.enums;

/**
 * Payment method
 */
public enum PaymentMethod {
    CASH, // Thanh toán tiền mặt
    QR, // Thanh toán QR (VNPay, MoMo, ZaloPay)
    CARD // Thanh toán thẻ (Visa, MasterCard, Stripe)
}
