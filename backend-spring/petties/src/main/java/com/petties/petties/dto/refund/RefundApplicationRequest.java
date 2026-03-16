package com.petties.petties.dto.refund;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Request tạo đơn hoàn tiền: doanh thu tháng (web tự tính 5% và số tiền nhận).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundApplicationRequest {

    /** Doanh thu tháng này (VND) - Tổng hợp */
    @NotNull(message = "Doanh thu tháng không được để trống")
    @DecimalMin(value = "0", message = "Doanh thu tháng phải lớn hơn hoặc bằng 0")
    private BigDecimal monthRevenue;

    /** Doanh thu từ QR */
    private BigDecimal qrRevenue;

    /** Doanh thu từ Tiền mặt */
    private BigDecimal cashRevenue;

    /** Số tiền clinic yêu cầu rút */
    @NotNull(message = "Số tiền rút không được để trống")
    private BigDecimal requestedAmount;

    /** ID phòng khám (nếu Owner muốn rút cho phòng khám cụ thể) */
    private UUID clinicId;

    /** Tháng/năm (yyyy-MM), ví dụ 2026-03. Nếu null thì dùng tháng hiện tại. */
    private String periodYearMonth;
}
