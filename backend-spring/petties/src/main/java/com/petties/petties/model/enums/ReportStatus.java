package com.petties.petties.model.enums;

public enum ReportStatus {
    PENDING,
    APPROVED,
    REJECTED,
    /** Reporter withdrew the report before admin resolution */
    WITHDRAWN
}
