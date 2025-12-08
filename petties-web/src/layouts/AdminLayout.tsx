import { Outlet, NavLink } from 'react-router-dom'
import {
  HomeIcon,
  CpuChipIcon,
  WrenchScrewdriverIcon,
  BookOpenIcon,
  PlayIcon,
  Cog6ToothIcon,
  UserGroupIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

/**
 * Admin Layout - Redesigned with Warm Neutrals Design System
 * Professional sidebar navigation with agent management focus
 */
export const AdminLayout = () => {
  const navLinks = [
    { path: '/admin', label: 'Dashboard', icon: HomeIcon },
  ]

  const agentManagementLinks = [
    { path: '/admin/agents', label: 'Agents', icon: CpuChipIcon },
    { path: '/admin/tools', label: 'Tools', icon: WrenchScrewdriverIcon },
    { path: '/admin/knowledge', label: 'Knowledge Base', icon: BookOpenIcon },
    { path: '/admin/playground', label: 'Playground', icon: PlayIcon },
  ]

  const platformLinks = [
    { path: '/admin/settings', label: 'System Settings', icon: Cog6ToothIcon },
    { path: '/admin/users', label: 'User Management', icon: UserGroupIcon },
    { path: '/admin/appointments', label: 'Appointments', icon: CalendarIcon },
    { path: '/admin/transactions', label: 'Transactions', icon: CurrencyDollarIcon },
    { path: '/admin/analytics', label: 'Analytics', icon: ChartBarIcon },
  ]

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col">
        {/* Logo/Header */}
        <div className="px-6 py-6 border-b border-stone-200">
          <h2 className="text-xl font-bold text-stone-900">Petties Admin</h2>
          <p className="text-xs text-stone-500 mt-1">Agent Management Platform</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {/* Dashboard */}
          <div className="mb-6">
            {navLinks.map((link) => {
              const Icon = link.icon
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-amber-50 text-amber-700 font-medium border border-amber-200'
                        : 'text-stone-700 hover:bg-stone-50'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{link.label}</span>
                </NavLink>
              )
            })}
          </div>

          {/* Agent Management Section */}
          <div className="mb-6">
            <div className="px-3 mb-2">
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                AI Agent Management
              </h3>
            </div>
            {agentManagementLinks.map((link) => {
              const Icon = link.icon
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-amber-50 text-amber-700 font-medium border border-amber-200'
                        : 'text-stone-700 hover:bg-stone-50'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{link.label}</span>
                </NavLink>
              )
            })}
          </div>

          {/* Platform Management Section */}
          <div>
            <div className="px-3 mb-2">
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Platform Management
              </h3>
            </div>
            {platformLinks.map((link) => {
              const Icon = link.icon
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-amber-50 text-amber-700 font-medium border border-amber-200'
                        : 'text-stone-700 hover:bg-stone-50'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{link.label}</span>
                </NavLink>
              )
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200">
          <p className="text-xs text-stone-500">
            Version 1.0.0
          </p>
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