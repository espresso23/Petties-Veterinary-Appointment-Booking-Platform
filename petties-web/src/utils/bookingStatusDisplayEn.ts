import type { BookingStatus } from '../types/booking'

/** English labels for booking status (dashboard / EN UI) */
export const BOOKING_STATUS_LABEL_EN: Record<BookingStatus, string> = {
    PENDING: 'Pending',
    SEARCHING: 'Searching',
    PENDING_CLINIC_CONFIRM: 'Awaiting clinic',
    CONFIRMED: 'Confirmed',
    IN_PROGRESS: 'In progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    NO_SHOW: 'No-show',
}

export function bookingStatusLabelEn(status: string): string {
    return BOOKING_STATUS_LABEL_EN[status as BookingStatus] ?? status
}
