package com.petties.petties.dto.report;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateReportRequest {

    @NotBlank(message = "Lý do báo cáo không được để trống")
    @Size(min = 10, max = 2000, message = "Lý do báo cáo phải từ 10 đến 2000 ký tự")
    private String reason;

    @Size(max = 5, message = "Tối đa 5 ảnh đính kèm")
    private List<String> attachmentUrls;
}
