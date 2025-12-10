import { Link, useLocation } from 'react-router-dom'
import '../../styles/brutalist.css'

export interface SidebarItem {
    label: string
    path: string
}

interface DashboardSidebarProps {
    items: SidebarItem[]
    title: string
    basePath: string
}

/**
 * Brutalist Dashboard Sidebar
 * Text-only navigation, no icons/emoji as per design guidelines
 */
export function DashboardSidebar({ items, title, basePath }: DashboardSidebarProps) {
    const location = useLocation()
    const currentPath = location.pathname

    return (
        <aside className="w-64 min-h-screen bg-white border-r-4 border-stone-900 flex flex-col">
            {/* Logo/Title */}
            <div className="p-6 border-b-4 border-stone-900">
                <Link to={basePath} className="block">
                    <h1 className="text-xl font-bold text-amber-600 uppercase tracking-wider">
                        PETTIES
                    </h1>
                    <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mt-1">
                        {title}
                    </p>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4">
                {items.map((item) => {
                    const isActive = currentPath === item.path ||
                        (item.path !== basePath && currentPath.startsWith(item.path))

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`
                block px-6 py-3 text-sm font-bold uppercase tracking-wide
                border-l-4 transition-colors
                ${isActive
                                    ? 'bg-amber-50 text-amber-700 border-amber-600'
                                    : 'text-stone-700 border-transparent hover:bg-stone-50 hover:border-stone-300'
                                }
              `}
                        >
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t-4 border-stone-900">
                <p className="text-xs text-stone-500 text-center">
                    V0.0.1
                </p>
            </div>
        </aside>
    )
}

export default DashboardSidebar
