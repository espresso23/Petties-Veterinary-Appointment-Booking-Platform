package com.petties.petties.model.enums;

/**
 * Status of a time Slot
 */
public enum SlotStatus {
    AVAILABLE, // Open for booking
    BOOKED, // Already booked by a customer
    BLOCKED // Manually blocked by Vet/Manager
}
