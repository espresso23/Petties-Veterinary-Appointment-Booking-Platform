import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import '../styles/brutalist.css'

interface NavItem {
    path: string
    label: string
    end?: boolean
}

/**
 * CLINIC_MANAGER Layout - Neobrutalism Design
 * Text-only navigation, no icons as per design guidelines
 */
export const ClinicManagerLayout = () => {
    const navigate = useNavigate()
    const clearAuth = useAuthStore((state) => state.clearAuth)
    const user = useAuthStore((state) => state.user)

    const navItems: NavItem[] = [
        { path: '/clinic-manager', label: 'DASHBOARD', end: true },
        { path: '/clinic-manager/vets', label: 'BÁC SĨ' },
        { path: '/clinic-manager/bookings', label: 'BOOKING' },
        { path: '/clinic-manager/schedule', label: 'LỊCH LÀM VIỆC' },
        { path: '/clinic-manager/chat', label: 'CHAT TƯ VẤN' },
        { path: '/clinic-manager/refunds', label: 'HOÀN TIỀN' },
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
                    <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mt-1">CLINIC MANAGER</p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 overflow-y-auto">
                    {navItems.map((link) => (
                        <NavLink
                            key={link.path}
                            to={link.path}
                            end={link.end}
                            className={({ isActive }) =>
                                `block px-6 py-3 text-sm font-bold uppercase tracking-wide border-l-4 transition-colors ${isActive
                                    ? 'bg-amber-100 text-stone-900 border-amber-600'
                                    : 'text-stone-700 border-transparent hover:bg-stone-100 hover:border-stone-400'
                                }`
                            }
                        >
                            {link.label}
                        </NavLink>
                    ))}
                </nav>

                {/* User & Logout */}
                <div className="px-6 py-4 border-t-4 border-stone-900">
                    <p className="text-xs font-bold text-stone-700 uppercase mb-3 truncate">
                        {user?.username || 'User'}
                    </p>
                    <button
                        onClick={handleLogout}
                        className="w-full py-2 px-4 bg-stone-900 text-white text-sm font-bold uppercase tracking-wide border-4 border-stone-900 hover:bg-stone-700 transition-colors"
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

export default ClinicManagerLayout
