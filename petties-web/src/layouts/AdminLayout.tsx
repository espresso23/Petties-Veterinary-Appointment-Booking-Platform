import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { Sidebar } from '../components/Sidebar/Sidebar'
import type { NavGroup } from '../components/Sidebar/Sidebar'
import { useSidebar } from '../hooks/useSidebar'
import { useSseNotification } from '../hooks/useSseNotification'
import { useSyncProfile } from '../hooks/useSyncProfile'
import { useClinicStore } from '../store/clinicStore'
import {
  Squares2X2Icon,
  BuildingOfficeIcon,
  UsersIcon,
  FlagIcon,
  BookOpenIcon,
  WrenchIcon,
  PlayIcon,
  BellIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline'
import '../styles/brutalist.css'

export const AdminLayout = () => {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const user = useAuthStore((state) => state.user)
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const refreshUnreadCount = useNotificationStore((state) => state.refreshUnreadCount)
  const { pendingCount, fetchPendingCount } = useClinicStore()
  const { state, toggleSidebar, isMobile } = useSidebar()

  // Initialize SSE and fetch initial counts
  useSseNotification()

  // Auto-sync profile (avatar, fullName) to authStore for Sidebar
  useSyncProfile()

  useEffect(() => {
    refreshUnreadCount()
    fetchPendingCount()
  }, [refreshUnreadCount, fetchPendingCount])

  const navGroups: NavGroup[] = [
    {
      title: 'DASHBOARD',
      items: [
        { path: '/admin', label: 'DASHBOARD', icon: Squares2X2Icon, end: true },
      ]
    },
    {
      title: 'PLATFORM MANAGEMENT',
      items: [
        { path: '/admin/clinics', label: 'QUẢN LÝ CLINIC', icon: BuildingOfficeIcon, unreadCount: pendingCount },
        { path: '/admin/users', label: 'USERS', icon: UsersIcon },
        { path: '/admin/reports', label: 'REPORTS', icon: FlagIcon },
      ]
    },
    {
      title: 'AI AGENT MANAGEMENT',
      items: [
        { path: '/admin/knowledge', label: 'KNOWLEDGE BASE', icon: BookOpenIcon },
        { path: '/admin/tools', label: 'TOOLS', icon: WrenchIcon },
        { path: '/admin/playground', label: 'PLAYGROUND', icon: PlayIcon },
      ]
    },
    {
      title: 'CÁ NHÂN',
      items: [
        { path: '/admin/notifications', label: 'THÔNG BÁO', icon: BellIcon, unreadCount },
        { path: '/admin/profile', label: 'HỒ SƠ', icon: UserCircleIcon },
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
        roleName="QUẢN TRỊ VIÊN"
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

export default AdminLayout