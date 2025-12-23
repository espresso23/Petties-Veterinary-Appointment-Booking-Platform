package com.petties.petties.dto.clinic;

import com.petties.petties.model.OperatingHours;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.Map;

/**
 * DTO for creating/updating a clinic
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClinicRequest {

    @NotBlank(message = "Tên phòng khám không được để trống")
    @Size(max = 200, message = "Tên phòng khám không được vượt quá 200 ký tự")
    private String name;

    @Size(max = 2000, message = "Mô tả không được vượt quá 2000 ký tự")
    private String description;

    @NotBlank(message = "Địa chỉ không được để trống")
    @Size(max = 500, message = "Địa chỉ không được vượt quá 500 ký tự")
    private String address;

    @Size(max = 100, message = "Quận/huyện không được vượt quá 100 ký tự")
    private String district; // Quận/huyện

    @Size(max = 100, message = "Tỉnh/thành phố không được vượt quá 100 ký tự")
    private String province; // Tỉnh/thành phố

    @Size(max = 200, message = "Vị trí chính xác không được vượt quá 200 ký tự")
    private String specificLocation; // Vị trí chính xác (khu phố, tầng lầu, số nhà, etc.)

    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(regexp = "^0\\d{9,10}$", message = "Số điện thoại không hợp lệ (10-11 số, bắt đầu bằng 0)")
    private String phone;

    @Email(message = "Email không hợp lệ")
    @Size(max = 100, message = "Email không được vượt quá 100 ký tự")
    private String email;

    private Map<String, OperatingHours> operatingHours;

    private BigDecimal latitude;

    private BigDecimal longitude;

    private String logo; // URL to clinic logo
}

