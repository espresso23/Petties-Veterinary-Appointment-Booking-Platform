import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { Sidebar } from '../components/Sidebar/Sidebar'
import MascotProvider from '../components/mascot/MascotProvider'
import type { NavGroup } from '../components/Sidebar/Sidebar'
import { useSidebar } from '../hooks/useSidebar'
import { useSseNotification } from '../hooks/useSseNotification'
import { useSyncProfile } from '../hooks/useSyncProfile'
import { useMembershipStore } from '../store/membershipStore'
import { useClinicStore } from '../store/clinicStore'
import { useSandboxStore } from '../store/sandboxStore'
import { SandboxHeader } from '../components/sandbox/SandboxHeader'
import { SandboxGuideSteps } from '../components/sandbox/SandboxGuideSteps'
import { SandboxFocusOverlay } from '../components/sandbox/SandboxFocusOverlay'
import {
    Squares2X2Icon,
    HomeModernIcon,
    CreditCardIcon,
    UserGroupIcon,
    WrenchScrewdriverIcon,
    BeakerIcon,
    BellIcon,
    PresentationChartLineIcon,
    UserCircleIcon,
} from '@heroicons/react/24/outline'
import '../styles/brutalist.css'

export const ClinicOwnerLayout = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const clearAuth = useAuthStore((state) => state.clearAuth)
    const user = useAuthStore((state) => state.user)
    const unreadCount = useNotificationStore((state) => state.unreadCount)
    const refreshUnreadCount = useNotificationStore((state) => state.refreshUnreadCount)
    const { state, toggleSidebar, isMobile } = useSidebar()

    const fetchMembershipStatus = useMembershipStore(state => state.fetchMembershipStatus)
    const { getMyClinics, selectedClinicId } = useClinicStore()

    const isVIP = useMembershipStore(state => state.isVIP())
    const planName = useMembershipStore(state => state.getPlanName())
    const remainingDays = useMembershipStore(state => state.getRemainingDays())
    const { isSandboxMode, currentFeature, currentGuideStep, currentSandboxClinic, exitSandbox } = useSandboxStore()

    // Initialize SSE
    useSseNotification()

    // Auto-sync profile (avatar, fullName) to authStore for Sidebar
    useSyncProfile()

    useEffect(() => {
        refreshUnreadCount()
        getMyClinics()
    }, [refreshUnreadCount, getMyClinics])

    useEffect(() => {
        if (selectedClinicId) {
            fetchMembershipStatus(selectedClinicId)
        }
    }, [selectedClinicId, fetchMembershipStatus])

    const navGroups: NavGroup[] = [
        {
            title: 'HỆ THỐNG',
            items: [
                { path: '/clinic-owner', label: 'BẢNG ĐIỀU KHIỂN', icon: Squares2X2Icon, end: true },
                { path: '/clinic-owner/clinics', label: 'QUẢN LÝ PHÒNG KHÁM', icon: HomeModernIcon },
                { path: '/clinic-owner/subscriptions', label: 'GÓI DỊCH VỤ', icon: CreditCardIcon },
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

    const handleExitSandbox = async () => {
        try {
            await exitSandbox()
            navigate('/clinic-owner/clinics', { replace: true })
        } catch (error) {
            console.error('Lỗi thoát chế độ dùng thử:', error)
        }
    }

    const handleFinishSandboxGuide = async () => {
        if (currentFeature === 'clinic_info') {
            navigate('/clinic-owner/clinics/new', { replace: true })
            return
        }

        await handleExitSandbox()
    }

    useEffect(() => {
        if (!isSandboxMode || currentFeature !== 'clinic_info' || currentGuideStep !== 5) {
            return
        }

        if (location.pathname !== '/clinic-owner/clinics/new') {
            navigate('/clinic-owner/clinics/new', { replace: true })
        }
    }, [currentFeature, currentGuideStep, isSandboxMode, location.pathname, navigate])

    return (
        <div className="h-screen h-screen-safe min-h-screen-safe bg-stone-50 flex overflow-hidden safe-area-padding">
            <SandboxFocusOverlay />

            <Sidebar
                groups={navGroups}
                user={user}
                roleName="CHỦ PHÒNG KHÁM"
                state={state}
                toggleSidebar={toggleSidebar}
                onLogout={handleLogout}
                isMobile={isMobile}
                isVIP={isVIP}
                planName={planName}
                remainingDays={remainingDays}
            />

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-stone-50 relative">
                {isSandboxMode && (
                    <SandboxHeader
                        clinicName={currentSandboxClinic?.name}
                        onExit={handleExitSandbox}
                    />
                )}

                {isSandboxMode && currentFeature && (
                    <div className="pointer-events-none fixed inset-0 z-40 hidden xl:block">
                        <div className="pointer-events-auto">
                            <SandboxGuideSteps feature={currentFeature} onFinish={handleFinishSandboxGuide} draggable />
                        </div>
                    </div>
                )}

                <div className="p-0 h-full">
                    <Outlet />
                </div>
            </main>

            <MascotProvider />
        </div>
    )
}

export default ClinicOwnerLayout
