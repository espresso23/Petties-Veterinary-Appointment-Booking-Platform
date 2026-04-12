package com.petties.petties.dto.emr;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseMemoryResyncResponse {
    private boolean success;
    private int totalEligible;
    private int processedCount;
    private int syncedCount;
    private int failedCount;
    private String message;
}
