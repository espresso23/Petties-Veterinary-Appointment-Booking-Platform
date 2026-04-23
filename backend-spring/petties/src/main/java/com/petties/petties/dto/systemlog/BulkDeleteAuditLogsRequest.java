package com.petties.petties.dto.systemlog;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class BulkDeleteAuditLogsRequest {

    @NotEmpty(message = "Danh sach eventId khong duoc de trong")
    private List<String> eventIds;

    private String source = "ALL";
}
