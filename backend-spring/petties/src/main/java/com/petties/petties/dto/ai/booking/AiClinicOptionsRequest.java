package com.petties.petties.dto.ai.booking;

import com.petties.petties.model.enums.BookingType;
import com.petties.petties.model.enums.PetSpecies;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiClinicOptionsRequest {
    private String transcript;
    private String latestMessage;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String address;
    private UUID petId;
    private String petHint;
    private PetSpecies petSpecies;
    private UUID clinicId;
    private String clinicHint;
    private String serviceHint;
    private BookingType bookingType;
    private Double radiusKm;
    private Integer topK;
}
