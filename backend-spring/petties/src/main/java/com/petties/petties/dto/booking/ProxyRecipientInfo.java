package com.petties.petties.dto.booking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * DTO for capturing recipient information in proxy booking.
 * Used when a user books on behalf of someone else.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProxyRecipientInfo {

    @NotBlank(message = "Họ tên người được đặt hộ không được để trống")
    private String fullName;

    @NotBlank(message = "Số điện thoại người được đặt hộ không được để trống")
    @Pattern(regexp = "^0\\d{9}$", message = "Số điện thoại không hợp lệ")
    private String phone;

    /**
     * Optional address for home visit bookings
     */
    private String address;
    private BigDecimal lat;
    private BigDecimal lng;
}
