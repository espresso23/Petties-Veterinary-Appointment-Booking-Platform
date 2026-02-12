import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StaffShiftResponse } from '../../../types/staffshift'
import type { StaffMember } from '../../../types/clinicStaff'
import {
    generateTimeSlots,
    getSlotEnd,
    getSlotCellStatus,
} from './shiftTableUtils'

const DAYS_VN = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN']

const EDGE_SCROLL_THRESHOLD = 48
const EDGE_SCROLL_SPEED = 5

const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const formatDisplayDateWithYear = (date: Date) => {
    const day = date.getDate()
    const month = date.getMonth() + 1
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
}

export interface ShiftTableGridViewProps {
    staffMembers: StaffMember[]
    dayViewShifts: StaffShiftResponse[]
    selectedDay: Date
    loading: boolean
    slotStart: string
    slotEnd: string
    onSlotStartChange: (v: string) => void
    onSlotEndChange: (v: string) => void
    onDayPrev: () => void
    onDayNext: () => void
    selectedShift: StaffShiftResponse | null
    /** staffId đang được chọn trong form gán lịch (để đồng bộ highlight) */
    formStaffId?: string | null
    onRowClick: (staffId: string, staffShift: StaffShiftResponse | undefined, dateStr: string) => void
    /** Khi user chọn khung giờ (click hoặc kéo thả) để gán lịch */
    onTimeRangeSelect: (staffId: string, dateStr: string, startTime: string, endTime: string) => void
}

