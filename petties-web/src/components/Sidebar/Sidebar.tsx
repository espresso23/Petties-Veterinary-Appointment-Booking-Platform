import React from 'react'
import { NavLink } from 'react-router-dom'
import {
    ChevronLeftIcon,
    Bars3Icon,
    ArrowLeftOnRectangleIcon,
    ChevronRightIcon
} from '@heroicons/react/24/outline'
import type { SidebarState } from '../../hooks/useSidebar'

export interface NavItem {
    path: string
    label: string
    icon: React.ForwardRefExoticComponent<any>
    end?: boolean
    unreadCount?: number
}

export interface NavGroup {
    title: string | null
    items: NavItem[]
}

interface SidebarProps {
    groups: NavGroup[]
    user: any
    roleName: string
    state: SidebarState
    toggleSidebar: () => void
    onLogout: () => void
    isMobile: boolean
}

export const Sidebar: React.FC<SidebarProps> = ({
    groups,
    user,
    roleName,
    state,
    toggleSidebar,
    onLogout,
    isMobile
}) => {
    const isCollapsed = state === 'collapsed'
    const isExpanded = state === 'expanded'

    // Width classes based on state
    const sidebarWidth = isExpanded ? 'w-64' : 'w-20'
    const mobileClasses = isMobile
        ? `fixed inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out ${sidebarWidth} shadow-2xl`
        : `relative transition-all duration-300 ease-in-out ${sidebarWidth} overflow-visible`

    return (
        <>
            {/* Mobile Backdrop - Only if expanded on mobile */}
            {isMobile && isExpanded && (
                <div
                    className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-40 transition-opacity duration-300"
                    onClick={toggleSidebar}
                />
            )}

            <aside className={`${mobileClasses} bg-white border-r-2 border-stone-900 flex flex-col h-full flex-shrink-0`}>
                {/* Header with Toggle */}
                <div className={`px-4 py-5 border-b-2 border-stone-900 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} min-h-[85px]`}>
                    {isExpanded && (
                        <div className="animate-in fade-in slide-in-from-left duration-300">
                            <h2 className="text-xl font-black text-amber-600 uppercase tracking-wider">PETTIES</h2>
                            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-tighter mt-0.5">{roleName}</p>
                        </div>
                    )}

                    {isCollapsed && (
                        <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center border-2 border-stone-900 shadow-[3px_3px_0_0_#000] font-black text-white text-xl animate-in zoom-in duration-300">
                            P
                        </div>
                    )}

                    {!isMobile && (
                        <button
                            onClick={toggleSidebar}
                            className={`p-1.5 rounded-md bg-white border-2 border-stone-900 shadow-[2px_2px_0_0_#000] hover:bg-amber-400 transition-all ${isCollapsed ? 'absolute -right-3.5 top-8 z-50' : ''}`}
                        >
                            {isCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
                        </button>
                    )}

                    {isMobile && (
                        <button
                            onClick={toggleSidebar}
                            className="p-2 rounded-lg bg-stone-100 border-2 border-stone-900 active:scale-95 transition-transform"
                        >
                            <Bars3Icon className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 overflow-y-auto no-scrollbar scroll-smooth">
                    {groups.map((group, groupIndex) => (
                        <div key={groupIndex} className="mb-6">
                            {group.title && isExpanded && (
                                <div className="px-6 mb-2 animate-in fade-in slide-in-from-left duration-500">
                                    <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">
                                        {group.title}
                                    </h3>
                                </div>
                            )}
                            <div className="space-y-1">
                                {group.items.map((link) => (
                                    <NavLink
                                        key={link.path}
                                        to={link.path}
                                        end={link.end}
                                        title={isCollapsed ? link.label : ''}
                                        className={({ isActive }) =>
                                            `flex items-center transition-all duration-200 group relative ${isCollapsed ? 'justify-center py-3.5' : 'px-6 py-2.5'
                                            } ${isActive
                                                ? 'bg-amber-500 text-white border-l-4 border-stone-900 font-black'
                                                : 'text-stone-600 border-l-4 border-transparent hover:bg-amber-50 hover:text-stone-900'
                                            }`
                                        }
                                    >
                                        <link.icon className={`transition-all duration-300 ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5 mr-3 group-hover:scale-110'}`} />

                                        {isExpanded && (
                                            <span className="text-xs font-bold uppercase tracking-tight truncate whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300 shadow-none">
                                                {link.label}
                                            </span>
                                        )}

                                        {/* Tooltip */}
                                        {isCollapsed && !isMobile && (
                                            <div className="absolute left-[calc(100%+1rem)] px-2.5 py-1.5 bg-stone-900 text-white text-[9px] font-black rounded border border-amber-500 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all pointer-events-none z-50 whitespace-nowrap uppercase tracking-widest">
                                                {link.label}
                                            </div>
                                        )}

                                        {/* Notification Badge */}
                                        {link.unreadCount !== undefined && link.unreadCount > 0 && (
                                            <span className={`absolute ${isCollapsed ? 'top-2 right-2' : 'right-4 top-1/2 -translate-y-1/2'} flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center`}>
                                                {link.unreadCount > 99 ? '99+' : link.unreadCount}
                                            </span>
                                        )}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                <div className={`mt-auto border-t-2 border-stone-900 transition-all bg-stone-50/50 ${isCollapsed ? 'p-3' : 'p-4'}`}>
                    {isExpanded ? (
                        <>
                            <div className="flex items-center gap-3 mb-3 animate-in fade-in duration-300">
                                <div className="relative group">
                                    {user?.avatar ? (
                                        <img src={user.avatar} className="w-9 h-9 rounded-full border-2 border-stone-900 object-cover" alt="avt" />
                                    ) : (
                                        <div className="w-9 h-9 rounded-full bg-amber-400 border-2 border-stone-900 flex items-center justify-center font-black text-stone-900 text-xs">
                                            {user?.fullName?.charAt(0) || '?'}
                                        </div>
                                    )}
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-black text-stone-900 truncate uppercase leading-tight">
                                        {user?.fullName || 'User'}
                                    </p>
                                    <p className="text-[9px] font-medium text-stone-500 truncate mt-0.5">{user?.email}</p>
                                    {user?.specialty && (
                                        <p className="text-[8px] font-bold text-amber-600 truncate mt-0.5 uppercase">
                                            {user.specialty === 'VET_GENERAL' && 'BS Thú y'}
                                            {user.specialty === 'VET_SURGERY' && 'BS Phẫu thuật'}
                                            {user.specialty === 'VET_DENTAL' && 'BS Nha khoa'}
                                            {user.specialty === 'VET_DERMATOLOGY' && 'BS Da liễu'}
                                            {user.specialty === 'GROOMER' && 'Grooming'}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={onLogout}
                                className="w-full py-2 px-4 bg-white text-stone-950 text-[10px] font-black uppercase tracking-widest border-2 border-stone-950 shadow-[3px_3px_0_0_#000] hover:bg-red-500 hover:text-white hover:border-red-600 transition-all flex items-center justify-center gap-2 group/btn"
                            >
                                <ArrowLeftOnRectangleIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-x-1" />
                                <span>ĐĂNG XUẤT</span>
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-300">
                            <div className="relative">
                                {user?.avatar ? (
                                    <img src={user.avatar} className="w-9 h-9 rounded-full border-2 border-stone-900 object-cover shadow-[2px_2px_0_0_#000]" alt="avt" />
                                ) : (
                                    <div className="w-9 h-9 rounded-full border-2 border-stone-900 bg-amber-400 flex items-center justify-center font-black text-xs shadow-[2px_2px_0_0_#000]">
                                        {user?.fullName?.charAt(0) || '?'}
                                    </div>
                                )}
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                            </div>
                            <button
                                onClick={onLogout}
                                className="p-2.5 bg-white border-2 border-stone-900 hover:bg-red-500 hover:text-white transition-all rounded-lg shadow-[2px_2px_0_0_#000]"
                                title="Đăng xuất"
                            >
                                <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </aside>
        </>
    )
}
