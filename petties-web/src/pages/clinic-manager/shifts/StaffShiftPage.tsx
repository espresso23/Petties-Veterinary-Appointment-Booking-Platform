import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../store/authStore'
import { staffShiftService } from '../../../services/api/staffShiftService'
import { clinicStaffService } from '../../../services/api/clinicStaffService'
import { clinicService } from '../../../services/api/clinicService'
import type { StaffShiftResponse, StaffShiftRequest } from '../../../types/staffshift'
import type { StaffMember } from '../../../types/clinicStaff'
import type { ClinicResponse } from '../../../types/clinic'
import { useToast } from '../../../components/Toast'
import { ConfirmModal } from '../../../components/ConfirmModal'
import { CalendarPicker } from '../../../components/CalendarPicker'
import { TrashIcon, DocumentDuplicateIcon, HandRaisedIcon, UserIcon, ClockIcon, MoonIcon, ArrowRightIcon, LockClosedIcon, LockOpenIcon, CalendarIcon } from '@heroicons/react/24/outline'
import { ShiftTableGridView } from './ShiftTableGridView'
import { mergeSlots } from './shiftTableUtils'
import type { MergedSlot } from './shiftTableUtils'
import {
    formatDate,
    formatDisplayDate,
    formatDisplayDateWithYear,
    formatWeekRange,
    getWeekDates,
    DAYS_VN,
    getDefaultBreakForDate,
    timesOverlap,
    type ConflictItem,
} from './staffShiftPageUtils'
import '../../../styles/brutalist.css'

