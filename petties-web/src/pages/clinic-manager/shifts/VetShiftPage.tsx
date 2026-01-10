import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '../../../store/authStore'
import { vetShiftService } from '../../../services/api/vetShiftService'
import { clinicStaffService } from '../../../services/api/clinicStaffService'
import type { VetShiftResponse, VetShiftRequest, SlotResponse } from '../../../types/vetshift'
import type { StaffMember } from '../../../types/clinicStaff'
import { useToast } from '../../../components/Toast'
import { ConfirmModal } from '../../../components/ConfirmModal'
import { CalendarPicker } from '../../../components/CalendarPicker'
import { TrashIcon, DocumentDuplicateIcon, HandRaisedIcon, UserIcon, ClockIcon, MoonIcon, ArrowRightIcon, LockClosedIcon, LockOpenIcon, CalendarIcon } from '@heroicons/react/24/outline'
import '../../../styles/brutalist.css'

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

const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}
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
    // If crossing year boundary, show both years
    if (startYear !== endYear) {
        return `${formatDisplayDateWithYear(startDate)} - ${formatDisplayDateWithYear(endDate)}`
    }
    // Otherwise show year once at the end
    return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}/${endYear}`
}

const DAYS_VN = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN']

/**
 * VetShift Management Page - Soft Neubrutalism (Consistent Clinic Manager Colors)
 * Colors: bg-stone-50, bg-amber-500, stone-900
 */
export const VetShiftPage = () => {
    const { user } = useAuthStore()
    const clinicId = user?.workingClinicId
    const { showToast } = useToast()

    const [currentWeek, setCurrentWeek] = useState(new Date())
    const [weekDates, setWeekDates] = useState<Date[]>([])
    const [shifts, setShifts] = useState<VetShiftResponse[]>([])
    const [vets, setVets] = useState<StaffMember[]>([])
    const [loading, setLoading] = useState(false)

    // Selection mode
    const [selectionMode, setSelectionMode] = useState(false)
    const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([])

    // Drag selection state
    const [isDragging, setIsDragging] = useState(false)
    const [hasMoved, setHasMoved] = useState(false) // Distinguish click vs drag
    const [dragStartPos, setDragStartPos] = useState<{ vetId: string; dateIndex: number } | null>(null)
    const [dragEndPos, setDragEndPos] = useState<{ vetId: string; dateIndex: number } | null>(null)
    const [dragType, setDragType] = useState<'create' | 'delete' | null>(null)

    // Ref for immediate drag state access (fixes race condition in click handlers)
    const dragStateRef = useRef({
        isDragging: false,
        hasMoved: false,
        startPos: null as { vetId: string; dateIndex: number } | null,
        endPos: null as { vetId: string; dateIndex: number } | null
    })

    // Modals
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)
    const [isConflictModalOpen, setIsConflictModalOpen] = useState(false)
    const [conflictDetails, setConflictDetails] = useState<{ date: string; existingShift: string; newShift: string }[]>([])
    const [isVetSelectorOpen, setIsVetSelectorOpen] = useState(false)
    const vetSelectorRef = useRef<HTMLDivElement>(null)

    // Form
    const [formData, setFormData] = useState<VetShiftRequest>({
        vetId: '',
        workDates: [],
        startTime: '08:00',
        endTime: '17:00',
        // breakStart and breakEnd left undefined to use clinic defaults
        repeatWeeks: 1,
    })

    const [selectedShift, setSelectedShift] = useState<VetShiftResponse | null>(null)
    const [shiftDetail, setShiftDetail] = useState<VetShiftResponse | null>(null)
    const [loadingSlots, setLoadingSlots] = useState(false)
    const [sidebarMode, setSidebarMode] = useState<'create' | 'detail'>('create')
    const [viewMode, setViewMode] = useState<'week' | 'day' | 'month'>('week')
    const [selectedDay, setSelectedDay] = useState<Date>(new Date())

    // Force re-calculate weekDates when currentWeek changes
    useEffect(() => {
        console.log('VetShiftPage: currentWeek changed to:', currentWeek)
        const newWeekDates = getWeekDates(new Date(currentWeek))
        console.log('VetShiftPage: new weekDates:', newWeekDates.map(d => d.toDateString()))
        setWeekDates(newWeekDates)
    }, [currentWeek.getTime()]) // Use getTime() to detect actual date changes

    // When switching to Day view, sync selectedDay to be within current week
    // Constraint logic removed to fix Month->Day navigation bug
    // selectedDay is managed explicitly by navigation handlers

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (vetSelectorRef.current && !vetSelectorRef.current.contains(event.target as Node)) {
                setIsVetSelectorOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (clinicId) fetchVets()
    }, [clinicId])

    useEffect(() => {
        if (clinicId && weekDates.length > 0) fetchShifts()
    }, [clinicId, weekDates, viewMode])

    const fetchVets = async () => {
        if (!clinicId) return
        try {
            const staffList = await clinicStaffService.getClinicStaff(clinicId)
            const vetList = staffList.filter(s => s.role === 'VET')
            setVets(vetList)
        } catch (err: any) {
            console.error('fetchVets error:', err)
        }
    }

    const fetchShifts = async () => {
        if (!clinicId || weekDates.length === 0) return
        setLoading(true)
        try {
            let startDate = formatDate(weekDates[0])
            let endDate = formatDate(weekDates[6])

            if (viewMode === 'month') {
                const year = currentWeek.getFullYear()
                const month = currentWeek.getMonth()
                const first = new Date(year, month, 1)
                const last = new Date(year, month + 1, 0)
                startDate = formatDate(first)
                endDate = formatDate(last)
            }

            const data = await vetShiftService.getShiftsByClinic(clinicId, startDate, endDate)
            setShifts(data)
        } catch (err: any) {
            showToast('error', err.response?.data?.message || err.message || 'Lỗi tải lịch')
        } finally {
            setLoading(false)
        }
    }

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

    // Fetch shift detail with slots when a shift is selected
    useEffect(() => {
        if (!selectedShift) {
            setShiftDetail(null)
            return
        }
        const fetchDetail = async () => {
            setLoadingSlots(true)
            try {
                const detail = await vetShiftService.getShiftDetail(selectedShift.shiftId)
                setShiftDetail(detail)
            } catch (err: any) {
                showToast('error', 'Không thể tải chi tiết slots')
            } finally {
                setLoadingSlots(false)
            }
        }
        fetchDetail()
    }, [selectedShift, showToast])

    // State for Day View with slots
    const [dayViewShifts, setDayViewShifts] = useState<VetShiftResponse[]>([])

    // Fetch shifts with slots for Day View
    useEffect(() => {
        if (viewMode !== 'day' || !clinicId) return

        const fetchDayShifts = async () => {
            const dayStr = formatDate(selectedDay)
            const dayShifts = shifts.filter(s => s.workDate === dayStr && !s.isContinuation)

            // Fetch detail for each shift to get slots
            const detailPromises = dayShifts.map(s => vetShiftService.getShiftDetail(s.shiftId))
            try {
                const details = await Promise.all(detailPromises)
                setDayViewShifts(details)
            } catch {
                setDayViewShifts(dayShifts) // Fallback to basic data
            }
        }

        fetchDayShifts()
    }, [viewMode, selectedDay, shifts, clinicId])

    // Block/Unblock slot handlers
    const handleBlockSlot = async (slotId: string) => {
        try {
            await vetShiftService.blockSlot(slotId)
            // Refresh shift detail
            if (selectedShift) {
                const detail = await vetShiftService.getShiftDetail(selectedShift.shiftId)
                setShiftDetail(detail)
                setSelectedShift(detail) // Sync sidebar stats immediately
                // Sync with day view immediately
                setDayViewShifts(prev => prev.map(s => s.shiftId === detail.shiftId ? detail : s))
            }
            showToast('success', 'Đã khóa slot')
            fetchShifts() // Refresh grid counts
        } catch (err: any) {
            showToast('error', err.response?.data?.message || 'Lỗi khóa slot')
        }
    }

    const handleUnblockSlot = async (slotId: string) => {
        try {
            await vetShiftService.unblockSlot(slotId)
            // Refresh shift detail
            if (selectedShift) {
                const detail = await vetShiftService.getShiftDetail(selectedShift.shiftId)
                setShiftDetail(detail)
                setSelectedShift(detail) // Sync sidebar stats immediately
                // Sync with day view immediately
                setDayViewShifts(prev => prev.map(s => s.shiftId === detail.shiftId ? detail : s))
            }
            showToast('success', 'Đã mở khóa slot')
            fetchShifts() // Refresh grid counts
        } catch (err: any) {
            showToast('error', err.response?.data?.message || 'Lỗi mở khóa slot')
        }
    }

    // --- Drag Selection Logic ---

    const handleCellMouseDown = (vetId: string, dateIndex: number, hasShift: boolean) => {
        // Sync Ref immediately
        dragStateRef.current = {
            isDragging: true,
            hasMoved: false,
            startPos: { vetId, dateIndex },
            endPos: { vetId, dateIndex }
        }

        setIsDragging(true)
        setHasMoved(false) // Reset move tracking
        setDragStartPos({ vetId, dateIndex })
        setDragEndPos({ vetId, dateIndex })

        const type = hasShift ? 'delete' : 'create'
        setDragType(type)

        const dateStr = formatDate(weekDates[dateIndex])

        if (type === 'create') {
            setFormData(prev => ({ ...prev, vetId, workDates: [dateStr] }))
            setSelectionMode(false)
        } else {
            // Delete mode - still update formData to show selection in sidebar
            setFormData(prev => ({ ...prev, vetId, workDates: [dateStr] }))
            const shift = shifts.find(s => s.vetId === vetId && s.workDate === dateStr)
            if (shift) {
                setSelectedShiftIds([shift.shiftId])
                setSelectionMode(true)
            }
        }
    }

    const handleCellMouseEnter = (vetId: string, dateIndex: number) => {
        // Use Ref for check
        if (!dragStateRef.current.isDragging || !dragStateRef.current.startPos) return
        if (vetId !== dragStateRef.current.startPos.vetId) return // Only horizontal drag

        // Update Ref
        dragStateRef.current.endPos = { vetId, dateIndex }
        dragStateRef.current.hasMoved = true

        setDragEndPos({ vetId, dateIndex })
        setHasMoved(true) // Mark that user has moved (this is a drag, not a click)

        const startIdx = Math.min(dragStateRef.current.startPos.dateIndex, dateIndex)
        const endIdx = Math.max(dragStateRef.current.startPos.dateIndex, dateIndex)

        // Collect target dates (for both create and delete modes)
        const targetDates: string[] = []
        for (let i = startIdx; i <= endIdx; i++) {
            const date = weekDates[i]
            if (date >= new Date(new Date().setHours(0, 0, 0, 0))) {
                targetDates.push(formatDate(date))
            }
        }

        // Always update formData to show selection info in sidebar
        setFormData(prev => ({ ...prev, workDates: targetDates }))

        if (dragType === 'delete') {
            const targetShiftIds: string[] = []
            for (let i = startIdx; i <= endIdx; i++) {
                const dateStr = formatDate(weekDates[i])
                const shift = shifts.find(s => s.vetId === vetId && s.workDate === dateStr)
                if (shift) targetShiftIds.push(shift.shiftId)
            }
            setSelectedShiftIds(targetShiftIds)
        }
    }

    const handleDragEndGlobal = useCallback(() => {
        // Use Ref for logic source of truth
        const { isDragging, hasMoved, startPos, endPos } = dragStateRef.current

        if (isDragging && startPos && endPos) {
            setIsDragging(false)
            // Reset Ref dragging state
            dragStateRef.current.isDragging = false

            // If user didn't move (quick click), handle as click
            if (!hasMoved) {
                const dateStr = formatDate(weekDates[startPos.dateIndex])
                const clickedShift = shifts.find(s =>
                    s.vetId === startPos.vetId &&
                    (s.displayDate || s.workDate) === dateStr &&
                    !s.isContinuation
                )

                if (clickedShift) {
                    // Click on existing shift → Open detail
                    setFormData({
                        vetId: clickedShift.vetId,
                        workDates: [clickedShift.workDate],
                        startTime: clickedShift.startTime.substring(0, 5),
                        endTime: clickedShift.endTime.substring(0, 5),
                        breakStart: clickedShift.breakStart?.substring(0, 5),
                        breakEnd: clickedShift.breakEnd?.substring(0, 5),
                        isOvernight: clickedShift.isOvernight,
                        repeatWeeks: 1,
                    })
                    setSelectedShift(clickedShift)
                    setSidebarMode('detail') // Switch to detail tab
                    setSelectionMode(false)
                    setSelectedShiftIds([])
                } else {
                    // Click on empty cell → Select for create
                    setFormData(prev => ({ ...prev, vetId: startPos.vetId, workDates: [dateStr] }))
                    setSelectedShift(null)
                    setSidebarMode('create') // Switch to create tab
                    setSelectionMode(false)
                    setSelectedShiftIds([])
                }
                return
            }

            // User dragged (moved) → Show toast for multi-select
            if (dragType === 'create') {
                showToast('info', `Đã chọn ${formData.workDates.length} ngày`)
            } else if (dragType === 'delete') {
                showToast('info', `Đã chọn ${selectedShiftIds.length} ca`)
            }

            // Sync form time if we selected existing shifts (Edit Mode simulation)
            // This ensures sidebar shows 09:00 if we selected 09:00 shifts, not default 08:00
            const vetId = formData.vetId
            const selectedDates = formData.workDates
            const existingShifts = shifts.filter(s => s.vetId === vetId && selectedDates.includes(s.workDate))

            if (existingShifts.length > 0 && existingShifts.length === selectedDates.length) {
                const firstShift = existingShifts[0]
                setFormData(prev => ({
                    ...prev, // to keep vetId and workDates
                    startTime: firstShift.startTime.substring(0, 5),
                    endTime: firstShift.endTime.substring(0, 5),
                    isOvernight: firstShift.isOvernight,
                    // If overnight, clear explicit breaks to match toggle logic
                    breakStart: firstShift.isOvernight ? undefined : prev.breakStart,
                    breakEnd: firstShift.isOvernight ? undefined : prev.breakEnd
                }))
            }
        }
    }, [isDragging, hasMoved, dragType, dragStartPos, dragEndPos, weekDates, shifts, formData.workDates, formData.vetId, selectedShiftIds.length, showToast])

    useEffect(() => {
        window.addEventListener('mouseup', handleDragEndGlobal)
        return () => window.removeEventListener('mouseup', handleDragEndGlobal)
    }, [handleDragEndGlobal])

    // --- Actions ---

    // Helper to check time overlap
    const timesOverlap = (start1: string, end1: string, start2: string, end2: string, isOvernight1: boolean, isOvernight2: boolean) => {
        // Convert to minutes for easier comparison
        const toMinutes = (t: string) => {
            const [h, m] = t.split(':').map(Number)
            return h * 60 + m
        }

        let s1 = toMinutes(start1)
        let e1 = toMinutes(end1)
        let s2 = toMinutes(start2)
        let e2 = toMinutes(end2)

        // Handle overnight shifts (add 24h to end time if it's before start)
        if (isOvernight1 || e1 < s1) e1 += 24 * 60
        if (isOvernight2 || e2 < s2) e2 += 24 * 60

        // Check overlap
        return s1 < e2 && s2 < e1
    }

    // Check for conflicts with existing shifts
    const checkForConflicts = () => {
        const conflicts: { date: string; existingShift: string; newShift: string }[] = []

        formData.workDates.forEach(date => {
            const existingShiftsOnDate = shifts.filter(s =>
                s.vetId === formData.vetId && s.workDate === date && !s.isContinuation
            )

            existingShiftsOnDate.forEach(existing => {
                if (timesOverlap(
                    formData.startTime,
                    formData.endTime,
                    existing.startTime,
                    existing.endTime,
                    formData.isOvernight || false,
                    existing.isOvernight || false
                )) {
                    conflicts.push({
                        date,
                        existingShift: `${existing.startTime} - ${existing.endTime}${existing.isOvernight ? ' (Ca đêm)' : ''}`,
                        newShift: `${formData.startTime} - ${formData.endTime}${formData.isOvernight ? ' (Ca đêm)' : ''}`
                    })
                }
            })
        })

        return conflicts
    }

    const handleCreateShift = async (e: React.FormEvent, forceCreate = false) => {
        e.preventDefault()
        if (!clinicId) return
        if (formData.workDates.length === 0) {
            showToast('warning', 'Vui lòng chọn ít nhất một ngày')
            return
        }

        // Frontend validation for overnight logic
        const endBeforeStart = formData.endTime < formData.startTime
        let finalIsOvernight = formData.isOvernight || false

        // If end < start (e.g., 22:00 -> 06:00), overnight MUST be enabled
        if (endBeforeStart && !formData.isOvernight) {
            showToast('error', 'Thời gian kết thúc trước thời gian bắt đầu - hãy bật chế độ Ca đêm')
            return
        }

        // If end >= start (e.g., 00:00 -> 05:00), overnight is NOT needed - auto-disable
        if (!endBeforeStart && formData.isOvernight) {
            showToast('info', 'Ca đêm không cần cho khung giờ này - đã tự động tắt')
            finalIsOvernight = false
        }

        // Check if start == end
        if (formData.startTime === formData.endTime) {
            showToast('error', 'Thời gian bắt đầu và kết thúc không được trùng nhau')
            return
        }

        // Check for conflicts (only if not forcing)
        if (!forceCreate) {
            const conflicts = checkForConflicts()
            if (conflicts.length > 0) {
                setConflictDetails(conflicts)
                setIsConflictModalOpen(true)
                return
            }
        }

        setLoading(true)
        try {
            // Check if we're editing existing shifts OR user confirmed to override conflicts
            const isEditing = forceCreate || (formData.workDates.length > 0 && formData.workDates.every(date =>
                shifts.some(s => s.vetId === formData.vetId && s.workDate === date)
            ))

            const requestData = {
                ...formData,
                isOvernight: finalIsOvernight,
                forceUpdate: isEditing // Enable upsert when editing or overriding conflicts
            }
            const createdShifts = await vetShiftService.createShift(clinicId, requestData)

            if (forceCreate) {
                showToast('success', `Đã cập nhật ${createdShifts.length} ca làm việc (đè lên ca cũ)`)
            } else if (isEditing) {
                showToast('success', `Đã cập nhật ${createdShifts.length} ca làm việc`)
            } else {
                showToast('success', `Đã tạo ${createdShifts.length} ca làm việc (${formData.repeatWeeks} tuần)`)
            }

            setFormData({
                vetId: '',
                workDates: [],
                startTime: '08:00',
                endTime: '17:00',
                breakStart: '12:00',
                breakEnd: '13:00',
                repeatWeeks: 1,
            })
            setSelectedShift(null) // Clear selected shift
            fetchShifts()
        } catch (err: any) {
            showToast('error', err.response?.data?.message || err.message || 'Lỗi tạo lịch')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteShift = async () => {
        if (!selectedShift) return
        try {
            await vetShiftService.deleteShift(selectedShift.shiftId)
            setSelectedShift(null)
            setIsDeleteModalOpen(false)
            showToast('success', 'Đã xóa ca làm việc')
            fetchShifts()
        } catch (err: any) {
            showToast('error', err.response?.data?.message || err.message || 'Lỗi xóa lịch')
        }
    }

    const handleBulkDelete = async () => {
        if (selectedShiftIds.length === 0) return
        try {
            await vetShiftService.bulkDeleteShifts(selectedShiftIds)
            setSelectedShiftIds([])
            setSelectionMode(false)
            setIsBulkDeleteModalOpen(false)
            showToast('success', `Đã xóa ${selectedShiftIds.length} ca`)
            fetchShifts()
        } catch (err: any) {
            showToast('error', err.response?.data?.message || err.message || 'Lỗi xóa hàng loạt')
        }
    }

    const handleUseAsTemplate = () => {
        if (!selectedShift) return
        setFormData({
            vetId: selectedShift.vetId,
            workDates: [selectedShift.workDate],
            startTime: selectedShift.startTime.substring(0, 5),
            endTime: selectedShift.endTime.substring(0, 5),
            breakStart: selectedShift.breakStart?.substring(0, 5) || '12:00',
            breakEnd: selectedShift.breakEnd?.substring(0, 5) || '13:00',
            repeatWeeks: 4,
        })
        setSelectedShift(null)
        showToast('info', 'Đã nạp mẫu ca làm việc.')
    }

    const shiftsByVet = shifts.reduce((acc, shift) => {
        if (!acc[shift.vetId]) {
            acc[shift.vetId] = { name: shift.vetName, avatar: shift.vetAvatar, shifts: [] }
        }
        acc[shift.vetId].shifts.push(shift)
        return acc
    }, {} as Record<string, { name: string; avatar: string | null; shifts: VetShiftResponse[] }>)

    // Detect if we're editing existing shifts (all selected dates have shifts)
    const isEditMode = formData.vetId && formData.workDates.length > 0 && formData.workDates.every(date =>
        shifts.some(s => s.vetId === formData.vetId && s.workDate === date)
    )

    return (
        <div className="flex h-screen bg-stone-50 text-stone-900 font-sans select-none overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden p-6 gap-6">
                {/* Header */}
                <header className="flex justify-between items-center bg-white p-5 rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,0.8)]">
                    <div>
                        <h1 className="text-xl font-bold bg-amber-500 text-white px-4 py-1.5 rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] inline-block mb-1">
                            LỊCH LÀM VIỆC
                        </h1>
                        <p className="text-stone-500 font-bold ml-1 text-sm">
                            {user?.workingClinicName || 'Phòng khám thú y'}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        {selectionMode ? (
                            <>
                                <button
                                    onClick={() => { setSelectionMode(false); setSelectedShiftIds([]); }}
                                    className="px-5 py-2.5 bg-white border-2 border-stone-900 rounded-xl font-bold text-sm shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(28,25,23,1)] transition-all"
                                >
                                    Hủy chọn
                                </button>
                                <button
                                    disabled={selectedShiftIds.length === 0}
                                    onClick={() => setIsBulkDeleteModalOpen(true)}
                                    className="px-5 py-2.5 bg-red-500 text-white border-2 border-stone-900 rounded-xl font-bold text-sm shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(28,25,23,1)] transition-all disabled:opacity-50"
                                >
                                    Xóa {selectedShiftIds.length} ca
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setSelectionMode(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white border-2 border-stone-900 rounded-xl font-bold text-sm shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(28,25,23,1)] transition-all"
                            >
                                <TrashIcon className="w-5 h-5" /> Xóa nhiều
                            </button>
                        )}
                    </div>
                </header>
                {/* Calendar Nav - Outside overflow container for dropdown to work */}
                <div className="flex items-center justify-between mb-3 bg-white rounded-xl border-2 border-stone-200 p-3">
                    {/* View Mode Toggle */}
                    <div className="flex bg-stone-100 rounded-xl p-1 border-2 border-stone-200">
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'week'
                                ? 'bg-amber-500 text-white shadow-[2px_2px_0px_0px_rgba(28,25,23,0.5)]'
                                : 'text-stone-500 hover:text-stone-700'
                                }`}
                        >
                            Tuần
                        </button>
                        <button
                            onClick={() => setViewMode('day')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'day'
                                ? 'bg-amber-500 text-white shadow-[2px_2px_0px_0px_rgba(28,25,23,0.5)]'
                                : 'text-stone-500 hover:text-stone-700'
                                }`}
                        >
                            Ngày
                        </button>
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'month'
                                ? 'bg-amber-500 text-white shadow-[2px_2px_0px_0px_rgba(28,25,23,0.5)]'
                                : 'text-stone-500 hover:text-stone-700'
                                }`}
                        >
                            Tháng
                        </button>
                    </div>

                    {/* Date Navigation */}
                    <div className="flex items-center gap-3">
                        <button onClick={handlePrevWeek} className="w-10 h-10 flex items-center justify-center border-2 border-stone-900 rounded-xl hover:bg-amber-100 transition-colors bg-white shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]">←</button>
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
                        <button onClick={handleNextWeek} className="w-10 h-10 flex items-center justify-center border-2 border-stone-900 rounded-xl hover:bg-amber-100 transition-colors bg-white shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]">→</button>
                    </div>
                </div>

                {/* Calendar Content - With overflow for scrolling */}
                <div className="flex-1 bg-white rounded-2xl border-2 border-stone-900 p-5 shadow-[4px_4px_0px_0px_rgba(28,25,23,0.8)] flex flex-col overflow-hidden">

                    {/* Week View Hint */}
                    {viewMode === 'week' && (
                        <div className="flex items-center gap-2 text-sm font-bold text-stone-500 mb-3">
                            <HandRaisedIcon className="w-4 h-4 text-amber-500" />
                            <span className="text-amber-600 text-xs">Kéo chuột để chọn nhanh nhiều ngày</span>
                        </div>
                    )}

                    {/* Week View */}
                    {viewMode === 'week' && (
                        <>
                            {/* Grid Header */}
                            <div className="grid grid-cols-8 gap-3 mb-3">
                                <div className="bg-stone-900 text-white rounded-xl p-3 flex items-center justify-center font-bold shadow-[2px_2px_0px_0px_rgba(251,191,36,1)]">
                                    Bác sĩ
                                </div>
                                {weekDates.map((date, i) => {
                                    const dateStr = formatDate(date)
                                    const isSelectedDay = formData.workDates.includes(dateStr)
                                    const isToday = date.toDateString() === new Date().toDateString()

                                    return (
                                        <div
                                            key={i}
                                            className={`rounded-xl p-2 text-center border-2 transition-all duration-300 ${isSelectedDay
                                                ? 'bg-amber-500 border-stone-900 text-white shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] scale-105'
                                                : isToday
                                                    ? 'bg-amber-100 border-amber-500 text-amber-700'
                                                    : 'bg-stone-50 border-stone-200 text-stone-500'
                                                }`}
                                        >
                                            <div className="text-xs font-bold uppercase mb-1 opacity-80">{DAYS_VN[i]}</div>
                                            <div className="text-lg font-bold">{formatDisplayDate(date)}</div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Grid Body */}
                            <div className="overflow-y-auto flex-1 pr-2 space-y-3 cursor-crosshair custom-scrollbar">
                                {loading ? (
                                    <div className="h-40 flex items-center justify-center flex-col gap-3 text-stone-400 font-bold italic">
                                        <div className="w-8 h-8 border-4 border-stone-200 border-t-amber-500 rounded-full animate-spin"></div>
                                        Đang tải dữ liệu...
                                    </div>
                                ) : (
                                    vets.map(vet => {
                                        const vetShifts = shiftsByVet[vet.userId]?.shifts || []
                                        return (
                                            <div key={vet.userId} className="grid grid-cols-8 gap-3">
                                                {/* Vet Info */}
                                                <div className="bg-white border-2 border-stone-900 rounded-xl p-3 flex flex-col items-center justify-center gap-2 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
                                                    {vet.avatar ? (
                                                        <img src={vet.avatar} alt="avt" className="w-10 h-10 rounded-full border-2 border-stone-900 object-cover" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full border-2 border-stone-900 bg-amber-100 flex items-center justify-center font-bold text-amber-600">
                                                            {vet.fullName.charAt(0)}
                                                        </div>
                                                    )}
                                                    <span className="font-bold text-sm text-center leading-tight">{vet.fullName}</span>
                                                </div>

                                                {/* Days */}
                                                {weekDates.map((date, i) => {
                                                    const dateStr = formatDate(date)
                                                    // Use displayDate for matching (handles overnight continuation)
                                                    const dayShift = vetShifts.find(s => (s.displayDate || s.workDate) === dateStr)
                                                    const isSelectedInSidebar = formData.vetId === vet.userId && formData.workDates.includes(dateStr)
                                                    const isSelectedForDelete = dayShift && selectedShiftIds.includes(dayShift.shiftId)
                                                    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0))
                                                    const isContinuation = dayShift?.isContinuation
                                                    const isOvernight = dayShift?.isOvernight && !isContinuation

                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`
                                                         rounded-xl border-2 transition-all relative h-32 p-2.5 flex flex-col justify-between overflow-hidden
                                                         ${isPast ? 'bg-stone-100 border-stone-200 opacity-50 cursor-not-allowed' : 'bg-white border-stone-200 hover:border-stone-900'}
                                                         ${isSelectedInSidebar && !dayShift ? '!bg-amber-100 !border-amber-500 shadow-[inset_0_0_0_2px_#fbbf24]' : ''}
                                                         ${isSelectedInSidebar && dayShift ? '!bg-amber-50 !border-amber-500 shadow-[inset_0_0_0_2px_#fbbf24]' : ''}
                                                         ${dayShift && !isContinuation && !isSelectedInSidebar ? '!bg-stone-50 !border-stone-900 shadow-[3px_3px_0px_0px_rgba(28,25,23,0.2)]' : ''}
                                                         ${isContinuation ? '!bg-indigo-50 !border-indigo-300' : ''}
                                                         ${isSelectedForDelete ? '!bg-red-50 !border-red-500' : ''}
                                                     `}
                                                            onMouseDown={() => !isPast && !isContinuation && handleCellMouseDown(vet.userId, i, !!dayShift)}
                                                            onMouseEnter={() => !isPast && !isContinuation && handleCellMouseEnter(vet.userId, i)}
                                                            title={isOvernight ? `Ca đêm: Kết thúc vào ngày hôm sau` : ''}
                                                        >
                                                            {dayShift ? (
                                                                <div className={`h-full flex flex-col justify-between ${isContinuation ? 'cursor-default' : 'cursor-pointer group'}`}>
                                                                    <div className="space-y-1">
                                                                        {/* Overnight badge */}
                                                                        {isOvernight && (
                                                                            <div className="flex items-center gap-1 mb-1">
                                                                                <span className="bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                                                                    <MoonIcon className="w-3 h-3" /> CA ĐÊM
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {/* Continuation badge */}
                                                                        {isContinuation && (
                                                                            <div className="bg-indigo-100 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 mb-1">
                                                                                <ArrowRightIcon className="w-2.5 h-2.5" /> Từ {dayShift.workDate.split('-').slice(1).reverse().join('/')}
                                                                            </div>
                                                                        )}
                                                                        {/* Time display */}
                                                                        <div className={`font-bold text-base leading-tight ${isContinuation ? 'text-indigo-700' : 'text-stone-900 group-hover:text-amber-600'} transition-colors`}>
                                                                            {isContinuation
                                                                                ? `00:00 - ${dayShift.endTime.substring(0, 5)}`
                                                                                : `${dayShift.startTime.substring(0, 5)} - ${dayShift.endTime.substring(0, 5)}`
                                                                            }
                                                                        </div>
                                                                        {/* Next day indicator for overnight */}
                                                                        {isOvernight && (
                                                                            <div className="text-[10px] font-bold text-indigo-500">→ Ngày hôm sau</div>
                                                                        )}
                                                                        {/* Break time */}
                                                                        {dayShift.breakStart && dayShift.breakEnd && !isContinuation && (
                                                                            <div className="text-[10px] font-bold text-stone-400">Nghỉ: {dayShift.breakStart.substring(0, 5)} - {dayShift.breakEnd.substring(0, 5)}</div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex justify-end mt-1 mb-1">
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${isContinuation ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : isSelectedForDelete ? 'bg-red-200 text-red-800 border-red-300' : 'bg-white text-stone-600 border-stone-200'}`}>
                                                                            {dayShift.availableSlots}/{dayShift.totalSlots}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ) : isSelectedInSidebar ? (
                                                                <div className="flex items-center justify-center h-full">
                                                                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"></div>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </>
                    )}

                    {/* Day View */}
                    {viewMode === 'day' && (
                        <div className="flex-1 overflow-y-auto">
                            {/* Day Header */}
                            <div className="flex items-center gap-4 mb-4 p-3 bg-amber-50 rounded-xl border-2 border-amber-200">
                                <button
                                    onClick={() => {
                                        const newDate = new Date(selectedDay.getTime() - 86400000)
                                        setSelectedDay(newDate)
                                        setCurrentWeek(newDate)
                                    }}
                                    className="w-8 h-8 flex items-center justify-center border-2 border-stone-900 rounded-lg hover:bg-amber-100 bg-white"
                                >←</button>
                                <div className="flex-1 text-center">
                                    <div className="text-lg font-bold text-stone-900">{formatDisplayDateWithYear(selectedDay)}</div>
                                    <div className="text-xs text-stone-500">{DAYS_VN[selectedDay.getDay() === 0 ? 6 : selectedDay.getDay() - 1]}</div>
                                </div>
                                <button
                                    onClick={() => {
                                        const newDate = new Date(selectedDay.getTime() + 86400000)
                                        setSelectedDay(newDate)
                                        setCurrentWeek(newDate)
                                    }}
                                    className="w-8 h-8 flex items-center justify-center border-2 border-stone-900 rounded-lg hover:bg-amber-100 bg-white"
                                >→</button>
                            </div>

                            {/* Vets with Slots */}
                            <div className="space-y-4">
                                {vets.map(vet => {
                                    // Use dayViewShifts which has slot details
                                    const vetShift = dayViewShifts.find(s => s.vetId === vet.userId && !s.isContinuation)

                                    return (
                                        <div
                                            key={vet.userId}
                                            className={`bg-white rounded-xl border-2 p-4 transition-all cursor-pointer hover:border-amber-500 hover:shadow-[3px_3px_0px_0px_rgba(251,191,36,0.5)] ${(selectedShift && vetShift && selectedShift.shiftId === vetShift.shiftId) ? 'border-amber-500 bg-amber-50' : (formData.vetId === vet.userId && !vetShift && formData.workDates.includes(formatDate(selectedDay))) ? 'border-amber-500 bg-amber-50' : 'border-stone-200'}`}
                                            onClick={() => {
                                                if (vetShift) {
                                                    setSelectedShift(vetShift)
                                                    setSidebarMode('detail')
                                                } else {
                                                    // No shift - switch to create mode with pre-filled vet and date
                                                    setSelectedShift(null)
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        vetId: vet.userId,
                                                        workDates: [formatDate(selectedDay)]
                                                    }))
                                                    setSidebarMode('create')
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-stone-100">
                                                {vet.avatar ? (
                                                    <img src={vet.avatar} alt="avt" className="w-10 h-10 rounded-full border-2 border-stone-900 object-cover" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center font-bold text-amber-600">
                                                        {vet.fullName.charAt(0)}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-bold text-stone-900">{vet.fullName}</div>
                                                    {vetShift && (
                                                        <div className="text-xs text-stone-500">
                                                            {vetShift.startTime.substring(0, 5)} - {vetShift.endTime.substring(0, 5)}
                                                            {vetShift.isOvernight && <span className="ml-2 text-indigo-600">(Ca đêm)</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {vetShift ? (
                                                <div className="grid grid-cols-4 gap-2">
                                                    {vetShift.slots?.map(slot => {
                                                        const isPast = new Date(vetShift.workDate) < new Date(new Date().setHours(0, 0, 0, 0))
                                                        return (
                                                            <div
                                                                key={slot.slotId}
                                                                className={`p-2 rounded-lg border text-xs font-bold ${slot.status === 'AVAILABLE'
                                                                    ? (isPast ? 'bg-stone-100 border-stone-200 text-stone-400' : 'bg-green-50 border-green-200 text-green-700')
                                                                    : slot.status === 'BLOCKED'
                                                                        ? 'bg-red-50 border-red-200 text-red-700'
                                                                        : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                                                    }`}
                                                            >
                                                                <div className="text-center">{slot.startTime.substring(0, 5)}</div>
                                                                <div className="text-[10px] opacity-70 text-center">
                                                                    {slot.status === 'AVAILABLE'
                                                                        ? (isPast ? 'Đã qua' : 'Trống')
                                                                        : slot.status === 'BLOCKED' ? 'Đã khóa' : 'Đã đặt'}
                                                                </div>
                                                                {/* Show booking info if booked */}
                                                                {slot.status === 'BOOKED' && slot.petName && (
                                                                    <div className="mt-1 pt-1 border-t border-yellow-300 text-[9px] text-yellow-800">
                                                                        <div className="truncate" title={slot.petName}>{slot.petName}</div>
                                                                        {slot.petOwnerName && (
                                                                            <div className="truncate opacity-70" title={slot.petOwnerName}>{slot.petOwnerName}</div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    }) || (
                                                            <div className="col-span-4 text-center text-stone-400 text-sm py-2">
                                                                Đang tải slots...
                                                            </div>
                                                        )}
                                                </div>
                                            ) : (
                                                <div className="text-center text-stone-400 text-sm py-4">
                                                    Không có ca làm việc
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Month View */}
                    {viewMode === 'month' && (
                        <div className="flex-1 overflow-y-auto">
                            {/* Month Header */}
                            <div className="flex items-center justify-center gap-4 mb-4 p-3 bg-amber-50 rounded-xl border-2 border-amber-200">
                                <button
                                    onClick={() => setCurrentWeek(new Date(currentWeek.getFullYear(), currentWeek.getMonth() - 1, 1))}
                                    className="w-8 h-8 flex items-center justify-center border-2 border-stone-900 rounded-lg hover:bg-amber-100 bg-white"
                                >←</button>
                                <CalendarPicker
                                    value={currentWeek}
                                    onChange={setCurrentWeek}
                                    mode="month"
                                />
                                <button
                                    onClick={() => setCurrentWeek(new Date(currentWeek.getFullYear(), currentWeek.getMonth() + 1, 1))}
                                    className="w-8 h-8 flex items-center justify-center border-2 border-stone-900 rounded-lg hover:bg-amber-100 bg-white"
                                >→</button>
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1">
                                {/* Day Headers */}
                                {DAYS_VN.map(day => (
                                    <div key={day} className="text-center text-xs font-bold text-stone-500 py-2">{day}</div>
                                ))}

                                {/* Days */}
                                {(() => {
                                    const firstDay = new Date(currentWeek.getFullYear(), currentWeek.getMonth(), 1)
                                    const lastDay = new Date(currentWeek.getFullYear(), currentWeek.getMonth() + 1, 0)
                                    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
                                    const days = []

                                    // Empty cells before first day
                                    for (let i = 0; i < startOffset; i++) {
                                        days.push(<div key={`empty-${i}`} className="h-20"></div>)
                                    }

                                    // Actual days
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
                                                onClick={() => {
                                                    setSelectedDay(date);
                                                    setCurrentWeek(date); // Sync week context
                                                    setViewMode('day');
                                                }}
                                                className={`h-20 p-2 rounded-lg border-2 cursor-pointer transition-all hover:border-amber-500 ${isToday ? 'bg-amber-50 border-amber-400' : 'bg-white border-stone-200'
                                                    }`}
                                            >
                                                <div className={`text-sm font-bold mb-1 ${isToday ? 'text-amber-600' : 'text-stone-700'}`}>{d}</div>
                                                {dayShifts.length > 0 && (
                                                    <div className="mt-1 space-y-1">
                                                        <div className="flex -space-x-2 overflow-hidden">
                                                            {dayShifts.slice(0, 3).map((s, idx) => (
                                                                <div key={idx} className="w-5 h-5 rounded-full border border-white bg-amber-100 flex items-center justify-center overflow-hidden shadow-sm" title={s.vetName}>
                                                                    {s.vetAvatar ? (
                                                                        <img src={s.vetAvatar} alt="avt" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <span className="text-[8px] font-bold text-amber-600">{s.vetName.charAt(0)}</span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            {dayShifts.length > 3 && (
                                                                <div className="w-5 h-5 rounded-full border border-white bg-stone-200 flex items-center justify-center text-[8px] font-bold text-stone-600">
                                                                    +{dayShifts.length - 3}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-green-600">{availSlots}/{totalSlots} slots</div>
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

            {/* Sidebar Panel */}
            <div className={`w-96 bg-white border-l-2 border-stone-900 p-6 shadow-[-4px_0px_0px_0px_rgba(0,0,0,0.05)] flex flex-col overflow-y-auto z-10`}>
                {/* Toggle Tabs */}
                <div className="flex mb-6 bg-stone-100 rounded-xl p-1 border-2 border-stone-200">
                    <button
                        onClick={() => {
                            // Sync formData with selectedShift when switching to create mode
                            if (selectedShift) {
                                setFormData(prev => ({
                                    ...prev,
                                    vetId: selectedShift.vetId,
                                    workDates: [selectedShift.workDate],
                                    startTime: selectedShift.startTime.substring(0, 5),
                                    endTime: selectedShift.endTime.substring(0, 5),
                                    breakStart: selectedShift.breakStart?.substring(0, 5),
                                    breakEnd: selectedShift.breakEnd?.substring(0, 5),
                                    isOvernight: selectedShift.isOvernight,
                                }))
                            }
                            setSidebarMode('create')
                        }}
                        className={`flex-1 py-2.5 px-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${sidebarMode === 'create'
                            ? 'bg-amber-500 text-white shadow-[2px_2px_0px_0px_rgba(28,25,23,0.5)]'
                            : 'text-stone-500 hover:text-stone-700'
                            }`}
                    >
                        <CalendarIcon className="w-4 h-4" />
                        Gán lịch
                    </button>
                    <button
                        onClick={() => setSidebarMode('detail')}
                        disabled={!selectedShift}
                        className={`flex-1 py-2.5 px-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${sidebarMode === 'detail' && selectedShift
                            ? 'bg-amber-500 text-white shadow-[2px_2px_0px_0px_rgba(28,25,23,0.5)]'
                            : !selectedShift
                                ? 'text-stone-300 cursor-not-allowed'
                                : 'text-stone-500 hover:text-stone-700'
                            }`}
                    >
                        <ClockIcon className="w-4 h-4" />
                        Chi tiết ca
                    </button>
                </div>

                {sidebarMode === 'detail' && selectedShift ? (
                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                        {/* Detail View */}
                        <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl border-2 border-amber-200">
                            {selectedShift.vetAvatar ? (
                                <img src={selectedShift.vetAvatar} alt="avt" className="w-12 h-12 rounded-full border-2 border-amber-400 object-cover" />
                            ) : (
                                <div className="w-12 h-12 bg-white rounded-full border-2 border-amber-400 flex items-center justify-center font-bold text-xl text-amber-600">
                                    {selectedShift.vetName.charAt(0)}
                                </div>
                            )}
                            <div>
                                <h3 className="font-bold text-lg text-stone-900">{selectedShift.vetName}</h3>
                                <p className="text-stone-500 text-sm">{selectedShift.workDate}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-stone-400 uppercase">Khung giờ</label>
                                <div className="text-2xl font-bold text-stone-900">{selectedShift.startTime.substring(0, 5)} - {selectedShift.endTime.substring(0, 5)}</div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-2 bg-white rounded-xl border-2 border-green-200 text-center">
                                    <div className="text-xl font-bold text-green-600">{selectedShift.availableSlots}</div>
                                    <div className="text-[10px] font-bold text-green-800">Trống</div>
                                </div>
                                <div className="p-2 bg-white rounded-xl border-2 border-yellow-200 text-center">
                                    <div className="text-xl font-bold text-yellow-600">{selectedShift.bookedSlots}</div>
                                    <div className="text-[10px] font-bold text-yellow-800">Đã đặt</div>
                                </div>
                                <div className="p-2 bg-white rounded-xl border-2 border-red-200 text-center">
                                    <div className="text-xl font-bold text-red-600">{selectedShift.blockedSlots}</div>
                                    <div className="text-[10px] font-bold text-red-800">Đã khóa</div>
                                </div>
                            </div>
                        </div>

                        {/* Slots List */}
                        <div>
                            <label className="text-xs font-bold text-stone-400 uppercase mb-2 block">Danh sách Slots</label>
                            {loadingSlots ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : shiftDetail?.slots && shiftDetail.slots.length > 0 ? (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {shiftDetail.slots.map((slot: SlotResponse) => {
                                        const isPastShift = new Date(selectedShift.workDate) < new Date(new Date().setHours(0, 0, 0, 0))
                                        return (
                                            <div
                                                key={slot.slotId}
                                                className={`flex items-center justify-between p-2.5 rounded-lg border-2 ${slot.status === 'AVAILABLE'
                                                    ? (isPastShift ? 'border-stone-200 bg-stone-50 opacity-60' : 'border-green-200 bg-green-50')
                                                    : slot.status === 'BLOCKED'
                                                        ? 'border-red-200 bg-red-50'
                                                        : 'border-yellow-200 bg-yellow-50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-bold text-sm ${isPastShift && slot.status === 'AVAILABLE' ? 'text-stone-400' : 'text-stone-900'}`}>
                                                        {slot.startTime.substring(0, 5)} - {slot.endTime.substring(0, 5)}
                                                    </span>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${slot.status === 'AVAILABLE'
                                                        ? (isPastShift ? 'bg-stone-200 text-stone-500' : 'bg-green-500 text-white')
                                                        : slot.status === 'BLOCKED'
                                                            ? 'bg-red-500 text-white'
                                                            : 'bg-yellow-500 text-white'
                                                        }`}>
                                                        {slot.status === 'AVAILABLE'
                                                            ? (isPastShift ? 'Đã qua' : 'Trống')
                                                            : slot.status === 'BLOCKED' ? 'Đã khóa' : 'Đã đặt'}
                                                    </span>
                                                </div>
                                                {!isPastShift && slot.status === 'AVAILABLE' && (
                                                    <button
                                                        onClick={() => handleBlockSlot(slot.slotId)}
                                                        className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                                        title="Khóa slot này"
                                                    >
                                                        <LockClosedIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {!isPastShift && slot.status === 'BLOCKED' && (
                                                    <button
                                                        onClick={() => handleUnblockSlot(slot.slotId)}
                                                        className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                                        title="Mở khóa slot này"
                                                    >
                                                        <LockOpenIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {slot.status === 'BOOKED' && (
                                                    <span className="text-[10px] text-yellow-700 font-bold">Có lịch hẹn</span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-stone-400 text-sm">Không có slots</div>
                            )}
                        </div>

                        <div className="pt-4 space-y-3 border-t border-stone-200">
                            <button
                                onClick={handleUseAsTemplate}
                                className="w-full py-3 px-4 bg-white text-stone-900 border-2 border-stone-900 rounded-xl font-bold text-sm shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(28,25,23,1)] transition-all flex items-center justify-center gap-2"
                            >
                                <DocumentDuplicateIcon className="w-5 h-5" /> Dùng làm mẫu
                            </button>
                            <button
                                onClick={() => setIsDeleteModalOpen(true)}
                                className="w-full py-3 px-4 bg-red-50 text-red-600 border-2 border-red-200 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors"
                            >
                                Xóa ca làm việc
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleCreateShift} className="space-y-5 animate-in slide-in-from-right duration-300">
                        {/* Create Form */}
                        <div>
                            <label className="text-sm font-bold text-stone-900 mb-2 block">Chọn Bác sĩ</label>
                            <div className="relative" ref={vetSelectorRef}>
                                <div
                                    className={`w-full p-4 bg-white border-2 rounded-xl font-medium cursor-pointer flex items-center justify-between transition-all ${isVetSelectorOpen ? 'border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,0.8)]' : 'border-stone-200'}`}
                                    onClick={() => !isEditMode && setIsVetSelectorOpen(!isVetSelectorOpen)}
                                >
                                    <div className="flex items-center gap-3">
                                        {formData.vetId ? (
                                            <>
                                                {vets.find(v => v.userId === formData.vetId)?.avatar ? (
                                                    <img src={vets.find(v => v.userId === formData.vetId)?.avatar} alt="avt" className="w-6 h-6 rounded-full border border-stone-900 object-cover" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-amber-100 border border-stone-900 flex items-center justify-center text-[10px] font-bold text-amber-600">
                                                        {vets.find(v => v.userId === formData.vetId)?.fullName.charAt(0)}
                                                    </div>
                                                )}
                                                <span className="text-stone-900 font-bold">{vets.find(v => v.userId === formData.vetId)?.fullName}</span>
                                            </>
                                        ) : (
                                            <span className="text-stone-400">-- Chọn bác sĩ --</span>
                                        )}
                                    </div>
                                    <UserIcon className={`w-5 h-5 transition-transform ${isVetSelectorOpen ? 'rotate-180 text-stone-900' : 'text-stone-400'}`} />
                                </div>

                                {isVetSelectorOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] z-50 py-1 overflow-hidden">
                                        <div className="max-h-60 overflow-y-auto">
                                            {vets.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-stone-400 italic">Không có bác sĩ nào</div>
                                            ) : (
                                                vets.map(v => (
                                                    <div
                                                        key={v.userId}
                                                        onClick={() => {
                                                            setFormData({ ...formData, vetId: v.userId });
                                                            setIsVetSelectorOpen(false);
                                                        }}
                                                        className={`flex items-center gap-3 p-4 hover:bg-amber-50 cursor-pointer transition-colors ${formData.vetId === v.userId ? 'bg-amber-50 border-l-4 border-amber-500 pl-3' : 'pl-4'}`}
                                                    >
                                                        {v.avatar ? (
                                                            <img src={v.avatar} alt="avt" className="w-8 h-8 rounded-full border-2 border-stone-900 object-cover" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-amber-100 border-2 border-stone-900 flex items-center justify-center font-bold text-amber-600">
                                                                {v.fullName.charAt(0)}
                                                            </div>
                                                        )}
                                                        <div className="font-bold text-stone-900 text-sm">{v.fullName}</div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-bold text-stone-900 mb-2 flex justify-between">
                                <span>Ngày đã chọn</span>
                                <span className="text-amber-600 font-bold">{formData.workDates.length} ngày</span>
                            </label>
                            <div className="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto p-1">
                                {formData.workDates.length === 0 && <span className="text-stone-400 text-sm italic">Kéo chuột trên lịch để chọn ngày...</span>}
                                {formData.workDates.map(d => (
                                    <span key={d} className="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-bold rounded-lg border border-amber-200">
                                        {d.split('-').reverse().join('/')}
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setFormData({ ...formData, workDates: weekDates.filter(d => d.getDay() !== 0).map(formatDate) })} className="flex-1 py-2 bg-stone-100 rounded-lg text-xs font-bold text-stone-600 hover:bg-stone-200 transition-colors">T2 - T7</button>
                                <button type="button" onClick={() => setFormData({ ...formData, workDates: weekDates.filter(d => [1, 3, 5].includes(d.getDay())).map(formatDate) })} className="flex-1 py-2 bg-stone-100 rounded-lg text-xs font-bold text-stone-600 hover:bg-stone-200 transition-colors">2 - 4 - 6</button>
                                <button type="button" onClick={() => setFormData({ ...formData, workDates: weekDates.filter(d => [2, 4, 6].includes(d.getDay())).map(formatDate) })} className="flex-1 py-2 bg-stone-100 rounded-lg text-xs font-bold text-stone-600 hover:bg-stone-200 transition-colors">3 - 5 - 7</button>
                            </div>
                        </div>

                        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                            <label className="text-xs font-bold text-stone-500 uppercase mb-3 block">Tự động lặp lại</label>
                            <div className="flex items-center gap-4">
                                <select
                                    value={formData.repeatWeeks}
                                    onChange={(e) => setFormData({ ...formData, repeatWeeks: Number(e.target.value) })}
                                    className="flex-1 p-2 bg-white border border-stone-300 rounded-lg text-sm font-bold focus:border-stone-900 focus:outline-none"
                                >
                                    <option value={1}>Chỉ tuần này</option>
                                    <option value={2}>2 Tuần tới</option>
                                    <option value={4}>4 Tuần (1 Tháng)</option>
                                    <option value={8}>8 Tuần</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-stone-500 mb-1 block">Giờ vào</label>
                                <input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} className="w-full p-3 bg-white border-2 border-stone-200 rounded-xl font-bold focus:border-stone-900 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-stone-500 mb-1 block">Giờ ra</label>
                                <input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} className="w-full p-3 bg-white border-2 border-stone-200 rounded-xl font-bold focus:border-stone-900 focus:outline-none" />
                            </div>
                        </div>

                        {/* Overnight shift toggle */}
                        <div
                            className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.isOvernight ? 'bg-indigo-50 border-indigo-300' : 'bg-stone-50 border-stone-200 hover:border-stone-300'}`}
                            onClick={() => {
                                const newOvernight = !formData.isOvernight
                                setFormData({
                                    ...formData,
                                    isOvernight: newOvernight,
                                    // Auto-clear break times when enabling overnight
                                    breakStart: newOvernight ? undefined : formData.breakStart,
                                    breakEnd: newOvernight ? undefined : formData.breakEnd
                                })
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${formData.isOvernight ? 'bg-indigo-500 text-white' : 'bg-stone-200 text-stone-500'}`}>
                                    <MoonIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-stone-900">Ca đêm (Overnight)</div>
                                    <div className="text-xs text-stone-500">Kết thúc vào ngày hôm sau</div>
                                </div>
                            </div>
                            <div className={`w-12 h-7 rounded-full p-1 transition-colors ${formData.isOvernight ? 'bg-indigo-500' : 'bg-stone-300'}`}>
                                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${formData.isOvernight ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </div>
                        </div>

                        {/* Break time note - always from clinic */}
                        {!formData.isOvernight && (
                            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                                <div className="text-xs font-bold text-stone-500">Giờ nghỉ trưa</div>
                                <div className="text-xs text-stone-400 italic">Tự động theo cài đặt phòng khám</div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 px-4 text-white border-2 border-stone-900 rounded-xl font-bold text-base shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(28,25,23,1)] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-1 ${isEditMode ? 'bg-teal-500' : 'bg-amber-500'}`}
                        >
                            {loading ? 'Đang xử lý...' : isEditMode ? 'CẬP NHẬT CA' : 'XÁC NHẬN GÁN LỊCH'}
                        </button>
                    </form>
                )}
            </div>

            {/* Confirmation Modals */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                title="Xóa ca làm việc?"
                message={`Bạn có chắc muốn xóa ca làm việc ngày ${selectedShift?.workDate}? Hành động này không thể hoàn tác.`}
                confirmLabel="Xóa ngay"
                cancelLabel="Hủy bỏ"
                isDanger={true}
                onConfirm={handleDeleteShift}
                onCancel={() => setIsDeleteModalOpen(false)}
            />

            <ConfirmModal
                isOpen={isBulkDeleteModalOpen}
                title="Xóa nhiều ca?"
                message={`Bạn đang chọn xóa ${selectedShiftIds.length} ca làm việc. Tất cả dữ liệu của các ca này sẽ bị xóa. Bạn có chắc không?`}
                confirmLabel={`Đồng ý xóa ${selectedShiftIds.length} ca`}
                cancelLabel="Giữ lại"
                isDanger={true}
                onConfirm={handleBulkDelete}
                onCancel={() => setIsBulkDeleteModalOpen(false)}
            />

            {/* Conflict Warning Modal */}
            {isConflictModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold text-amber-600 mb-3 flex items-center gap-2">
                            Phát hiện ca trùng lịch
                        </h3>
                        <p className="text-stone-600 text-sm mb-4">
                            Bác sĩ đã có ca làm việc trong các khung giờ sau:
                        </p>
                        <div className="max-h-40 overflow-y-auto mb-4">
                            {conflictDetails.map((c, idx) => (
                                <div key={idx} className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2 text-sm">
                                    <div className="font-bold text-stone-900">{c.date}</div>
                                    <div className="text-stone-600">Ca hiện có: <span className="font-medium">{c.existingShift}</span></div>
                                    <div className="text-amber-700">Ca mới: <span className="font-medium">{c.newShift}</span></div>
                                </div>
                            ))}
                        </div>
                        <p className="text-stone-500 text-xs mb-4">
                            Nếu tiếp tục, hệ thống sẽ <strong>cập nhật</strong> ca mới đè lên ca cũ.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsConflictModalOpen(false)}
                                className="flex-1 px-4 py-2 border-2 border-stone-300 rounded-xl font-bold text-stone-600 hover:bg-stone-100 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={(e) => {
                                    setIsConflictModalOpen(false)
                                    handleCreateShift(e, true)
                                }}
                                className="flex-1 px-4 py-2 bg-amber-500 text-white border-2 border-stone-900 rounded-xl font-bold shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] hover:bg-amber-600 transition-colors"
                            >
                                Vẫn tạo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default VetShiftPage
