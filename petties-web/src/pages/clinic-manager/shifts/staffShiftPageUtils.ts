import type { ClinicResponse } from '../../../types/clinic'

// --- Date helpers ---
export const formatDate = (date: Date): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

export const formatDisplayDate = (date: Date): string => {
    return `${date.getDate()}/${date.getMonth() + 1}`
}

export const formatDisplayDateWithYear = (date: Date): string => {
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
}

export const formatWeekRange = (start: Date, end: Date): string => {
    if (start.getFullYear() !== end.getFullYear()) {
        return `${formatDisplayDateWithYear(start)} - ${formatDisplayDateWithYear(end)}`
    }
    return `${formatDisplayDate(start)} - ${formatDisplayDate(end)}/${end.getFullYear()}`
}

/** Get Monday to Sunday of the week containing date */
export const getWeekDates = (date: Date): Date[] => {
    const clone = new Date(date)
    const day = clone.getDay()
    const diff = clone.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(clone.setDate(diff))
    const dates: Date[] = []
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        dates.push(d)
    }
    return dates
}

// --- Constants ---
export const DAYS_VN = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN']

/** Map JS getDay() (0=Sun..6=Sat) to backend DayOfWeek */
export const DAY_OF_WEEK_KEYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

// --- Clinic break (default lunch break by day) ---
function timeFromHours(value: string | { hour?: number; minute?: number } | undefined): string {
    if (value == null) return '00:00'
    if (typeof value === 'string') return value.substring(0, 5)
    const h = (value as { hour?: number }).hour ?? 0
    const m = (value as { minute?: number }).minute ?? 0
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function getDefaultBreakForDate(
    clinic: ClinicResponse | null,
    date: Date
): { breakStart: string; breakEnd: string } | null {
    if (!clinic?.operatingHours) return null
    const key = DAY_OF_WEEK_KEYS[date.getDay()]
    const hours = clinic.operatingHours[key]
    if (!hours?.breakStart || !hours?.breakEnd || hours.isClosed) return null
    return {
        breakStart: timeFromHours(hours.breakStart),
        breakEnd: timeFromHours(hours.breakEnd),
    }
}

// --- Time overlap (used for conflict check) ---
export function timesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string,
    isOvernight1: boolean,
    isOvernight2: boolean
): boolean {
    const toMin = (t: string) => {
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
    }
    let s1 = toMin(start1)
    let e1 = toMin(end1)
    let s2 = toMin(start2)
    let e2 = toMin(end2)
    if (isOvernight1 || e1 < s1) e1 += 24 * 60
    if (isOvernight2 || e2 < s2) e2 += 24 * 60
    return s1 < e2 && s2 < e1
}

export type ConflictItem = { date: string; existingShift: string; newShift: string }
