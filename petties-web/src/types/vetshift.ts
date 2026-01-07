export type SlotStatus = 'AVAILABLE' | 'BOOKED' | 'BLOCKED';

export interface SlotResponse {
    slotId: string;
    startTime: string; // HH:mm format
    endTime: string;
    status: SlotStatus;
    // Booking info (only populated when status is BOOKED)
    bookingId?: string;
    petName?: string;
    petOwnerName?: string;
    serviceName?: string;
}

export interface VetShiftResponse {
    shiftId: string;
    vetId: string;
    vetName: string;
    vetAvatar: string | null;
    clinicId: string;
    workDate: string; // YYYY-MM-DD
    startTime: string;
    endTime: string;
    breakStart: string | null;
    breakEnd: string | null;
    isOvernight: boolean;
    isContinuation: boolean;  // true if this is the "next day" portion of overnight shift
    displayDate: string;      // The date this entry is shown on (may differ from workDate)
    notes: string | null;
    createdAt: string;
    totalSlots: number;
    availableSlots: number;
    bookedSlots: number;
    blockedSlots: number;
    slots: SlotResponse[] | null;
}

export interface VetShiftRequest {
    vetId: string;
    workDates: string[]; // Array of YYYY-MM-DD
    startTime: string;
    endTime: string;
    repeatWeeks?: number;
    breakStart?: string;
    breakEnd?: string;
    isOvernight?: boolean;
    forceUpdate?: boolean; // If true, delete existing shifts and create new ones
    notes?: string;
}
