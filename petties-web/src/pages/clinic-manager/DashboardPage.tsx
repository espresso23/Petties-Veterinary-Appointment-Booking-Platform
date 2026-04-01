import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useClinicStore } from '../../store/clinicStore'
import { DashboardCard, DashboardStatsGrid, DashboardSection } from '../../components/dashboard/DashboardCard'
import { ClinicDashboardCharts } from '../../components/clinic/ClinicDashboardCharts'
import { getBookingsByClinic, getActiveSosAlerts } from '../../services/bookingService'
import { getClinicRevenueSummary, getClinicPayments } from '../../services/paymentService'
import { getClinicRefundApplications } from '../../services/refundApplicationService'
import { formatVndEn } from '../../utils/formatCurrency'
import { bookingStatusLabelEn } from '../../utils/bookingStatusDisplayEn'
import type { Booking } from '../../types/booking'
import '../../styles/brutalist.css'

function todayIsoDate(): string {
    const t = new Date()
    const y = t.getFullYear()
    const m = String(t.getMonth() + 1).padStart(2, '0')
    const d = String(t.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function isToday(dateStr: string, day: string): boolean {
    return dateStr.startsWith(day) || dateStr.slice(0, 10) === day
}

function aggregateBookingSegments(bookings: Booking[]): { name: string; value: number }[] {
    const map = new Map<string, number>()
    for (const b of bookings) {
        const label = bookingStatusLabelEn(b.status)
        map.set(label, (map.get(label) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
}

const FETCH_KEYS = [
    'Daily revenue',
    'Weekly revenue',
    'Monthly revenue',
    'Bookings',
    'Refunds',
    'Pending payments',
    'SOS alerts',
] as const

export const ClinicManagerDashboardPage = () => {
    const { user } = useAuthStore()
    const { clinics, getMyClinics, isLoading: isClinicsLoading } = useClinicStore()

    const currentClinic = clinics.length > 0 ? clinics[0] : null
    const clinicId = currentClinic?.clinicId

    const [loading, setLoading] = useState(false)
    const [partialWarnings, setPartialWarnings] = useState<string[]>([])
    const [dayRevenue, setDayRevenue] = useState<number | null>(null)
    const [pendingAssign, setPendingAssign] = useState<number | null>(null)
    const [completedToday, setCompletedToday] = useState<number | null>(null)
    const [inProgressToday, setInProgressToday] = useState<number | null>(null)
    const [pendingRefunds, setPendingRefunds] = useState<number | null>(null)
    const [pendingPaymentsCount, setPendingPaymentsCount] = useState<number | null>(null)
    const [sosActiveCount, setSosActiveCount] = useState<number | null>(null)
    const [recentBookings, setRecentBookings] = useState<Booking[]>([])
    const [bookingSegments, setBookingSegments] = useState<{ name: string; value: number }[]>([])
    const [revenueWeekLabels, setRevenueWeekLabels] = useState<string[]>([])
    const [revenueWeekValues, setRevenueWeekValues] = useState<number[]>([])
    const [revenueMonthLabels, setRevenueMonthLabels] = useState<string[]>([])
    const [revenueMonthValues, setRevenueMonthValues] = useState<number[]>([])
    const [revenueChartPeriod, setRevenueChartPeriod] = useState<'WEEK' | 'MONTH'>('WEEK')

    const revenueLabels = revenueChartPeriod === 'WEEK' ? revenueWeekLabels : revenueMonthLabels
    const revenueValues = revenueChartPeriod === 'WEEK' ? revenueWeekValues : revenueMonthValues
    const revenueTitle = revenueChartPeriod === 'WEEK' ? 'Revenue (week)' : 'Revenue (month)'

    const loadData = useCallback(async () => {
        if (!clinicId) return
        setLoading(true)
        setPartialWarnings([])
        const day = todayIsoDate()

        const settled = await Promise.allSettled([
            getClinicRevenueSummary(clinicId, 'DAY'),
            getClinicRevenueSummary(clinicId, 'WEEK'),
            getClinicRevenueSummary(clinicId, 'MONTH'),
            getBookingsByClinic(clinicId, undefined, undefined, 0, 500),
            getClinicRefundApplications(clinicId),
            getClinicPayments(clinicId, 100, 'PENDING'),
            getActiveSosAlerts(),
        ])

        const w: string[] = []
        settled.forEach((r, i) => {
            if (r.status === 'rejected') w.push(FETCH_KEYS[i])
        })
        setPartialWarnings(w)

        const rev = settled[0].status === 'fulfilled' ? settled[0].value : null
        const weekRes = settled[1].status === 'fulfilled' ? settled[1].value : null
        const monthRes = settled[2].status === 'fulfilled' ? settled[2].value : null
        const bookingsPage = settled[3].status === 'fulfilled' ? settled[3].value : null
        const refundRes = settled[4].status === 'fulfilled' ? settled[4].value : null
        const payPending = settled[5].status === 'fulfilled' ? settled[5].value : null
        const sosAlerts = settled[6].status === 'fulfilled' ? settled[6].value : null

        const sum = (items: { total?: number | string }[]) =>
            items.reduce((s, i) => s + (Number(i.total) || 0), 0)
        if (rev?.items) setDayRevenue(sum(rev.items))
        else setDayRevenue(null)

        if (weekRes?.items?.length) {
            setRevenueWeekLabels(weekRes.items.map((i) => i.label))
            setRevenueWeekValues(weekRes.items.map((i) => Number(i.total) || 0))
        } else {
            setRevenueWeekLabels([])
            setRevenueWeekValues([])
        }
        if (monthRes?.items?.length) {
            setRevenueMonthLabels(monthRes.items.map((i) => i.label))
            setRevenueMonthValues(monthRes.items.map((i) => Number(i.total) || 0))
        } else {
            setRevenueMonthLabels([])
            setRevenueMonthValues([])
        }

        const list = bookingsPage?.content || []
        if (bookingsPage) {
            const todayList = list.filter((b) => isToday(b.bookingDate, day))
            setPendingAssign(
                todayList.filter((b) => b.status === 'PENDING' || (b.status === 'CONFIRMED' && !b.assignedStaffId)).length
            )
            setCompletedToday(todayList.filter((b) => b.status === 'COMPLETED').length)
            setInProgressToday(todayList.filter((b) => b.status === 'IN_PROGRESS').length)
            setBookingSegments(aggregateBookingSegments(list))

            const sorted = [...list].sort((a, b) => {
                const da = `${a.bookingDate}T${a.bookingTime || '00:00:00'}`
                const db = `${b.bookingDate}T${b.bookingTime || '00:00:00'}`
                return db.localeCompare(da)
            })
            setRecentBookings(sorted.slice(0, 8))
        } else {
            setPendingAssign(null)
            setCompletedToday(null)
            setInProgressToday(null)
            setBookingSegments([])
            setRecentBookings([])
        }

        if (refundRes?.items) {
            const pendingRef = (refundRes.items || []).filter((r) => r.status === 'PENDING' || r.status === 'SUBMITTED')
            setPendingRefunds(pendingRef.length)
        } else setPendingRefunds(null)

        if (payPending?.payments) setPendingPaymentsCount(payPending.payments.length)
        else setPendingPaymentsCount(null)

        if (sosAlerts != null) setSosActiveCount(sosAlerts.length)
        else setSosActiveCount(null)

        setLoading(false)
    }, [clinicId])

    useEffect(() => {
        getMyClinics()
    }, [getMyClinics])

    useEffect(() => {
        if (clinicId) loadData()
    }, [clinicId, loadData])

    return (
        <div className="p-6 bg-stone-50 min-h-screen">
            <header className="mb-8">
                {currentClinic && (
                    <Link
                        to="/clinic-manager/clinic"
                        className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-amber-100 border-2 border-stone-900 shadow-[3px_3px_0px_#1c1917] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#1c1917] transition-all"
                    >
                        <span className="w-3 h-3 bg-green-500 rounded-full" aria-hidden />
                        <span className="text-sm font-bold uppercase text-stone-900 tracking-wide">{currentClinic.name}</span>
                    </Link>
                )}
                {isClinicsLoading && (
                    <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-stone-100 border-2 border-stone-400">
                        <span className="text-sm text-stone-500">Loading…</span>
                    </div>
                )}
                <h1 className="text-2xl font-bold text-stone-900">Clinic manager dashboard</h1>
                <p className="text-stone-600 mt-1">Welcome, {user?.fullName || 'Manager'}</p>
            </header>

            {partialWarnings.length > 0 && (
                <div
                    className="mb-4 border-2 border-amber-800 bg-amber-50 px-4 py-3 text-sm font-bold text-stone-800 shadow-[3px_3px_0_#1c1917]"
                    role="status"
                >
                    Partial data: could not load {partialWarnings.join(', ')}.
                </div>
            )}

            {clinicId && (
                <>
                    <DashboardSection title="Today overview">
                        <DashboardStatsGrid>
                            <DashboardCard
                                title="Revenue today"
                                value={loading ? '…' : formatVndEn(dayRevenue ?? 0)}
                                subtitle="Daily period"
                            />
                            <DashboardCard
                                title="Needs action / assign"
                                value={loading ? '…' : pendingAssign ?? '—'}
                                subtitle="Bookings today"
                            />
                            <DashboardCard title="In progress" value={loading ? '…' : inProgressToday ?? '—'} subtitle="Today" />
                            <DashboardCard title="Completed" value={loading ? '…' : completedToday ?? '—'} subtitle="Today" />
                        </DashboardStatsGrid>
                    </DashboardSection>

                    <DashboardSection title="Charts">
                        <div className="flex flex-wrap gap-2 mb-4">
                            <button
                                type="button"
                                onClick={() => setRevenueChartPeriod('WEEK')}
                                className={`text-xs font-bold uppercase px-3 py-1 border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] ${
                                    revenueChartPeriod === 'WEEK' ? 'bg-amber-200' : 'bg-white'
                                }`}
                            >
                                Week
                            </button>
                            <button
                                type="button"
                                onClick={() => setRevenueChartPeriod('MONTH')}
                                className={`text-xs font-bold uppercase px-3 py-1 border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] ${
                                    revenueChartPeriod === 'MONTH' ? 'bg-amber-200' : 'bg-white'
                                }`}
                            >
                                Month
                            </button>
                        </div>
                        <ClinicDashboardCharts
                            revenueLabels={revenueLabels}
                            revenueValues={revenueValues}
                            revenueTitle={revenueTitle}
                            bookingSegments={bookingSegments}
                            loading={loading}
                        />
                    </DashboardSection>

                    <DashboardSection title="Attention">
                        <DashboardStatsGrid>
                            <DashboardCard
                                title="Bookings to handle"
                                value={loading ? '…' : pendingAssign ?? '—'}
                                subtitle="Unassigned or pending (estimate)"
                            />
                            <DashboardCard
                                title="Pending payment"
                                value={loading ? '…' : pendingPaymentsCount ?? '—'}
                                subtitle="Payment records (PENDING)"
                            />
                            <DashboardCard title="Pending refunds" value={loading ? '…' : pendingRefunds ?? '—'} subtitle="Refund requests" />
                            <DashboardCard
                                title="Active SOS"
                                value={loading ? '…' : sosActiveCount ?? '—'}
                                subtitle="Open bookings to review SOS queue"
                            />
                        </DashboardStatsGrid>
                    </DashboardSection>

                    <DashboardSection title="Recent bookings">
                        <div className="bg-white border-4 border-stone-900 shadow-brutal overflow-hidden">
                            <table className="w-full">
                                <thead className="border-b-4 border-stone-900 bg-stone-100">
                                    <tr className="text-left">
                                        <th className="p-4 text-xs font-bold uppercase tracking-wide">Code</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wide">Customer</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wide">Time</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wide">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentBookings.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={4} className="p-6 text-center text-stone-600">
                                                No bookings yet
                                            </td>
                                        </tr>
                                    )}
                                    {recentBookings.map((b) => (
                                        <tr key={b.bookingId} className="border-b-2 border-stone-200 hover:bg-amber-50">
                                            <td className="p-4 font-mono text-sm">{b.bookingCode}</td>
                                            <td className="p-4 font-bold">{b.ownerName}</td>
                                            <td className="p-4 text-sm">
                                                {new Date(b.bookingDate).toLocaleDateString('en-US')} {b.bookingTime?.slice(0, 5)}
                                            </td>
                                            <td className="p-4 text-sm font-bold">{bookingStatusLabelEn(b.status)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </DashboardSection>

                    <DashboardSection title="Quick links">
                        <div className="flex flex-wrap gap-4">
                            <Link
                                to="/clinic-manager/bookings"
                                className="btn-brutal py-3 px-6 text-sm uppercase font-bold inline-block text-center"
                            >
                                Bookings
                            </Link>
                            <Link
                                to="/clinic-manager/staff"
                                className="btn-brutal-outline py-3 px-6 text-sm uppercase font-bold inline-block text-center border-2 border-stone-900 bg-white shadow-[3px_3px_0_#1c1917]"
                            >
                                Staff
                            </Link>
                            <Link
                                to="/clinic-manager/shifts"
                                className="btn-brutal-outline py-3 px-6 text-sm uppercase font-bold inline-block text-center border-2 border-stone-900 bg-white shadow-[3px_3px_0_#1c1917]"
                            >
                                Shifts
                            </Link>
                            <Link
                                to="/clinic-manager/revenue"
                                className="btn-brutal-outline py-3 px-6 text-sm uppercase font-bold inline-block text-center border-2 border-stone-900 bg-amber-50 shadow-[3px_3px_0_#1c1917]"
                            >
                                Revenue
                            </Link>
                            <Link
                                to="/clinic-manager/clinic"
                                className="btn-brutal-outline py-3 px-6 text-sm uppercase font-bold inline-block text-center border-2 border-stone-900 bg-white shadow-[3px_3px_0_#1c1917]"
                            >
                                Clinic profile
                            </Link>
                            <Link
                                to="/clinic-manager/refunds"
                                className="btn-brutal-outline py-3 px-6 text-sm uppercase font-bold inline-block text-center border-2 border-stone-900 bg-white shadow-[3px_3px_0_#1c1917]"
                            >
                                Refunds
                            </Link>
                        </div>
                    </DashboardSection>
                </>
            )}
        </div>
    )
}

export default ClinicManagerDashboardPage
