package com.petties.petties.dto.clinic;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * DTO cho request approve clinic
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ApproveClinicRequest {

    @Size(max = 500, message = "Lý do không được quá 500 ký tự")
    private String reason; // Optional reason for approval
}

