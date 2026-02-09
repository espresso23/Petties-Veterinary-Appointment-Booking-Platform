package com.petties.petties.dto.booking;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO for creating a pet on-the-fly during proxy booking.
 * Used when booking for someone who doesn't have the pet registered yet.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProxyPetInfo {

    @NotBlank(message = "Tên thú cưng không được để trống")
    private String name;

    /**
     * Species: DOG, CAT, etc.
     */
    private String species;

    private String breed;

    /**
     * Gender: MALE, FEMALE
     */
    private String gender;

    private LocalDate dateOfBirth;

    /**
     * Weight in kilograms
     */
    private BigDecimal weight;
}
