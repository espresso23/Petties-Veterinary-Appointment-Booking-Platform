import { useState, useEffect, useCallback } from 'react';
import { isAxiosError } from 'axios';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import {
    getBookingsByClinic,
    confirmBooking,
    getBookingById,
    checkStaffAvailability,
    confirmBookingWithOptions,
    addServiceToBooking,
    getAvailableStaffForConfirm,
    removeServiceFromBooking,
    cancelBooking,
    checkoutBooking,
    type StaffOption,
} from '../../../services/bookingService';
import type { Booking, BookingStatus, BookingServiceItem, StaffAvailabilityCheckResponse } from '../../../types/booking';
import { BOOKING_STATUS_CONFIG, BOOKING_TYPE_CONFIG, BOOKING_TYPE_LABELS, SERVICE_CATEGORY_LABELS, PAYMENT_STATUS_LABELS, STAFF_SPECIALTY_LABELS } from '../../../types/booking';
import { ReassignStaffModal } from '../../../components/booking/ReassignStaffModal';
import { StaffAvailabilityWarningModal, type ConfirmOption } from '../../../components/booking/StaffAvailabilityWarningModal';
import { AddServiceModal } from '../../../components/booking/AddServiceModal';
import { ReportBookingModal } from '../../../components/booking/ReportBookingModal';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { getMyReports } from '../../../services/reportService';
import type { ReportResponse } from '../../../types/report';
import { useToast } from '../../../components/Toast';
import { TrashIcon, TruckIcon, ScaleIcon, FlagIcon } from '@heroicons/react/24/outline';
import { useSseNotification } from '../../../hooks/useSseNotification';
import '../../../styles/brutalist.css';

type TabFilter = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'UNPAID' | 'HISTORY' | 'ALL';

const TAB_OPTIONS: { key: TabFilter; label: string }[] = [
    { key: 'PENDING', label: 'Chờ xác nhận' },
    { key: 'CONFIRMED', label: 'Đã xác nhận' },
    { key: 'IN_PROGRESS', label: 'Đang tiến hành' },
    { key: 'COMPLETED', label: 'Đã hoàn thành' },
    { key: 'UNPAID', label: 'Chưa thanh toán' },
    { key: 'HISTORY', label: 'Lịch sử' },
    { key: 'ALL', label: 'Tất cả' },
];

const TYPE_FILTER_OPTIONS = [
    { key: 'ALL', label: 'Tất cả loại' },
    { key: 'IN_CLINIC', label: 'Tại phòng khám' },
    { key: 'HOME_VISIT', label: 'Khám tại nhà' },
    { key: 'SOS', label: 'Cấp cứu' },
];

const getAllServices = (booking: Booking): BookingServiceItem[] => {
    if (booking.pets && booking.pets.length > 0) {
        return booking.pets.flatMap(pet => pet.services || []);
    }
    return booking.services || [];
};

/**
 * Booking Dashboard Page - Manager view
 * Shows list of bookings with filter tabs and confirm action
 */