export const StaffShiftPage = () => {
    const { user } = useAuthStore()
    const navigate = useNavigate()
    const clinicId = user?.workingClinicId
    const { showToast } = useToast()

    // --- State: Calendar & view ---
    const [currentWeek, setCurrentWeek] = useState(new Date())
    const [weekDates, setWeekDates] = useState<Date[]>([])
    const [viewMode, setViewMode] = useState<'week' | 'day' | 'month' | 'table'>('table')
    const [selectedDay, setSelectedDay] = useState<Date>(new Date())
    const [tableSlotStart, setTableSlotStart] = useState('08:00')
    const [tableSlotEnd, setTableSlotEnd] = useState('17:00')

    // --- State: Data ---
    const [shifts, setShifts] = useState<StaffShiftResponse[]>([])
    const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
    const [clinicDetail, setClinicDetail] = useState<ClinicResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [dayViewShifts, setDayViewShifts] = useState<StaffShiftResponse[]>([])

    // --- State: Selection (delete multiple / drag select) ---
    const [selectionMode, setSelectionMode] = useState(false)
    const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const [hasMoved, setHasMoved] = useState(false)
    const [dragStartPos, setDragStartPos] = useState<{ staffId: string; dateIndex: number } | null>(null)
    const [dragEndPos, setDragEndPos] = useState<{ staffId: string; dateIndex: number } | null>(null)
    const [dragType, setDragType] = useState<'create' | 'delete' | null>(null)
    const dragStateRef = useRef({
        isDragging: false,
        hasMoved: false,
        startPos: null as { staffId: string; dateIndex: number } | null,
        endPos: null as { staffId: string; dateIndex: number } | null,
    })

    // --- State: Modals & UI ---
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false)
    const [isConflictModalOpen, setIsConflictModalOpen] = useState(false)
    const [conflictDetails, setConflictDetails] = useState<ConflictItem[]>([])
    const [isStaffSelectorOpen, setIsStaffSelectorOpen] = useState(false)
    const staffSelectorRef = useRef<HTMLDivElement>(null)

    // --- State: Sidebar (form + detail) ---
    const [formData, setFormData] = useState<StaffShiftRequest>({
        staffId: '',
        workDates: [],
        startTime: '08:00',
        endTime: '17:00',
        repeatWeeks: 1,
    })
    const [selectedShift, setSelectedShift] = useState<StaffShiftResponse | null>(null)
    const [shiftDetail, setShiftDetail] = useState<StaffShiftResponse | null>(null)
    const [loadingSlots, setLoadingSlots] = useState(false)
    const [sidebarMode, setSidebarMode] = useState<'create' | 'detail'>('create')

    // --- Effects: Derived (weekDates từ currentWeek) ---
    useEffect(() => {
        const newWeekDates = getWeekDates(new Date(currentWeek))
        setWeekDates(newWeekDates)
    }, [currentWeek.getTime()])

    // --- Effects: Data (staff, clinic, shifts) ---
    // --- Effects: Close dropdown when clicking outside ---
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (staffSelectorRef.current && !staffSelectorRef.current.contains(event.target as Node)) {
                setIsStaffSelectorOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (clinicId) fetchStaff()
    }, [clinicId])

    useEffect(() => {
        if (!clinicId) return
        clinicService.getClinicById(clinicId).then(setClinicDetail).catch(() => setClinicDetail(null))
    }, [clinicId])

    useEffect(() => {
        if (!clinicDetail || formData.workDates.length === 0 || formData.breakStart != null || formData.breakEnd != null) return
        const firstDate = new Date(formData.workDates[0])
        const def = getDefaultBreakForDate(clinicDetail, firstDate)
        if (def) setFormData(prev => ({ ...prev, breakStart: def.breakStart, breakEnd: def.breakEnd }))
    }, [clinicDetail, formData.workDates.join(','), formData.breakStart, formData.breakEnd])

    // --- Effects: Fetch shifts (by viewMode) ---
    useEffect(() => {
        if (!clinicId || (viewMode !== 'table' && viewMode !== 'day') || !selectedDay) return
        fetchShifts()
    }, [clinicId, viewMode, selectedDay.getTime()])

    useEffect(() => {
        if (!clinicId || viewMode === 'table' || viewMode === 'day') return
        if (weekDates.length === 0) return
        fetchShifts()
    }, [clinicId, viewMode, weekDates])

    const fetchStaff = async () => {
        if (!clinicId) return
        try {
            const staffList = await clinicStaffService.getClinicStaff(clinicId)
            const filteredStaff = staffList.filter(s => s.role === 'STAFF')
            setStaffMembers(filteredStaff)
        } catch (err: any) {
            console.error('fetchStaff error:', err)
        }
    }

    const fetchShifts = async () => {
        if (!clinicId) return
        if (viewMode === 'table' || viewMode === 'day') {
            if (!selectedDay) return
            setLoading(true)
            try {
                const dayStr = formatDate(selectedDay)
                const data = await staffShiftService.getShiftsByClinic(clinicId, dayStr, dayStr)
                setShifts(data)
            } catch (err: any) {
                showToast('error', err.response?.data?.message || err.message || 'Lỗi tải lịch')
            } finally {
                setLoading(false)
            }
            return
        }
        // Week: needs weekDates
        if (weekDates.length === 0) return
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

            const data = await staffShiftService.getShiftsByClinic(clinicId, startDate, endDate)
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

    // --- Fetch shifts with slots for Day View & Table View ---
    useEffect(() => {
        if ((viewMode !== 'day' && viewMode !== 'table') || !clinicId) return

        const fetchDayShifts = async () => {
            const dayStr = formatDate(selectedDay)
            const dayShifts = shifts.filter(s => s.workDate === dayStr && !s.isContinuation)

            // Fetch detail for each shift to get slots
            const detailPromises = dayShifts.map(s => staffShiftService.getShiftDetail(s.shiftId))
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
            await staffShiftService.blockSlot(slotId)
            // Refresh shift detail
            if (selectedShift) {
                const detail = await staffShiftService.getShiftDetail(selectedShift.shiftId)
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
            await staffShiftService.unblockSlot(slotId)
            // Refresh shift detail
            if (selectedShift) {
                const detail = await staffShiftService.getShiftDetail(selectedShift.shiftId)
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

    // --- Handlers: Drag selection (week) ---
    const handleCellMouseDown = (staffId: string, dateIndex: number, hasShift: boolean) => {
        // Sync Ref immediately
        dragStateRef.current = {
            isDragging: true,
            hasMoved: false,
            startPos: { staffId, dateIndex },
            endPos: { staffId, dateIndex }
        }

        setIsDragging(true)
        setHasMoved(false) // Reset move tracking
        setDragStartPos({ staffId, dateIndex })
        setDragEndPos({ staffId, dateIndex })

        const type = hasShift ? 'delete' : 'create'
        setDragType(type)

        const dateStr = formatDate(weekDates[dateIndex])

        if (type === 'create') {
            setFormData(prev => ({ ...prev, staffId, workDates: [dateStr] }))
            setSelectionMode(false)
        } else {
            // Delete mode - still update formData to show selection in sidebar
            setFormData(prev => ({ ...prev, staffId, workDates: [dateStr] }))
            const shift = shifts.find(s => s.staffId === staffId && s.workDate === dateStr)
            if (shift) {
                setSelectedShiftIds([shift.shiftId])
                setSelectionMode(true)
            }
        }
    }

    const handleCellMouseEnter = (staffId: string, dateIndex: number) => {
        // Use Ref for check
        if (!dragStateRef.current.isDragging || !dragStateRef.current.startPos) return
        if (staffId !== dragStateRef.current.startPos.staffId) return // Only horizontal drag

        // Update Ref
        dragStateRef.current.endPos = { staffId, dateIndex }
        dragStateRef.current.hasMoved = true

        setDragEndPos({ staffId, dateIndex })
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
                const shift = shifts.find(s => s.staffId === staffId && s.workDate === dateStr)
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
                    s.staffId === startPos.staffId &&
                    (s.displayDate || s.workDate) === dateStr &&
                    !s.isContinuation
                )

                if (clickedShift) {
                    // Click on existing shift → Open detail
                    setFormData({
                        staffId: clickedShift.staffId,
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
                    setFormData(prev => ({ ...prev, staffId: startPos.staffId, workDates: [dateStr] }))
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
            const staffId = formData.staffId
            const selectedDates = formData.workDates
            const existingShifts = shifts.filter(s => s.staffId === staffId && selectedDates.includes(s.workDate))

            if (existingShifts.length > 0 && existingShifts.length === selectedDates.length) {
                const firstShift = existingShifts[0]
                setFormData(prev => ({
                    ...prev, // to keep staffId and workDates
                    startTime: firstShift.startTime.substring(0, 5),
                    endTime: firstShift.endTime.substring(0, 5),
                    isOvernight: firstShift.isOvernight,
                    // If overnight, clear explicit breaks to match toggle logic
                    breakStart: firstShift.isOvernight ? undefined : prev.breakStart,
                    breakEnd: firstShift.isOvernight ? undefined : prev.breakEnd
                }))
            }
        }
    }, [isDragging, hasMoved, dragType, dragStartPos, dragEndPos, weekDates, shifts, formData.workDates, formData.staffId, selectedShiftIds.length, showToast])

    useEffect(() => {
        window.addEventListener('mouseup', handleDragEndGlobal)
        return () => window.removeEventListener('mouseup', handleDragEndGlobal)
    }, [handleDragEndGlobal])

    // --- Actions: Check for conflicts ---
    const checkForConflicts = (): ConflictItem[] => {
        const conflicts: ConflictItem[] = []

        formData.workDates.forEach(date => {
            const existingShiftsOnDate = shifts.filter(s =>
                s.staffId === formData.staffId && s.workDate === date && !s.isContinuation
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
                shifts.some(s => s.staffId === formData.staffId && s.workDate === date)
            ))

            const { breakStart: _bS, breakEnd: _bE, ...rest } = formData
            const requestData: StaffShiftRequest = {
                ...rest,
                isOvernight: finalIsOvernight,
                forceUpdate: isEditing
            }
            const createdShifts = await staffShiftService.createShift(clinicId, requestData)

            if (forceCreate) {
                showToast('success', `Đã cập nhật ${createdShifts.length} ca làm việc (đè lên ca cũ)`)
            } else if (isEditing) {
                showToast('success', `Đã cập nhật ${createdShifts.length} ca làm việc`)
            } else {
                showToast('success', `Đã tạo ${createdShifts.length} ca làm việc (${formData.repeatWeeks} tuần)`)
            }

            setFormData({
                staffId: '',
                workDates: [],
                startTime: '08:00',
                endTime: '17:00',
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
            await staffShiftService.deleteShift(selectedShift.shiftId)
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
            await staffShiftService.bulkDeleteShifts(selectedShiftIds)
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
            staffId: selectedShift.staffId,
            workDates: [selectedShift.workDate],
            startTime: selectedShift.startTime.substring(0, 5),
            endTime: selectedShift.endTime.substring(0, 5),
            isOvernight: selectedShift.isOvernight,
            breakStart: selectedShift.isOvernight ? undefined : (selectedShift.breakStart?.substring(0, 5) || '12:00'),
            breakEnd: selectedShift.isOvernight ? undefined : (selectedShift.breakEnd?.substring(0, 5) || '13:00'),
            repeatWeeks: 4,
        })
        setSelectedShift(null)
        showToast('info', 'Đã nạp mẫu ca làm việc.')
    }

    const shiftsByStaff = shifts.reduce((acc, shift) => {
        if (!acc[shift.staffId]) {
            acc[shift.staffId] = { name: shift.staffName, avatar: shift.staffAvatar, shifts: [] }
        }
        acc[shift.staffId].shifts.push(shift)
        return acc
    }, {} as Record<string, { name: string; avatar: string | null; shifts: StaffShiftResponse[] }>)

    // Detect if we're editing existing shifts (all selected dates have shifts)
    const isEditMode = formData.staffId && formData.workDates.length > 0 && formData.workDates.every(date =>
        shifts.some(s => s.staffId === formData.staffId && s.workDate === date)
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
                            onClick={() => setViewMode('table')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${viewMode === 'table'
                                ? 'bg-amber-500 text-white shadow-[2px_2px_0px_0px_rgba(28,25,23,0.5)]'
                                : 'text-stone-500 hover:text-stone-700'
                                }`}
                        >
                            Bảng khung giờ
                        </button>
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
                        <button
                            onClick={() => {
                                if (viewMode === 'table') {
                                    const n = new Date(selectedDay)
                                    n.setDate(n.getDate() - 1)
                                    setSelectedDay(n)
                                    setCurrentWeek(n)
                                } else {
                                    handlePrevWeek()
                                }
                            }}
                            className="w-10 h-10 flex items-center justify-center border-2 border-stone-900 rounded-xl hover:bg-amber-100 transition-colors bg-white shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                        >←</button>
                        <CalendarPicker
                            value={viewMode === 'table' ? selectedDay : currentWeek}
                            onChange={(date) => {
                                setCurrentWeek(date)
                                setSelectedDay(date)
                                if (viewMode === 'week') setViewMode('day')
                            }}
                            mode="date"
                            displayFormat={() => viewMode === 'table'
                                ? formatDisplayDateWithYear(selectedDay)
                                : weekDates.length > 0 ? formatWeekRange(weekDates[0], weekDates[6]) : ''
                            }
                        />
                        <button
                            onClick={() => {
                                if (viewMode === 'table') {
                                    const n = new Date(selectedDay)
                                    n.setDate(n.getDate() + 1)
                                    setSelectedDay(n)
                                    setCurrentWeek(n)
                                } else {
                                    handleNextWeek()
                                }
                            }}
                            className="w-10 h-10 flex items-center justify-center border-2 border-stone-900 rounded-xl hover:bg-amber-100 transition-colors bg-white shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                        >→</button>
                    </div>
                </div>

                {/* Calendar Content - With overflow for scrolling */}
                <div className="flex-1 bg-white rounded-2xl border-2 border-stone-900 p-5 shadow-[4px_4px_0px_0px_rgba(28,25,23,0.8)] flex flex-col overflow-hidden">

                    {/* Table View - Bảng khung giờ */}
                    {viewMode === 'table' && (
                        <ShiftTableGridView
                            staffMembers={staffMembers}
                            dayViewShifts={dayViewShifts}
                            selectedDay={selectedDay}
                            loading={loading}
                            slotStart={tableSlotStart}
                            slotEnd={tableSlotEnd}
                            onSlotStartChange={setTableSlotStart}
                            onSlotEndChange={setTableSlotEnd}
                            onDayPrev={() => {
                                const newDate = new Date(selectedDay.getTime() - 86400000)
                                setSelectedDay(newDate)
                                setCurrentWeek(newDate)
                            }}
                            onDayNext={() => {
                                const newDate = new Date(selectedDay.getTime() + 86400000)
                                setSelectedDay(newDate)
                                setCurrentWeek(newDate)
                            }}
                            selectedShift={selectedShift}
                            formStaffId={formData.staffId || null}
                            onRowClick={(staffId, staffShift, dateStr) => {
                                if (staffShift) {
                                    setSelectedShift(staffShift)
                                    setSidebarMode('detail')
                                } else {
                                    setSelectedShift(null)
                                    setFormData(prev => ({ ...prev, staffId, workDates: [dateStr] }))
                                    setSidebarMode('create')
                                }
                            }}
                            onTimeRangeSelect={(staffId, dateStr, startTime, endTime) => {
                                setSelectedShift(null)
                                setFormData(prev => ({
                                    ...prev,
                                    staffId,
                                    workDates: [dateStr],
                                    startTime,
                                    endTime,
                                }))
                                setSidebarMode('create')
                            }}
                        />
                    )}

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
                                    Nhân viên
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
                                    staffMembers.map(staff => {
                                        const staffShifts = shiftsByStaff[staff.userId]?.shifts || []
                                        return (
                                            <div key={staff.userId} className="grid grid-cols-8 gap-3">
                                                {/* Staff Info */}
                                                <div className="bg-white border-2 border-stone-900 rounded-xl p-3 flex flex-col items-center justify-center gap-2 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)]">
                                                    {staff.avatar ? (
                                                        <img src={staff.avatar} alt="avt" className="w-10 h-10 rounded-full border-2 border-stone-900 object-cover" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full border-2 border-stone-900 bg-amber-100 flex items-center justify-center font-bold text-amber-600">
                                                            {staff.fullName?.charAt(0) || '?'}
                                                        </div>
                                                    )}
                                                    <span className="font-bold text-sm text-center leading-tight">{staff.fullName}</span>
                                                </div>

                                                {/* Days */}
                                                {weekDates.map((date, i) => {
                                                    const dateStr = formatDate(date)
                                                    // Use displayDate for matching (handles overnight continuation)
                                                    const dayShift = staffShifts.find(s => (s.displayDate || s.workDate) === dateStr)
                                                    const isSelectedInSidebar = formData.staffId === staff.userId && formData.workDates.includes(dateStr)
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
                                                            onMouseDown={() => !isPast && !isContinuation && handleCellMouseDown(staff.userId, i, !!dayShift)}
                                                            onMouseEnter={() => !isPast && !isContinuation && handleCellMouseEnter(staff.userId, i)}
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

                            {/* Staff with Slots */}
                            <div className="space-y-4">
                                {staffMembers.map(staff => {
                                    // Use dayViewShifts which has slot details
                                    const staffShift = dayViewShifts.find(s => s.staffId === staff.userId && !s.isContinuation)

                                    return (
                                        <div
                                            key={staff.userId}
                                            className={`bg-white rounded-xl border-2 p-4 transition-all cursor-pointer hover:border-amber-500 hover:shadow-[3px_3px_0px_0px_rgba(251,191,36,0.5)] ${(selectedShift && staffShift && selectedShift.shiftId === staffShift.shiftId) ? 'border-amber-500 bg-amber-50' : (formData.staffId === staff.userId && !staffShift && formData.workDates.includes(formatDate(selectedDay))) ? 'border-amber-500 bg-amber-50' : 'border-stone-200'}`}
                                            onClick={() => {
                                                if (staffShift) {
                                                    setSelectedShift(staffShift)
                                                    setSidebarMode('detail')
                                                } else {
                                                    // No shift - switch to create mode with pre-filled staff and date
                                                    setSelectedShift(null)
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        staffId: staff.userId,
                                                        workDates: [formatDate(selectedDay)]
                                                    }))
                                                    setSidebarMode('create')
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-stone-100">
                                                {staff.avatar ? (
                                                    <img src={staff.avatar} alt="avt" className="w-10 h-10 rounded-full border-2 border-stone-900 object-cover" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center font-bold text-amber-600">
                                                        {staff.fullName?.charAt(0) || '?'}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-bold text-stone-900">{staff.fullName}</div>
                                                    {staffShift && (
                                                        <div className="text-xs text-stone-500">
                                                            {staffShift.startTime.substring(0, 5)} - {staffShift.endTime.substring(0, 5)}
                                                            {staffShift.isOvernight && <span className="ml-2 text-indigo-600">(Ca đêm)</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {staffShift ? (
                                                <div className="grid grid-cols-4 gap-2">
                                                    {mergeSlots(staffShift.slots).map((mergedSlot, idx) => {
                                                        const isPast = new Date(staffShift.workDate) < new Date(new Date().setHours(0, 0, 0, 0));
                                                        const colSpan = Math.min(mergedSlot.span, 4);

                                                        if (mergedSlot.status === 'BOOKED') {
                                                            return (
                                                                <div
                                                                    key={`${mergedSlot.id}-${idx}`}
                                                                    className={`relative group p-3 rounded-lg border-2 text-xs font-bold bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 text-yellow-800 cursor-pointer hover:border-yellow-500 hover:shadow-lg transition-all`}
                                                                    style={{ gridColumn: `span ${colSpan}` }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigate(`/clinic-manager/bookings?bookingId=${mergedSlot.bookingId}`);
                                                                    }}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div>
                                                                            <div className="text-sm font-bold text-amber-700">
                                                                                {mergedSlot.startTime.substring(0, 5)} - {mergedSlot.endTime.substring(0, 5)}
                                                                            </div>
                                                                            <div className="text-[10px] text-yellow-600 mt-0.5">
                                                                                {mergedSlot.serviceName || `${mergedSlot.span} slot (${mergedSlot.span * 30} phút)`}
                                                                            </div>
                                                                        </div>
                                                                        {mergedSlot.petName && (
                                                                            <div className="text-right">
                                                                                <div className="font-bold text-amber-800">{mergedSlot.petName}</div>
                                                                                {mergedSlot.petOwnerName && (
                                                                                    <div className="text-[9px] text-yellow-600">{mergedSlot.petOwnerName}</div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        } else {
                                                            return (
                                                                <div
                                                                    key={mergedSlot.id}
                                                                    className={`p-2 rounded-lg border text-xs font-bold flex flex-col items-center justify-center ${mergedSlot.status === 'AVAILABLE'
                                                                        ? (isPast ? 'bg-stone-100 border-stone-200 text-stone-400' : 'bg-green-50 border-green-200 text-green-700')
                                                                        : 'bg-red-50 border-red-200 text-red-700'
                                                                        }`}
                                                                    style={{ gridColumn: `span ${colSpan}` }}
                                                                >
                                                                    <div className="text-center font-black tracking-tighter">
                                                                        {mergedSlot.startTime.substring(0, 5)} - {mergedSlot.endTime.substring(0, 5)}
                                                                    </div>
                                                                    <div className="text-[9px] opacity-70 text-center uppercase">
                                                                        {mergedSlot.status === 'AVAILABLE'
                                                                            ? (isPast ? 'Đã qua' : `Trống (${mergedSlot.span * 30}')`)
                                                                            : `Khóa (${mergedSlot.span * 30}')`}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    })}
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
                                                                <div key={idx} className="w-5 h-5 rounded-full border border-white bg-amber-100 flex items-center justify-center overflow-hidden shadow-sm" title={s.staffName}>
                                                                    {s.staffAvatar ? (
                                                                        <img src={s.staffAvatar} alt="avt" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <span className="text-[8px] font-bold text-amber-600">{s.staffName?.charAt(0) || '?'}</span>
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
                                    staffId: selectedShift.staffId,
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
                            {selectedShift.staffAvatar ? (
                                <img src={selectedShift.staffAvatar} alt="avt" className="w-12 h-12 rounded-full border-2 border-amber-400 object-cover" />
                            ) : (
                                <div className="w-12 h-12 bg-white rounded-full border-2 border-amber-400 flex items-center justify-center font-bold text-xl text-amber-600">
                                    {selectedShift.staffName?.charAt(0) || '?'}
                                </div>
                            )}
                            <div>
                                <h3 className="font-bold text-lg text-stone-900">{selectedShift.staffName}</h3>
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
                                    {shiftDetail?.slots && mergeSlots(shiftDetail.slots).map((mergedSlot: MergedSlot) => {
                                        const isPastShift = new Date(selectedShift.workDate) < new Date(new Date().setHours(0, 0, 0, 0))
                                        return (
                                            <div
                                                key={mergedSlot.id}
                                                className={`flex items-center justify-between p-2.5 rounded-lg border-2 ${mergedSlot.status === 'AVAILABLE'
                                                    ? (isPastShift ? 'border-stone-200 bg-stone-50 opacity-60' : 'border-green-200 bg-green-50')
                                                    : mergedSlot.status === 'BLOCKED'
                                                        ? 'border-red-200 bg-red-50'
                                                        : 'border-yellow-200 bg-yellow-50 cursor-pointer hover:border-yellow-400 hover:shadow-md transition-all'
                                                    }`}
                                                onClick={() => {
                                                    if (mergedSlot.status === 'BOOKED' && mergedSlot.bookingId) {
                                                        navigate(`/clinic-manager/bookings?bookingId=${mergedSlot.bookingId}`)
                                                    }
                                                }}
                                                title={mergedSlot.status === 'BOOKED' ? 'Click để xem chi tiết lịch hẹn' : undefined}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-bold text-sm ${isPastShift && mergedSlot.status === 'AVAILABLE' ? 'text-stone-400' : 'text-stone-900'}`}>
                                                        {mergedSlot.startTime.substring(0, 5)} - {mergedSlot.endTime.substring(0, 5)}
                                                    </span>
                                                    <div className="flex flex-col">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit ${mergedSlot.status === 'AVAILABLE'
                                                            ? (isPastShift ? 'bg-stone-200 text-stone-500' : 'bg-green-500 text-white')
                                                            : mergedSlot.status === 'BLOCKED'
                                                                ? 'bg-red-500 text-white'
                                                                : 'bg-yellow-500 text-white'
                                                            }`}>
                                                            {mergedSlot.status === 'AVAILABLE'
                                                                ? (isPastShift ? 'Đã qua' : 'Trống')
                                                                : mergedSlot.status === 'BLOCKED' ? 'Đã khóa' : 'Đã đặt'}
                                                        </span>
                                                        {mergedSlot.span > 1 && (
                                                            <span className="text-[9px] text-stone-400 italic">({mergedSlot.span} slots)</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!isPastShift && mergedSlot.status === 'AVAILABLE' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleBlockSlot(mergedSlot.id); }}
                                                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                                            title="Khóa slot này"
                                                        >
                                                            <LockClosedIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {!isPastShift && mergedSlot.status === 'BLOCKED' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleUnblockSlot(mergedSlot.id); }}
                                                            className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                                            title="Mở khóa slot này"
                                                        >
                                                            <LockOpenIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {mergedSlot.status === 'BOOKED' && (
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-yellow-700 font-bold">{mergedSlot.petName || 'Có lịch hẹn'}</div>
                                                            {mergedSlot.petOwnerName && <div className="text-[9px] text-yellow-600">{mergedSlot.petOwnerName}</div>}
                                                        </div>
                                                    )}
                                                </div>
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
                            <label className="text-sm font-bold text-stone-900 mb-2 block">Chọn Nhân viên</label>
                            <div className="relative" ref={staffSelectorRef}>
                                <div
                                    className={`w-full p-4 bg-white border-2 rounded-xl font-medium cursor-pointer flex items-center justify-between transition-all ${isStaffSelectorOpen ? 'border-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,0.8)]' : 'border-stone-200'}`}
                                    onClick={() => !isEditMode && setIsStaffSelectorOpen(!isStaffSelectorOpen)}
                                >
                                    <div className="flex items-center gap-3">
                                        {formData.staffId ? (
                                            <>
                                                {staffMembers.find(v => v.userId === formData.staffId)?.avatar ? (
                                                    <img src={staffMembers.find(v => v.userId === formData.staffId)?.avatar} alt="avt" className="w-6 h-6 rounded-full border border-stone-900 object-cover" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-amber-100 border border-stone-900 flex items-center justify-center text-[10px] font-bold text-amber-600">
                                                        {staffMembers.find(v => v.userId === formData.staffId)?.fullName?.charAt(0) || '?'}
                                                    </div>
                                                )}
                                                <span className="text-stone-900 font-bold">{staffMembers.find(v => v.userId === formData.staffId)?.fullName}</span>
                                            </>
                                        ) : (
                                            <span className="text-stone-400">-- Chọn nhân viên --</span>
                                        )}
                                    </div>
                                    <UserIcon className={`w-5 h-5 transition-transform ${isStaffSelectorOpen ? 'rotate-180 text-stone-900' : 'text-stone-400'}`} />
                                </div>

                                {isStaffSelectorOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] z-50 py-1 overflow-hidden">
                                        <div className="max-h-60 overflow-y-auto">
                                            {staffMembers.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-stone-400 italic">Không có nhân viên nào</div>
                                            ) : (
                                                staffMembers.map(v => (
                                                    <div
                                                        key={v.userId}
                                                        onClick={() => {
                                                            setFormData({ ...formData, staffId: v.userId });
                                                            setIsStaffSelectorOpen(false);
                                                        }}
                                                        className={`flex items-center gap-3 p-4 hover:bg-amber-50 cursor-pointer transition-colors ${formData.staffId === v.userId ? 'bg-amber-50 border-l-4 border-amber-500 pl-3' : 'pl-4'}`}
                                                    >
                                                        {v.avatar ? (
                                                            <img src={v.avatar} alt="avt" className="w-8 h-8 rounded-full border-2 border-stone-900 object-cover" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-amber-100 border-2 border-stone-900 flex items-center justify-center font-bold text-amber-600">
                                                                {v.fullName?.charAt(0) || '?'}
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
                                <input
                                    type="time"
                                    value={formData.startTime}
                                    onChange={(e) => {
                                        const newStart = e.target.value
                                        const endBeforeStart = formData.endTime < newStart
                                        let newOvernight = formData.isOvernight || false

                                        if (endBeforeStart && !formData.isOvernight) {
                                            newOvernight = true
                                        } else if (!endBeforeStart && formData.isOvernight) {
                                            newOvernight = false
                                            showToast('info', 'Ca đêm không cần cho khung giờ này - đã tự động tắt')
                                        }

                                        setFormData({
                                            ...formData,
                                            startTime: newStart,
                                            isOvernight: newOvernight,
                                            breakStart: newOvernight ? undefined : formData.breakStart,
                                            breakEnd: newOvernight ? undefined : formData.breakEnd
                                        })
                                    }}
                                    className="w-full p-3 bg-white border-2 border-stone-200 rounded-xl font-bold focus:border-stone-900 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-stone-500 mb-1 block">Giờ ra</label>
                                <input
                                    type="time"
                                    value={formData.endTime}
                                    onChange={(e) => {
                                        const newEnd = e.target.value
                                        const endBeforeStart = newEnd < formData.startTime
                                        let newOvernight = formData.isOvernight || false

                                        if (endBeforeStart && !formData.isOvernight) {
                                            newOvernight = true
                                        } else if (!endBeforeStart && formData.isOvernight) {
                                            newOvernight = false
                                            showToast('info', 'Ca đêm không cần cho khung giờ này - đã tự động tắt')
                                        }

                                        setFormData({
                                            ...formData,
                                            endTime: newEnd,
                                            isOvernight: newOvernight,
                                            breakStart: newOvernight ? undefined : formData.breakStart,
                                            breakEnd: newOvernight ? undefined : formData.breakEnd
                                        })
                                    }}
                                    className="w-full p-3 bg-white border-2 border-stone-200 rounded-xl font-bold focus:border-stone-900 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Overnight shift toggle */}
                        <div
                            className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.isOvernight ? 'bg-indigo-50 border-indigo-300' : 'bg-stone-50 border-stone-200 hover:border-stone-300'}`}
                            onClick={() => {
                                const newOvernight = !formData.isOvernight
                                // Refuse to enable overnight manually if end >= start (daytime)
                                if (newOvernight && formData.endTime >= formData.startTime && formData.startTime !== formData.endTime) {
                                    showToast('warning', 'Khung giờ này không cần chế độ ca đêm')
                                    return
                                }
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

                        {/* Giờ nghỉ trưa: ưu tiên lấy từ clinic, không có thì dùng 12:00 - 13:00 */}
                        {!formData.isOvernight && (
                            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                                <div className="text-xs font-bold text-stone-500">Giờ nghỉ trưa</div>
                                {(() => {
                                    const refDate = formData.workDates.length > 0 ? new Date(formData.workDates[0]) : selectedDay
                                    const clinicBreak = getDefaultBreakForDate(clinicDetail, refDate)
                                    const breakStart = clinicBreak?.breakStart ?? '12:00'
                                    const breakEnd = clinicBreak?.breakEnd ?? '13:00'
                                    const willApply = !formData.breakStart && !formData.breakEnd
                                    return (
                                        <div className="text-xs text-stone-600 mt-0.5">
                                            Mặc định phòng khám: <span className="font-bold">{breakStart} - {breakEnd}</span>
                                            {willApply && ' (sẽ áp dụng khi tạo ca)'}
                                        </div>
                                    )
                                })()}
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

            {/* --- Modals --- */}
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
                            Nhân viên đã có ca làm việc trong các khung giờ sau:
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

export default StaffShiftPage
