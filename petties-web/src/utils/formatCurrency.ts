/**
 * Định dạng tiền VND cho UI (không dùng ký hiệu tiền tệ ISO để tránh lệch hiển thị).
 */
export function formatVnd(amount: number | undefined | null): string {
    if (amount === undefined || amount === null || Number.isNaN(amount)) {
        return '—'
    }
    return `${new Intl.NumberFormat('vi-VN').format(Math.round(amount))} đ`
}

/** VND with English locale (dashboard EN copy) */
export function formatVndEn(amount: number | undefined | null): string {
    if (amount === undefined || amount === null || Number.isNaN(amount)) {
        return '—'
    }
    return `${new Intl.NumberFormat('en-US').format(Math.round(amount))} VND`
}
