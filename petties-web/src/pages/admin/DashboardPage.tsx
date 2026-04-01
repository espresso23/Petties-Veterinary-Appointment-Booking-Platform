import { useAuthStore } from '../../store/authStore'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { env } from '../../config/env'
import { DashboardCard, DashboardStatsGrid, DashboardSection } from '../../components/dashboard/DashboardCard'
import { AdminDashboardCharts } from '../../components/admin/AdminDashboardCharts'
import { clinicService } from '../../services/api/clinicService'
import { getAllReportsForAdmin } from '../../services/reportService'
import { getPendingForAdmin } from '../../services/refundApplicationService'
import { getStruckPetOwners } from '../../services/api/userService'
import { subscriptionService } from '../../services/api/subscriptionService'
import { ROUTES } from '../../config/routes'
import type { ReportResponse } from '../../types/report'
import type { ClinicResponse } from '../../types/clinic'
import '../../styles/brutalist.css'

interface ServiceHealth {
    status: 'checking' | 'healthy' | 'error'
    message: string
    version?: string
}

/**
 * Admin dashboard — platform stats, charts, service health
 */
export const AdminDashboardPage = () => {
    const { user } = useAuthStore()
    const [aiHealth, setAiHealth] = useState<ServiceHealth>({ status: 'checking', message: 'Checking…' })
    const [springHealth, setSpringHealth] = useState<ServiceHealth>({ status: 'checking', message: 'Checking…' })

    const [pendingClinics, setPendingClinics] = useState<number | null>(null)
    const [pendingReports, setPendingReports] = useState<number | null>(null)
    const [pendingRefunds, setPendingRefunds] = useState<number | null>(null)
    const [reportApproved, setReportApproved] = useState<number | null>(null)
    const [reportRejected, setReportRejected] = useState<number | null>(null)
    const [struckClinics, setStruckClinics] = useState<number | null>(null)
    const [struckPetOwners, setStruckPetOwners] = useState<number | null>(null)
    const [approvedClinics, setApprovedClinics] = useState<number | null>(null)
    const [pendingSubscriptionPayments, setPendingSubscriptionPayments] = useState<number | null>(null)

    const [recentPendingClinics, setRecentPendingClinics] = useState<ClinicResponse[]>([])
    const [recentPendingReports, setRecentPendingReports] = useState<ReportResponse[]>([])

    const [statsLoading, setStatsLoading] = useState(true)
    const [statsWarnings, setStatsWarnings] = useState<string[]>([])

    const checkServices = useCallback(async () => {
        try {
            const res = await fetch(`${env.AGENT_API_BASE_URL}/health`, { method: 'GET' })
            if (res.ok) {
                const data = (await res.json()) as { service?: string; version?: string }
                setAiHealth({ status: 'healthy', message: data.service || 'AI service', version: data.version })
            } else {
                setAiHealth({ status: 'error', message: `HTTP ${res.status}` })
            }
        } catch {
            setAiHealth({ status: 'error', message: 'Connection failed' })
        }

        try {
            const res = await fetch(`${env.API_BASE_URL}/actuator/health`, { method: 'GET' })
            if (res.ok) {
                const data = (await res.json()) as { status?: string }
                setSpringHealth({ status: 'healthy', message: data.status || 'UP' })
            } else {
                setSpringHealth({ status: 'error', message: `HTTP ${res.status}` })
            }
        } catch {
            setSpringHealth({ status: 'error', message: 'Connection error' })
        }
    }, [])

    const loadPlatformStats = useCallback(async () => {
        setStatsLoading(true)
        setStatsWarnings([])

        const warn: string[] = []
        const mark = (label: string) => warn.push(`${label} could not be loaded`)

        const [
            pc,
            repPendingPage,
            repApprovedPage,
            repRejectedPage,
            refundRes,
            struckCPage,
            struckUPage,
            approvedPage,
            subsList,
            pendingClinicsPage,
            pendingReportsPage,
        ] = await Promise.all([
            clinicService.getPendingClinicsCount().catch(() => {
                mark('Pending clinics count')
                return null
            }),
            getAllReportsForAdmin('PENDING', 0, 1).catch(() => {
                mark('Reports (pending)')
                return null
            }),
            getAllReportsForAdmin('APPROVED', 0, 1).catch(() => {
                mark('Reports (approved)')
                return null
            }),
            getAllReportsForAdmin('REJECTED', 0, 1).catch(() => {
                mark('Reports (rejected)')
                return null
            }),
            getPendingForAdmin().catch(() => {
                mark('Refund queue')
                return null
            }),
            clinicService.getStruckClinics(0, 1).catch(() => {
                mark('Struck clinics')
                return null
            }),
            getStruckPetOwners(0, 1).catch(() => {
                mark('Struck pet owners')
                return null
            }),
            clinicService.getAllClinics({ status: 'APPROVED', page: 0, size: 1 }).catch(() => {
                mark('Approved clinics total')
                return null
            }),
            subscriptionService.getAllUserSubscriptions().catch(() => {
                mark('Subscriptions')
                return null
            }),
            clinicService.getPendingClinics(0, 5).catch(() => {
                mark('Recent pending clinics list')
                return null
            }),
            getAllReportsForAdmin('PENDING', 0, 5).catch(() => {
                mark('Recent pending reports list')
                return null
            }),
        ])

        setPendingClinics(pc)
        setPendingReports(repPendingPage?.totalElements ?? null)
        setReportApproved(repApprovedPage?.totalElements ?? null)
        setReportRejected(repRejectedPage?.totalElements ?? null)

        if (refundRes && typeof refundRes === 'object' && 'items' in refundRes) {
            const items = (refundRes as { items?: unknown[] }).items
            setPendingRefunds(Array.isArray(items) ? items.length : null)
        } else {
            setPendingRefunds(null)
        }

        setStruckClinics(struckCPage?.totalElements ?? null)
        setStruckPetOwners(struckUPage?.totalElements ?? null)
        setApprovedClinics(approvedPage?.totalElements ?? null)

        if (subsList) {
            setPendingSubscriptionPayments(subsList.filter((s) => s.status === 'PENDING_PAYMENT').length)
        } else {
            setPendingSubscriptionPayments(null)
        }

        setRecentPendingClinics(pendingClinicsPage?.content ?? [])
        setRecentPendingReports(pendingReportsPage?.content ?? [])

        setStatsWarnings(warn)
        setStatsLoading(false)
    }, [])

    useEffect(() => {
        checkServices()
    }, [checkServices])

    useEffect(() => {
        loadPlatformStats()
    }, [loadPlatformStats])

    const getStatusStyle = (status: ServiceHealth['status']) => {
        switch (status) {
            case 'healthy':
                return 'bg-amber-100 text-stone-900'
            case 'error':
                return 'bg-red-100 text-stone-900'
            default:
                return 'bg-stone-100 text-stone-700'
        }
    }

    const getStatusText = (status: ServiceHealth['status']) => {
        switch (status) {
            case 'healthy':
                return 'Up'
            case 'error':
                return 'Error'
            default:
                return 'Checking'
        }
    }

    const statVal = (n: number | null) => {
        if (statsLoading) return '…'
        if (n === null) return '—'
        return n
    }

    const queueBarItems = useMemo(() => {
        const n = (v: number | null) => (v === null ? 0 : v)
        return [
            { label: 'Clinics pending', value: n(pendingClinics) },
            { label: 'Reports pending', value: n(pendingReports) },
            { label: 'Refunds pending', value: n(pendingRefunds) },
            { label: 'Struck clinics', value: n(struckClinics) },
            { label: 'Sub. pending pay', value: n(pendingSubscriptionPayments) },
            { label: 'Struck pet owners', value: n(struckPetOwners) },
        ]
    }, [pendingClinics, pendingReports, pendingRefunds, struckClinics, pendingSubscriptionPayments, struckPetOwners])

    const reportChartPending = pendingReports ?? 0
    const reportChartApproved = reportApproved ?? 0
    const reportChartRejected = reportRejected ?? 0

    return (
        <div className="p-6 bg-stone-50 min-h-screen">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-stone-900">Admin dashboard</h1>
                <p className="text-stone-600 mt-1">Welcome, {user?.username || 'Administrator'}</p>
            </header>

            <DashboardSection title="Service status">
                <div className="flex flex-wrap gap-4 items-start">
                    <div
                        className={`border-4 border-stone-900 p-4 shadow-brutal transition-all duration-200 hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_#1c1917] ${getStatusStyle(aiHealth.status)}`}
                    >
                        <p className="text-xs font-bold uppercase tracking-wide mb-1">AI service</p>
                        <p className="text-lg font-bold">{getStatusText(aiHealth.status)}</p>
                        <p className="text-sm">{aiHealth.message}</p>
                        {aiHealth.version && <p className="text-xs opacity-70">v{aiHealth.version}</p>}
                    </div>
                    <div
                        className={`border-4 border-stone-900 p-4 shadow-brutal transition-all duration-200 hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_#1c1917] ${getStatusStyle(springHealth.status)}`}
                    >
                        <p className="text-xs font-bold uppercase tracking-wide mb-1">Backend API</p>
                        <p className="text-lg font-bold">{getStatusText(springHealth.status)}</p>
                        <p className="text-sm">{springHealth.message}</p>
                    </div>
                    <button type="button" onClick={checkServices} className="btn-brutal py-2 px-4 text-sm uppercase font-bold">
                        Refresh
                    </button>
                </div>
            </DashboardSection>

            {statsWarnings.length > 0 && (
                <div className="mb-6 border-2 border-amber-800 bg-amber-50 px-4 py-3 text-sm text-stone-900 shadow-[3px_3px_0_#1c1917]">
                    <p className="font-bold uppercase text-xs mb-1">Partial data</p>
                    <ul className="list-disc list-inside space-y-1">
                        {statsWarnings.map((w, i) => (
                            <li key={`${i}-${w}`}>{w}</li>
                        ))}
                    </ul>
                </div>
            )}

            <DashboardSection title="Queues & risk">
                <DashboardStatsGrid>
                    <DashboardCard title="Clinics pending approval" value={statVal(pendingClinics)} subtitle="Needs action" />
                    <DashboardCard title="Reports pending" value={statVal(pendingReports)} subtitle="Awaiting review" />
                    <DashboardCard title="Refund requests pending" value={statVal(pendingRefunds)} subtitle="Clinic payouts" />
                    <DashboardCard title="Struck clinics" value={statVal(struckClinics)} subtitle="Restricted" />
                </DashboardStatsGrid>
            </DashboardSection>

            <DashboardSection title="Platform totals">
                <DashboardStatsGrid>
                    <DashboardCard title="Approved clinics" value={statVal(approvedClinics)} subtitle="Registered & approved" />
                    <DashboardCard title="Subscription pending payment" value={statVal(pendingSubscriptionPayments)} subtitle="From all clinics" />
                    <DashboardCard title="Struck pet owners" value={statVal(struckPetOwners)} subtitle="Active strikes" />
                </DashboardStatsGrid>
            </DashboardSection>

            <DashboardSection title="Charts">
                <AdminDashboardCharts
                    reportPending={reportChartPending}
                    reportApproved={reportChartApproved}
                    reportRejected={reportChartRejected}
                    queueItems={queueBarItems}
                    loading={statsLoading}
                />
            </DashboardSection>

            <DashboardSection title="Recent pending clinics">
                <div className="bg-white border-4 border-stone-900 shadow-brutal overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="border-b-4 border-stone-900 bg-stone-100">
                            <tr>
                                <th className="p-3 text-xs font-bold uppercase">Name</th>
                                <th className="p-3 text-xs font-bold uppercase">Phone</th>
                                <th className="p-3 text-xs font-bold uppercase">Submitted</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statsLoading && (
                                <tr>
                                    <td colSpan={3} className="p-6 text-stone-500">
                                        Loading…
                                    </td>
                                </tr>
                            )}
                            {!statsLoading && recentPendingClinics.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-6 text-center text-stone-600">
                                        No pending clinics
                                    </td>
                                </tr>
                            )}
                            {!statsLoading &&
                                recentPendingClinics.map((c) => (
                                    <tr key={c.clinicId} className="border-b-2 border-stone-200 hover:bg-amber-50">
                                        <td className="p-3 font-bold text-stone-900">{c.name}</td>
                                        <td className="p-3 font-mono text-sm">{c.phone}</td>
                                        <td className="p-3 text-sm text-stone-600">
                                            {c.createdAt ? new Date(c.createdAt).toLocaleString('en-US') : '—'}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
                <p className="mt-3 text-sm">
                    <Link to="/admin/clinics" className="font-bold text-amber-800 underline underline-offset-2">
                        Open clinic review
                    </Link>
                </p>
            </DashboardSection>

            <DashboardSection title="Recent pending reports">
                <div className="bg-white border-4 border-stone-900 shadow-brutal overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="border-b-4 border-stone-900 bg-stone-100">
                            <tr>
                                <th className="p-3 text-xs font-bold uppercase">Booking</th>
                                <th className="p-3 text-xs font-bold uppercase">Reason</th>
                                <th className="p-3 text-xs font-bold uppercase">Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statsLoading && (
                                <tr>
                                    <td colSpan={3} className="p-6 text-stone-500">
                                        Loading…
                                    </td>
                                </tr>
                            )}
                            {!statsLoading && recentPendingReports.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-6 text-center text-stone-600">
                                        No pending reports
                                    </td>
                                </tr>
                            )}
                            {!statsLoading &&
                                recentPendingReports.map((r) => (
                                    <tr key={r.id} className="border-b-2 border-stone-200 hover:bg-amber-50">
                                        <td className="p-3 font-mono text-sm font-bold">{r.bookingCode}</td>
                                        <td className="p-3 text-sm text-stone-800 max-w-[240px] truncate" title={r.reason}>
                                            {r.reason}
                                        </td>
                                        <td className="p-3 text-sm text-stone-600">
                                            {r.createdAt ? new Date(r.createdAt).toLocaleString('en-US') : '—'}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
                <p className="mt-3 text-sm">
                    <Link to="/admin/reports" className="font-bold text-amber-800 underline underline-offset-2">
                        Open reports
                    </Link>
                </p>
            </DashboardSection>

            <DashboardSection
                title="AI & knowledge"
                action={
                    <Link
                        to={ROUTES.admin.aiInsights}
                        className="text-sm font-bold uppercase text-amber-700 border-2 border-stone-900 px-3 py-1 bg-white shadow-[3px_3px_0_#1c1917] hover:translate-x-[-2px] hover:translate-y-[-2px]"
                    >
                        Open AI Insights
                    </Link>
                }
            >
                <p className="text-sm text-stone-600">
                    Configure the knowledge base, tools, and response metrics from the menu. See AI Insights for a detailed overview.
                </p>
            </DashboardSection>

            <DashboardSection title="Quick links">
                <div className="flex flex-wrap gap-3">
                    <Link
                        to="/admin/clinics"
                        className="inline-block px-4 py-3 font-bold uppercase text-sm border-4 border-stone-900 bg-white shadow-[4px_4px_0_#1c1917] hover:translate-x-[-2px] hover:translate-y-[-2px]"
                    >
                        Review clinics
                    </Link>
                    <Link
                        to="/admin/reports"
                        className="inline-block px-4 py-3 font-bold uppercase text-sm border-4 border-stone-900 bg-amber-100 shadow-[4px_4px_0_#1c1917] hover:translate-x-[-2px] hover:translate-y-[-2px]"
                    >
                        Handle reports
                    </Link>
                    <Link
                        to="/admin/refunds"
                        className="inline-block px-4 py-3 font-bold uppercase text-sm border-4 border-stone-900 bg-white shadow-[4px_4px_0_#1c1917] hover:translate-x-[-2px] hover:translate-y-[-2px]"
                    >
                        Refunds
                    </Link>
                    <Link
                        to="/admin/knowledge"
                        className="inline-block px-4 py-3 font-bold uppercase text-sm border-4 border-stone-900 bg-white shadow-[4px_4px_0_#1c1917] hover:translate-x-[-2px] hover:translate-y-[-2px]"
                    >
                        Knowledge base
                    </Link>
                    <Link
                        to="/admin/subscriptions"
                        className="inline-block px-4 py-3 font-bold uppercase text-sm border-4 border-stone-900 bg-amber-50 shadow-[4px_4px_0_#1c1917] hover:translate-x-[-2px] hover:translate-y-[-2px]"
                    >
                        Subscriptions
                    </Link>
                    <Link
                        to="/admin/vouchers"
                        className="inline-block px-4 py-3 font-bold uppercase text-sm border-4 border-stone-900 bg-white shadow-[4px_4px_0_#1c1917] hover:translate-x-[-2px] hover:translate-y-[-2px]"
                    >
                        Vouchers
                    </Link>
                    <Link
                        to="/admin/notifications"
                        className="inline-block px-4 py-3 font-bold uppercase text-sm border-4 border-stone-900 bg-white shadow-[4px_4px_0_#1c1917] hover:translate-x-[-2px] hover:translate-y-[-2px]"
                    >
                        Notifications
                    </Link>
                </div>
            </DashboardSection>
        </div>
    )
}

export default AdminDashboardPage
