import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { getBookingsByClinic, confirmBooking, getBookingById, checkStaffAvailability, confirmBookingWithOptions, addServiceToBooking, getAvailableServicesForAddOn, getAvailableStaffForConfirm, completeBooking, removeServiceFromBooking, cancelBooking } from '../../../services/bookingService';
import type { StaffOption } from '../../../services/bookingService';
import type { Booking, BookingStatus, BookingServiceItem, StaffAvailabilityCheckResponse } from '../../../types/booking';
import type { ClinicServiceResponse } from '../../../types/service';
import { BOOKING_STATUS_CONFIG, BOOKING_TYPE_CONFIG, BOOKING_TYPE_LABELS, SERVICE_CATEGORY_LABELS, PAYMENT_STATUS_LABELS, STAFF_SPECIALTY_LABELS } from '../../../types/booking';
import { ReassignStaffModal } from '../../../components/booking/ReassignStaffModal';
import { StaffAvailabilityWarningModal, type ConfirmOption } from '../../../components/booking/StaffAvailabilityWarningModal';
import { AddServiceModal } from '../../../components/booking/AddServiceModal';
import { useToast } from '../../../components/Toast';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useSseNotification } from '../../../hooks/useSseNotification';
import '../../../styles/brutalist.css';

type TabFilter = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'HISTORY' | 'ALL';

const TAB_OPTIONS: { key: TabFilter; label: string }[] = [
    { key: 'PENDING', label: 'Chờ xác nhận' },
    { key: 'CONFIRMED', label: 'Đã xác nhận' },
    { key: 'IN_PROGRESS', label: 'Đang tiến hành' },
    { key: 'COMPLETED', label: 'Đã hoàn thành' },
    { key: 'HISTORY', label: 'Lịch sử' },
    { key: 'ALL', label: 'Tất cả' },
];