export const ShiftTableGridView = ({
    staffMembers,
    dayViewShifts,
    selectedDay,
    loading,
    slotStart,
    slotEnd,
    onSlotStartChange,
    onSlotEndChange,
    onDayPrev,
    onDayNext,
    selectedShift,
    formStaffId,
    onRowClick,
    onTimeRangeSelect,
}: ShiftTableGridViewProps) => {
    const navigate = useNavigate()
    const slots = slotStart < slotEnd ? generateTimeSlots(slotStart, slotEnd) : generateTimeSlots('08:00', '17:00')
    const dateStr = formatDate(selectedDay)
    const isPast = selectedDay < new Date(new Date().setHours(0, 0, 0, 0))

    // Chọn khung giờ để gán lịch (click + kéo thả) - chỉ trên ô OFF (trống)
    const [selectingStaffId, setSelectingStaffId] = useState<string | null>(null)
    const [selectStartIdx, setSelectStartIdx] = useState<number | null>(null)
    const [selectEndIdx, setSelectEndIdx] = useState<number | null>(null)
    /** Giữ trạng thái chọn sau khi kéo xong để nhìn trực quan */
    const [committedSelection, setCommittedSelection] = useState<{
        staffId: string
        startIdx: number
        endIdx: number
    } | null>(null)
    const dragRef = useRef({ isSelecting: false, staffId: '', startIdx: -1 })
    const selectEndIdxRef = useRef<number | null>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const edgeScrollRafRef = useRef<number | null>(null)

    const isSlotInSelection = useCallback(
        (staffId: string, slotIdx: number): boolean => {
            if (selectingStaffId !== staffId || selectStartIdx == null || selectEndIdx == null) return false
            const lo = Math.min(selectStartIdx, selectEndIdx)
            const hi = Math.max(selectStartIdx, selectEndIdx)
            return slotIdx >= lo && slotIdx <= hi
        },
        [selectingStaffId, selectStartIdx, selectEndIdx]
    )

    const isSlotInCommittedSelection = useCallback(
        (staffId: string, slotIdx: number): boolean => {
            if (!committedSelection || committedSelection.staffId !== staffId) return false
            const lo = Math.min(committedSelection.startIdx, committedSelection.endIdx)
            const hi = Math.max(committedSelection.startIdx, committedSelection.endIdx)
            return slotIdx >= lo && slotIdx <= hi
        },
        [committedSelection]
    )

    const handleSlotMouseDown = (staffId: string, slotIdx: number, status: string) => {
        if (status !== 'OFF' || isPast) return
        setCommittedSelection(null) // Xóa selection cũ khi bắt đầu chọn mới
        dragRef.current = { isSelecting: true, staffId, startIdx: slotIdx }
        selectEndIdxRef.current = slotIdx
        setSelectingStaffId(staffId)
        setSelectStartIdx(slotIdx)
        setSelectEndIdx(slotIdx)
    }

    const handleSlotMouseEnter = (staffId: string, slotIdx: number, status: string) => {
        if (status !== 'OFF' || isPast) return
        if (!dragRef.current.isSelecting || dragRef.current.staffId !== staffId) return
        selectEndIdxRef.current = slotIdx
        setSelectEndIdx(slotIdx)
    }

    selectEndIdxRef.current = selectEndIdx

    const commitSelection = useCallback(() => {
        if (!dragRef.current.isSelecting || !dragRef.current.staffId) return
        const startIdx = dragRef.current.startIdx
        const endIdx = selectEndIdxRef.current ?? startIdx
        const lo = Math.min(startIdx, endIdx)
        const hi = Math.max(startIdx, endIdx)
        const startTime = slots[lo]
        const endTime = getSlotEnd(slots[hi])
        onTimeRangeSelect(dragRef.current.staffId, dateStr, startTime, endTime)
        setCommittedSelection({ staffId: dragRef.current.staffId, startIdx: lo, endIdx: hi })
        dragRef.current = { isSelecting: false, staffId: '', startIdx: -1 }
        setSelectingStaffId(null)
        setSelectStartIdx(null)
        setSelectEndIdx(null)
    }, [slots, dateStr, onTimeRangeSelect])

    useEffect(() => {
        setCommittedSelection(null) // Xóa khi đổi ngày
    }, [selectedDay.toDateString()])

    useEffect(() => {
        if (formStaffId != null && committedSelection && formStaffId !== committedSelection.staffId) {
            setCommittedSelection(null)
        }
    }, [formStaffId, committedSelection])

    const handleSlotMouseUp = useCallback(() => {
        if (dragRef.current.isSelecting) commitSelection()
    }, [commitSelection])

    useEffect(() => {
        const onMouseUp = () => {
            if (dragRef.current.isSelecting) commitSelection()
        }
        window.addEventListener('mouseup', onMouseUp)
        return () => window.removeEventListener('mouseup', onMouseUp)
    }, [commitSelection])

    // Auto-scroll khi kéo chuột gần mép vùng hiển thị (requestAnimationFrame cho smooth)
    useEffect(() => {
        const stopEdgeScroll = () => {
            if (edgeScrollRafRef.current != null) {
                cancelAnimationFrame(edgeScrollRafRef.current)
                edgeScrollRafRef.current = null
            }
        }

        if (!selectingStaffId) {
            stopEdgeScroll()
            return
        }

        const handleMouseMove = (e: MouseEvent) => {
            if (!scrollContainerRef.current || !dragRef.current.isSelecting) return
            const el = scrollContainerRef.current
            const rect = el.getBoundingClientRect()

            stopEdgeScroll()

            let scrollX = 0
            let scrollY = 0

            if (e.clientY - rect.top < EDGE_SCROLL_THRESHOLD) scrollY = -EDGE_SCROLL_SPEED
            else if (rect.bottom - e.clientY < EDGE_SCROLL_THRESHOLD) scrollY = EDGE_SCROLL_SPEED

            if (e.clientX - rect.left < EDGE_SCROLL_THRESHOLD) scrollX = -EDGE_SCROLL_SPEED
            else if (rect.right - e.clientX < EDGE_SCROLL_THRESHOLD) scrollX = EDGE_SCROLL_SPEED

            if (scrollX !== 0 || scrollY !== 0) {
                const tick = () => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollBy(scrollX, scrollY)
                    }
                    edgeScrollRafRef.current = requestAnimationFrame(tick)
                }
                edgeScrollRafRef.current = requestAnimationFrame(tick)
            }
        }

        document.addEventListener('mousemove', handleMouseMove)
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            stopEdgeScroll()
        }
    }, [selectingStaffId])

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Day + Time Range Config */}
            <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-amber-50 rounded-xl border-2 border-amber-200">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onDayPrev}
                        className="w-8 h-8 flex items-center justify-center border-2 border-stone-900 rounded-lg hover:bg-amber-100 bg-white"
                    >
                        ←
                    </button>
                    <div className="min-w-[140px] text-center">
                        <div className="text-lg font-bold text-stone-900">{formatDisplayDateWithYear(selectedDay)}</div>
                        <div className="text-xs text-stone-500">
                            {DAYS_VN[selectedDay.getDay() === 0 ? 6 : selectedDay.getDay() - 1]}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onDayNext}
                        className="w-8 h-8 flex items-center justify-center border-2 border-stone-900 rounded-lg hover:bg-amber-100 bg-white"
                    >
                        →
                    </button>
                </div>
                <div className="h-8 w-px bg-stone-300" />
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-stone-500 uppercase">Khung giờ hiển thị</span>
                    <div className="flex items-center gap-2">
                        <input
                            type="time"
                            value={slotStart}
                            onChange={(e) => onSlotStartChange(e.target.value)}
                            className="w-24 p-2 bg-white border-2 border-stone-200 rounded-lg font-bold text-sm focus:border-stone-900 focus:outline-none"
                        />
                        <span className="text-stone-400 font-bold">–</span>
                        <input
                            type="time"
                            value={slotEnd}
                            onChange={(e) => onSlotEndChange(e.target.value)}
                            className="w-24 p-2 bg-white border-2 border-stone-200 rounded-lg font-bold text-sm focus:border-stone-900 focus:outline-none"
                        />
                    </div>
                    {slotStart >= slotEnd && (
                        <span className="text-xs text-red-600 font-bold">Giờ kết thúc phải sau giờ bắt đầu</span>
                    )}
                </div>
                {!isPast && (
                    <span className="text-xs text-amber-700 font-bold">
                        Click hoặc kéo thả trên ô trống để chọn khung giờ gán lịch
                    </span>
                )}
            </div>

            {/* Table */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-auto border-2 border-stone-200 rounded-xl scroll-smooth"
            >
                {loading ? (
                    <div className="h-40 flex items-center justify-center flex-col gap-3 text-stone-400 font-bold italic">
                        <div className="w-8 h-8 border-4 border-stone-200 border-t-amber-500 rounded-full animate-spin" />
                        Đang tải dữ liệu...
                    </div>
                ) : (
                    <table className="w-full border-collapse min-w-max">
                        <thead>
                            <tr>
                                <th className="sticky left-0 z-20 bg-stone-900 text-white p-3 text-left font-bold border-stone-900 min-w-[160px]">
                                    Nhân viên
                                </th>
                                {slots.map((slot) => (
                                    <th
                                        key={slot}
                                        className="bg-stone-100 p-2 text-center text-xs font-bold text-stone-700 border-b-2 border-r border-stone-200 min-w-[64px]"
                                    >
                                        {slot}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {staffMembers.map((staff) => {
                                const staffShift = dayViewShifts.find(
                                    (s) => s.staffId === staff.userId && !s.isContinuation
                                )
                                return (
                                    <tr
                                        key={staff.userId}
                                        className={`border-b border-stone-200 hover:bg-stone-50/50 cursor-pointer ${
                                            selectedShift?.shiftId === staffShift?.shiftId ? 'bg-amber-50' : ''
                                        }`}
                                        onClick={() => onRowClick(staff.userId, staffShift, dateStr)}
                                    >
                                        <td className="sticky left-0 z-10 bg-white border-r-2 border-stone-200 p-3 font-bold text-stone-900 min-w-[160px]">
                                            <div className="flex items-center gap-3">
                                                {staff.avatar ? (
                                                    <img
                                                        src={staff.avatar}
                                                        alt=""
                                                        className="w-8 h-8 rounded-full border-2 border-stone-900 object-cover shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full border-2 border-stone-900 bg-amber-100 flex items-center justify-center font-bold text-amber-600 text-sm shrink-0">
                                                        {staff.fullName?.charAt(0) || '?'}
                                                    </div>
                                                )}
                                                <span className="truncate">{staff.fullName}</span>
                                            </div>
                                        </td>
                                        {slots.map((slot, slotIdx) => {
                                            const slotEndTime = getSlotEnd(slot)
                                            const { status, mergedSlot } = getSlotCellStatus(
                                                staffShift,
                                                slot,
                                                slotEndTime
                                            )
                                            const isActiveSelect = isSlotInSelection(staff.userId, slotIdx)
                                            const isCommittedSelect = isSlotInCommittedSelection(staff.userId, slotIdx)
                                            const canSelect = status === 'OFF' && !isPast
                                            const cellClass =
                                                isActiveSelect && canSelect
                                                    ? 'bg-amber-100 border-amber-300 border-2'
                                                    : isCommittedSelect && canSelect
                                                      ? 'bg-amber-50 border-amber-200'
                                                      : status === 'OFF'
                                                        ? isPast
                                                            ? 'bg-stone-50'
                                                            : 'bg-white hover:bg-amber-50 cursor-cell'
                                                        : status === 'BREAK'
                                                          ? 'bg-stone-200'
                                                          : status === 'AVAILABLE'
                                                            ? isPast
                                                                ? 'bg-stone-100'
                                                                : 'bg-green-100 border-green-200'
                                                            : status === 'BOOKED'
                                                              ? 'bg-amber-100 border-amber-300 cursor-pointer'
                                                              : 'bg-red-100 border-red-200'
                                            return (
                                                <td
                                                    key={slot}
                                                    className={`p-1 border-r border-b border-stone-200 align-middle text-center transition-colors select-none ${cellClass}`}
                                                    title={
                                                        status === 'BOOKED' && mergedSlot
                                                            ? `${mergedSlot.petName || 'Đã đặt'} ${mergedSlot.serviceName || ''}`
                                                            : status === 'BREAK'
                                                              ? 'Giờ nghỉ'
                                                              : status === 'AVAILABLE'
                                                                ? 'Trống'
                                                                : status === 'BLOCKED'
                                                                  ? 'Đã khóa'
                                                                  : canSelect
                                                                    ? 'Click hoặc kéo để chọn khung giờ gán lịch'
                                                                    : ''
                                                    }
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation()
                                                        handleSlotMouseDown(staff.userId, slotIdx, status)
                                                    }}
                                                    onMouseEnter={() =>
                                                        handleSlotMouseEnter(staff.userId, slotIdx, status)
                                                    }
                                                    onMouseUp={(e) => {
                                                        e.stopPropagation()
                                                        if (canSelect) handleSlotMouseUp()
                                                    }}
                                                    onClick={(e) => {
                                                        if (status === 'BOOKED' && mergedSlot?.bookingId) {
                                                            e.stopPropagation()
                                                            navigate(
                                                                `/clinic-manager/bookings?bookingId=${mergedSlot.bookingId}`
                                                            )
                                                        } else if (canSelect) {
                                                            e.stopPropagation() // Tránh row click khi chọn khung giờ
                                                        }
                                                    }}
                                                >
                                                    {status === 'BOOKED' && mergedSlot && (
                                                        <div
                                                            className="text-[10px] font-bold text-amber-800 truncate px-1"
                                                            title={mergedSlot.petName || mergedSlot.serviceName}
                                                        >
                                                            {mergedSlot.petName || mergedSlot.serviceName || 'Đặt'}
                                                        </div>
                                                    )}
                                                    {status === 'BREAK' && (
                                                        <div className="text-stone-400 text-xs">—</div>
                                                    )}
                                                    {status === 'AVAILABLE' && !isPast && (
                                                        <div className="text-green-600 text-xs font-bold">○</div>
                                                    )}
                                                    {status === 'BLOCKED' && (
                                                        <div className="text-red-500 text-xs font-bold">⊘</div>
                                                    )}
                                                    {isActiveSelect && canSelect && (
                                                        <div className="text-amber-600 text-xs font-bold">✓</div>
                                                    )}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-bold">
                <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-white border-2 border-stone-200" /> Trống (chọn để gán)
                </span>
                <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-amber-100 border-2 border-amber-300" /> Đang kéo
                </span>
                <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-amber-50 border border-amber-200" /> Đã chọn
                </span>
                <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-green-100 border border-green-200" /> Có ca - trống
                </span>
                <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-amber-100 border border-amber-300" /> Đã đặt
                </span>
                <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-red-100 border border-red-200" /> Đã khóa
                </span>
                <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-stone-200" /> Giờ nghỉ
                </span>
            </div>
        </div>
    )
}
