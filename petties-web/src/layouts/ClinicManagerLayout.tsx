import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { useBookingStore } from '../store/bookingStore'
import { Sidebar } from '../components/Sidebar/Sidebar'
import type { NavGroup } from '../components/Sidebar/Sidebar'
import { useSidebar } from '../hooks/useSidebar'
import { useSseNotification } from '../hooks/useSseNotification'
import { useSyncProfile } from '../hooks/useSyncProfile'
import {
    Squares2X2Icon,
    UserGroupIcon,
    CalendarIcon,
    ClipboardDocumentListIcon,
    ChatBubbleLeftRightIcon,
    CurrencyDollarIcon,
    BellIcon,
    UserCircleIcon,
    ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline'
import '../styles/brutalist.css'

export const ClinicManagerLayout = () => {
    const navigate = useNavigate()
    const clearAuth = useAuthStore((state) => state.clearAuth)
    const user = useAuthStore((state) => state.user)
    const unreadCount = useNotificationStore((state) => state.unreadCount)
    const refreshUnreadCount = useNotificationStore((state) => state.refreshUnreadCount)
    const pendingBookingCount = useBookingStore((state) => state.pendingBookingCount)
    const refreshPendingBookingCount = useBookingStore((state) => state.refreshPendingBookingCount)
    const incrementPendingBookingCount = useBookingStore((state) => state.incrementPendingBookingCount)
    const { state, toggleSidebar, isMobile } = useSidebar()

    // Initialize SSE with booking update handler
    useSseNotification({
        onBookingUpdate: (data) => {
            console.log('[ClinicManagerLayout] Booking update received:', data)
            // Refresh pending count on booking events
            if (data.action === 'ASSIGNED' || data.action === 'CANCELLED' || data.action === 'COMPLETED') {
                if (user?.workingClinicId) {
                    refreshPendingBookingCount(user.workingClinicId)
                }
            }
        },
        onNotification: (notification) => {
            // New booking created → increment pending count
            if (notification.type === 'BOOKING_CREATED') {
                incrementPendingBookingCount()
            }
        }
    })

    // Auto-sync profile (avatar, fullName) to authStore for Sidebar
    useSyncProfile()

    useEffect(() => {
        refreshUnreadCount()
        if (user?.workingClinicId) {
            refreshPendingBookingCount(user.workingClinicId)
        }
    }, [refreshUnreadCount, refreshPendingBookingCount, user?.workingClinicId])


    const navGroups: NavGroup[] = [
        {
            title: 'QUẢN LÝ',
            items: [
                { path: '/clinic-manager', label: 'DASHBOARD', icon: Squares2X2Icon, end: true },
                { path: '/clinic-manager/vets', label: 'BÁC SĨ', icon: UserGroupIcon },
                { path: '/clinic-manager/shifts', label: 'LỊCH LÀM VIỆC', icon: CalendarIcon },
                { path: '/clinic-manager/bookings', label: 'BOOKING', icon: ClipboardDocumentListIcon, unreadCount: pendingBookingCount },
                { path: '/clinic-manager/services', label: 'DỊCH VỤ', icon: ClipboardDocumentCheckIcon },
            ]
        },
        {
            title: 'HỆ THỐNG',
            items: [
                { path: '/clinic-manager/chat', label: 'CHAT TƯ VẤN', icon: ChatBubbleLeftRightIcon },
                { path: '/clinic-manager/refunds', label: 'HOÀN TIỀN', icon: CurrencyDollarIcon },
                { path: '/clinic-manager/notifications', label: 'THÔNG BÁO', icon: BellIcon, unreadCount },
                { path: '/clinic-manager/profile', label: 'HỒ SƠ CÁ NHÂN', icon: UserCircleIcon },
            ]
        }
    ]

    const handleLogout = () => {
        clearAuth()
        navigate('/login', { replace: true })
    }

    return (
        <div className="h-screen bg-stone-50 flex overflow-hidden">
            <Sidebar
                groups={navGroups}
                user={user}
                roleName="CLINIC MANAGER"
                state={state}
                toggleSidebar={toggleSidebar}
                onLogout={handleLogout}
                isMobile={isMobile}
            />

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-stone-50 relative">
                <div className="p-0 h-full">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}

export default ClinicManagerLayout
