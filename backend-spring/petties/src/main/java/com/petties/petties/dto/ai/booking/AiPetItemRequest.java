package com.petties.petties.dto.ai.booking;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * One pet item for multi-pet booking in AI context.
 * Supports both explicit petId (resolved) and petHint (for LLM resolution).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiPetItemRequest {

    /**
     * Resolved pet ID. If null, AI will resolve from petHint.
     */
    private UUID petId;

    /**
     * Pet hint for AI to resolve (e.g., "bé mèo", "pet đen", "con mèo đầu tiên").
     * Used when petId is null.
     */
    private String petHint;

    /**
     * Service IDs for this pet. Required.
     */
    @NotEmpty(message = "Vui long chon it nhat mot dich vu cho thu cung")
    private List<UUID> serviceIds;
}
