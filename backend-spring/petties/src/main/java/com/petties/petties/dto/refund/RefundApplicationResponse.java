package com.petties.petties.dto.refund;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Response đơn hoàn tiền (sau khi tạo hoặc lấy danh sách).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundApplicationResponse {

    private UUID refundApplicationId;
    private UUID clinicId;
    private String clinicName;
    private String bankName;
    private String accountNumber;
    private String periodYearMonth;
    private BigDecimal monthRevenue;
    private BigDecimal qrRevenue;
    private BigDecimal cashRevenue;
    private BigDecimal requestedAmount;
    private Integer webDeductionPercent;
    private BigDecimal webDeductionAmount;
    private BigDecimal amountAfterDeduction;
    private String status;
    private String rejectionReason;
    private LocalDateTime reviewedAt;
    private LocalDateTime createdAt;
}
