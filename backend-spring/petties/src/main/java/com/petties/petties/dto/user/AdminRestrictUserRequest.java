package com.petties.petties.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminRestrictUserRequest {

    @NotBlank(message = "Lý do hạn chế không được để trống")
    @Size(min = 10, max = 2000, message = "Lý do hạn chế phải từ 10 đến 2000 ký tự")
    private String reason;

    @Builder.Default
    private Boolean isPermanent = Boolean.FALSE;

    /**
     * Số ngày hạn chế tạm thời. Bắt buộc khi isPermanent = false.
     */
    private Integer days;
}
