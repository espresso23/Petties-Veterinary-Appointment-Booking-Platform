package com.petties.petties.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO cho request yeu cau thay doi email.
 * User se nhap email moi, he thong gui OTP den email moi de xac nhan.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailChangeRequest {

    @NotBlank(message = "Email moi khong duoc de trong")
    @Email(message = "Email khong hop le")
    private String newEmail;
}
