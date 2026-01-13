import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
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

export const VetLayout = () => {
    const navigate = useNavigate()
    const clearAuth = useAuthStore((state) => state.clearAuth)
    const user = useAuthStore((state) => state.user)
    const unreadCount = useNotificationStore((state) => state.unreadCount)
    const refreshUnreadCount = useNotificationStore((state) => state.refreshUnreadCount)
    const { state, toggleSidebar, isMobile } = useSidebar()

    // Initialize SSE
    useSseNotification()

    // Auto-sync profile (avatar, fullName) to authStore for Sidebar
    useSyncProfile()

    useEffect(() => {
        refreshUnreadCount()
    }, [refreshUnreadCount])

    const navGroups: NavGroup[] = [
        {
            title: 'DASHBOARD',
            items: [
                { path: '/vet', label: 'DASHBOARD', icon: Squares2X2Icon, end: true },
            ]
        },
        {
            title: 'CÔNG VIỆC',
            items: [
                { path: '/vet/schedule', label: 'LỊCH LÀM VIỆC', icon: CalendarIcon },
                { path: '/vet/bookings', label: 'BOOKINGS', icon: ClipboardDocumentListIcon },
                { path: '/vet/patients', label: 'BỆNH NHÂN', icon: UserGroupIcon },
            ]
        },
        {
            title: 'CÁ NHÂN',
            items: [
                { path: '/vet/notifications', label: 'THÔNG BÁO', icon: BellIcon, unreadCount },
                { path: '/vet/profile', label: 'HỒ SƠ', icon: UserCircleIcon },
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
                roleName="VETERINARIAN"
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

export default VetLayout
