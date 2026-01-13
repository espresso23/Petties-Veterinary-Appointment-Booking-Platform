package com.petties.petties.dto.pet;

import jakarta.validation.constraints.DecimalMin;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PetRequest {
    @NotBlank(message = "Tên thú cưng không được để trống")
    private String name;

    @NotBlank(message = "Loài không được để trống")
    private String species;

    @NotBlank(message = "Giống không được để trống")
    private String breed;

    @jakarta.validation.constraints.NotNull(message = "Ngày sinh không được để trống")
    @jakarta.validation.constraints.PastOrPresent(message = "Ngày sinh không hợp lệ")
    @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
    private java.time.LocalDate dateOfBirth;

    @DecimalMin(value = "0.1", message = "Cân nặng phải lớn hơn 0")
    private double weight;

    @NotBlank(message = "Giới tính không được để trống")
    private String gender;

    private String color; // Optional for backward compatibility with existing clients

    private String allergies; // Optional - null if no allergies
}
