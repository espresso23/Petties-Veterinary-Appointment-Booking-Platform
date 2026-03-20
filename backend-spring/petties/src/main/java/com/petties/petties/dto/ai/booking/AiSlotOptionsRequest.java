package com.petties.petties.dto.ai.booking;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.petties.petties.model.enums.BookingType;
import com.petties.petties.model.enums.PetSpecies;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSlotOptionsRequest {
    @NotNull(message = "Ma phong kham khong duoc de trong")
    private UUID clinicId;

    @NotNull(message = "Ngay dat lich khong duoc de trong")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate bookingDate;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime exactTime;

    private String timePreference;
    private List<UUID> serviceIds;
    private UUID petId;
    private String petHint;
    private PetSpecies petSpecies;
    private BookingType bookingType;
    private String serviceHint;
    private Integer limit;
    private String transcript;
    private String latestMessage;
}