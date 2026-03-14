/**
 * StaffBookingsPage - Page for Staff to view their assigned bookings
 * Displays list of bookings with status filters and details modal
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getBookingsByStaff, getBookingById, checkInBooking, checkoutBooking, addServiceToBooking, removeServiceFromBooking } from '../../services/bookingService'
import type { Booking, BookingStatus } from '../../types/booking'
import { BOOKING_STATUS_CONFIG, BOOKING_TYPE_CONFIG } from '../../types/booking'
import { useSseNotification } from '../../hooks/useSseNotification'
import { AddServiceModal } from '../../components/booking/AddServiceModal'
import { ConfirmModal } from '../../components/ConfirmModal'
import { useToast } from '../../components/Toast'
import {
    CalendarIcon,
    ClockIcon,
    MapPinIcon,
    UserIcon,
    PhoneIcon,
    XMarkIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    TrashIcon,
} from '@heroicons/react/24/outline'


// Status filter options - Petties Amber-Stone Theme
const STATUS_FILTERS: { value: BookingStatus | 'ALL'; label: string; color: string }[] = [
    { value: 'ALL', label: 'Tất cả', color: 'bg-stone-100 text-stone-700' },
    { value: 'CONFIRMED', label: 'Đã xác nhận', color: 'bg-amber-50 text-amber-700' },
    { value: 'IN_PROGRESS', label: 'Đang thực hiện', color: 'bg-amber-100 text-amber-700' },
    { value: 'COMPLETED', label: 'Hoàn thành', color: 'bg-green-100 text-green-700' },
    { value: 'CANCELLED', label: 'Đã hủy', color: 'bg-stone-100 text-stone-600' },
]



export const StaffBookingsPage = () => {
    const { user } = useAuthStore()
    const location = useLocation()
    const navigate = useNavigate()
    const { showToast } = useToast()
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)



    // Vaccine Modal/Redirect state
    // (Modal bypassed per user request, redirecting directly to recording page)

    // Pagination
    const [page, setPage] = useState(0)

    // Add-on Service state
    const [addServiceModalOpen, setAddServiceModalOpen] = useState(false);
    const [addingService, setAddingService] = useState(false);
    const [removeConfirmService, setRemoveConfirmService] = useState<{ bookingServiceId: string; serviceName: string } | null>(null);
    const [checkoutConfirmBookingId, setCheckoutConfirmBookingId] = useState<string | null>(null);
    const checkoutInFlightRef = useRef(false);
    const [totalPages, setTotalPages] = useState(0)
    const [totalElements, setTotalElements] = useState(0)
    const pageSize = 10

    // Handle navigation from StaffSchedulePage with focusBookingId
    const focusBookingId = (location.state as { focusBookingId?: string })?.focusBookingId

    // Fetch bookings
    const lastRequestIdRef = useRef(0)



    // Fetch bookings (My bookings tab)
    const fetchBookings = useCallback(async () => {
        if (!user?.userId) return

        const requestId = ++lastRequestIdRef.current
        setLoading(true)
        // Clear bookings immediately when filter changes to give visual feedback and avoid confusion
        if (page === 0) setBookings([])

        try {
            const status = statusFilter === 'ALL' ? undefined : statusFilter
            console.log(`[StaffBookingsPage] Fetching bookings status=${status} page=${page} reqId=${requestId}`)
            const response = await getBookingsByStaff(user.userId, status, page, pageSize)

            // Only update state if this is still the latest request
            if (requestId === lastRequestIdRef.current) {
                setBookings(response.content)
                setTotalPages(response.totalPages)
                setTotalElements(response.totalElements)
            }
        } catch (error) {
            if (requestId === lastRequestIdRef.current) {
                console.error('Error fetching bookings:', error)
            }
        } finally {
            if (requestId === lastRequestIdRef.current) {
                setLoading(false)
            }
        }
    }, [user?.userId, statusFilter, page])

    // Subscribe to SSE for real-time booking updates
    useSseNotification({
        silent: true,
        onBookingUpdate: (data) => {
            console.log('[StaffBookingsPage] Booking update received:', data)
            showToast('info', `Có cập nhật booking: ${data.bookingCode}`)
            // Refetch bookings list
            fetchBookings()
            // If the updated booking is currently selected, refresh it
            if (selectedBooking && selectedBooking.bookingId === data.bookingId) {
                handleViewDetail(data.bookingId)
            }
        }
    })

    useEffect(() => {
        fetchBookings()
    }, [fetchBookings])

    // Auto-open modal when navigating from schedule with focusBookingId
    useEffect(() => {
        if (focusBookingId && !loading) {
            handleViewDetail(focusBookingId)
            // Clear the state to prevent re-opening on refresh
            window.history.replaceState({}, document.title)
        }
    }, [focusBookingId, loading])

    // View booking detail
    const handleViewDetail = async (bookingId: string) => {
        setDetailLoading(true)
        try {
            const booking = await getBookingById(bookingId)
            setSelectedBooking(booking)
        } catch (error) {
            console.error('Error fetching booking detail:', error)
        } finally {
            setDetailLoading(false)
        }
    }

    // Filter bookings by search query
    const filteredBookings = bookings.filter(b => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
            b.bookingCode?.toLowerCase().includes(query) ||
            b.petName?.toLowerCase().includes(query) ||
            b.ownerName?.toLowerCase().includes(query)
        )
    })

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('vi-VN', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
    }

    // Navigate directly to vaccine record page
    const handleOpenVaccineModal = () => {
        if (!selectedBooking) return;
        
        // Find the vaccine service to get its name
        const allServiceItems = (selectedBooking.pets?.length ?? 0) > 0
            ? (selectedBooking.pets ?? []).flatMap(p => p.services ?? [])
            : (selectedBooking.services ?? []);
            
        const vaccService = allServiceItems.find(svc => {
            const nameStr = svc.serviceName?.toLowerCase() || '';
            const catStr = svc.serviceCategory || '';
            return catStr === 'VACCINATION' || 
                   nameStr.includes('vaccine') || 
                   nameStr.includes('vắc-xin') || 
                   nameStr.includes('vắc xin') || 
                   nameStr.includes('tiêm') ||
                   catStr.toLowerCase().includes('vaccine') ||
                   catStr.toLowerCase().includes('vắc-xin') ||
                   catStr.toLowerCase().includes('vắc xin') ||
                   catStr.toLowerCase().includes('tiêm');
        });

        let url = `/staff/patients/${selectedBooking.petId}/vaccinations?bookingId=${selectedBooking.bookingId}&bookingCode=${selectedBooking.bookingCode}`;
        if (vaccService && vaccService.serviceName) {
            url += `&initialVaccineName=${encodeURIComponent(vaccService.serviceName)}`;
        }
        
        navigate(url);
    }

    const handleOpenAddServiceModal = () => {
        if (!selectedBooking) return;
        setAddServiceModalOpen(true);
    };

    const handleAddService = async (serviceId: string) => {
        if (!selectedBooking) return;
        setAddingService(true);
        try {
            await addServiceToBooking(selectedBooking.bookingId, serviceId);
            const updated = await getBookingById(selectedBooking.bookingId);
            setSelectedBooking(updated);
            // Refresh list
            fetchBookings();
            setAddServiceModalOpen(false);
            showToast('success', 'Đã thêm dịch vụ thành công');
        } catch (error: unknown) {
            console.error('Failed to add service:', error);
            const msg = (error && typeof error === 'object' && 'response' in error && (error as { response?: { data?: { message?: string } } }).response?.data?.message)
                ? (error as { response: { data: { message: string } } }).response.data.message
                : 'Không thể thêm dịch vụ';
            showToast('error', msg);
        } finally {
            setAddingService(false);
        }
    };

    const handleRemoveAddOnConfirm = async () => {
        if (!selectedBooking || !removeConfirmService) return;
        setActionLoading(true);
        try {
            await removeServiceFromBooking(selectedBooking.bookingId, removeConfirmService.bookingServiceId);
            const updated = await getBookingById(selectedBooking.bookingId);
            setSelectedBooking(updated);
            fetchBookings();
            showToast('success', 'Đã xóa dịch vụ phát sinh.');
        } catch (error: unknown) {
            const msg = (error && typeof error === 'object' && 'response' in error && (error as { response?: { data?: { message?: string } } }).response?.data?.message)
                ? (error as { response: { data: { message: string } } }).response.data.message
                : 'Không thể xóa dịch vụ phát sinh.';
            showToast('error', msg);
        } finally {
            setActionLoading(false);
            setRemoveConfirmService(null);
        }
    };

    const handleCheckoutConfirm = async () => {
        if (!checkoutConfirmBookingId) return;
        if (checkoutInFlightRef.current) return;
        checkoutInFlightRef.current = true;
        setActionLoading(true);
        try {
            await checkoutBooking(checkoutConfirmBookingId);
            const updated = await getBookingById(checkoutConfirmBookingId);
            setSelectedBooking(updated);
            fetchBookings();
            showToast('success', 'Hoàn thành khám thành công.');
        } catch (error: unknown) {
            console.error('Checkout failed:', error);
            const msg = (error && typeof error === 'object' && 'response' in error && (error as { response?: { data?: { message?: string } } }).response?.data?.message)
                ? (error as { response: { data: { message: string } } }).response.data.message
                : 'Hoàn thành khám thất bại.';
            showToast('error', msg);
        } finally {
            setActionLoading(false);
            setCheckoutConfirmBookingId(null);
            checkoutInFlightRef.current = false;
        }
    };


    return (
        <div className="min-h-screen bg-stone-50 p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-black text-stone-900">Lịch hẹn</h1>
                <p className="text-stone-500 text-sm">Danh sách các lịch hẹn được gán cho bạn</p>
            </div>

            {/* Status filter & Search */}
            <div className="bg-white rounded-2xl border-2 border-stone-200 p-4 mb-6 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)]">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search */}
                    <div className="relative flex-1">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Tìm theo mã, tên pet hoặc chủ nuôi..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border-2 border-stone-200 rounded-xl font-medium focus:border-amber-500 focus:outline-none"
                        />
                    </div>

                    {/* Status filter */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        <FunnelIcon className="w-5 h-5 text-stone-400 flex-shrink-0" />
                        {STATUS_FILTERS.map(filter => (
                            <button
                                key={filter.value}
                                onClick={() => { setStatusFilter(filter.value); setPage(0); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${statusFilter === filter.value
                                    ? 'shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]'
                                    : filter.color + ' hover:opacity-80'
                                    }`}
                                style={statusFilter === filter.value ? { backgroundColor: '#f59e0b', color: '#ffffff' } : {}}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="text-sm text-stone-500 mb-4">
                Hiển thị <span className="font-bold text-stone-700">{filteredBookings.length}</span> / {totalElements} lịch hẹn
            </div>

            {/* Bookings List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : filteredBookings.length === 0 ? (
                <div className="bg-white rounded-2xl border-2 border-stone-200 p-12 text-center">
                    <CalendarIcon className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                    <p className="text-stone-500 font-medium">Không có lịch hẹn nào</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredBookings.map(booking => {
                        const statusCfg = BOOKING_STATUS_CONFIG[booking.status]
                        const typeCfg = BOOKING_TYPE_CONFIG[booking.type]

                        return (
                            <div
                                key={booking.bookingId}
                                onClick={() => handleViewDetail(booking.bookingId)}
                                className="bg-white rounded-2xl border-2 p-4 hover:shadow-[4px_4px_0px_0px_rgba(217,119,6,0.2)] transition-all cursor-pointer border-stone-200 hover:border-amber-400"
                            >
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    {/* Left: Booking info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="font-black text-stone-900 text-lg">#{booking.bookingCode}</span>
                                            <span
                                                className="px-2.5 py-1 rounded-lg text-xs font-bold"
                                                style={{ backgroundColor: statusCfg?.bgColor, color: statusCfg?.textColor }}
                                            >
                                                {statusCfg?.label || booking.status}
                                            </span>
                                            <span
                                                className="px-2 py-1 rounded-lg text-xs font-bold"
                                                style={{ backgroundColor: typeCfg?.bgColor, color: typeCfg?.textColor }}
                                            >
                                                {typeCfg?.label}
                                            </span>

                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                            <div className="flex items-center gap-2 text-stone-600">
                                                <CalendarIcon className="w-4 h-4 text-amber-500" />
                                                <span>{formatDate(booking.bookingDate)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-stone-600">
                                                <ClockIcon className="w-4 h-4 text-amber-500" />
                                                <span>{(() => {
                                                    const startTime = booking.bookingTime?.substring(0, 5) || '--:--';
                                                    // Calculate end time from staff's services
                                                    const staffServices = booking.services?.filter(
                                                        svc => svc.assignedStaffId === user?.userId
                                                    ) || [];

                                                    if (staffServices.length > 0) {
                                                        // Find the latest end time among staff's services
                                                        const endTimes = staffServices
                                                            .map(svc => svc.scheduledEndTime)
                                                            .filter((t): t is string => Boolean(t));

                                                        if (endTimes.length > 0) {
                                                            const latestEndTime = endTimes.sort().reverse()[0];
                                                            return `${startTime} - ${latestEndTime.substring(0, 5)}`;
                                                        }
                                                    }
                                                    return startTime;
                                                })()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Pet & Owner */}
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="font-bold text-stone-900">{booking.petName || 'N/A'}</div>
                                            <div className="text-xs text-stone-500">{booking.ownerName}</div>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-amber-100 border-2 border-amber-500 flex items-center justify-center overflow-hidden">
                                            {booking.petPhotoUrl ? (
                                                <img src={booking.petPhotoUrl} alt={booking.petName} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-lg font-bold text-amber-600">{booking.petName?.charAt(0) || '?'}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Services */}
                                {(() => {
                                    const servicesToShow = booking.services?.filter(svc => svc.assignedStaffId === user?.userId) || [];

                                    return servicesToShow.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-stone-100">
                                            <div className="flex flex-wrap gap-2">
                                                {servicesToShow.map((svc, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-1 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-200"
                                                    >
                                                        {svc.serviceName}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-2 rounded-lg border-2 border-stone-200 hover:border-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <span className="px-4 py-2 font-bold text-stone-700">
                        Trang {page + 1} / {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="p-2 rounded-lg border-2 border-stone-200 hover:border-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Detail Modal */}
            {selectedBooking && (
                <div className="fixed inset-0 bg-stone-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedBooking(null)}>
                    <div
                        className="bg-white rounded-2xl border-2 border-stone-900 shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {detailLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            (() => {
                                const allServiceItems = (selectedBooking.pets?.length ?? 0) > 0
                                    ? (selectedBooking.pets ?? []).flatMap(p => p.services ?? [])
                                    : (selectedBooking.services ?? []);
                                const hasVaccineService = allServiceItems.some(svc => {
                                    const nameStr = svc.serviceName?.toLowerCase() || '';
                                    const catStr = svc.serviceCategory || '';
                                    return catStr === 'VACCINATION' ||
                                           nameStr.includes('vaccine') || 
                                           nameStr.includes('vắc-xin') || 
                                           nameStr.includes('vắc xin') ||
                                           catStr.toLowerCase().includes('vaccine') ||
                                           catStr.toLowerCase().includes('vắc-xin') ||
                                           catStr.toLowerCase().includes('vắc xin');
                                });
                                return (
                            <>
                                {/* Modal Header */}
                                <div className="flex items-center justify-between p-5 border-b-2 border-stone-100">
                                    <div>
                                        <h2 className="text-xl font-black text-stone-900 uppercase tracking-tight">Chi tiết lịch hẹn</h2>
                                        <p className="text-sm font-bold text-stone-400">#{selectedBooking.bookingCode}</p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedBooking(null)}
                                        className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-900"
                                    >
                                        <XMarkIcon className="w-6 h-6 stroke-2" />
                                    </button>
                                </div>

                                {/* Modal Content */}
                                <div className="p-6 space-y-6">
                                    {/* Status & Type */}
                                    <div className="flex flex-wrap gap-3">
                                        <span
                                            className="px-3 py-1.5 rounded-lg text-xs font-black border-2 shadow-[2px_2px_0_0_#1c1917] uppercase"
                                            style={{
                                                backgroundColor: BOOKING_STATUS_CONFIG[selectedBooking.status]?.bgColor,
                                                color: BOOKING_STATUS_CONFIG[selectedBooking.status]?.textColor,
                                                borderColor: '#1c1917'
                                            }}
                                        >
                                            {BOOKING_STATUS_CONFIG[selectedBooking.status]?.label || selectedBooking.status}
                                        </span>
                                        <span
                                            className="px-3 py-1.5 rounded-lg text-xs font-black border-2 shadow-[2px_2px_0_0_#1c1917] uppercase"
                                            style={{
                                                backgroundColor: BOOKING_TYPE_CONFIG[selectedBooking.type]?.bgColor,
                                                color: BOOKING_TYPE_CONFIG[selectedBooking.type]?.textColor,
                                                borderColor: '#1c1917'
                                            }}
                                        >
                                            {BOOKING_TYPE_CONFIG[selectedBooking.type]?.label}
                                        </span>
                                    </div>

                                    {/* Date & Time */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-amber-50 rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0_0_#1c1917]">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white border-2 border-stone-900 flex items-center justify-center shadow-[2px_2px_0_0_#1c1917]">
                                                <CalendarIcon className="w-6 h-6 text-amber-600" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-stone-500 font-black uppercase tracking-widest">Ngày hẹn</div>
                                                <div className="font-black text-stone-900">{formatDate(selectedBooking.bookingDate)}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white border-2 border-stone-900 flex items-center justify-center shadow-[2px_2px_0_0_#1c1917]">
                                                <ClockIcon className="w-6 h-6 text-amber-600" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-stone-500 font-black uppercase tracking-widest">Thời gian</div>
                                                <div className="font-black text-stone-900">{selectedBooking.bookingTime?.substring(0, 5) || '--:--'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Thao tác - đặt trên cao để staff luôn thấy */}
                                    {(selectedBooking.status === 'CONFIRMED' || selectedBooking.status === 'IN_PROGRESS') && (
                                        <div className="p-4 bg-stone-50 rounded-2xl border-2 border-stone-900 shadow-[3px_3px_0_0_#1c1917] space-y-3">
                                            <div className="text-[10px] text-stone-500 font-black uppercase tracking-widest">Thao tác</div>
                                            <button
                                                type="button"
                                                onClick={() => navigate('/staff/patients', { state: { focusPetId: selectedBooking.petId } })}
                                                className="w-full bg-white text-stone-900 py-3 rounded-xl font-black uppercase text-xs tracking-widest border-2 border-stone-900 shadow-[2px_2px_0_0_#1c1917] hover:-translate-y-0.5 transition-all"
                                            >
                                                XEM HỒ SƠ BỆNH ÁN
                                            </button>
                                            {selectedBooking.status === 'CONFIRMED' && (
                                                <button
                                                    onClick={async () => {
                                                        setActionLoading(true)
                                                        try {
                                                            await checkInBooking(selectedBooking.bookingId)
                                                            handleViewDetail(selectedBooking.bookingId)
                                                            fetchBookings()
                                                            showToast('success', 'Check-in thành công')
                                                        } catch (err) {
                                                            console.error('Check-in failed:', err)
                                                            showToast('error', 'Check-in thất bại')
                                                        } finally {
                                                            setActionLoading(false)
                                                        }
                                                    }}
                                                    disabled={actionLoading}
                                                    className="w-full bg-amber-600 text-white py-3 rounded-xl font-black uppercase text-sm tracking-widest border-2 border-stone-900 shadow-[3px_3px_0_0_#1c1917] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#1c1917] active:translate-y-0 transition-all disabled:opacity-50"
                                                >
                                                    {actionLoading ? 'ĐANG XỬ LÝ...' : 'BẮT ĐẦU THỰC HIỆN DỊCH VỤ'}
                                                </button>
                                            )}
                                            {selectedBooking.status === 'IN_PROGRESS' && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/staff/emr/create/${selectedBooking.petId}?bookingId=${selectedBooking.bookingId}&bookingCode=${selectedBooking.bookingCode}`)}
                                                        className={`bg-blue-500 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest border-2 border-stone-900 shadow-[2px_2px_0_0_#1c1917] hover:-translate-y-0.5 transition-all ${!hasVaccineService ? 'col-span-1 sm:col-span-2' : ''}`}
                                                    >
                                                        TẠO BỆNH ÁN
                                                    </button>
                                                    {hasVaccineService && (
                                                        <button
                                                        type="button"
                                                        onClick={handleOpenVaccineModal}
                                                        className="bg-emerald-500 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest border-2 border-emerald-700 shadow-[2px_2px_0_0_#065f46] hover:-translate-y-0.5 transition-all"
                                                    >
                                                        TIÊM VACCINE
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={handleOpenAddServiceModal}
                                                    className="col-span-1 sm:col-span-2 bg-[#38B2AC] text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest border-2 border-stone-900 shadow-[3px_3px_0_0_#1c1917] hover:-translate-y-0.5 transition-all"
                                                >
                                                    THÊM DỊCH VỤ PHÁT SINH
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setCheckoutConfirmBookingId(selectedBooking.bookingId)}
                                                    className="col-span-1 sm:col-span-2 bg-amber-600 text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest border-2 border-stone-900 shadow-[3px_3px_0_0_#1c1917] hover:-translate-y-0.5 transition-all"
                                                >
                                                    HOÀN THÀNH KHÁM
                                                </button>
                                            </div>
                                        )}
                                        </div>
                                    )}

                                    {/* Pet Info */}
                                    <div className="p-5 bg-white rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0_0_#1c1917]">
                                        <div className="flex items-center gap-5">
                                            <div className="w-16 h-16 rounded-full bg-amber-100 border-2 border-stone-900 flex items-center justify-center overflow-hidden shadow-[2px_2px_0_0_#1c1917]">
                                                {selectedBooking.petPhotoUrl ? (
                                                    <img src={selectedBooking.petPhotoUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-2xl font-black text-amber-600">{selectedBooking.petName?.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-black text-xl text-stone-900 uppercase tracking-tight">{selectedBooking.petName}</div>
                                                <div className="text-sm font-bold text-stone-500">
                                                    {selectedBooking.petSpecies} • {selectedBooking.petBreed}
                                                    {selectedBooking.petWeight && ` • ${selectedBooking.petWeight}kg`}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Owner Info */}
                                    <div className="p-5 bg-white rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0_0_#1c1917]">
                                        <div className="text-[10px] text-stone-400 font-black uppercase tracking-widest mb-4">Thông tin chủ nuôi</div>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center border border-stone-200">
                                                    <UserIcon className="w-4 h-4 text-stone-600" />
                                                </div>
                                                <span className="font-bold text-stone-800">{selectedBooking.ownerName}</span>
                                            </div>
                                            {selectedBooking.ownerPhone && (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center border border-stone-200">
                                                        <PhoneIcon className="w-4 h-4 text-stone-600" />
                                                    </div>
                                                    <a href={`tel:${selectedBooking.ownerPhone}`} className="font-bold text-amber-600 hover:underline">
                                                        {selectedBooking.ownerPhone}
                                                    </a>
                                                </div>
                                            )}
                                            {selectedBooking.homeAddress && (
                                                <div className="flex items-start gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center border border-stone-200 shrink-0">
                                                        <MapPinIcon className="w-4 h-4 text-stone-600" />
                                                    </div>
                                                    <span className="text-sm font-bold text-stone-600 leading-snug">{selectedBooking.homeAddress}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Services */}
                                    {(() => {
                                        const addOnServices = allServiceItems.filter(svc => svc.isAddOn === true);
                                        const myServices = allServiceItems.filter(svc => svc.assignedStaffId === user?.userId && !svc.isAddOn);
                                        const myTotal = myServices.reduce((sum, svc) => sum + (svc.price || 0), 0);
                                        const isMyBooking = myServices.length > 0;

                                        return (
                                            <>
                                                {/* Dịch vụ của bạn (chỉ dịch vụ gốc được giao cho bạn, không bao gồm phát sinh) */}
                                                {myServices.length > 0 && (
                                                    <div className="space-y-3">
                                                        <div className="text-[10px] text-stone-400 font-black uppercase tracking-widest px-1">
                                                            Dịch vụ của bạn ({myServices.length})
                                                        </div>
                                                        <p className="text-xs text-stone-500 px-1">Các dịch vụ được giao cho bạn thực hiện</p>
                                                        <div className="space-y-3">
                                                            {myServices.map((svc, idx) => (
                                                                <div key={svc.bookingServiceId ?? idx} className="p-4 bg-amber-50/30 rounded-xl border-2 border-stone-900 shadow-[2px_2px_0_0_#1c1917] transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#1c1917]">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="font-black text-stone-900 uppercase tracking-tight">{svc.serviceName}</span>
                                                                        <span className="font-black text-amber-700">
                                                                            {svc.price?.toLocaleString('vi-VN')}đ
                                                                        </span>
                                                                    </div>
                                                                    {svc.scheduledStartTime && svc.scheduledEndTime && (
                                                                        <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 bg-white/50 w-fit px-2 py-1 rounded-md border border-stone-200">
                                                                            <ClockIcon className="w-3.5 h-3.5" />
                                                                            <span>{svc.scheduledStartTime?.substring(0, 5)} - {svc.scheduledEndTime?.substring(0, 5)}</span>
                                                                            {svc.durationMinutes && <span className="text-stone-400 italic">({svc.durationMinutes} phút)</span>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Dịch vụ phát sinh (không gán ai thực hiện) */}
                                                {addOnServices.length > 0 && (
                                                    <div className="space-y-3">
                                                        <div className="text-[10px] text-stone-400 font-black uppercase tracking-widest px-1">
                                                            Dịch vụ phát sinh ({addOnServices.length})
                                                        </div>
                                                        <p className="text-xs text-stone-500 px-1">Dịch vụ thêm sau khi đặt lịch; không cần gán người thực hiện</p>
                                                        <div className="space-y-3">
                                                            {addOnServices.map((svc, idx) => (
                                                                <div key={svc.bookingServiceId ?? idx} className="p-4 bg-stone-50 rounded-xl border-2 border-stone-300 shadow-[2px_2px_0_0_#1c1917]">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="font-black text-stone-900 uppercase tracking-tight">{svc.serviceName}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-black text-stone-700">
                                                                                {svc.price?.toLocaleString('vi-VN')}đ
                                                                            </span>
                                                                            {svc.bookingServiceId && selectedBooking.status === 'IN_PROGRESS' && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setRemoveConfirmService({ bookingServiceId: svc.bookingServiceId!, serviceName: svc.serviceName })}
                                                                                    className="p-1.5 rounded-lg border-2 border-stone-900 bg-white text-red-600 shadow-[2px_2px_0_0_#1c1917] hover:bg-red-50 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_#1c1917] transition-all disabled:opacity-50"
                                                                                    title="Xóa dịch vụ phát sinh"
                                                                                    aria-label="Xóa dịch vụ phát sinh"
                                                                                    disabled={actionLoading}
                                                                                >
                                                                                    <TrashIcon className="w-4 h-4" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {svc.scheduledStartTime && svc.scheduledEndTime && (
                                                                        <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 bg-white/50 w-fit px-2 py-1 rounded-md border border-stone-200">
                                                                            <ClockIcon className="w-3.5 h-3.5" />
                                                                            <span>{svc.scheduledStartTime?.substring(0, 5)} - {svc.scheduledEndTime?.substring(0, 5)}</span>
                                                                            {svc.durationMinutes && <span className="text-stone-400 italic">({svc.durationMinutes} phút)</span>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Total Price (chỉ tổng dịch vụ của tôi) */}
                                                {isMyBooking && (
                                                    <div className="flex items-center justify-between p-5 bg-amber-600 text-white rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0_0_#1c1917]">
                                                        <span className="font-black uppercase tracking-widest text-sm">Tổng của bạn</span>
                                                        <span className="text-2xl font-black tracking-tight">
                                                            {myTotal?.toLocaleString('vi-VN')}đ
                                                        </span>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}

                                    {/* Add-on Service Modal */}
                                    {selectedBooking && (
                                        <AddServiceModal
                                            isOpen={addServiceModalOpen}
                                            onClose={() => setAddServiceModalOpen(false)}
                                            booking={selectedBooking}
                                            onAddService={handleAddService}
                                            isAdding={addingService}
                                        />
                                    )}

                                    {/* Confirm remove add-on service */}
                                    <ConfirmModal
                                        isOpen={!!removeConfirmService}
                                        title="Xóa dịch vụ phát sinh"
                                        message="Bạn có chắc muốn xóa dịch vụ phát sinh này?"
                                        confirmLabel="XÓA"
                                        cancelLabel="HỦY BỎ"
                                        isDanger
                                        onConfirm={handleRemoveAddOnConfirm}
                                        onCancel={() => setRemoveConfirmService(null)}
                                    />
                                    
                                    {/* Confirm checkout */}
                                    <ConfirmModal
                                        isOpen={!!checkoutConfirmBookingId}
                                        title="Hoàn thành khám"
                                        message="Bạn có chắc chắn muốn hoàn thành lượt khám này? Hành động này sẽ cập nhật trạng thái đơn đặt lịch."
                                        confirmLabel="HOÀN THÀNH"
                                        cancelLabel="HỦY BỎ"
                                        onConfirm={handleCheckoutConfirm}
                                        onCancel={() => setCheckoutConfirmBookingId(null)}
                                    />
                                </div>
                            </>
                                );
                            })()
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default StaffBookingsPage
