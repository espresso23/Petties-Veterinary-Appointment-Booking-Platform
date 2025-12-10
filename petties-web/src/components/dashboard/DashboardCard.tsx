import { type ReactNode } from 'react'
import '../../styles/brutalist.css'

interface DashboardCardProps {
    title: string
    value: string | number
    subtitle?: string
    icon?: ReactNode
    trend?: string
    trendUp?: boolean
    children?: ReactNode
    className?: string
}

/**
 * Brutalist Dashboard Card
 * Supports optional icon and trend indicator
 */
export function DashboardCard({
    title,
    value,
    subtitle,
    icon,
    trend,
    trendUp,
    children,
    className = ''
}: DashboardCardProps) {
    return (
        <div className={`bg-white border-4 border-stone-900 shadow-brutal p-6 transition-all duration-200 cursor-default hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_#1c1917] ${className}`}>
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                    {title}
                </h3>
                {icon && (
                    <div className="text-stone-900">
                        {icon}
                    </div>
                )}
            </div>

            <p className="text-3xl font-bold text-stone-900 mb-1">
                {value}
            </p>

            {(subtitle || trend) && (
                <div className="flex items-center gap-2 mt-2">
                    {trend && (
                        <span className={`text-xs font-bold px-2 py-0.5 border-2 border-stone-900 ${trendUp
                                ? 'bg-green-100 text-green-800'
                                : 'bg-stone-100 text-stone-600'
                            }`}>
                            {trend}
                        </span>
                    )}
                    {subtitle && (
                        <p className="text-sm text-stone-600">{subtitle}</p>
                    )}
                </div>
            )}

            {children}
        </div>
    )
}

interface DashboardStatsGridProps {
    children: ReactNode
}

/**
 * Grid container for dashboard stats
 */
export function DashboardStatsGrid({ children }: DashboardStatsGridProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {children}
        </div>
    )
}

interface DashboardSectionProps {
    title: string
    children: ReactNode
    action?: ReactNode
}

/**
 * Dashboard section with title
 */
export function DashboardSection({ title, children, action }: DashboardSectionProps) {
    return (
        <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-stone-900 uppercase tracking-wide">
                    {title}
                </h2>
                {action}
            </div>
            {children}
        </section>
    )
}

export default DashboardCard
