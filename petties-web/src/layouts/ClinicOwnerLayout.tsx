import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useNotificationPolling } from '../hooks/useNotificationPolling'
import '../styles/brutalist.css'

interface NavItem {
    path: string
    label: string
    end?: boolean
}

/**
 * CLINIC_OWNER Layout - Neobrutalism Design
 * Text-only navigation, no icons as per design guidelines
 */
export const ClinicOwnerLayout = () => {
    const navigate = useNavigate()
    const clearAuth = useAuthStore((state) => state.clearAuth)
    const user = useAuthStore((state) => state.user)
    const { unreadCount } = useNotificationPolling({ interval: 30000, fetchLimit: 5 })

        const navItems: NavItem[] = [
        { path: '/clinic-owner', label: 'DASHBOARD', end: true },
        { path: '/clinic-owner/clinics', label: 'QUẢN LÝ PHÒNG KHÁM' },
<<<<<<< HEAD
        { path: '/clinic-owner/staff', label: 'NHÂN SỰ' },
        { path: '/clinic-owner/services', label: 'DỊCH VỤ' },
=======
        { path: '/clinic-owner/master-services', label: 'DỊCH VỤ MẪU' },
        { path: '/clinic-owner/services', label: 'DỊCH VỤ PHÒNG KHÁM' },
        { path: '/clinic-owner/notifications', label: 'THÔNG BÁO' },
>>>>>>> intergrationFeature
        { path: '/clinic-owner/revenue', label: 'DOANH THU' },
        { path: '/clinic-owner/profile', label: 'HỒ SƠ CÁ NHÂN' },
        ]

    const handleLogout = () => {
        clearAuth()
        navigate('/login', { replace: true })
    }

    return (
        <div className="min-h-screen bg-stone-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r-4 border-stone-900 flex flex-col">
                {/* Logo/Header */}
                <div className="px-6 py-6 border-b-4 border-stone-900">
                    <h2 className="text-xl font-bold text-amber-600 uppercase tracking-wider">PETTIES</h2>
                    <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mt-1">CHỦ PHÒNG KHÁM</p>
                </div>

                {/* Navigation */}
                <nav className="py-4 overflow-y-auto">
                    {navItems.map((link) => (
                        <NavLink
                            key={link.path}
                            to={link.path}
                            end={link.end}
                            className={({ isActive }) =>
                                `block px-6 py-3 text-sm font-bold uppercase tracking-wide border-l-4 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 relative ${isActive
                                    ? 'bg-amber-500 !text-white border-stone-900'
                                    : '!text-stone-900 border-transparent hover:bg-amber-200 hover:border-stone-900 hover:translate-x-[-2px]'
                                }`
                            }
                        >
                            {String(link.label)}
                            {link.path === '/clinic-owner/notifications' && unreadCount > 0 && (
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-red-600 text-white text-xs font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                    {unreadCount}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div style={{ flex: 1 }}></div>

                {/* User & Logout */}
                <div className="px-6 py-4 border-t-4 border-stone-900">
                    <p className="text-xs font-bold text-stone-700 uppercase mb-3 truncate">
                        {user?.fullName || 'Owner'}
                    </p>
                    <button
                        onClick={handleLogout}
                        className="w-full py-2 px-4 bg-white text-stone-950 text-sm font-black uppercase tracking-widest border-4 border-stone-950 shadow-[4px_4px_0_#000] hover:bg-amber-400 hover:shadow-[6px_6px_0_#000] hover:-translate-x-1 hover:-translate-y-1 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_#000] transition-all duration-200 cursor-pointer focus:outline-none focus:ring-4 focus:ring-amber-500"
                    >
                        ĐĂNG XUẤT
                    </button>
                    <p className="text-xs text-stone-500 text-center mt-3">V0.0.1</p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    )
}

export default ClinicOwnerLayout
