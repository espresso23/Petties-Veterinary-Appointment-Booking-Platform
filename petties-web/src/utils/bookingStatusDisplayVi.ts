import type { BookingStatus } from '../types/booking'

/** Nhãn trạng thái lịch hẹn — giao diện tiếng Việt */
export const BOOKING_STATUS_LABEL_VI: Record<BookingStatus, string> = {
    PENDING: 'Chờ xử lý',
    SEARCHING: 'Đang tìm',
    PENDING_CLINIC_CONFIRM: 'Chờ phòng khám',
    CONFIRMED: 'Đã xác nhận',
    IN_PROGRESS: 'Đang khám',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    NO_SHOW: 'Không đến',
}

export function bookingStatusLabelVi(status: string): string {
    return BOOKING_STATUS_LABEL_VI[status as BookingStatus] ?? status
}
