import type { StaffShiftResponse, SlotResponse } from '../../../types/staffshift'

export type SlotCellStatus = 'OFF' | 'BREAK' | 'AVAILABLE' | 'BOOKED' | 'BLOCKED'

export interface MergedSlot {
    id: string
    startTime: string
    endTime: string
    status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED'
    petName?: string
    petOwnerName?: string
    bookingId?: string
    serviceName?: string
    span: number
}

/** Generate time slots between start and end (inclusive), 30-min intervals */
export const generateTimeSlots = (start: string, end: string): string[] => {
    const slots: string[] = []
    const [sH, sM] = start.split(':').map(Number)
    const [eH, eM] = end.split(':').map(Number)
    let minutes = sH * 60 + sM
    const endMinutes = eH * 60 + eM
    while (minutes <= endMinutes) {
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
        minutes += 30
    }
    return slots
}

/** Get slot end time (slot + 30min) */
export const getSlotEnd = (slot: string): string => {
    const slotEndMin = parseInt(slot.slice(0, 2)) * 60 + parseInt(slot.slice(3, 5)) + 30
    return `${String(Math.floor(slotEndMin / 60)).padStart(2, '0')}:${String(slotEndMin % 60).padStart(2, '0')}`
}

/** Check if time t is within [start, end) */
export const isTimeInRange = (t: string, start: string, end: string): boolean => {
    const [th, tm] = t.split(':').map(Number)
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const tMin = th * 60 + tm
    const sMin = sh * 60 + sm
    const eMin = eh * 60 + em
    return tMin >= sMin && tMin < eMin
}

/** Normalize time string to HH:mm (API may return HH:mm:ss) */
const normalizeTime = (t: string): string => t.length > 5 ? t.slice(0, 5) : t

export const mergeSlots = (slots: SlotResponse[] | null): MergedSlot[] => {
    if (!slots || slots.length === 0) return []

    const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime))
    const merged: MergedSlot[] = []
    let current: MergedSlot | null = null

    sorted.forEach((slot) => {
        const shouldMerge = current &&
            slot.status === 'BOOKED' &&
            current.status === 'BOOKED' &&
            current.bookingId === slot.bookingId

        if (shouldMerge && current) {
            current.endTime = slot.endTime
            current.span += 1
        } else {
            current = {
                id: slot.slotId,
                startTime: slot.startTime,
                endTime: slot.endTime,
                status: slot.status as MergedSlot['status'],
                petName: slot.petName,
                petOwnerName: slot.petOwnerName,
                bookingId: slot.bookingId,
                serviceName: slot.serviceName,
                span: 1,
            }
            merged.push(current)
        }
    })

    return merged
}

export const getSlotCellStatus = (
    staffShift: StaffShiftResponse | undefined,
    timeSlot: string,
    slotEnd: string
): { status: SlotCellStatus; mergedSlot?: MergedSlot } => {
    if (!staffShift || staffShift.isContinuation) {
        return { status: 'OFF' }
    }

    const startTime = normalizeTime(staffShift.startTime)
    const endTime = normalizeTime(staffShift.endTime)
    const breakStart = staffShift.breakStart ? normalizeTime(staffShift.breakStart) : null
    const breakEnd = staffShift.breakEnd ? normalizeTime(staffShift.breakEnd) : null

    // Kiểm tra giờ nghỉ TRƯỚC (kể cả khi slots = null từ API list)
    if (breakStart && breakEnd && isTimeInRange(timeSlot, breakStart, breakEnd)) {
        return { status: 'BREAK' }
    }

    const slots = staffShift.slots
    if (!slots || slots.length === 0) {
        // Slots chưa load - dùng startTime/endTime: nếu trong ca làm việc thì không cho chọn (tránh chọn nhầm giờ nghỉ)
        if (isTimeInRange(timeSlot, startTime, endTime)) {
            return { status: 'AVAILABLE' }
        }
        return { status: 'OFF' }
    }

    const merged = mergeSlots(slots)
    for (const m of merged) {
        const slotStartMin = parseInt(m.startTime.slice(0, 2)) * 60 + parseInt(m.startTime.slice(3, 5))
        const slotEndMin = parseInt(m.endTime.slice(0, 2)) * 60 + parseInt(m.endTime.slice(3, 5))
        const cellStartMin = parseInt(timeSlot.slice(0, 2)) * 60 + parseInt(timeSlot.slice(3, 5))
        const cellEndMin = parseInt(slotEnd.slice(0, 2)) * 60 + parseInt(slotEnd.slice(3, 5))
        if (cellStartMin < slotEndMin && cellEndMin > slotStartMin) {
            return { status: m.status as SlotCellStatus, mergedSlot: m }
        }
    }
    return { status: 'OFF' }
}
