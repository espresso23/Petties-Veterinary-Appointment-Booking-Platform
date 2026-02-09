package com.petties.petties.dto.sos;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Request DTO for SOS Auto-Match feature
 * Used when Pet Owner sends an SOS emergency request
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SosMatchRequest {

    @NotNull(message = "Vui lòng chọn thú cưng cần cấp cứu")
    private UUID petId;

    @NotNull(message = "Vui lòng cho phép truy cập vị trí")
    @DecimalMin(value = "-90.0", message = "Vĩ độ không hợp lệ")
    @DecimalMax(value = "90.0", message = "Vĩ độ không hợp lệ")
    private BigDecimal latitude;

    @NotNull(message = "Vui lòng cho phép truy cập vị trí")
    @DecimalMin(value = "-180.0", message = "Kinh độ không hợp lệ")
    @DecimalMax(value = "180.0", message = "Kinh độ không hợp lệ")
    private BigDecimal longitude;

    private String symptoms;

    private String notes;
}
