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
    HomeModernIcon,
    UserGroupIcon,
    WrenchScrewdriverIcon,
    BeakerIcon,
    BellIcon,
    PresentationChartLineIcon,
    UserCircleIcon
} from '@heroicons/react/24/outline'
import '../styles/brutalist.css'

export const ClinicOwnerLayout = () => {
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
            title: 'HỆ THỐNG',
            items: [
                { path: '/clinic-owner', label: 'DASHBOARD', icon: Squares2X2Icon, end: true },
                { path: '/clinic-owner/clinics', label: 'QUẢN LÝ PHÒNG KHÁM', icon: HomeModernIcon },
                { path: '/clinic-owner/staff', label: 'NHÂN SỰ', icon: UserGroupIcon },
            ]
        },
        {
            title: 'DỊCH VỤ',
            items: [
                { path: '/clinic-owner/master-services', label: 'DỊCH VỤ MẪU', icon: WrenchScrewdriverIcon },
                { path: '/clinic-owner/services', label: 'DỊCH VỤ PHÒNG KHÁM', icon: BeakerIcon },
            ]
        },
        {
            title: 'CÁ NHÂN',
            items: [
                { path: '/clinic-owner/notifications', label: 'THÔNG BÁO', icon: BellIcon, unreadCount },
                { path: '/clinic-owner/revenue', label: 'DOANH THU', icon: PresentationChartLineIcon },
                { path: '/clinic-owner/profile', label: 'HỒ SƠ CÁ NHÂN', icon: UserCircleIcon },
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
                roleName="CLINIC OWNER"
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

export default ClinicOwnerLayout
