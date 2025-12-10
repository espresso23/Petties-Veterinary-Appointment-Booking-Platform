import { Outlet, NavLink } from 'react-router-dom'
import '../styles/brutalist.css'

/**
 * CLINIC_OWNER Layout - Neobrutalism Design
 * Text-only navigation, no icons as per design guidelines
 */
export const ClinicOwnerLayout = () => {
    const navItems = [
        { path: '/clinic-owner', label: 'DASHBOARD', end: true },
        { path: '/clinic-owner/clinic-info', label: 'THÔNG TIN PHÒNG KHÁM' },
        { path: '/clinic-owner/services', label: 'DỊCH VỤ' },
        { path: '/clinic-owner/pricing', label: 'GIÁ DỊCH VỤ' },
        { path: '/clinic-owner/revenue', label: 'DOANH THU' },
        { path: '/clinic-owner/schedule', label: 'LỊCH LÀM VIỆC' },
    ]

    return (
        <div className="min-h-screen bg-stone-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r-4 border-stone-900 flex flex-col">
                {/* Logo/Header */}
                <div className="px-6 py-6 border-b-4 border-stone-900">
                    <h2 className="text-xl font-bold text-amber-600 uppercase tracking-wider">PETTIES</h2>
                    <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mt-1">CHU PHONG KHAM</p>
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
                                    ? 'bg-amber-50 text-amber-700 border-amber-600'
                                    : 'text-stone-700 border-transparent hover:bg-stone-50 hover:border-stone-300'
                                }`
                            }
                        >
                            {link.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="px-6 py-4 border-t-4 border-stone-900">
                    <p className="text-xs text-stone-500 text-center">V0.0.1</p>
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
