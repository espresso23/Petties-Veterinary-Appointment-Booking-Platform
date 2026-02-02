package com.petties.petties.dto.pet;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO for Staff's patient list view
 * Used by STAFF role to see their assigned patients
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffPatientDTO {
    private UUID petId;
    private String petName;
    private String species;
    private String breed;
    private String gender;
    private int ageYears; // Calculated
    private int ageMonths; // Calculated

    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate dob;

    private Double weight;
    private String color;
    private String imageUrl;
    private String allergies;

    // Owner Info
    private String ownerName;
    private String ownerPhone;

    // Priority Info
    private boolean isAssignedToMe; // Is there an active booking with ME?

    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime nextAppointment; // Nearest future booking

    private String bookingStatus; // CONFIRMED, CHECK_IN, IN_PROGRESS etc.
    private UUID bookingId; // Current/Next booking ID
    private String bookingCode; // Current/Next booking code

    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime lastVisitDate; // Most recent past booking
}
