package com.petties.petties.dto.refund;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RefundApplicationStatusUpdateRequest {

    @NotNull(message = "Trạng thái không được để trống")
    private com.petties.petties.model.enums.RefundApplicationStatus status;

    private String note;
}
