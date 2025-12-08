package com.petties.petties.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.UUID;

@Entity
@DiscriminatorValue("VET")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Vet extends User {

    @Column(name = "clinic_id")
    private UUID clinicId;
    
    @Column(name = "specialty", length = 200)
    private String specialty;

    @Column(name = "rating")
    private Double rating;
}

