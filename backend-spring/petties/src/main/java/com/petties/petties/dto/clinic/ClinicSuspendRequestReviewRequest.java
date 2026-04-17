package com.petties.petties.dto.clinic;

import com.petties.petties.model.enums.ClinicSuspendRequestStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClinicSuspendRequestReviewRequest {

    @NotNull(message = "Trạng thái duyệt không được để trống")
    private ClinicSuspendRequestStatus status;

    @Size(max = 2000, message = "Ghi chú quản trị không được quá 2000 ký tự")
    private String note;
}