export const BookingDashboardPage = () => {
    const { user } = useAuthStore();
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabFilter>('PENDING');
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [confirming, setConfirming] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState<string | null>(null);
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [bookingIdToCancel, setBookingIdToCancel] = useState<string | null>(null);

    // Staff availability warning modal state
    const [availabilityWarningOpen, setAvailabilityWarningOpen] = useState(false);
    const [availabilityCheckResult, setAvailabilityCheckResult] = useState<StaffAvailabilityCheckResponse | null>(null);
    const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);

    // Add-on Service state
    const [addServiceModalOpen, setAddServiceModalOpen] = useState(false);
    const [addingService, setAddingService] = useState(false);

    // Report state
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [bookingToReport, setBookingToReport] = useState<{ id: string; code: string } | null>(null);

    // Main view: Lịch hẹn | Lịch sử báo cáo
    const [viewMode, setViewMode] = useState<'bookings' | 'reports'>('bookings');
    const [reports, setReports] = useState<ReportResponse[]>([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [reportDetail, setReportDetail] = useState<ReportResponse | null>(null);

    // Handle bookingId from URL query params (e.g., from schedule page click)
    useEffect(() => {
        const bookingIdFromUrl = searchParams.get('bookingId');
        if (bookingIdFromUrl && user?.workingClinicId) {
            // Fetch and select the specific booking
            getBookingById(bookingIdFromUrl)
                .then(booking => {
                    setSelectedBooking(booking);
                    // Switch to appropriate tab
                    if (booking.status === 'PENDING') {
                        setActiveTab('PENDING');
                    } else if (booking.status === 'CONFIRMED') {
                        setActiveTab('CONFIRMED');
                    } else if (booking.status === 'IN_PROGRESS') {
                        setActiveTab('IN_PROGRESS');
                    } else if (booking.status === 'COMPLETED') {
                        setActiveTab('COMPLETED');
                    } else if (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') {
                        setActiveTab('HISTORY');
                    } else {
                        setActiveTab('ALL');
                    }
                })
                .catch(err => console.error('Failed to fetch booking from URL:', err));
        }
    }, [searchParams, user?.workingClinicId]);

    // Fetch bookings
    const fetchBookings = useCallback(async () => {
        if (!user?.workingClinicId) return;

        setLoading(true);
        try {
            // Pass type filter to API if not 'ALL'
            const apiType = typeFilter === 'ALL' ? undefined : typeFilter;

            // Optimization: For PENDING tab, pass status to API to get full list correctly
            // For other tabs, we still fetch all and filter client-side (until backend supports list of statuses)
            // But we request a larger page size to minimize pagination issues

            let statusParam: BookingStatus | undefined = undefined;
            if (activeTab === 'PENDING') {
                statusParam = 'PENDING';
            }

            // Using larger page size to ensure we get enough items when filtering client-side
            const response = await getBookingsByClinic(
                user.workingClinicId,
                statusParam,
                apiType,
                0,
                100
            );

            let filtered = response.content || [];

            if (activeTab === 'PENDING') {
                // Should already be filtered by API, but double check
                filtered = filtered.filter(b => b.status === 'PENDING');
            } else if (activeTab === 'CONFIRMED') {
                // Only show CONFIRMED status
                filtered = filtered.filter(b => b.status === 'CONFIRMED');
            } else if (activeTab === 'IN_PROGRESS') {
                // Show in-progress bookings
                filtered = filtered.filter(b =>
                    b.status === 'IN_PROGRESS'
                );
            } else if (activeTab === 'COMPLETED') {
                // Show completed bookings only
                filtered = filtered.filter(b => b.status === 'COMPLETED');
            } else if (activeTab === 'UNPAID') {
                // Show unpaid bookings (excluding cancelled/no-show)
                filtered = filtered.filter(b => {
                    const paymentStatus = (b.paymentStatus || '').toUpperCase();
                    return paymentStatus !== 'PAID' && b.status !== 'CANCELLED' && b.status !== 'NO_SHOW';
                });
            } else if (activeTab === 'HISTORY') {
                // Show cancelled/no-show bookings
                filtered = filtered.filter(b =>
                    b.status === 'CANCELLED' ||
                    b.status === 'NO_SHOW'
                );
            }
            // 'ALL' shows everything

            setBookings(filtered);
        } catch (error) {
            console.error('Failed to fetch bookings:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.workingClinicId, activeTab, typeFilter]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    // Fetch report history when on reports tab
    const fetchReports = useCallback(async () => {
        setReportsLoading(true);
        try {
            const data = await getMyReports(0, 50);
            setReports(data.content || []);
        } catch (error) {
            console.error('Failed to fetch reports:', error);
            showToast('error', 'Không thể tải lịch sử báo cáo');
        } finally {
            setReportsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        if (viewMode === 'reports') {
            fetchReports();
        }
    }, [viewMode, fetchReports]);

    // Handle real-time booking updates
    useSseNotification({
        silent: true,
        onBookingUpdate: (data) => {
            console.log('[BookingDashboardPage] Real-time update:', data);

            // 1. Refresh the main list
            fetchBookings();

            // 2. If the updated booking is currently open in modal, refresh it
            if (selectedBooking && data.bookingId === selectedBooking.bookingId) {
                getBookingById(data.bookingId)
                    .then(updatedBooking => {
                        console.log('[BookingDashboardPage] Refreshing open booking:', updatedBooking.bookingCode);
                        setSelectedBooking(updatedBooking);
                    })
                    .catch(err => console.error('Failed to refresh selected booking:', err));
            }
        }
    });

    // Handle confirm booking - checks availability first
    const handleConfirm = async (bookingId: string, selectedStaffId?: string) => {
        setConfirming(bookingId);
        try {
            // If staff is manually selected, skip availability check and confirm directly
            if (selectedStaffId) {
                await confirmBooking(bookingId, { selectedStaffId });
                showToast('success', 'Đã xác nhận và gán bác sĩ thành công');
                await fetchBookings();
                setSelectedBooking(null);
                return;
            }

            // Step 1: Check staff availability (auto-assign mode)
            const availability = await checkStaffAvailability(bookingId);

            if (availability.allServicesHaveStaff) {
                // All staff available, proceed with normal confirmation
                await confirmBooking(bookingId);
                showToast('success', 'Đã xác nhận và gán bác sĩ thành công');
                await fetchBookings();
                setSelectedBooking(null);
            } else {
                // Some services don't have available staff, show warning modal
                setAvailabilityCheckResult(availability);
                setPendingBookingId(bookingId);
                setAvailabilityWarningOpen(true);
            }
        } catch (error) {
            console.error('Failed to confirm booking:', error);
            showToast('error', (isAxiosError(error) && error.response?.data && typeof error.response.data === 'object' && 'message' in error.response.data ? String((error.response.data as { message?: unknown }).message) : null) || 'Không thể xác nhận booking. Vui lòng thử lại.');
        } finally {
            setConfirming(null);
        }
    };

    // Handle confirm option from warning modal
    const handleConfirmOption = async (option: ConfirmOption) => {
        if (!pendingBookingId) return;

        setConfirming(pendingBookingId);
        try {
            if (option === 'cancel') {
                // User wants to cancel and add staff schedule first
                setAvailabilityWarningOpen(false);
                setPendingBookingId(null);
                setAvailabilityCheckResult(null);
                showToast('info', 'Vui lòng thêm lịch làm việc cho bác sĩ và quay lại xác nhận');
                return;
            }

            if (option === 'partial') {
                // Confirm with partial assignment
                await confirmBookingWithOptions(pendingBookingId, {
                    allowPartial: true,
                });
                showToast('success', 'Đã xác nhận một phần. Vui lòng gán bác sĩ thủ công cho các dịch vụ còn lại.');
            } else if (option === 'remove') {
                // Confirm and remove unavailable services
                await confirmBookingWithOptions(pendingBookingId, {
                    removeUnavailableServices: true,
                });
                showToast('success', 'Đã xác nhận và loại bỏ dịch vụ thiếu bác sĩ');
            }

            await fetchBookings();
            setAvailabilityWarningOpen(false);
            setPendingBookingId(null);
            setAvailabilityCheckResult(null);
            setSelectedBooking(null);
        } catch (error) {
            console.error('Failed to confirm booking with option:', error);
            showToast('error', 'Không thể xác nhận booking. Vui lòng thử lại.');
        } finally {
            setConfirming(null);
        }
    };
    const handleOpenAddServiceModal = () => {
        if (!selectedBooking) return;
        setAddServiceModalOpen(true);
    };

    // Handle Add Service
    const handleAddService = async (serviceId: string) => {
        if (!selectedBooking) return;

        setAddingService(true);
        try {
            const updatedBooking = await addServiceToBooking(selectedBooking.bookingId, serviceId);
            setSelectedBooking(updatedBooking);
            await fetchBookings();
            setAddServiceModalOpen(false);
            showToast('success', 'Đã thêm dịch vụ thành công');
        } catch (error) {
            console.error('Failed to add service:', error);
            showToast('error', error?.response?.data?.message || 'Không thể thêm dịch vụ');
        } finally {
            setAddingService(false);
        }
    };

    // Handle cancel booking
    const handleCancelBooking = (bookingId: string) => {
        setBookingIdToCancel(bookingId);
        setCancelModalOpen(true);
    };

    const confirmCancelBooking = async (reason: string) => {
        if (!bookingIdToCancel) return;

        setCancelling(bookingIdToCancel);
        try {
            await cancelBooking(bookingIdToCancel, reason);
            showToast('success', 'Đã hủy lịch hẹn thành công');
            await fetchBookings();
            setSelectedBooking(null);
            setCancelModalOpen(false);
            setBookingIdToCancel(null);
        } catch (error: any) {
            console.error('Failed to cancel booking:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Không thể hủy lịch hẹn. Vui lòng thử lại.';
            showToast('error', errorMessage);
        } finally {
            setCancelling(null);
        }
    };

    const handleOpenReportModal = (bookingId: string, bookingCode: string) => {
        setBookingToReport({ id: bookingId, code: bookingCode });
        setReportModalOpen(true);
    };

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    // Get status badge
    const getStatusBadge = (status: BookingStatus) => {
        const config = BOOKING_STATUS_CONFIG[status];
        return (
            <span
                className="px-3 py-1 text-xs font-bold uppercase border-2 border-stone-900 whitespace-nowrap"
                style={{ backgroundColor: config.bgColor, color: config.textColor }}
            >
                {config.label}
            </span>
        );
    };

    // Get pending count
    const pendingCount = bookings.filter(b => b.status === 'PENDING').length;

    return (
        <div className="p-6 bg-stone-50 min-h-screen">
            {/* Header */}
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-stone-900 uppercase tracking-wide">
                    QUẢN LÝ ĐẶT LỊCH
                </h1>
                <p className="text-stone-600 mt-1">
                    Xem và xác nhận các đơn đặt lịch khám
                </p>
            </header>

            {/* Main view tabs: Lịch hẹn | Lịch sử báo cáo */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setViewMode('bookings')}
                    className={`px-6 py-2 font-bold uppercase border-2 border-stone-900 transition-all ${viewMode === 'bookings'
                        ? 'bg-amber-400 shadow-[4px_4px_0_#1c1917]'
                        : 'bg-white hover:bg-stone-100'
                        }`}
                >
                    Lịch hẹn
                </button>
                <button
                    onClick={() => {
                        setViewMode('reports');
                        setSelectedBooking(null);
                    }}
                    className={`px-6 py-2 font-bold uppercase border-2 border-stone-900 transition-all ${viewMode === 'reports'
                        ? 'bg-amber-400 shadow-[4px_4px_0_#1c1917]'
                        : 'bg-white hover:bg-stone-100'
                        }`}
                >
                    Lịch sử báo cáo
                </button>
            </div>

            {viewMode === 'bookings' && (
            <>
            {/* Tabs (chỉ hiện khi xem Lịch hẹn) */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex gap-2">
                    {TAB_OPTIONS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 font-bold text-sm uppercase border-2 border-stone-900 transition-all ${activeTab === tab.key
                                ? 'bg-amber-400 shadow-[4px_4px_0_#1c1917]'
                                : 'bg-white hover:bg-stone-100'
                                }`}
                        >
                            {tab.label}
                            {tab.key === 'PENDING' && pendingCount > 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-coral-500 text-white text-xs rounded">
                                    {pendingCount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold uppercase text-stone-500">Lọc loại:</span>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-4 py-2 bg-white border-2 border-stone-900 font-bold text-sm uppercase focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                        {TYPE_FILTER_OPTIONS.map(opt => (
                            <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Booking Table */}
            <div className="bg-white border-4 border-stone-900 shadow-brutal">
                <table className="w-full">
                    <thead className="border-b-4 border-stone-900 bg-stone-100">
                        <tr className="text-left">
                            <th className="p-4 text-xs font-bold uppercase tracking-wide">Mã đơn</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wide">Thú cưng</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wide">Chủ</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wide">Dịch vụ</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wide text-center">Loại</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wide text-center">Ngày giờ</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wide text-center">Trạng thái</th>
                            <th className="p-4 text-xs font-bold uppercase tracking-wide text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-stone-600">
                                    Đang tải...
                                </td>
                            </tr>
                        ) : bookings.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-stone-600">
                                    Không có đơn đặt lịch nào
                                </td>
                            </tr>
                        ) : (
                            bookings.map((booking) => (
                                <tr
                                    key={booking.bookingId}
                                    className="border-b-2 border-stone-200 hover:bg-amber-50 transition-colors"
                                >
                                    <td className="p-4">
                                        <span className="font-mono font-bold text-sm">
                                            {booking.bookingCode}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {booking.pets && booking.pets.length > 1 ? (
                                            <div className="space-y-1">
                                                {booking.pets.map((pet) => (
                                                    <div key={pet.petId} className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg border-2 border-stone-300 overflow-hidden bg-stone-100 flex-shrink-0 flex items-center justify-center font-bold text-stone-600 text-xs">
                                                            {pet.petName?.charAt(0) || '?'}
                                                        </div>
                                                        <div className="font-bold text-sm">{pet.petName}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 rounded-lg border-2 border-stone-300 overflow-hidden bg-stone-100 flex-shrink-0">
                                                    {booking.petPhotoUrl ? (
                                                        <img
                                                            src={booking.petPhotoUrl}
                                                            alt={booking.petName}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center font-bold text-stone-500 text-sm">
                                                            {booking.petName?.charAt(0) || '?'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold">{booking.petName}</div>
                                                    <div className="text-xs text-stone-500">{booking.petBreed}</div>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-medium">{booking.ownerName}</div>
                                        <div className="text-xs text-stone-500">{booking.ownerPhone}</div>
                                    </td>
                                    <td className="p-4">
                                        {booking.pets && booking.pets.length > 0
                                            ? booking.pets.map((pet) => (
                                                <div key={pet.petId} className="mb-2 last:mb-0">
                                                    <div className="text-xs font-bold text-stone-500 uppercase mb-0.5">{pet.petName}</div>
                                                    {(pet.services || []).map((s, idx) => (
                                                        <div key={idx} className="text-sm pl-2 border-l-2 border-stone-200 my-0.5">
                                                            {s.serviceName}
                                                            <span className="ml-1 text-xs text-stone-500">
                                                                [{SERVICE_CATEGORY_LABELS[s.serviceCategory] || s.serviceCategory}]
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))
                                            : getAllServices(booking).map((s, idx) => (
                                                <div key={idx} className="text-sm">
                                                    {s.serviceName}
                                                    <span className="ml-1 text-xs text-stone-500">
                                                        [{SERVICE_CATEGORY_LABELS[s.serviceCategory] || s.serviceCategory}]
                                                    </span>
                                                </div>
                                            ))
                                        }
                                    </td>
                                    <td className="p-4 text-center">
                                        <div
                                            className="text-xs font-bold uppercase px-3 py-1.5 border-2 border-stone-900 inline-block whitespace-nowrap shadow-[2px_2px_0_#1c1917]"
                                            style={{
                                                backgroundColor: BOOKING_TYPE_CONFIG[booking.type]?.bgColor || '#f5f5f4',
                                                color: BOOKING_TYPE_CONFIG[booking.type]?.textColor || '#1c1917',
                                            }}
                                        >
                                            {BOOKING_TYPE_CONFIG[booking.type]?.label || booking.type}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="font-bold">{formatDate(booking.bookingDate)}</div>
                                        <div className="text-sm text-stone-600">{booking.bookingTime}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        {getStatusBadge(booking.status)}
                                        {/* Show all unique assigned staff from services with avatar */}
                                        {(() => {
                                            const staffMembers = new Map<string, { name: string; avatar?: string }>();

                                            // 1. Add primary assigned staff (Crucial for SOS where services list is empty)
                                            if (booking.assignedStaffId && booking.assignedStaffName) {
                                                staffMembers.set(booking.assignedStaffId, {
                                                    name: booking.assignedStaffName,
                                                    avatar: booking.assignedStaffAvatarUrl
                                                });
                                            }

                                            // 2. Add staff from individual services (multi-pet + traditional)
                                            getAllServices(booking).forEach((service: BookingServiceItem) => {
                                                if (service.assignedStaffId && service.assignedStaffName) {
                                                    staffMembers.set(service.assignedStaffId, {
                                                        name: service.assignedStaffName,
                                                        avatar: service.assignedStaffAvatarUrl
                                                    });
                                                }
                                            });

                                            if (staffMembers.size === 0) return null;

                                            return (
                                                <div className="mt-2 flex flex-wrap gap-1 justify-center">
                                                    {Array.from(staffMembers.values()).map((staff, idx) => (
                                                        <div key={idx} className="flex items-center gap-1.5 bg-mint-100 px-2 py-1 rounded-full border border-stone-300">
                                                            {/* Staff Avatar */}
                                                            <div className="w-5 h-5 rounded-full overflow-hidden border border-stone-400 bg-white flex-shrink-0">
                                                                {staff.avatar ? (
                                                                    <img
                                                                        src={staff.avatar}
                                                                        alt={staff.name}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold bg-mint-200 text-stone-600">
                                                                        {staff.name?.charAt(0) || '?'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {/* Staff Name */}
                                                            <span className="text-xs font-medium text-stone-700">{staff.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-2 justify-center">
                                            {booking.status === 'PENDING' && (
                                                <button
                                                    onClick={() => handleConfirm(booking.bookingId)}
                                                    disabled={confirming === booking.bookingId}
                                                    className="px-3 py-1 text-xs font-bold uppercase bg-mint-400 border-2 border-stone-900 hover:shadow-[2px_2px_0_#1c1917] transition-all disabled:opacity-50"
                                                >
                                                    {confirming === booking.bookingId ? '...' : 'Xác nhận'}
                                                </button>
                                            )}
                                            {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                                                <button
                                                    onClick={() => handleCancelBooking(booking.bookingId)}
                                                    disabled={cancelling === booking.bookingId}
                                                    className="px-3 py-1 text-xs font-bold uppercase bg-red-500 text-white border-2 border-stone-900 hover:shadow-[2px_2px_0_#1c1917] transition-all disabled:opacity-50"
                                                >
                                                    {cancelling === booking.bookingId ? '...' : 'Hủy'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setSelectedBooking(booking)}
                                                className="px-3 py-1 text-xs font-bold uppercase bg-white border-2 border-stone-900 hover:shadow-[2px_2_0_#1c1917] transition-all"
                                            >
                                                Chi tiết
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            </>
            )}

            {/* Lịch sử báo cáo */}
            {viewMode === 'reports' && (
            <div className="bg-white border-4 border-stone-900 shadow-brutal overflow-hidden">
                <table className="w-full">
                    <thead className="border-b-4 border-stone-900 bg-stone-100">
                        <tr className="text-left font-bold uppercase text-xs tracking-wider">
                            <th className="p-4">Mã Booking</th>
                            <th className="p-4">Khách hàng bị báo cáo</th>
                            <th className="p-4">Lý do</th>
                            <th className="p-4 text-center">Trạng thái</th>
                            <th className="p-4 text-center">Ngày gửi</th>
                            <th className="p-4 text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportsLoading ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-stone-600">Đang tải...</td>
                            </tr>
                        ) : reports.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-stone-600">Chưa có báo cáo nào</td>
                            </tr>
                        ) : (
                            reports.map((report) => (
                                <tr key={report.id} className="border-b-2 border-stone-200 hover:bg-amber-50">
                                    <td className="p-4 font-mono font-bold">{report.bookingCode}</td>
                                    <td className="p-4">
                                        <div className="font-bold">{report.reportedUserName || report.reportedClinicName || '—'}</div>
                                        <div className="text-[10px] text-stone-500 uppercase">
                                            {report.reportedUserName ? 'Khách hàng' : report.reportedClinicName ? 'Phòng khám' : ''}
                                        </div>
                                    </td>
                                    <td className="p-4 max-w-xs">
                                        <div className="text-sm line-clamp-2" title={report.reason}>{report.reason}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1 text-xs font-bold uppercase border-2 border-stone-900 ${
                                            report.status === 'PENDING' ? 'bg-yellow-400 text-stone-900' :
                                            report.status === 'APPROVED' ? 'bg-mint-400 text-stone-900' :
                                            'bg-red-500 text-white'
                                        }`}>
                                            {report.status === 'PENDING' ? 'Chờ xử lý' : report.status === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center text-sm text-stone-600">
                                        {new Date(report.createdAt).toLocaleDateString('vi-VN')}
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => setReportDetail(report)}
                                            className="px-3 py-1 text-xs font-bold uppercase bg-white border-2 border-stone-900 hover:shadow-[2px_2px_0_#1c1917]"
                                        >
                                            Chi tiết
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            )}

            {/* Report Detail Modal (read-only) */}
            {reportDetail && (
                <div className="fixed inset-0 bg-stone-900/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                    <div className="bg-white border-4 border-stone-900 shadow-[8px_8px_0_#1c1917] max-w-2xl w-full flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="bg-amber-400 border-b-4 border-stone-900 p-4 flex justify-between items-center">
                            <h2 className="text-xl font-bold uppercase">Chi tiết báo cáo</h2>
                            <button onClick={() => setReportDetail(null)} className="w-8 h-8 flex items-center justify-center bg-white border-2 border-stone-900 hover:bg-stone-100">✕</button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="border-2 border-stone-900 p-3 bg-stone-50">
                                    <p className="text-[10px] font-bold text-stone-500 uppercase">Mã booking</p>
                                    <p className="font-mono font-bold">{reportDetail.bookingCode}</p>
                                </div>
                                <div className="border-2 border-stone-900 p-3 bg-stone-50">
                                    <p className="text-[10px] font-bold text-stone-500 uppercase">Bị báo cáo</p>
                                    <p className="font-bold">{reportDetail.reportedUserName || reportDetail.reportedClinicName || '—'}</p>
                                </div>
                            </div>
                            <div className="border-2 border-stone-900 p-3 bg-white">
                                <p className="text-[10px] font-bold text-stone-500 uppercase mb-1">Lý do báo cáo</p>
                                <p className="text-sm font-medium">{reportDetail.reason}</p>
                            </div>
                            {reportDetail.status !== 'PENDING' && reportDetail.adminNote && (
                                <div className={`border-2 border-stone-900 p-3 ${reportDetail.status === 'APPROVED' ? 'bg-mint-50' : 'bg-red-50'}`}>
                                    <p className="text-[10px] font-bold text-stone-500 uppercase mb-1">Quyết định của Admin</p>
                                    <p className="text-sm font-medium">{reportDetail.adminNote}</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t-4 border-stone-900 bg-stone-100 flex justify-end">
                            <button
                                onClick={() => setReportDetail(null)}
                                className="px-6 py-2 font-bold uppercase bg-white border-2 border-stone-900 shadow-[4px_4px_0_#1c1917]"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Booking Detail Modal */}
            {selectedBooking && (
                <BookingDetailModal
                    booking={selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                    onConfirm={handleConfirm}
                    onCancel={handleCancelBooking}
                    onBookingUpdated={fetchBookings}
                    onAddService={handleOpenAddServiceModal}
                    onReport={() => handleOpenReportModal(selectedBooking.bookingId, selectedBooking.bookingCode)}
                />
            )}

            {/* Report Modal */}
            {bookingToReport && (
                <ReportBookingModal
                    isOpen={reportModalOpen}
                    onClose={() => {
                        setReportModalOpen(false);
                        setBookingToReport(null);
                    }}
                    onSuccess={() => {
                        if (viewMode === 'reports') fetchReports();
                    }}
                    bookingId={bookingToReport.id}
                    bookingCode={bookingToReport.code}
                    reporterContext="CLINIC_MANAGER"
                />
            )}

            {/* Staff Availability Warning Modal */}
            {
                availabilityCheckResult && (
                    <StaffAvailabilityWarningModal
                        isOpen={availabilityWarningOpen}
                        availability={availabilityCheckResult}
                        onClose={() => {
                            setAvailabilityWarningOpen(false);
                            setPendingBookingId(null);
                            setAvailabilityCheckResult(null);
                        }}
                        onConfirm={handleConfirmOption}
                        isConfirming={confirming !== null}
                    />
                )
            }
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

            {/* Cancel Booking Modal */}
            <CancelBookingModal
                isOpen={cancelModalOpen}
                onClose={() => {
                    setCancelModalOpen(false);
                    setBookingIdToCancel(null);
                }}
                onConfirm={confirmCancelBooking}
                isCancelling={cancelling !== null}
            />
        </div >
    );
};

// Booking Detail Modal Component
interface BookingDetailModalProps {
    booking: Booking;
    onClose: () => void;
    onConfirm: (bookingId: string, selectedStaffId?: string) => void;
    onCancel: (bookingId: string) => void;
    onBookingUpdated?: () => void;
    onAddService?: () => void;
    onReport?: () => void;
}

const BookingDetailModal = ({ booking: initialBooking, onClose, onConfirm, onCancel, onBookingUpdated, onAddService, onReport }: BookingDetailModalProps) => {
    const { showToast } = useToast();
    const [booking, setBooking] = useState<Booking>(initialBooking);
    const [reassignModalOpen, setReassignModalOpen] = useState(false);
    const [selectedService, setSelectedService] = useState<BookingServiceItem | null>(null);

    // Sync state when prop changes (e.g. from parent update or SSE)
    useEffect(() => {
        setBooking(initialBooking);
    }, [initialBooking]);

    // Staff selection dropdown state - per service
    const [availableStaffByService, setAvailableStaffByService] = useState<Record<string, StaffOption[]>>({});
    const [selectedStaffByService, setSelectedStaffByService] = useState<Record<string, string>>({});
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [openDropdownServiceId, setOpenDropdownServiceId] = useState<string | null>(null);

    // Confirmation Modal for Removal (integrationFeature)
    const [confirmRemoveModal, setConfirmRemoveModal] = useState<{ isOpen: boolean; serviceId: string | null }>({
        isOpen: false,
        serviceId: null,
    });
    const [confirmCheckoutModal, setConfirmCheckoutModal] = useState<Booking | null>(null);

    const handleCheckout = async () => {
        if (!confirmCheckoutModal) return;
        try {
            await checkoutBooking(confirmCheckoutModal.bookingId);
            showToast('success', 'Thu tiền mặt và hoàn thành lịch hẹn thành công');
            setConfirmCheckoutModal(null);
            if (onBookingUpdated) onBookingUpdated();
            onClose();
        } catch (error: any) {
            console.error('Failed to checkout:', error);
            const errorMessage = error.response?.data?.message || 'Không thể thu tiền. Vui lòng thử lại.';
            showToast('error', errorMessage);
        }
    };

    // Fetch available staff when modal opens with PENDING booking
    useEffect(() => {
        if (booking.status === 'PENDING') {
            // Fetch all available staff for dropdown - grouped by service
            setLoadingStaff(true);
            getAvailableStaffForConfirm(booking.bookingId)
                .then(data => {
                    // Group staff by service (for now, use same list for all services)
                    // In future, can make API return per-service staff
                    const staffByService: Record<string, StaffOption[]> = {};
                    const selectedByService: Record<string, string> = {};

                    getAllServices(booking).forEach((service: BookingServiceItem) => {
                        const serviceId = service.bookingServiceId || service.serviceId;

                        // Filter staff for this specific service category
                        const category = service.serviceCategory;
                        const filteredStaff = data.filter(staff => {
                            const staffSpec = staff.specialty;

                            // 1. Strict Groomer rule
                            if (category === 'GROOMING_SPA') {
                                return staffSpec === 'GROOMER';
                            }

                            // 2. Medical services shouldn't show Groomers
                            if (staffSpec === 'GROOMER') {
                                return false;
                            }

                            // 3. Match specialty: medical services → VET, GROOMING_SPA → GROOMER
                            const requiredSpecialty = category === 'GROOMING_SPA' ? 'GROOMER' : 'VET';
                            const staffIsVet = staffSpec === 'VET' || (staffSpec?.startsWith('VET_') ?? false);
                            return requiredSpecialty === 'VET' ? staffIsVet : staffSpec === requiredSpecialty;
                        });

                        staffByService[serviceId] = filteredStaff;

                        // Auto-select staff for this service:
                        // Priority 1: Suggested staff from backend (if they pass our specialty filter AND are available for this specific service)
                        // Priority 2: First staff with available slots for THIS specific service in the filtered list
                        const suggested = filteredStaff.find(s => s.isSuggested && s.availableServiceItemIds?.includes(serviceId));
                        const firstAvailable = filteredStaff.find(s => s.availableServiceItemIds?.includes(serviceId));

                        if (suggested) {
                            selectedByService[serviceId] = suggested.staffId;
                        } else if (firstAvailable) {
                            selectedByService[serviceId] = firstAvailable.staffId;
                        }
                    });

                    setAvailableStaffByService(staffByService);
                    setSelectedStaffByService(selectedByService);
                })
                .catch(err => {
                    console.error('Failed to fetch available staff:', err);
                })
                .finally(() => {
                    setLoadingStaff(false);
                });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [booking.bookingId, booking.status]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const handleOpenReassignModal = (service: BookingServiceItem) => {
        setSelectedService(service);
        setReassignModalOpen(true);
    };

    const handleReassigned = async () => {
        // Refresh booking data after reassignment
        try {
            const updatedBooking = await getBookingById(booking.bookingId);
            setBooking(updatedBooking);
            if (onBookingUpdated) {
                onBookingUpdated();
            }
        } catch (error) {
            console.error('Failed to refresh booking:', error);
        }
    };

    const handleRemoveService = async (_bookingId: string, serviceId: string) => {
        setConfirmRemoveModal({ isOpen: true, serviceId });
    };

    const confirmRemoveAction = async () => {
        const serviceId = confirmRemoveModal.serviceId;
        if (!serviceId) return;

        try {
            await removeServiceFromBooking(booking.bookingId, serviceId);
            showToast('success', 'Đã xóa dịch vụ thành công');
            setConfirmRemoveModal({ isOpen: false, serviceId: null });

            // Refresh booking
            const updatedBooking = await getBookingById(booking.bookingId);
            setBooking(updatedBooking);
            if (onBookingUpdated) {
                onBookingUpdated();
            }
        } catch (error) {
            console.error('Failed to remove service:', error);
            showToast('error', 'Không thể xóa dịch vụ');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            {/* Main Modal Container */}
            <div className="bg-white border-4 border-stone-900 shadow-brutal max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden relative">
                {/* Header */}
                <div className={`flex justify-between items-center p-4 border-b-4 border-stone-900 ${booking.type === 'SOS' ? 'bg-red-500 text-white' : 'bg-amber-400 text-stone-900'}`}>
                    <div>
                        <h2 className="text-xl font-bold uppercase flex items-center gap-2">
                            {booking.type === 'SOS' && (
                                <span className="animate-pulse bg-white text-red-600 px-2 py-0.5 text-sm border-2 border-red-900">SOS</span>
                            )}
                            Chi tiết đặt lịch
                        </h2>
                        <p className={`font-mono ${booking.type === 'SOS' ? 'text-red-100' : 'text-stone-700'}`}>{booking.bookingCode}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center bg-stone-900 text-white font-bold text-xl hover:bg-stone-700"
                    >
                        X
                    </button>
                </div>

                {booking.type === 'SOS' && (
                    <div className="bg-red-50 border-b-4 border-red-600 p-3 text-red-800 flex items-center gap-3">
                        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-red-600 text-white rounded-full">
                            <span className="font-bold">!</span>
                        </div>
                        <div>
                            <div className="font-bold uppercase text-sm">Yêu cầu cấp cứu khẩn cấp</div>
                            <div className="text-xs">Vui lòng ưu tiên xử lý và gán nhân viên ngay lập tức.</div>
                        </div>
                    </div>
                )}

                {/* Content - Scrollable Body */}
                <div className="p-6 space-y-6 overflow-auto flex-1 bg-white">
                    {/* Pet & Owner Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="border-2 border-stone-900 p-4 bg-white">
                            <h3 className="font-bold uppercase text-sm mb-3 text-stone-500">
                                Thông tin thú cưng{booking.pets && booking.pets.length > 1 ? ` (${booking.pets.length})` : ''}
                            </h3>
                            {booking.pets && booking.pets.length > 1 ? (
                                <div className="space-y-4">
                                    {booking.pets.map((pet) => (
                                        <div key={pet.petId} className="flex gap-4 items-start pb-4 border-b-2 border-stone-200 last:border-0 last:pb-0">
                                            <div className="w-14 h-14 border-2 border-stone-900 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0 flex items-center justify-center text-xl font-bold text-stone-500">
                                                {pet.petName?.charAt(0) || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold">{pet.petName}</div>
                                                <div className="text-xs text-stone-500 mt-1">
                                                    {(pet.services || []).length} dịch vụ
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex gap-4 items-start">
                                    <div className="w-20 h-20 border-2 border-stone-900 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                                        {booking.petPhotoUrl ? (
                                            <img src={booking.petPhotoUrl} alt={booking.petName} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-lg font-bold text-stone-400">
                                                {booking.petName?.charAt(0) || '?'}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-lg font-bold">{booking.petName}</div>
                                        <div className="text-sm text-stone-600">{booking.petSpecies} - {booking.petBreed}</div>
                                        <div className="text-sm text-stone-500 mt-1">
                                            {booking.petAge}
                                            {booking.petWeight && <span className="ml-2 font-medium text-stone-700">• {booking.petWeight} kg</span>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="border-2 border-stone-900 p-4 bg-white">
                            <h3 className="font-bold uppercase text-sm mb-3 text-stone-500">Thông tin chủ</h3>
                            <div className="text-lg font-bold">{booking.ownerName}</div>
                            <div className="text-sm text-stone-600">{booking.ownerPhone}</div>
                            <div className="text-sm text-stone-500">{booking.ownerEmail}</div>
                            {booking.ownerAddress && (
                                <div className="text-sm text-stone-500 mt-1">📍 {booking.ownerAddress}</div>
                            )}
                        </div>
                    </div>

                    {/* Payment Status */}
                    {booking.paymentStatus && (
                        <div className="border-2 border-stone-900 p-3 flex items-center justify-between">
                            <span className="font-bold uppercase text-sm text-stone-500">Thanh toán</span>
                            <span
                                className="px-3 py-1 text-sm font-bold border-2 border-stone-900"
                                style={{
                                    backgroundColor: PAYMENT_STATUS_LABELS[booking.paymentStatus]?.color || '#D4D4D8',
                                }}
                            >
                                {PAYMENT_STATUS_LABELS[booking.paymentStatus]?.label || booking.paymentStatus}
                            </span>
                        </div>
                    )}

                    {/* QR Code Display (when QR checkout is active) */}
                    {booking.paymentStatus === 'PENDING' && booking.qrImageUrl && (
                        <div className="border-2 border-blue-500 bg-blue-50 p-4 mb-4">
                            <h3 className="font-bold uppercase text-sm mb-3 text-blue-700 text-center">
                                Quét mã QR để thanh toán
                            </h3>
                            <div className="flex justify-center mb-3">
                                <img
                                    src={booking.qrImageUrl}
                                    alt={booking.bookingCode}
                                    className="w-56 h-56 border-2 border-stone-900"
                                />
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-bold text-stone-900">
                                    {Number(booking.finalPrice ?? booking.totalPrice).toLocaleString('vi-VN')} VNĐ
                                </div>
                                <div className="flex items-center justify-center gap-2 mt-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                                    <span className="text-sm text-blue-600 font-medium">
                                        Đang chờ thanh toán...
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Assigned Staff (Top level - e.g. for SOS) */}
                    {booking.type === 'SOS' && booking.assignedStaffName && (
                        <div className="border-2 border-stone-900 p-4 bg-mint-50">
                            <h3 className="font-bold uppercase text-[10px] mb-3 text-stone-500 tracking-wider">
                                Bác sĩ cấp cứu
                            </h3>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-stone-900 bg-white shadow-[2px_2px_0_#1c1917]">
                                    {booking.assignedStaffAvatarUrl ? (
                                        <img
                                            src={booking.assignedStaffAvatarUrl}
                                            alt={booking.assignedStaffName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xl font-bold bg-mint-200 text-stone-600">
                                            {booking.assignedStaffName.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="font-bold text-lg leading-tight">
                                        {booking.assignedStaffName}
                                    </div>
                                    <div className="text-xs text-stone-600 font-medium">
                                        {STAFF_SPECIALTY_LABELS[booking.assignedStaffSpecialty || ''] ||
                                            booking.assignedStaffSpecialty ||
                                            'Bác sĩ thú y'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Services - grouped by pet when multi-pet */}
                    <div className="border-2 border-stone-900 p-4">
                        <h3 className="font-bold uppercase text-sm mb-3 text-stone-500">Dịch vụ đặt</h3>
                        {booking.pets && booking.pets.length > 0 ? (
                            booking.pets.map((pet) => (
                                <div key={pet.petId} className="mb-6 last:mb-0">
                                    <div className="text-sm font-bold text-stone-700 mb-3 pb-2 border-b-2 border-stone-300">
                                        {pet.petName}
                                    </div>
                                    {(pet.services || []).map((service: BookingServiceItem, idx: number) => (
                                        <div key={service.bookingServiceId || idx} className="py-3 border-b border-stone-200 last:border-0 pl-3 border-l-4 border-amber-400">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <span className="font-bold">{service.serviceName}</span>
                                                    <span className="ml-2 text-xs bg-stone-200 px-2 py-0.5">
                                                        {SERVICE_CATEGORY_LABELS[service.serviceCategory] || service.serviceCategory}
                                                    </span>
                                                    <div className="text-xs text-stone-500 mt-1">
                                                        {service.durationMinutes} phút - {service.slotsRequired} slot(s)
                                                        {service.scheduledStartTime && service.scheduledEndTime && (
                                                            <span className="ml-2 font-medium text-amber-600">
                                                                {String(service.scheduledStartTime).substring(0, 5)} - {String(service.scheduledEndTime).substring(0, 5)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex justify-end items-center gap-2">
                                                        <div className="font-bold">{formatCurrency(service.price)}</div>
                                                        {service.isAddOn && (
                                                            <button
                                                                onClick={() => handleRemoveService(booking.bookingId, service.bookingServiceId!)}
                                                                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                                                                title="Xóa dịch vụ phát sinh"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-stone-500 mt-1">
                                                        {service.basePrice && service.weightPrice && service.weightPrice !== service.basePrice ? (
                                                            <span className="text-stone-400">Giá gốc: <span className="line-through">{formatCurrency(service.basePrice)}</span> → <span className="text-mint-600">{formatCurrency(service.weightPrice)}</span></span>
                                                        ) : (
                                                            <span className="text-stone-400">Giá cố định</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {service.assignedStaffName ? (
                                                <div className="mt-2 flex items-center gap-2 bg-mint-100 px-2 py-1 rounded border border-stone-300">
                                                    <div className="w-6 h-6 rounded-full overflow-hidden border border-stone-400 bg-white flex-shrink-0">
                                                        {service.assignedStaffAvatarUrl ? (
                                                            <img
                                                                src={service.assignedStaffAvatarUrl}
                                                                alt={service.assignedStaffName}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-xs font-bold bg-mint-200">
                                                                {service.assignedStaffName?.charAt(0) || '?'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-xs flex-1">
                                                        <span className="font-medium">{service.assignedStaffName}</span>
                                                        {service.assignedStaffSpecialty && (
                                                            <span className="text-stone-500 ml-1">
                                                                ({STAFF_SPECIALTY_LABELS[service.assignedStaffSpecialty] || service.assignedStaffSpecialty})
                                                            </span>
                                                        )}
                                                    </div>
                                                    {booking.status !== 'PENDING' && booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && booking.status !== 'IN_PROGRESS' && (
                                                        <button
                                                            onClick={() => handleOpenReassignModal(service)}
                                                            className="px-2 py-1 text-xs font-bold bg-amber-200 border border-stone-900 hover:bg-amber-300 transition-colors flex items-center gap-1"
                                                        >
                                                            Đổi
                                                        </button>
                                                    )}
                                                </div>
                                            ) : booking.status === 'PENDING' ? (
                                                (() => {
                                                    const serviceId = service.bookingServiceId || service.serviceId;
                                                    const serviceStaff = availableStaffByService[serviceId] || [];
                                                    const selectedStaffId = selectedStaffByService[serviceId];
                                                    const isDropdownOpen = openDropdownServiceId === serviceId;

                                                    if (loadingStaff) return <div className="mt-2 text-xs text-stone-400 italic">Đang tải nhân viên...</div>;
                                                    if (serviceStaff.length === 0) return <div className="mt-2 text-xs font-bold text-amber-800 bg-amber-50 p-1 border border-amber-600">Không có nhân viên phù hợp</div>;

                                                    const selectedStaff = serviceStaff.find(s => s.staffId === selectedStaffId);

                                                    return (
                                                        <div className="mt-2 relative">
                                                            <button
                                                                onClick={() => setOpenDropdownServiceId(isDropdownOpen ? null : serviceId)}
                                                                className="w-full flex items-center justify-between px-2 py-1.5 bg-green-50 border-2 border-green-600 text-xs font-medium"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {selectedStaff && (
                                                                        <div className="w-5 h-5 rounded-full overflow-hidden border border-green-200 bg-white flex-shrink-0">
                                                                            {selectedStaff.avatarUrl ? (
                                                                                <img src={selectedStaff.avatarUrl} alt={selectedStaff.fullName} className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold bg-green-100 text-green-700">
                                                                                    {selectedStaff.fullName?.charAt(0) || '?'}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    <span>{selectedStaff ? selectedStaff.fullName : 'Chọn nhân viên...'}</span>
                                                                </div>
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
                                                            </button>
                                                            {isDropdownOpen && (
                                                                <div className="absolute z-20 w-full mt-1 bg-white border-2 border-stone-900 shadow-[4px_4px_0_#1c1917] max-h-48 overflow-y-auto">
                                                                    {serviceStaff.map((staff) => {
                                                                        const isAvailableForThisService = staff.availableServiceItemIds?.includes(serviceId);

                                                                        return (
                                                                            <button
                                                                                key={staff.staffId}
                                                                                type="button"
                                                                                disabled={!isAvailableForThisService}
                                                                                onClick={() => {
                                                                                    setSelectedStaffByService(prev => ({
                                                                                        ...prev,
                                                                                        [serviceId]: staff.staffId
                                                                                    }));
                                                                                    setOpenDropdownServiceId(null);
                                                                                }}
                                                                                className={`w-full flex items-center gap-2 px-2 py-2 text-left transition-colors ${selectedStaffId === staff.staffId
                                                                                    ? 'bg-mint-100 border-l-4 border-l-mint-600'
                                                                                    : isAvailableForThisService
                                                                                        ? 'hover:bg-stone-50'
                                                                                        : 'opacity-50 cursor-not-allowed bg-stone-100'
                                                                                    }`}
                                                                            >
                                                                                <div className="w-8 h-8 rounded-full border-2 border-stone-400 overflow-hidden bg-stone-200 flex-shrink-0">
                                                                                    {staff.avatarUrl ? (
                                                                                        <img src={staff.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                                                    ) : (
                                                                                        <div className="w-full h-full flex items-center justify-center font-bold text-stone-600 text-sm">
                                                                                            {staff.fullName?.charAt(0) || '?'}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="text-xs font-bold text-stone-900 truncate">
                                                                                        {staff.fullName}
                                                                                        {staff.isSuggested && (
                                                                                            <span className="ml-1 text-[10px] bg-green-200 text-green-800 px-1 py-0.5 border border-green-600">Gợi ý</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="text-[10px] text-stone-500 truncate">
                                                                                        {staff.specialtyLabel || staff.specialty}
                                                                                    </div>
                                                                                    {!isAvailableForThisService && (
                                                                                        <div className="text-[10px] text-red-600 font-medium italic">
                                                                                            {staff.unavailableReason || "Không đủ slot trống cho khung giờ này"}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()
                                            ) : (
                                                <div className="mt-2 flex items-center justify-between">
                                                    <span className="text-xs text-stone-400 italic">
                                                        Chưa phân công bác sĩ
                                                    </span>
                                                    {booking.status === 'CONFIRMED' && (
                                                        <button
                                                            onClick={() => handleOpenReassignModal(service)}
                                                            className="px-3 py-1 text-xs font-bold bg-coral-400 text-stone-900 border border-stone-900 hover:bg-coral-500 transition-colors"
                                                        >
                                                            Phân công BS
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))
                        ) : (
                            getAllServices(booking).map((service: BookingServiceItem, idx: number) => (
                                <div key={service.bookingServiceId || idx} className="py-3 border-b border-stone-200 last:border-0">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <span className="font-bold">{service.serviceName}</span>
                                            <span className="ml-2 text-xs bg-stone-200 px-2 py-0.5">
                                                {SERVICE_CATEGORY_LABELS[service.serviceCategory] || service.serviceCategory}
                                            </span>
                                            <div className="text-xs text-stone-500 mt-1">
                                                {service.durationMinutes} phút - {service.slotsRequired} slot(s)
                                                {service.scheduledStartTime && service.scheduledEndTime && (
                                                    <span className="ml-2 font-medium text-amber-600">
                                                        {String(service.scheduledStartTime).substring(0, 5)} - {String(service.scheduledEndTime).substring(0, 5)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <div className="font-bold">{formatCurrency(service.price)}</div>
                                                {service.isAddOn && (
                                                    <button
                                                        onClick={() => handleRemoveService(booking.bookingId, service.bookingServiceId!)}
                                                        className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                                                        title="Xóa dịch vụ phát sinh"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="text-xs text-stone-500 mt-1">
                                                {service.basePrice && service.weightPrice && service.weightPrice !== service.basePrice ? (
                                                    <span className="text-stone-400">Giá gốc: <span className="line-through">{formatCurrency(service.basePrice)}</span> → <span className="text-mint-600">{formatCurrency(service.weightPrice)}</span></span>
                                                ) : (
                                                    <span className="text-stone-400">Giá cố định</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {service.assignedStaffName ? (
                                        <div className="mt-2 flex items-center gap-2 bg-mint-100 px-2 py-1 rounded border border-stone-300">
                                            <div className="w-6 h-6 rounded-full overflow-hidden border border-stone-400 bg-white flex-shrink-0">
                                                {service.assignedStaffAvatarUrl ? (
                                                    <img src={service.assignedStaffAvatarUrl} alt={service.assignedStaffName} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs font-bold bg-mint-200">
                                                        {service.assignedStaffName?.charAt(0) || '?'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs flex-1">
                                                <span className="font-medium">{service.assignedStaffName}</span>
                                                {service.assignedStaffSpecialty && (
                                                    <span className="text-stone-500 ml-1">({STAFF_SPECIALTY_LABELS[service.assignedStaffSpecialty] || service.assignedStaffSpecialty})</span>
                                                )}
                                            </div>
                                            {booking.status !== 'PENDING' && booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && booking.status !== 'IN_PROGRESS' && (
                                                <button onClick={() => handleOpenReassignModal(service)} className="px-2 py-1 text-xs font-bold bg-amber-200 border border-stone-900 hover:bg-amber-300 transition-colors flex items-center gap-1" title="Đổi nhân viên">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0v2.433l-.31-.31a7 7 0 00-11.712 3.138.75.75 0 001.449.39 5.5 5.5 0 019.201-2.466l.312.311H12.18c-.414 0-.75.336-.75.75s.336.75.75.75h4.242z" clipRule="evenodd" /></svg>
                                                    Đổi người
                                                </button>
                                            )}
                                        </div>
                                    ) : booking.status === 'PENDING' ? (
                                        (() => {
                                            const serviceId = service.bookingServiceId || service.serviceId;
                                            const serviceStaff = availableStaffByService[serviceId] || [];
                                            const selectedStaffId = selectedStaffByService[serviceId];
                                            const isDropdownOpen = openDropdownServiceId === serviceId;
                                            if (loadingStaff) return (<div className="mt-2 flex items-center gap-2 px-2 py-1"><div className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin"></div><span className="text-xs text-stone-400">Đang tải nhân viên...</span></div>);
                                            if (serviceStaff.length === 0) return (<div className="mt-2 flex items-center gap-2 bg-amber-50 px-2 py-1.5 border-2 border-amber-600"><svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg><span className="text-xs font-bold text-amber-800">Chưa có nhân viên phù hợp</span></div>);
                                            const selectedStaff = serviceStaff.find(s => s.staffId === selectedStaffId);
                                            return (
                                                <div className="mt-2 relative">
                                                    <button type="button" onClick={() => setOpenDropdownServiceId(isDropdownOpen ? null : serviceId)} className="w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-green-50 border-2 border-green-600 hover:shadow-[2px_2px_0_#1c1917] transition-all text-left">
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                            {selectedStaff ? <><div className="w-6 h-6 rounded-full bg-green-200 border border-green-600 flex items-center justify-center flex-shrink-0"><span className="text-xs font-bold text-green-700">{selectedStaff.fullName?.charAt(0) || '?'}</span></div><div className="text-xs flex-1 min-w-0"><span className="font-bold text-green-800">Nhân viên:</span><span className="ml-1 font-medium text-green-700">{selectedStaff.fullName}</span></div></> : <span className="text-xs text-stone-500">Chọn nhân viên...</span>}
                                                        </div>
                                                        <svg className={`w-4 h-4 text-green-600 transition-transform flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                    </button>
                                                    {isDropdownOpen && (
                                                        <div className="absolute z-20 w-full mt-1 bg-white border-2 border-stone-900 shadow-[4px_4px_0_#1c1917] max-h-48 overflow-y-auto">
                                                            {serviceStaff.map((staff) => {
                                                                const isAvailableForThisService = staff.availableServiceItemIds?.includes(serviceId);
                                                                return (
                                                                    <button key={staff.staffId} type="button" disabled={!isAvailableForThisService} onClick={() => { setSelectedStaffByService(prev => ({ ...prev, [serviceId]: staff.staffId })); setOpenDropdownServiceId(null); }} className={`w-full flex items-center gap-2 px-2 py-2 text-left ${selectedStaffId === staff.staffId ? 'bg-mint-100 border-l-4 border-l-mint-600' : isAvailableForThisService ? 'hover:bg-stone-50' : 'opacity-50 cursor-not-allowed bg-stone-100'}`}>
                                                                        <div className="w-8 h-8 rounded-full border-2 border-stone-400 overflow-hidden bg-stone-200 flex-shrink-0">
                                                                            {staff.avatarUrl ? <img src={staff.avatarUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-stone-600 text-sm">{staff.fullName?.charAt(0) || '?'}</div>}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-xs font-bold text-stone-900 truncate">{staff.fullName}</div>
                                                                            <div className="text-[10px] text-stone-500 truncate">{staff.specialtyLabel || staff.specialty}</div>
                                                                        </div>
                                                                        {selectedStaffId === staff.staffId && <svg className="w-4 h-4 text-mint-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()
                                    ) : (
                                        <div className="mt-2 flex items-center justify-between">
                                            <span className="text-xs text-stone-400 italic">Chưa phân công bác sĩ</span>
                                            {booking.status === 'CONFIRMED' && (
                                                <button onClick={() => handleOpenReassignModal(service)} className="px-3 py-1 text-xs font-bold bg-coral-400 text-stone-900 border border-stone-900 hover:bg-coral-500 transition-colors">Phân công BS</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}

                        {/* Booking-level Fee (Distance) - Always show for HOME_VISIT/SOS */}
                        {(booking.type === 'HOME_VISIT' || booking.type === 'SOS') && (
                            <div className="flex justify-between items-center py-2 border-t border-dashed border-stone-300 bg-stone-50 px-2 mt-1">
                                <span className="text-xs font-semibold text-stone-600 uppercase flex items-center gap-1">
                                    <TruckIcon className="w-4 h-4" />
                                    Phí di chuyển {booking.distanceKm ? `(${booking.distanceKm}km)` : ''}
                                </span>
                                <span className="text-sm font-bold text-amber-600">
                                    +{formatCurrency(booking.distanceFee || 0)}
                                </span>
                            </div>
                        )}

                        {/* Weight-based Pricing - Always show */}
                        <div className="flex justify-between items-center py-2 border-t border-dashed border-stone-300 bg-stone-50 px-2 mt-1">
                            <span className="text-xs font-semibold text-stone-600 uppercase flex items-center gap-1">
                                <ScaleIcon className="w-4 h-4" />
                                Phụ phí cân nặng ({booking.petWeight || 0}kg)
                            </span>
                            <span className="text-sm font-bold">
                                {(() => {
                                    // Weight pricing is ALWAYS a surcharge (never discount)
                                    // weightPrice = basePrice + surcharge, so difference should be >= 0
                                    const weightSurcharge = getAllServices(booking)?.reduce((sum: number, svc: BookingServiceItem) => {
                                        if (svc.weightPrice && svc.basePrice && svc.weightPrice > svc.basePrice) {
                                            return sum + (svc.weightPrice - svc.basePrice);
                                        }
                                        return sum;
                                    }, 0) || 0;

                                    if (weightSurcharge > 0) {
                                        return <span className="text-amber-600">+{formatCurrency(weightSurcharge)}</span>;
                                    }
                                    return <span className="text-stone-400">{formatCurrency(0)}</span>;
                                })()}
                            </span>
                        </div>

                        {/* Price Summary */}
                        <div className="mt-2 py-2 px-2 bg-stone-100 border border-stone-200 rounded text-xs space-y-1">
                            <div className="flex justify-between text-stone-500">
                                <span>Giá dịch vụ gốc</span>
                                <span>{formatCurrency(getAllServices(booking)?.reduce((sum: number, svc: BookingServiceItem) => sum + (svc.basePrice || svc.price || 0), 0) || 0)}</span>
                            </div>
                            {(() => {
                                const weightSurcharge = getAllServices(booking)?.reduce((sum: number, svc: BookingServiceItem) => {
                                    if (svc.weightPrice && svc.basePrice && svc.weightPrice > svc.basePrice) {
                                        return sum + (svc.weightPrice - svc.basePrice);
                                    }
                                    return sum;
                                }, 0) || 0;
                                return weightSurcharge > 0 && (
                                    <div className="flex justify-between text-stone-500">
                                        <span>+ Phụ phí cân nặng ({booking.petWeight || 0}kg)</span>
                                        <span className="text-amber-600">+{formatCurrency(weightSurcharge)}</span>
                                    </div>
                                );
                            })()}
                            {(booking.type === 'HOME_VISIT' || booking.type === 'SOS') && (booking.distanceFee || 0) > 0 && (
                                <div className="flex justify-between text-stone-500">
                                    <span>+ Phí di chuyển ({booking.distanceKm || 0}km)</span>
                                    <span>+{formatCurrency(booking.distanceFee || 0)}</span>
                                </div>
                            )}
                            {booking.type === 'SOS' && (booking.sosFee || 0) > 0 && (
                                <div className="flex justify-between text-stone-500">
                                    <span>+ Phí cấp cứu (SOS)</span>
                                    <span className="text-red-600">+{formatCurrency(booking.sosFee || 0)}</span>
                                </div>
                            )}
                            {booking.discountAmount && booking.discountAmount > 0 ? (
                                <div className="flex justify-between text-stone-500">
                                    <span>- Giảm voucher</span>
                                    <span className="text-green-600">-{formatCurrency(booking.discountAmount)}</span>
                                </div>
                            ) : null}
                            <div className="flex justify-between font-bold border-t border-stone-300 pt-1 mt-1 text-stone-900">
                                <span>Tổng cộng</span>
                                <span className="text-sm">
                                    {booking.discountAmount && booking.discountAmount > 0 ? (
                                        <span className="text-stone-400 line-through mr-2 font-normal">{formatCurrency(booking.totalPrice)}</span>
                                    ) : null}
                                    {formatCurrency(booking.finalPrice ?? booking.totalPrice)}
                                </span>
                            </div>
                        </div>

                        {/* Type & Address */}
                        <div className="mt-4 pt-4 border-t border-stone-200 flex items-center gap-4">
                            <div className="border-l-4 border-amber-400 pl-3">
                                <div className="text-xs text-stone-500 font-bold uppercase">Loại</div>
                                <div className="font-bold">{BOOKING_TYPE_LABELS[booking.type]}</div>
                            </div>
                            {booking.homeAddress && (
                                <div className="border-l-4 border-stone-300 pl-3">
                                    <div className="text-xs text-stone-500 font-bold uppercase tracking-tight">Địa chỉ khám tại nhà</div>
                                    <div className="font-medium text-xs line-clamp-1">{booking.homeAddress}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Assigned Staff Summary */}
                    <div className="border-2 border-stone-900 p-4 bg-white">
                        <h3 className="font-bold uppercase text-sm mb-3 text-stone-500">Nhân viên phụ trách</h3>
                        {(() => {
                            const uniqueStaff = new Map<string, { id: string; name: string; avatarUrl?: string; specialty?: string }>();

                            if (booking.assignedStaffId && booking.assignedStaffName) {
                                uniqueStaff.set(booking.assignedStaffId, {
                                    id: booking.assignedStaffId,
                                    name: booking.assignedStaffName,
                                    avatarUrl: booking.assignedStaffAvatarUrl,
                                    specialty: booking.assignedStaffSpecialty,
                                });
                            }
                            getAllServices(booking).forEach((service: BookingServiceItem) => {
                                if (service.assignedStaffId && service.assignedStaffName) {
                                    uniqueStaff.set(service.assignedStaffId, {
                                        id: service.assignedStaffId,
                                        name: service.assignedStaffName,
                                        avatarUrl: service.assignedStaffAvatarUrl,
                                        specialty: service.assignedStaffSpecialty,
                                    });
                                }
                            });

                            if (uniqueStaff.size === 0) {
                                return (
                                    <div className="text-stone-500 italic">
                                        Chưa phân công - Sau khi xác nhận sẽ tự động gán nhân viên phù hợp
                                    </div>
                                );
                            }

                            return (
                                <div className="space-y-3">
                                    {Array.from(uniqueStaff.values()).map((staff) => (
                                        <div key={staff.id} className="flex items-center gap-3">
                                            <div className="w-12 h-12 border-2 border-stone-900 rounded-lg overflow-hidden bg-mint-200 flex-shrink-0">
                                                {staff.avatarUrl ? (
                                                    <img
                                                        src={staff.avatarUrl}
                                                        alt={staff.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center font-bold text-lg">
                                                        {staff.name?.charAt(0) || '?'}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold">{staff.name}</div>
                                                <div className="text-sm text-stone-500">
                                                    {staff.specialty ? (STAFF_SPECIALTY_LABELS[staff.specialty] || staff.specialty) : 'Chưa xác định'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Notes & Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="border-2 border-stone-900 p-4 bg-white">
                            <h3 className="font-bold uppercase text-sm mb-2 text-stone-500">Ghi chú</h3>
                            <p className="text-sm text-stone-700">{booking.notes || 'Không có ghi chú'}</p>
                        </div>
                        <div className="border-2 border-stone-900 p-4 bg-white">
                            <h3 className="font-bold uppercase text-sm mb-2 text-stone-500">Trạng thái</h3>
                            <span className="inline-block px-3 py-1 font-bold uppercase border-2 border-stone-900 text-xs" style={{ backgroundColor: BOOKING_STATUS_CONFIG[booking.status]?.bgColor }}>
                                {BOOKING_STATUS_CONFIG[booking.status]?.label}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-between items-center p-4 border-t-4 border-stone-900 bg-stone-50 flex-shrink-0 font-bold">
                    <div>
                        {booking.status !== 'CANCELLED' && booking.status !== 'NO_SHOW' && onReport && (
                            <button
                                onClick={onReport}
                                className="px-4 py-2 font-bold uppercase bg-white text-red-600 border-2 border-red-600 hover:bg-red-50 transition-all flex items-center gap-2"
                            >
                                <FlagIcon className="w-5 h-5" />
                                Báo cáo
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2 font-bold uppercase bg-white border-2 border-stone-900 hover:shadow-[4px_4px_0_#1c1917] transition-all">Đóng</button>
                        {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                            <button
                                onClick={() => onCancel(booking.bookingId)}
                                className="px-6 py-2 font-bold uppercase bg-red-500 text-white border-2 border-stone-900 hover:shadow-[4px_4px_0_#1c1917] transition-all"
                            >
                                Hủy lịch
                            </button>
                        )}
                        {booking.status === 'PENDING' && (
                            <button onClick={() => { const firstSvc = getAllServices(booking)[0]; const sid = firstSvc?.bookingServiceId || firstSvc?.serviceId; onConfirm(booking.bookingId, sid ? selectedStaffByService[sid] : undefined); onClose(); }} className="px-6 py-2 font-bold uppercase bg-mint-400 border-2 border-stone-900 hover:shadow-[4px_4px_0_#1c1917] transition-all">Xác nhận</button>
                        )}
                        {booking.status === 'IN_PROGRESS' && (
                            <>
                                <button onClick={onAddService} className="px-6 py-2 font-bold uppercase bg-amber-400 border-2 border-stone-900 hover:shadow-[4px_4px_0_#1c1917] transition-all">Thêm dịch vụ</button>
                                <button onClick={() => setConfirmCheckoutModal(booking)} className="px-6 py-2 font-bold uppercase bg-mint-400 border-2 border-stone-900 hover:shadow-[4px_4px_0_#1c1917] transition-all">Thu Tiền Mặt</button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Sub-Modals */}
            <ConfirmModal
                isOpen={!!confirmCheckoutModal}
                title={`Thu Tiền Mặt: ${confirmCheckoutModal?.bookingCode}`}
                message={`Xác nhận đã thu ${confirmCheckoutModal?.totalPrice.toLocaleString('vi-VN')} đ cho lịch khám này?`}
                confirmLabel="Xác nhận & Hoàn thành"
                cancelLabel="Hủy"
                onConfirm={handleCheckout}
                onCancel={() => setConfirmCheckoutModal(null)}
            />
            {confirmRemoveModal.isOpen && (
                <div className="fixed inset-0 bg-stone-900/80 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
                    <div className="bg-white border-4 border-stone-900 shadow-[8px_8px_0_#1c1917] max-w-sm w-full p-6">
                        <h4 className="text-xl font-bold mb-4">Xác nhận xóa</h4>
                        <p className="text-stone-600 mb-6">Xóa dịch vụ phát sinh này?</p>
                        <div className="flex gap-4">
                            <button onClick={() => setConfirmRemoveModal({ isOpen: false, serviceId: null })} className="flex-1 py-2 font-bold border-2 border-stone-900">Bỏ qua</button>
                            <button onClick={confirmRemoveAction} className="flex-1 py-2 font-bold bg-red-500 text-white border-2 border-stone-900">Xóa</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedService && (
                <ReassignStaffModal
                    isOpen={reassignModalOpen}
                    bookingId={booking.bookingId}
                    service={selectedService}
                    onClose={() => { setReassignModalOpen(false); setSelectedService(null); }}
                    onReassigned={handleReassigned}
                />
            )}
        </div>
    );
};

// Cancel Booking Modal Component
interface CancelBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    isCancelling: boolean;
}

const CancelBookingModal = ({ isOpen, onClose, onConfirm, isCancelling }: CancelBookingModalProps) => {
    const [reason, setReason] = useState('');

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (isOpen) setReason('');
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-stone-900/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white border-4 border-stone-900 shadow-[8px_8px_0_#1c1917] max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-coral-500 border-b-4 border-stone-900 p-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white uppercase tracking-tight">Xác nhận hủy lịch</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center bg-white border-2 border-stone-900 hover:bg-stone-100 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="font-bold text-stone-900 mb-4 uppercase text-xs tracking-wider">Lý do hủy lịch:</p>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Vui lòng nhập lý do hủy lịch hẹn này..."
                        className="w-full h-32 p-4 border-4 border-stone-900 focus:outline-none focus:ring-2 focus:ring-coral-400 font-medium text-stone-700 resize-none"
                    />
                    <p className="mt-2 text-xs text-stone-500 italic">* Lý do này sẽ được gửi đến chủ thú cưng.</p>
                </div>

                {/* Footer */}
                <div className="bg-stone-50 border-t-4 border-stone-900 p-4 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isCancelling}
                        className="px-6 py-2 font-bold uppercase bg-white border-2 border-stone-900 hover:shadow-[4px_4px_0_#1c1917] transition-all disabled:opacity-50"
                    >
                        Quay lại
                    </button>
                    <button
                        onClick={() => {
                            if (!reason.trim()) return;
                            onConfirm(reason);
                        }}
                        disabled={isCancelling || !reason.trim()}
                        className="px-6 py-2 font-bold uppercase bg-red-500 text-white border-2 border-stone-900 hover:shadow-[4px_4px_0_#1c1917] transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isCancelling ? 'Đang xử lý...' : 'Xác nhận hủy'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BookingDashboardPage;
