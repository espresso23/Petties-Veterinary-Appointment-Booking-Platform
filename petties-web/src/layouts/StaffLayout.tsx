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
    CalendarIcon,
    ClipboardDocumentListIcon,
    UserGroupIcon,
    BellIcon,
    UserCircleIcon
} from '@heroicons/react/24/outline'
import '../styles/brutalist.css'

export const StaffLayout = () => {
    const navigate = useNavigate()
    const clearAuth = useAuthStore((state) => state.clearAuth)
    const user = useAuthStore((state) => state.user)
    const unreadCount = useNotificationStore((state) => state.unreadCount)
    const refreshUnreadCount = useNotificationStore((state) => state.refreshUnreadCount)
    const assignedBookingCount = useBookingStore((state) => state.assignedBookingCount)
    const refreshAssignedBookingCount = useBookingStore((state) => state.refreshAssignedBookingCount)
    const { state, toggleSidebar, isMobile } = useSidebar()

    // Initialize SSE with booking update handler
    useSseNotification({
        onBookingUpdate: (data) => {
            console.log('[StaffLayout] Booking update received:', data)
            // Refresh booking count when booking is assigned to this staff
            if (data.action === 'ASSIGNED') {
                // For ASSIGNED action, just refresh the count (the staff received this because they were assigned)
                if (user?.userId) {
                    refreshAssignedBookingCount(user.userId)
                }
            } else if (data.action === 'STAFF_REASSIGNED') {
                if (user?.userId) {
                    // If this staff is the new staff or old staff, refresh count
                    if (data.newStaffId === user.userId || data.oldStaffId === user.userId) {
                        refreshAssignedBookingCount(user.userId)
                    }
                }
            } else if (data.action === 'COMPLETED' || data.action === 'CANCELLED') {
                // Refresh on completion/cancellation
                if (user?.userId) {
                    refreshAssignedBookingCount(user.userId)
                }
            }
        }
    })

    // Auto-sync profile (avatar, fullName) to authStore for Sidebar
    useSyncProfile()

    useEffect(() => {
        refreshUnreadCount()
        if (user?.userId) {
            refreshAssignedBookingCount(user.userId)
        }
    }, [refreshUnreadCount, refreshAssignedBookingCount, user?.userId])

    const navGroups: NavGroup[] = [
        {
            title: 'DASHBOARD',
            items: [
                { path: '/staff', label: 'BẢNG ĐIỀU KHIỂN', icon: Squares2X2Icon, end: true },
            ]
        },
        {
            title: 'CÔNG VIỆC',
            items: [
                { path: '/staff/schedule', label: 'LỊCH LÀM VIỆC', icon: CalendarIcon },
                { path: '/staff/bookings', label: 'LỊCH HẸN', icon: ClipboardDocumentListIcon, unreadCount: assignedBookingCount },
                { path: '/staff/patients', label: 'BỆNH NHÂN', icon: UserGroupIcon },
            ]
        },
        {
            title: 'CÁ NHÂN',
            items: [
                { path: '/staff/notifications', label: 'THÔNG BÁO', icon: BellIcon, unreadCount },
                { path: '/staff/profile', label: 'HỒ SƠ', icon: UserCircleIcon },
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
                roleName="NHÂN VIÊN PHÒNG KHÁM"
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

export default StaffLayout
