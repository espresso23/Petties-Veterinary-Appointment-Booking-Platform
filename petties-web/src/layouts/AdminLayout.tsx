import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import '../styles/brutalist.css'

interface NavItem {
  path: string
  label: string
  end?: boolean
}

interface NavGroup {
  title: string | null
  items: NavItem[]
}

/**
 * Admin Layout - Neobrutalism Design
 * Text-only navigation, no icons as per design guidelines
 */
export const AdminLayout = () => {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const user = useAuthStore((state) => state.user)

  const navGroups: NavGroup[] = [
    {
      title: null,
      items: [
        { path: '/admin', label: 'DASHBOARD', end: true },
      ]
    },
    {
      title: 'AI AGENT MANAGEMENT',
      items: [
        { path: '/admin/agents', label: 'AGENTS' },
        { path: '/admin/tools', label: 'TOOLS' },
        { path: '/admin/knowledge', label: 'KNOWLEDGE BASE' },
        { path: '/admin/playground', label: 'PLAYGROUND' },
      ]
    },
    {
      title: 'PLATFORM MANAGEMENT',
      items: [
        { path: '/admin/clinics', label: 'QUẢN LÝ CLINIC' },
        { path: '/admin/users', label: 'USERS' },
        { path: '/admin/reports', label: 'REPORTS' },
        { path: '/admin/settings', label: 'CẤU HÌNH' },
      ]
    },
    {
      title: 'CÁ NHÂN',
      items: [
        { path: '/admin/profile', label: 'HỒ SƠ' },
      ]
    }
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
          <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mt-1">ADMIN PANEL</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="mb-4">
              {group.title && (
                <div className="px-6 mb-2">
                  <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                    {group.title}
                  </h3>
                </div>
              )}
              {group.items.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end={link.end}
                  className={({ isActive }) =>
                    `block px-6 py-3 text-sm font-bold uppercase tracking-wide border-l-4 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${isActive
                      ? 'bg-amber-500 !text-white border-stone-900'
                      : '!text-stone-900 border-transparent hover:bg-amber-200 hover:border-stone-900 hover:translate-x-[-2px]'
                    }`
                  }
                >
                  {String(link.label)}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User & Logout */}
        <div className="px-6 py-4 border-t-4 border-stone-900">
          <p className="text-xs font-bold text-stone-700 uppercase mb-3 truncate">
            {user?.username || 'Admin'}
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

export default AdminLayout