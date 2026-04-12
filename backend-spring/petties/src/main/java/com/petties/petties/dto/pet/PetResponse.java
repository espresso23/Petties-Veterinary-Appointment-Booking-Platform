package com.petties.petties.dto.pet;

import com.petties.petties.model.enums.PetSpecies;
import lombok.Data;
import java.util.UUID;

@Data
public class PetResponse {
    private UUID id;
    private String name;
    private PetSpecies species;
    private String breed;
    private java.time.LocalDate dateOfBirth;
    private double weight;
    private String gender;
    private String color;
    private String allergies;
    private String imageUrl;
    private String ownerName;
    private String ownerPhone;
}