const TYPE_FILTER_OPTIONS = [
    { key: 'ALL', label: 'Tất cả loại' },
    { key: 'IN_CLINIC', label: 'Tại phòng khám' },
    { key: 'HOME_VISIT', label: 'Khám tại nhà' },
    { key: 'SOS', label: 'Cấp cứu' },
];

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
    const [availableServices, setAvailableServices] = useState<ClinicServiceResponse[]>([]);
    const [addingService, setAddingService] = useState(false);

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

    // Handle real-time booking updates
    useSseNotification({
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
            showToast('error', 'Không thể xác nhận booking. Vui lòng thử lại.');
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
    const handleOpenAddServiceModal = async () => {
        if (!selectedBooking) return;

        try {
            // Fetch available services for this booking (filters by specialty for Staff/Home Visit)
            const services = await getAvailableServicesForAddOn(selectedBooking.bookingId);

            setAvailableServices(services);
            setAddServiceModalOpen(true);
        } catch (error) {
            console.error('Failed to fetch available services:', error);
            showToast('error', 'Không thể tải danh sách dịch vụ');
        }
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
        } catch (error) {
            console.error('Failed to cancel booking:', error);
            showToast('error', 'Không thể hủy lịch hẹn. Vui lòng thử lại.');
        } finally {
            setCancelling(null);
        }
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



            {/* Tabs */}
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
                                    </td>
                                    <td className="p-4">
                                        <div className="font-medium">{booking.ownerName}</div>
                                        <div className="text-xs text-stone-500">{booking.ownerPhone}</div>
                                    </td>
                                    <td className="p-4">
                                        {booking.services.map((s, idx) => (
                                            <div key={idx} className="text-sm">
                                                {s.serviceName}
                                                <span className="ml-1 text-xs text-stone-500">
                                                    [{SERVICE_CATEGORY_LABELS[s.serviceCategory] || s.serviceCategory}]
                                                </span>
                                            </div>
                                        ))}
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

                                            // 2. Add staff from individual services (for traditional bookings)
                                            booking.services.forEach(service => {
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
                                                                        {staff.name.charAt(0)}
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
            </div >

            {/* Booking Detail Modal */}
            {selectedBooking && (
                <BookingDetailModal
                    booking={selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                    onConfirm={handleConfirm}
                    onCancel={handleCancelBooking}
                    onBookingUpdated={fetchBookings}
                    onAddService={handleOpenAddServiceModal}
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
            <AddServiceModal
                isOpen={addServiceModalOpen}
                onClose={() => setAddServiceModalOpen(false)}
                availableServices={availableServices}
                onAddService={handleAddService}
                isAdding={addingService}
            />

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
}

const BookingDetailModal = ({ booking: initialBooking, onClose, onConfirm, onCancel, onBookingUpdated, onAddService }: BookingDetailModalProps) => {
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

    // Confirmation Modal for Removal
    const [confirmRemoveModal, setConfirmRemoveModal] = useState<{ isOpen: boolean, serviceId: string | null }>({
        isOpen: false,
        serviceId: null
    });

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

                    booking.services.forEach(service => {
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

                            // 3. Match specialty or allow VET_GENERAL as fallback for other medical
                            const requiredSpecialty =
                                category === 'SURGERY' ? 'VET_SURGERY' :
                                    category === 'DENTAL' ? 'VET_DENTAL' :
                                        category === 'DERMATOLOGY' ? 'VET_DERMATOLOGY' :
                                            'VET_GENERAL';

                            return staffSpec === requiredSpecialty || staffSpec === 'VET_GENERAL';
                        });

                        staffByService[serviceId] = filteredStaff;

                        // Auto-select staff for this service:
                        // Priority 1: Suggested staff from backend (if they pass our filter)
                        // Priority 2: First staff with available slots in the filtered list
                        const suggested = filteredStaff.find(s => s.isSuggested && s.hasAvailableSlots);
                        const firstAvailable = filteredStaff.find(s => s.hasAvailableSlots);

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
                            <h3 className="font-bold uppercase text-sm mb-3 text-stone-500">Thông tin thú cưng</h3>
                            <div className="flex gap-4 items-start">
                                {/* Pet Avatar */}
                                <div className="w-20 h-20 border-2 border-stone-900 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                                    {booking.petPhotoUrl ? (
                                        <img
                                            src={booking.petPhotoUrl}
                                            alt={booking.petName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-lg font-bold text-stone-400">
                                            {booking.petName?.charAt(0) || '?'}
                                        </div>
                                    )}
                                </div>
                                {/* Pet Info */}
                                <div>
                                    <div className="text-lg font-bold">{booking.petName}</div>
                                    <div className="text-sm text-stone-600">
                                        {booking.petSpecies} - {booking.petBreed}
                                    </div>
                                    <div className="text-sm text-stone-500 mt-1">
                                        {booking.petAge}
                                        {booking.petWeight && (
                                            <span className="ml-2 font-medium text-stone-700">• {booking.petWeight} kg</span>
                                        )}
                                    </div>
                                </div>
                            </div>
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

                    {/* Assigned Staff (Top level - e.g. for SOS) */}
                    {booking.type === 'SOS' && booking.assignedStaffName && (
                        <div className="border-2 border-stone-900 p-4 bg-mint-50">
                            <h3 className="font-bold uppercase text-[10px] mb-3 text-stone-500 tracking-wider">Bác sĩ cấp cứu</h3>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-stone-900 bg-white shadow-[2px_2px_0_#1c1917]">
                                    {booking.assignedStaffAvatarUrl ? (
                                        <img src={booking.assignedStaffAvatarUrl} alt={booking.assignedStaffName} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xl font-bold bg-mint-200 text-stone-600">
                                            {booking.assignedStaffName.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="font-bold text-lg leading-tight">{booking.assignedStaffName}</div>
                                    <div className="text-xs text-stone-600 font-medium">{STAFF_SPECIALTY_LABELS[booking.assignedStaffSpecialty || ''] || booking.assignedStaffSpecialty || 'Bác sĩ thú y'}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Services */}
                    <div className="border-2 border-stone-900 p-4">
                        <h3 className="font-bold uppercase text-[10px] mb-3 text-stone-500 tracking-wider">Dịch vụ đặt</h3>
                        {booking.services.map((service, idx) => (
                            <div key={idx} className="py-3 border-b border-stone-200 last:border-0">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <span className="font-bold">{service.serviceName}</span>
                                        {service.isAddOn && (
                                            <span className="ml-2 text-[10px] font-bold bg-amber-400 border border-stone-900 px-1.5 py-0.5 shadow-[1px_1px_0_#1c1917] uppercase tracking-tighter">
                                                Dịch vụ phát sinh
                                            </span>
                                        )}
                                        <span className="ml-2 text-xs bg-stone-200 px-2 py-0.5">
                                            {SERVICE_CATEGORY_LABELS[service.serviceCategory] || service.serviceCategory}
                                        </span>
                                        <div className="text-xs text-stone-500 mt-1">
                                            {service.durationMinutes} phút - {service.slotsRequired} slot(s)
                                            {service.scheduledStartTime && service.scheduledEndTime && (
                                                <span className="ml-2 font-medium text-amber-600">
                                                    {service.scheduledStartTime.substring(0, 5)} - {service.scheduledEndTime.substring(0, 5)}
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
                                            <div className="flex justify-end items-center gap-1">
                                                {service.basePrice && service.weightPrice && service.weightPrice !== service.basePrice ? (
                                                    <>
                                                        <span className="text-stone-400">Giá gốc:</span>
                                                        <span className="line-through text-stone-400">{formatCurrency(service.basePrice)}</span>
                                                        <span className="text-mint-600">→ {formatCurrency(service.weightPrice)}</span>
                                                        <span className="text-stone-400 text-[10px]">(theo cân {booking.petWeight || 0}kg)</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-stone-400">Giá cố định</span>
                                                        <span className="text-stone-400 text-[10px]">(pet {booking.petWeight || 0}kg)</span>
                                                    </>
                                                )}
                                            </div>
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
                                                    {service.assignedStaffName.charAt(0)}
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
                                                                        {selectedStaff.fullName.charAt(0)}
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
                                                        {serviceStaff.map(s => (
                                                            <button
                                                                key={s.staffId}
                                                                onClick={() => { setSelectedStaffByService(prev => ({ ...prev, [serviceId]: s.staffId })); setOpenDropdownServiceId(null); }}
                                                                className="w-full p-2 text-left text-xs hover:bg-stone-50 flex items-center gap-2"
                                                            >
                                                                <div className="w-6 h-6 rounded-full overflow-hidden border border-stone-300 bg-stone-100 flex-shrink-0">
                                                                    {s.avatarUrl ? (
                                                                        <img src={s.avatarUrl} alt={s.fullName} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-stone-500">
                                                                            {s.fullName.charAt(0)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold">{s.fullName} {s.isSuggested && '(Gợi ý)'}</span>
                                                                    <span className="text-[10px] text-stone-500">{s.specialtyLabel}</span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()
                                ) : !service.isAddOn ? (
                                    <div className="mt-2 text-xs text-stone-400 italic">Chưa phân công bác sĩ</div>
                                ) : null}
                            </div>
                        ))}

                        {/* Booking Fees Summary Panel */}
                        <div className="mt-4 py-2 px-2 bg-stone-100 border border-stone-200 rounded text-xs space-y-1">
                            <div className="flex justify-between text-stone-500">
                                <span>Giá dịch vụ gốc</span>
                                <span>{formatCurrency(booking.services?.reduce((sum, svc) => sum + (svc.basePrice || svc.price || 0), 0) || 0)}</span>
                            </div>
                            {(booking.type === 'HOME_VISIT' || booking.type === 'SOS') && (
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
                            <div className="flex justify-between font-bold border-t border-stone-300 pt-1 mt-1 text-stone-900">
                                <span>Tổng cộng</span>
                                <span className="text-sm">{formatCurrency(booking.totalPrice)}</span>
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
                            const uniqueStaff = new Map<string, { assignedStaffId?: string; assignedStaffName?: string; serviceName: string }>();
                            booking.services.forEach(s => { if (s.assignedStaffId) uniqueStaff.set(s.assignedStaffId, s); });
                            return uniqueStaff.size === 0 ? <div className="text-stone-400 italic text-sm">Chưa gán nhân viên</div> : (
                                <div className="flex flex-wrap gap-4">
                                    {Array.from(uniqueStaff.values()).map(s => (
                                        <div key={s.assignedStaffId} className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded bg-mint-100 flex items-center justify-center font-bold border border-stone-900">{s.assignedStaffName?.charAt(0)}</div>
                                            <div className="text-xs font-bold">{s.assignedStaffName}</div>
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
                <div className="flex justify-end gap-3 p-4 border-t-4 border-stone-900 bg-stone-50 flex-shrink-0">
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
                        <button onClick={() => { const firstSvc = booking.services[0]; const sid = firstSvc?.bookingServiceId || firstSvc?.serviceId; onConfirm(booking.bookingId, sid ? selectedStaffByService[sid] : undefined); onClose(); }} className="px-6 py-2 font-bold uppercase bg-mint-400 border-2 border-stone-900 hover:shadow-[4px_4px_0_#1c1917] transition-all">Xác nhận</button>
                    )}
                    {booking.status === 'IN_PROGRESS' && (
                        <>
                            <button onClick={onAddService} className="px-6 py-2 font-bold uppercase bg-amber-400 border-2 border-stone-900 hover:shadow-[4px_4px_0_#1c1917] transition-all">Thêm dịch vụ</button>
                            <button onClick={async () => { await completeBooking(booking.bookingId); onClose(); window.location.reload(); }} className="px-6 py-2 font-bold uppercase bg-mint-400 border-2 border-stone-900 hover:shadow-[4px_4px_0_#1c1917] transition-all">Checkout</button>
                        </>
                    )}
                </div>
            </div>

            {/* Sub-Modals */}
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
