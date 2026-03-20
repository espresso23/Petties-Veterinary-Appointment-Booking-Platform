package com.petties.petties.dto.ai.booking;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class AiCreateBookingRequest extends AiBookingDraftRequest {
    private Boolean confirmed;
}
