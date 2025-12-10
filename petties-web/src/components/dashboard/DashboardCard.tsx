import { type ReactNode } from 'react'
import '../../styles/brutalist.css'

interface DashboardCardProps {
    title: string
    value: string | number
    subtitle?: string
    children?: ReactNode
    className?: string
}

/**
 * Brutalist Dashboard Card
 * Text-only, no icons/emoji as per design guidelines
 */
export function DashboardCard({
    title,
    value,
    subtitle,
    children,
    className = ''
}: DashboardCardProps) {
    return (
        <div className={`bg-white border-4 border-stone-900 shadow-brutal p-6 ${className}`}>
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                {title}
            </h3>
            <p className="text-3xl font-bold text-stone-900 mb-1">
                {value}
            </p>
            {subtitle && (
                <p className="text-sm text-stone-600">{subtitle}</p>
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
