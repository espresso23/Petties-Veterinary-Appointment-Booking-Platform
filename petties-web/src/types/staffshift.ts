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
    // Service details (populated from BookingServiceItem)
    bookingServiceId?: string;
    serviceCategory?: string;
}

export interface StaffShiftResponse {
    shiftId: string;
    staffId: string;
    staffName: string;
    staffAvatar: string | null;
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

export interface StaffShiftRequest {
    staffId: string;
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
