/**
 * StaffBookingsPage - Page for Staff to view their assigned bookings
 * Displays list of bookings with status filters and details modal
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getBookingsByStaff, getBookingById, checkInBooking, completeBooking } from '../../services/bookingService'
import type { Booking, BookingStatus } from '../../types/booking'
import { BOOKING_STATUS_CONFIG, BOOKING_TYPE_CONFIG } from '../../types/booking'
import { useSseNotification } from '../../hooks/useSseNotification'
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
    const { showToast } = useToast()
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)

    // Pagination
    const [page, setPage] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [totalElements, setTotalElements] = useState(0)
    const pageSize = 10

    // Handle navigation from StaffSchedulePage with focusBookingId
    const focusBookingId = (location.state as { focusBookingId?: string })?.focusBookingId

    // Fetch bookings
    const lastRequestIdRef = useRef(0)

    // Fetch bookings
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

    return (
        <div className="min-h-screen bg-stone-50 p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-black text-stone-900">Lịch hẹn của tôi</h1>
                <p className="text-stone-500 text-sm">Danh sách các lịch hẹn được gán cho bạn</p>
            </div>

            {/* Filters */}
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
                                className="bg-white rounded-2xl border-2 border-stone-200 p-4 hover:border-amber-400 hover:shadow-[4px_4px_0px_0px_rgba(217,119,6,0.2)] transition-all cursor-pointer"
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

                                {/* Services - Only show staff's assigned */}
                                {(() => {
                                    // Filter to only show services assigned to this staff
                                    const staffServices = booking.services?.filter(
                                        svc => svc.assignedStaffId === user?.userId
                                    ) || [];
                                    return staffServices.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-stone-100">
                                            <div className="flex flex-wrap gap-2">
                                                {staffServices.map((svc, idx) => (
                                                    <span key={idx} className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-lg">
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
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
                    <div
                        className="bg-white rounded-2xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        {detailLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <>
                                {/* Modal Header */}
                                <div className="flex items-center justify-between p-4 border-b-2 border-stone-200">
                                    <div>
                                        <h2 className="text-xl font-black text-stone-900">Chi tiết lịch hẹn</h2>
                                        <p className="text-sm text-stone-500">#{selectedBooking.bookingCode}</p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedBooking(null)}
                                        className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
                                    >
                                        <XMarkIcon className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Modal Content */}
                                <div className="p-4 space-y-4">
                                    {/* Status & Type */}
                                    <div className="flex items-center gap-3">
                                        <span
                                            className="px-3 py-1.5 rounded-lg text-sm font-bold"
                                            style={{
                                                backgroundColor: BOOKING_STATUS_CONFIG[selectedBooking.status]?.bgColor,
                                                color: BOOKING_STATUS_CONFIG[selectedBooking.status]?.textColor
                                            }}
                                        >
                                            {BOOKING_STATUS_CONFIG[selectedBooking.status]?.label || selectedBooking.status}
                                        </span>
                                        <span
                                            className="px-3 py-1.5 rounded-lg text-sm font-bold"
                                            style={{
                                                backgroundColor: BOOKING_TYPE_CONFIG[selectedBooking.type]?.bgColor,
                                                color: BOOKING_TYPE_CONFIG[selectedBooking.type]?.textColor
                                            }}
                                        >
                                            {BOOKING_TYPE_CONFIG[selectedBooking.type]?.label}
                                        </span>
                                    </div>

                                    {/* Date & Time */}
                                    <div className="grid grid-cols-2 gap-4 p-4 bg-teal-50 rounded-xl border border-teal-200">
                                        <div className="flex items-center gap-3">
                                            <CalendarIcon className="w-6 h-6 text-teal-600" />
                                            <div>
                                                <div className="text-xs text-teal-600 font-bold">Ngày hẹn</div>
                                                <div className="font-bold text-stone-900">{formatDate(selectedBooking.bookingDate)}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <ClockIcon className="w-6 h-6 text-teal-600" />
                                            <div>
                                                <div className="text-xs text-teal-600 font-bold">Thời gian</div>
                                                <div className="font-bold text-stone-900">{selectedBooking.bookingTime?.substring(0, 5) || '--:--'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pet Info */}
                                    <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-full bg-amber-100 border-2 border-amber-500 flex items-center justify-center overflow-hidden">
                                                {selectedBooking.petPhotoUrl ? (
                                                    <img src={selectedBooking.petPhotoUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-2xl font-bold text-amber-600">{selectedBooking.petName?.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-black text-lg text-stone-900">{selectedBooking.petName}</div>
                                                <div className="text-sm text-stone-500">
                                                    {selectedBooking.petSpecies} • {selectedBooking.petBreed}
                                                    {selectedBooking.petWeight && ` • ${selectedBooking.petWeight}kg`}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Owner Info */}
                                    <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                                        <div className="text-xs text-stone-500 font-bold uppercase mb-2">Thông tin chủ nuôi</div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <UserIcon className="w-4 h-4 text-stone-400" />
                                                <span className="font-medium">{selectedBooking.ownerName}</span>
                                            </div>
                                            {selectedBooking.ownerPhone && (
                                                <div className="flex items-center gap-2">
                                                    <PhoneIcon className="w-4 h-4 text-stone-400" />
                                                    <a href={`tel:${selectedBooking.ownerPhone}`} className="font-medium text-amber-600 hover:underline">
                                                        {selectedBooking.ownerPhone}
                                                    </a>
                                                </div>
                                            )}
                                            {selectedBooking.homeAddress && (
                                                <div className="flex items-start gap-2">
                                                    <MapPinIcon className="w-4 h-4 text-stone-400 mt-0.5" />
                                                    <span className="text-sm text-stone-600">{selectedBooking.homeAddress}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Services - ONLY show services assigned to this staff */}
                                    {(() => {
                                        const myServices = selectedBooking.services?.filter(
                                            svc => svc.assignedStaffId === user?.userId
                                        ) || [];
                                        const myTotal = myServices.reduce((sum, svc) => sum + (svc.price || 0), 0);

                                        return myServices.length > 0 && (
                                            <>
                                                <div>
                                                    <div className="text-xs text-stone-500 font-bold uppercase mb-2">
                                                        Dịch vụ bạn phụ trách ({myServices.length})
                                                    </div>
                                                    <div className="space-y-2">
                                                        {myServices.map((svc, idx) => (
                                                            <div key={idx} className="p-3 bg-white rounded-lg border border-stone-200">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-medium text-stone-900">{svc.serviceName}</span>
                                                                    <span className="font-bold text-amber-600">
                                                                        {svc.price?.toLocaleString('vi-VN')}đ
                                                                    </span>
                                                                </div>
                                                                {/* Show scheduled time if available */}
                                                                {svc.scheduledStartTime && svc.scheduledEndTime && (
                                                                    <div className="mt-2 flex items-center gap-1.5 text-xs text-stone-500">
                                                                        <ClockIcon className="w-3.5 h-3.5" />
                                                                        <span>{svc.scheduledStartTime?.substring(0, 5)} - {svc.scheduledEndTime?.substring(0, 5)}</span>
                                                                        {svc.durationMinutes && <span className="text-stone-400">({svc.durationMinutes} phút)</span>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Total Price for staff's services */}
                                                <div className="flex items-center justify-between p-4 bg-amber-600 text-white rounded-xl">
                                                    <span className="font-bold">Tổng dịch vụ của bạn</span>
                                                    <span className="text-2xl font-black">
                                                        {myTotal?.toLocaleString('vi-VN')}đ
                                                    </span>
                                                </div>
                                            </>
                                        );
                                    })()}

                                    {/* Notes */}
                                    {selectedBooking.notes && (
                                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                                            <div className="text-xs text-amber-600 font-bold uppercase mb-1">Ghi chú</div>
                                            <p className="text-sm text-stone-700">{selectedBooking.notes}</p>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="pt-4 border-t-2 border-stone-100 flex gap-3">
                                        {(selectedBooking.status === 'ASSIGNED' || selectedBooking.status === 'ARRIVED') && (
                                            <button
                                                onClick={async () => {
                                                    setActionLoading(true)
                                                    try {
                                                        await checkInBooking(selectedBooking.bookingId)
                                                        handleViewDetail(selectedBooking.bookingId)
                                                        fetchBookings() // Reload list
                                                    } catch (err) {
                                                        console.error('Check-in failed:', err)
                                                        alert('Check-in thất bại')
                                                    } finally {
                                                        setActionLoading(false)
                                                    }
                                                }}
                                                disabled={actionLoading}
                                                className="flex-1 bg-amber-600 text-white py-3 rounded-xl font-black shadow-[4px_4px_0px_0px_rgba(120,53,15,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50"
                                            >
                                                {actionLoading ? 'ĐANG XỬ LÝ...' : 'BẮT ĐẦU KHÁM'}
                                            </button>
                                        )}

                                        {selectedBooking.status === 'IN_PROGRESS' && (
                                            <button
                                                onClick={async () => {
                                                    // Logic: Manager checkout if CLINIC, Staff checkout if HOME/SOS
                                                    const isClinic = selectedBooking.type === 'IN_CLINIC'
                                                    const isManager = user?.role === 'CLINIC_MANAGER' || user?.role === 'ADMIN'

                                                    if (isClinic && !isManager) {
                                                        alert('Chỉ quản lý mới có thể checkout tại phòng khám')
                                                        return
                                                    }

                                                    setActionLoading(true)
                                                    try {
                                                        await completeBooking(selectedBooking.bookingId)
                                                        handleViewDetail(selectedBooking.bookingId)
                                                        fetchBookings() // Reload list
                                                    } catch (err) {
                                                        console.error('Complete failed:', err)
                                                        alert('Thao tác thất bại')
                                                    } finally {
                                                        setActionLoading(false)
                                                    }
                                                }}
                                                disabled={actionLoading}
                                                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-black shadow-[4px_4px_0px_0px_rgba(20,83,45,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50"
                                            >
                                                {actionLoading ? 'ĐANG XỬ LÝ...' : (selectedBooking.type === 'IN_CLINIC' ? 'CHECKOUT & HOÀN THÀNH' : 'HOÀN THÀNH KHÁM')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default StaffBookingsPage
