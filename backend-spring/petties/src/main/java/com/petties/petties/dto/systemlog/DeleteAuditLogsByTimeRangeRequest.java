package com.petties.petties.dto.systemlog;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
public class DeleteAuditLogsByTimeRangeRequest {

    @NotNull(message = "Thoi gian bat dau khong duoc de trong")
    private OffsetDateTime fromTime;

    @NotNull(message = "Thoi gian ket thuc khong duoc de trong")
    private OffsetDateTime toTime;

    private String source = "ALL";
}
