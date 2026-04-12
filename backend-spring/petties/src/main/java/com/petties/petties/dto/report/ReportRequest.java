package com.petties.petties.dto.report;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportRequest {

    @NotNull(message = "Mã lịch hẹn không được để trống")
    private UUID bookingId;

    @NotBlank(message = "Lý do báo cáo không được để trống")
    @Size(min = 10, max = 2000, message = "Lý do báo cáo phải từ 10 đến 2000 ký tự")
    private String reason;

    /** Optional HTTPS image URLs (upload via POST /api/files/upload with folder=reports first). Max 5. */
    @Size(max = 5, message = "Tối đa 5 ảnh đính kèm")
    private List<String> attachmentUrls;
}
