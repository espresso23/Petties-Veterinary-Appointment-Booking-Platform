package com.petties.petties.dto.report;

import com.petties.petties.model.enums.ReportStatus;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResolveReportRequest {

    @NotNull(message = "Trạng thái giải quyết không được để trống")
    private ReportStatus status;

    private String adminNote;
    
}
