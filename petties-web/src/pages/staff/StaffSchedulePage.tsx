import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { staffShiftService } from '../../services/api/staffShiftService'
import type { StaffShiftResponse, SlotResponse } from '../../types/staffshift'
import { useToast } from '../../components/Toast'
import { CalendarPicker } from '../../components/CalendarPicker'
import {
    CalendarIcon,
    MoonIcon,
    ArrowRightIcon,
    LockClosedIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ClockIcon
} from '@heroicons/react/24/outline'
import { useSseNotification } from '../../hooks/useSseNotification'
import '../../styles/brutalist.css'
import { format } from 'date-fns'
import { vi as viLocale } from 'date-fns/locale'

// Helper to get week dates
const getWeekDates = (date: Date) => {
    const clone = new Date(date)
    const day = clone.getDay()
    const diff = clone.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(clone.setDate(diff))
    const dates = []
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        dates.push(d)
    }
    return dates
}

const formatDate = (date: Date) => date.toISOString().split('T')[0]
const formatDisplayDate = (date: Date) => {
    const day = date.getDate()
    const month = date.getMonth() + 1
    return `${day}/${month}`
}
const formatDisplayDateWithYear = (date: Date) => {
    const day = date.getDate()
    const month = date.getMonth() + 1
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
}
const formatWeekRange = (startDate: Date, endDate: Date) => {
    const startYear = startDate.getFullYear()
    const endYear = endDate.getFullYear()
    if (startYear !== endYear) {
        return `${formatDisplayDateWithYear(startDate)} - ${formatDisplayDateWithYear(endDate)}`
    }
    return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}/${endYear}`
}

const DAYS_VN = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN']

export interface MergedSlot {
    id: string;
    startTime: string;
    endTime: string;
    status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED';
    petName?: string;
    petOwnerName?: string;
    bookingId?: string;
    serviceName?: string;
    span: number; // Number of original 30-min slots
}

const mergeSlots = (slots: SlotResponse[] | null): MergedSlot[] => {
    if (!slots || slots.length === 0) return [];

    const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const merged: MergedSlot[] = [];
    let current: MergedSlot | null = null;

    sorted.forEach((slot) => {
        // Only merge BOOKED slots that belong to the same booking
        // AVAILABLE and BLOCKED slots remain as individual 30-min slots
        const shouldMerge = current &&
            slot.status === 'BOOKED' &&
            current.status === 'BOOKED' &&
            current.bookingId === slot.bookingId;

        if (shouldMerge && current) {
            current.endTime = slot.endTime;
            current.span += 1;
        } else {
            current = {
                id: slot.slotId,
                startTime: slot.startTime,
                endTime: slot.endTime,
                status: slot.status as any,
                petName: slot.petName,
                petOwnerName: slot.petOwnerName,
                bookingId: slot.bookingId,
                serviceName: slot.serviceName,
                span: 1
            };
            merged.push(current);
        }
    });

    return merged;
};

/**
 * StaffSchedulePage - Version for Staff to view their own schedule
 */
export const StaffSchedulePage = () => {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const clinicId = user?.workingClinicId
    const staffId = user?.userId
    const { showToast } = useToast()

    const [currentWeek, setCurrentWeek] = useState(new Date())
    const [weekDates, setWeekDates] = useState<Date[]>([])
    const [shifts, setShifts] = useState<StaffShiftResponse[]>([])
    const [loading, setLoading] = useState(false)

    const [selectedShift, setSelectedShift] = useState<StaffShiftResponse | null>(null)
    const [shiftDetail, setShiftDetail] = useState<StaffShiftResponse | null>(null)
    const [loadingSlots, setLoadingSlots] = useState(false)
    const [viewMode, setViewMode] = useState<'week' | 'day' | 'month'>('week')
    const [selectedDay, setSelectedDay] = useState<Date>(new Date())

    useEffect(() => {
        setWeekDates(getWeekDates(new Date(currentWeek)))
    }, [currentWeek.getTime()])

    // Sync selectedDay when switching to Day view
    useEffect(() => {
        if (viewMode === 'day' && weekDates.length > 0) {
            const dayStr = formatDate(selectedDay)
            const weekStart = formatDate(weekDates[0])
            const weekEnd = formatDate(weekDates[6])
            if (dayStr < weekStart || dayStr > weekEnd) {
                setSelectedDay(weekDates[0])
            }
        }
    }, [viewMode, weekDates])

    useEffect(() => {
        if (weekDates.length > 0) fetchShifts()
    }, [weekDates])

    const fetchShifts = useCallback(async () => {
        if (!staffId || weekDates.length === 0) return
        setLoading(true)
        try {
            const startDate = formatDate(weekDates[0])
            const endDate = formatDate(weekDates[6])

            // Sử dụng API lấy lịch riêng của staff
            const data = await staffShiftService.getMyShifts(startDate, endDate)
            setShifts(data)
        } catch (err: any) {
            showToast('error', err.response?.data?.message || err.message || 'Lỗi tải lịch')
        } finally {
            setLoading(false)
        }
    }, [staffId, weekDates, showToast])

    // Subscribe to SSE for real-time booking updates
    useSseNotification({
        onBookingUpdate: (data) => {
            console.log('[StaffSchedulePage] Booking update received:', data)
            showToast('info', `Có cập nhật booking: ${data.bookingCode}`)
            // Refetch shifts to update slot data
            fetchShifts()
        },
        onShiftUpdate: () => {
            console.log('[StaffSchedulePage] Shift update received')
            fetchShifts()
        }
    })

    const handlePrevWeek = () => {
        const prev = new Date(currentWeek)
        prev.setDate(prev.getDate() - 7)
        setCurrentWeek(prev)
    }

    const handleNextWeek = () => {
        const next = new Date(currentWeek)
        next.setDate(next.getDate() + 7)
        setCurrentWeek(next)
    }

    // Fetch shift detail with slots
    useEffect(() => {
        if (!selectedShift) {
            setShiftDetail(null)
            return
        }
        const fetchDetail = async () => {
            setLoadingSlots(true)
            try {
                const detail = await staffShiftService.getShiftDetail(selectedShift.shiftId)
                setShiftDetail(detail)
            } catch (err: any) {
                showToast('error', 'Không thể tải chi tiết slots')
            } finally {
                setLoadingSlots(false)
            }
        }
        fetchDetail()
    }, [selectedShift, showToast])

    const [dayViewShifts, setDayViewShifts] = useState<StaffShiftResponse[]>([])

    // Sync selectedShift when selectedDay changes (for sidebar to show correct shift info)
    useEffect(() => {
        const dayStr = formatDate(selectedDay)
        const shiftForDay = shifts.find(s => (s.displayDate || s.workDate) === dayStr && !s.isContinuation)
        if (shiftForDay) {
            setSelectedShift(shiftForDay)
        } else {
            setSelectedShift(null)
        }
    }, [selectedDay, shifts])

    useEffect(() => {
        if (viewMode !== 'day' || !clinicId) return

        const fetchDayShifts = async () => {
            const dayStr = formatDate(selectedDay)
            const myDayShifts = shifts.filter(s => s.workDate === dayStr && !s.isContinuation)

            const detailPromises = myDayShifts.map(s => staffShiftService.getShiftDetail(s.shiftId))
            try {
                const details = await Promise.all(detailPromises)
                setDayViewShifts(details)
            } catch {
                setDayViewShifts(myDayShifts)
            }
        }

        fetchDayShifts()
    }, [viewMode, selectedDay, shifts, clinicId])

    // Block/Unblock slot đã bị loại bỏ - Staff không có quyền block slot
    // Chỉ Manager mới có thể block/unblock

    return (
        <div className="flex min-h-screen bg-stone-50 text-stone-900 font-sans select-none overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden p-6 gap-6">
                {/* Header */}
                <header className="flex justify-between items-center bg-white p-4 rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,0.1)]">
                    <div className="flex items-center gap-5">
                        <div className="flex items-center gap-4">
                            <div className="bg-amber-400 p-2.5 rounded-xl border-2 border-stone-900 shadow-[3px_3px_0_0_#000] flex-shrink-0">
                                <CalendarIcon className="w-7 h-7 text-stone-900" />
                            </div>

                            <div className="flex flex-col">
                                <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tighter leading-none">
                                    Lịch làm việc
                                </h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Phòng khám:</span>
                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em]">{user?.workingClinicName}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex flex-col items-end text-right">
                            <p className="text-[9px] font-black text-stone-400 uppercase tracking-[0.2em]">Nhân viên phụ trách</p>
                            <p className="text-sm font-black text-stone-900 uppercase tracking-tight">{user?.fullName}</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 bg-white rounded-2xl border-2 border-stone-900 p-5 shadow-[8px_8px_0px_0px_#1c1917] flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex bg-stone-100 rounded-xl p-1 border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917]">
                            <button
                                onClick={() => setViewMode('week')}
                                className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${viewMode === 'week' ? 'bg-amber-600 text-white shadow-[2px_2px_0px_0px_#1c1917]' : 'text-stone-500 hover:text-stone-700'}`}
                            >
                                Tuần
                            </button>
                            <button
                                onClick={() => setViewMode('day')}
                                className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${viewMode === 'day' ? 'bg-amber-600 text-white shadow-[2px_2px_0px_0px_#1c1917]' : 'text-stone-500 hover:text-stone-700'}`}
                            >
                                Ngày
                            </button>
                            <button
                                onClick={() => setViewMode('month')}
                                className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${viewMode === 'month' ? 'bg-amber-600 text-white shadow-[2px_2px_0px_0px_#1c1917]' : 'text-stone-500 hover:text-stone-700'}`}
                            >
                                Tháng
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handlePrevWeek}
                                className="w-10 h-10 flex items-center justify-center border-2 border-stone-900 rounded-xl hover:bg-amber-100 transition-all bg-white shadow-[3px_3px_0px_0px_#1c1917] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                            >
                                <ChevronLeftIcon className="w-5 h-5 stroke-[3]" />
                            </button>
                            <div className="min-w-[200px]">
                                <CalendarPicker
                                    value={currentWeek}
                                    onChange={(date) => {
                                        setCurrentWeek(date)
                                        setSelectedDay(date)
                                        setViewMode('day')
                                    }}
                                    mode="date"
                                    displayFormat={() => weekDates.length > 0 ? formatWeekRange(weekDates[0], weekDates[6]) : ''}
                                />
                            </div>
                            <button
                                onClick={handleNextWeek}
                                className="w-10 h-10 flex items-center justify-center border-2 border-stone-900 rounded-xl hover:bg-amber-100 transition-all bg-white shadow-[3px_3px_0px_0px_#1c1917] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                            >
                                <ChevronRightIcon className="w-5 h-5 stroke-[3]" />
                            </button>
                        </div>
                    </div>

                    {viewMode === 'week' && (
                        <div className="flex flex-col flex-1 overflow-hidden">
                            <div className="grid grid-cols-7 gap-3 mb-3">
                                {weekDates.map((date, i) => (
                                    <div key={i} className={`rounded-xl p-2 text-center border-2 transition-all ${date.toDateString() === new Date().toDateString() ? 'bg-amber-600 border-stone-900 text-white shadow-[3px_3px_0px_0px_#1c1917]' : 'bg-stone-50 border-stone-200 text-stone-500'}`}>
                                        <div className="text-[10px] font-black uppercase mb-1 opacity-80 tracking-widest">{DAYS_VN[i]}</div>
                                        <div className="text-lg font-black tracking-tight">{formatDisplayDate(date)}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex-1 grid grid-cols-7 gap-3 overflow-y-auto pr-2 custom-scrollbar">
                                {loading ? (
                                    <div className="col-span-7 flex items-center justify-center py-20 italic text-stone-400">Đang tải lịch...</div>
                                ) : (
                                    weekDates.map((date, i) => {
                                        const dateStr = formatDate(date)
                                        const dayShift = shifts.find(s => (s.displayDate || s.workDate) === dateStr)
                                        const isPast = date < new Date(new Date().setHours(0, 0, 0, 0))
                                        const isContinuation = dayShift?.isContinuation
                                        const isOvernight = dayShift?.isOvernight && !isContinuation

                                        return (
                                            <div
                                                key={i}
                                                onClick={() => {
                                                    if (dayShift && !isContinuation) {
                                                        setSelectedShift(dayShift)
                                                        setSelectedDay(new Date(dayShift.workDate))
                                                    }
                                                }}
                                                className={`
                                                    rounded-xl border-2 transition-all h-40 p-3 flex flex-col justify-between overflow-hidden
                                                    ${isPast ? 'bg-stone-50 border-stone-200 opacity-40 grayscale cursor-not-allowed' : 'bg-white border-stone-200 hover:border-stone-900'}
                                                    ${dayShift && !isContinuation ? '!bg-white !border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,0.1)] cursor-pointer hover:shadow-[6px_6px_0px_0px_#1c1917] hover:-translate-y-1' : ''}
                                                    ${isContinuation ? '!bg-blue-50 !border-blue-900' : ''}
                                                    ${selectedShift?.shiftId === dayShift?.shiftId && dayShift ? 'ring-4 ring-amber-600/30 !border-amber-600' : ''}
                                                `}
                                            >
                                                {dayShift ? (
                                                    <div className="h-full flex flex-col justify-between">
                                                        <div className="space-y-1">
                                                            {isOvernight && (
                                                                <span className="bg-stone-900 text-white text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 w-fit shadow-[2px_2px_0_0_#4299E1] mb-1">
                                                                    <MoonIcon className="w-3 h-3" /> CA ĐÊM
                                                                </span>
                                                            )}
                                                            {isContinuation && (
                                                                <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 w-fit shadow-[2px_2px_0_0_#1c1917] mb-1">
                                                                    <ArrowRightIcon className="w-2.5 h-2.5" /> TIẾP NỐI
                                                                </span>
                                                            )}
                                                            <div className="font-black text-xl text-stone-900 tracking-tight leading-none pt-1">
                                                                {isContinuation ? `00:00 - ${dayShift.endTime.substring(0, 5)}` : `${dayShift.startTime.substring(0, 5)} - ${dayShift.endTime.substring(0, 5)}`}
                                                            </div>
                                                            {dayShift.breakStart && !isContinuation && (
                                                                <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">Nghỉ: {dayShift.breakStart.substring(0, 5)} - {dayShift.breakEnd?.substring(0, 5)}</div>
                                                            )}
                                                        </div>
                                                        <div className="flex justify-between items-end">
                                                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border-2 border-stone-900 shadow-[2px_2px_0_0_#1c1917] ${isContinuation ? 'bg-blue-100 text-blue-900' : 'bg-stone-50 text-stone-900'}`}>
                                                                {dayShift.totalSlots - dayShift.availableSlots}/{dayShift.totalSlots}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : <div className="text-stone-300 text-[11px] font-black uppercase italic tracking-widest">Không có ca</div>}
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {viewMode === 'day' && (
                        <div className="flex-1 overflow-y-auto">
                            <div className="flex items-center gap-4 mb-6 p-4 bg-amber-50 rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0_0_#1c1917]">
                                <button
                                    onClick={() => setSelectedDay(new Date(selectedDay.getTime() - 86400000))}
                                    className="w-10 h-10 flex items-center justify-center border-2 border-stone-900 rounded-xl hover:bg-amber-100 bg-white shadow-[3px_3px_0px_0px_#1c1917] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                                >
                                    <ChevronLeftIcon className="w-5 h-5 stroke-[3]" />
                                </button>
                                <div className="flex-1 text-center">
                                    <div className="text-2xl font-black text-stone-900 tracking-tight uppercase">{formatDisplayDateWithYear(selectedDay)}</div>
                                    <div className="text-xs font-black text-amber-600 uppercase tracking-widest">{DAYS_VN[selectedDay.getDay() === 0 ? 6 : selectedDay.getDay() - 1]}</div>
                                </div>
                                <button
                                    onClick={() => setSelectedDay(new Date(selectedDay.getTime() + 86400000))}
                                    className="w-10 h-10 flex items-center justify-center border-2 border-stone-900 rounded-xl hover:bg-amber-100 bg-white shadow-[3px_3px_0px_0px_#1c1917] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                                >
                                    <ChevronRightIcon className="w-5 h-5 stroke-[3]" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {dayViewShifts.length > 0 ? (
                                    dayViewShifts.map(shift => (
                                        <div key={shift.shiftId} className="bg-white rounded-2xl border-2 border-stone-900 p-6 shadow-[8px_8px_0px_0px_#1c1917]">
                                            <div className="flex justify-between items-center mb-8 border-b-2 border-stone-100 pb-6">
                                                <div className="flex items-center gap-5">
                                                    <div className="relative group">
                                                        {user?.avatar ? (
                                                            <img src={user.avatar} alt="avt" className="w-14 h-14 rounded-full border-2 border-stone-900 object-cover shadow-[3px_3px_0_0_#1c1917] transition-transform group-hover:scale-105" />
                                                        ) : (
                                                            <div className="w-14 h-14 bg-amber-400 rounded-full border-2 border-stone-900 shadow-[3px_3px_0_0_#1c1917] flex items-center justify-center text-2xl font-black text-stone-900 transition-transform group-hover:scale-105">
                                                                {user?.fullName?.charAt(0)}
                                                            </div>
                                                        )}
                                                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-stone-900 rounded-full"></div>
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-xl text-stone-900 uppercase tracking-tight leading-none">{user?.fullName}</div>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <ClockIcon className="w-4 h-4 text-stone-400 stroke-[2.5]" />
                                                            <div className="text-xs text-stone-500 font-bold uppercase tracking-widest">{shift.startTime.substring(0, 5)} - {shift.endTime.substring(0, 5)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3">
                                                    <div className="px-4 py-2 bg-green-50 text-green-700 border-2 border-stone-900 rounded-xl text-xs font-black shadow-[3px_3px_0_0_#1c1917]">{shift.availableSlots} Trống</div>
                                                    <div className="px-4 py-2 bg-amber-100 text-amber-700 border-2 border-stone-900 rounded-xl text-xs font-black shadow-[3px_3px_0_0_#1c1917]">{shift.bookedSlots} Đã đặt</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {mergeSlots(shift.slots).map(slot => (
                                                    <div
                                                        key={slot.id}
                                                        onClick={() => {
                                                            if (slot.status === 'BOOKED' && slot.bookingId) {
                                                                navigate('/staff/bookings', { state: { focusBookingId: slot.bookingId } })
                                                            }
                                                        }}
                                                        className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between min-h-[120px] shadow-[4px_4px_0px_0px_#1c1917] ${slot.status === 'AVAILABLE' ? 'bg-white border-stone-900 hover:bg-green-50' :
                                                            slot.status === 'BLOCKED' ? 'bg-red-50 border-stone-900 grayscale opacity-70' :
                                                                'bg-amber-50 border-stone-900 cursor-pointer hover:shadow-[6px_6px_0px_0px_#1c1917] hover:-translate-y-1'
                                                            }`}
                                                    >
                                                        <div>
                                                            <div className="flex justify-between items-start mb-3">
                                                                <div className="bg-stone-900 text-white px-3 py-1 rounded-lg text-sm font-black mono tracking-tight shadow-[2px_2px_0_0_#4299E1]">
                                                                    {slot.startTime.substring(0, 5)} - {slot.endTime.substring(0, 5)}
                                                                </div>
                                                                {slot.status === 'BLOCKED' && <LockClosedIcon className="w-5 h-5 text-red-600 stroke-2" />}
                                                                {slot.status === 'BOOKED' && <div className="w-3 h-3 bg-amber-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(217,119,6,0.5)]"></div>}
                                                            </div>
                                                            <div className={`text-[10px] font-black uppercase tracking-widest mb-2 ${slot.status === 'AVAILABLE' ? 'text-green-600' :
                                                                slot.status === 'BLOCKED' ? 'text-red-600' :
                                                                    'text-amber-700'
                                                                }`}>
                                                                {slot.status === 'AVAILABLE' ? 'Sẵn sàng' :
                                                                    slot.status === 'BLOCKED' ? 'Đã khóa' :
                                                                        'Lịch hẹn'}
                                                                {slot.span > 1 && <span className="ml-2 lowercase opacity-60 font-medium">({slot.span * 30} phút)</span>}
                                                            </div>
                                                        </div>

                                                        {slot.status === 'BOOKED' && slot.petName && (
                                                            <div className="mt-2 pt-3 border-t-2 border-amber-200/50">
                                                                <div className="text-sm font-black text-stone-900 truncate uppercase tracking-tight">
                                                                    {slot.petName}
                                                                </div>
                                                                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1 truncate">
                                                                    Chủ: {slot.petOwnerName}
                                                                </div>
                                                                {slot.serviceName && (
                                                                    <div className="mt-3 px-2 py-1 bg-white border-2 border-stone-900 rounded-lg text-[9px] font-black text-stone-900 uppercase tracking-widest inline-block shadow-[2px_2px_0_0_#1c1917]">
                                                                        {slot.serviceName}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-20 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 text-stone-400 font-bold italic">Bạn không có lịch làm việc trong ngày này</div>
                                )}
                            </div>
                        </div>
                    )}

                    {viewMode === 'month' && (
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="flex items-center gap-4 mb-6 p-4 bg-amber-50 rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0_0_#1c1917]">
                                <button
                                    onClick={() => setCurrentWeek(new Date(currentWeek.getFullYear(), currentWeek.getMonth() - 1, 1))}
                                    className="w-10 h-10 flex items-center justify-center border-2 border-stone-900 rounded-xl hover:bg-amber-100 bg-white shadow-[3px_3px_0px_0px_#1c1917] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                                >
                                    <ChevronLeftIcon className="w-5 h-5 stroke-[3]" />
                                </button>
                                <div className="flex-1 text-center font-black text-xl uppercase tracking-tight">Tháng {currentWeek.getMonth() + 1} / {currentWeek.getFullYear()}</div>
                                <button
                                    onClick={() => setCurrentWeek(new Date(currentWeek.getFullYear(), currentWeek.getMonth() + 1, 1))}
                                    className="w-10 h-10 flex items-center justify-center border-2 border-stone-900 rounded-xl hover:bg-amber-100 bg-white shadow-[3px_3px_0px_0px_#1c1917] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                                >
                                    <ChevronRightIcon className="w-5 h-5 stroke-[3]" />
                                </button>
                            </div>

                            <div className="grid grid-cols-7 gap-3">
                                {DAYS_VN.map(day => <div key={day} className="text-center text-[10px] font-black text-stone-400 py-2 uppercase tracking-widest">{day}</div>)}
                                {(() => {
                                    const firstDay = new Date(currentWeek.getFullYear(), currentWeek.getMonth(), 1)
                                    const lastDay = new Date(currentWeek.getFullYear(), currentWeek.getMonth() + 1, 0)
                                    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
                                    const days = []
                                    for (let i = 0; i < startOffset; i++) days.push(<div key={`empty-${i}`} className="h-28"></div>)
                                    for (let d = 1; d <= lastDay.getDate(); d++) {
                                        const date = new Date(currentWeek.getFullYear(), currentWeek.getMonth(), d)
                                        const dateStr = formatDate(date)
                                        const dayShifts = shifts.filter(s => s.workDate === dateStr && !s.isContinuation)
                                        const totalSlots = dayShifts.reduce((sum, s) => sum + s.totalSlots, 0)
                                        const availSlots = dayShifts.reduce((sum, s) => sum + s.availableSlots, 0)
                                        const isToday = date.toDateString() === new Date().toDateString()
                                        days.push(
                                            <div
                                                key={d}
                                                onClick={() => { setSelectedDay(date); setViewMode('day'); }}
                                                className={`
                                                    h-28 p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between 
                                                    ${isToday ? 'bg-amber-600 border-stone-900 text-white shadow-[4px_4px_0_0_#1c1917] -translate-y-1' : 'bg-white border-stone-200 hover:border-stone-900 shadow-[2px_2px_0_0_rgba(0,0,0,0.05)] hover:shadow-[4px_4px_0_0_#1c1917] hover:-translate-y-0.5'}
                                                `}
                                            >
                                                <div className={`text-base font-black ${isToday ? 'text-white' : 'text-stone-950'}`}>
                                                    {d} {isToday && <span className="text-[8px] ml-1 bg-white text-amber-600 px-1.5 py-0.5 rounded-md font-black">TODAY</span>}
                                                </div>
                                                {dayShifts.length > 0 && (
                                                    <div className="flex flex-col gap-1">
                                                        <div className={`text-[9px] font-black px-2 py-0.5 rounded-lg border-2 border-stone-900 shadow-[1.5px_1.5px_0_0_#1c1917] ${isToday ? 'bg-white text-stone-900' : 'bg-green-50 text-green-700'}`}>
                                                            {totalSlots - availSlots}/{totalSlots} Slots
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    }
                                    return days
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar Details */}
            <div className={`w-96 bg-white border-l-4 border-stone-900 p-8 flex flex-col overflow-y-auto z-10 transition-all ${!selectedShift ? 'hidden lg:flex opacity-30 grayscale' : 'lg:flex'}`}>
                {!selectedShift ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-6 animate-pulse">
                        <div className="w-20 h-20 bg-stone-100 rounded-3xl flex items-center justify-center border-2 border-dashed border-stone-300">
                            <CalendarIcon className="w-10 h-10 text-stone-300" />
                        </div>
                        <p className="text-sm font-black text-stone-400 uppercase tracking-widest leading-relaxed">
                            Chọn một ca trên lịch<br />để xem chi tiết
                        </p>
                    </div>
                ) : (
                    <div className="space-y-10 animate-in slide-in-from-right duration-500">
                        <div>
                            <h2 className="text-sm font-black bg-stone-900 text-white px-5 py-3 rounded-xl shadow-[4px_4px_0px_0px_#f59e0b] uppercase tracking-widest text-center mb-10">
                                Chi tiết ca làm
                            </h2>

                            <div className="flex flex-col items-center mb-10">
                                <div className="relative mb-6 group">
                                    <div className="absolute inset-0 bg-amber-400 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                                    {selectedShift.staffAvatar ? (
                                        <img src={selectedShift.staffAvatar} alt="avt" className="w-28 h-28 rounded-full border-4 border-stone-900 shadow-[8px_8px_0_0_#f59e0b] object-cover relative z-10 transition-all group-hover:scale-105 group-hover:rotate-3" />
                                    ) : (
                                        <div className="w-28 h-28 rounded-full bg-amber-400 border-4 border-stone-900 shadow-[8px_8px_0_0_#f59e0b] flex items-center justify-center text-4xl font-black text-stone-900 relative z-10 transition-all group-hover:scale-105 group-hover:-rotate-3">
                                            {selectedShift.staffName?.charAt(0)}
                                        </div>
                                    )}
                                    <div className="absolute bottom-2 right-2 w-7 h-7 bg-green-500 border-4 border-white rounded-full shadow-lg z-20"></div>
                                </div>
                                <h3 className="font-black text-stone-900 text-2xl uppercase tracking-tighter text-center leading-tight">{selectedShift.staffName}</h3>
                                <span className="mt-3 px-4 py-1 bg-stone-100 text-stone-500 border-2 border-stone-200 rounded-full text-[9px] font-black uppercase tracking-widest">Nhân viên chuyên khoa</span>
                            </div>

                            <div className="p-6 bg-amber-50 rounded-2xl border-2 border-stone-900 shadow-[6px_6px_0_0_#1c1917] mb-8 hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all cursor-default">
                                <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3">Thời gian trực</p>
                                <div className="space-y-1">
                                    <p className="text-xl font-black text-stone-900 uppercase tracking-tight">{format(selectedDay, 'EEEE, dd/MM/yyyy', { locale: viLocale })}</p>
                                    <div className="flex items-center gap-3 pt-1">
                                        <p className="text-3xl font-black text-amber-600 tracking-tighter leading-none">{selectedShift.startTime.substring(0, 5)}–{selectedShift.endTime.substring(0, 5)}</p>
                                        {selectedShift.isOvernight && <span className="bg-stone-900 text-white text-[9px] font-black px-2 py-1 rounded-md shadow-[2px_2px_0_0_#4299E1] uppercase tracking-widest">CA ĐÊM</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-5 mb-10">
                                <div className="p-5 bg-white rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0_0_#22c55e] text-center group hover:-translate-y-1 transition-all">
                                    <div className="text-4xl font-black text-green-600 group-hover:scale-110 transition-transform">{selectedShift.availableSlots}</div>
                                    <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-2">Trống</div>
                                </div>
                                <div className="p-5 bg-white rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0_0_#f59e0b] text-center group hover:-translate-y-1 transition-all">
                                    <div className="text-4xl font-black text-amber-600 group-hover:scale-110 transition-transform">{selectedShift.bookedSlots}</div>
                                    <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-2">Đã đặt</div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-6 pl-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-amber-600 rounded-full"></div>
                                    <label className="text-xs font-black text-stone-900 uppercase tracking-widest">Danh sách Slots</label>
                                </div>
                                {loadingSlots && <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>}
                            </div>

                            <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-3 custom-scrollbar">
                                {shiftDetail?.slots && mergeSlots(shiftDetail.slots).map((slot: MergedSlot) => (
                                    <div
                                        key={slot.id}
                                        className={`group flex items-center justify-between p-5 rounded-2xl border-2 transition-all shadow-[4px_4px_0_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#1c1917] ${slot.status === 'AVAILABLE' ? 'border-stone-900 bg-white' :
                                            slot.status === 'BLOCKED' ? 'border-stone-900 bg-red-50 grayscale opacity-60' :
                                                'border-stone-900 bg-amber-50'
                                            }`}
                                    >
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2">
                                                <ClockIcon className="w-4 h-4 text-stone-400" />
                                                <span className="font-black text-lg text-stone-900 tracking-tight">{slot.startTime.substring(0, 5)}–{slot.endTime.substring(0, 5)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border-2 border-stone-900 shadow-[1.5px_1.5px_0_0_#1c1917] uppercase tracking-widest ${slot.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                                                    slot.status === 'BLOCKED' ? 'bg-red-100 text-red-700' :
                                                        'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {slot.status === 'AVAILABLE' ? 'Sẵn sàng' : slot.status === 'BLOCKED' ? 'Đã khóa' : 'Đã đặt'}
                                                </span>
                                                {slot.span > 1 && (
                                                    <span className="text-[9px] font-bold text-stone-400 italic">({slot.span} slots)</span>
                                                )}
                                            </div>
                                        </div>

                                        {slot.status === 'BLOCKED' && <div className="p-3 bg-white border-2 border-stone-900 rounded-xl shadow-[2px_2px_0_0_#ef4444]"><LockClosedIcon className="w-5 h-5 text-red-600" /></div>}
                                        {slot.status === 'BOOKED' && <div className="text-[10px] font-black text-white bg-amber-600 p-3 rounded-xl border-2 border-stone-900 shadow-[2px_2px_0_0_#1c1917] uppercase tracking-widest leading-none">Booked</div>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Note area */}
                        <div className="p-5 bg-stone-900 text-white rounded-2xl border-2 border-stone-900 shadow-[6px_6px_0_0_#f59e0b] mt-auto">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                    <LockClosedIcon className="w-4 h-4 text-amber-400" />
                                </div>
                                <p className="text-[10px] font-bold text-stone-300 leading-relaxed uppercase tracking-widest">
                                    Lưu ý: Nếu bạn cần khóa slot đột xuất, vui lòng liên hệ <span className="text-amber-400">Quản lý</span> để hỗ trợ.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default StaffSchedulePage
