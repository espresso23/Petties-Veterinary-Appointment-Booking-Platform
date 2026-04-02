import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useClinicStore } from '../../store/clinicStore'
import { DashboardCard, DashboardStatsGrid, DashboardSection } from '../../components/dashboard/DashboardCard'
import { ClinicDashboardCharts } from '../../components/clinic/ClinicDashboardCharts'
import { getClinicRevenueSummary, getClinicPayments, type ClinicPaymentItem } from '../../services/paymentService'
import { getBookingsByClinic } from '../../services/bookingService'
import { subscriptionService } from '../../services/api/subscriptionService'
import { formatVnd } from '../../utils/formatCurrency'
import { bookingStatusLabelVi } from '../../utils/bookingStatusDisplayVi'
import { ROUTES } from '../../config/routes'
import type { Booking } from '../../types/booking'
import '../../styles/brutalist.css'

function todayIsoDate(): string {
    const t = new Date()
    const y = t.getFullYear()
    const m = String(t.getMonth() + 1).padStart(2, '0')
    const d = String(t.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function isBookingToday(bookingDate: string, day: string): boolean {
    return bookingDate.startsWith(day) || bookingDate.slice(0, 10) === day
}

function aggregateBookingSegments(bookings: Booking[]): { name: string; value: number }[] {
    const map = new Map<string, number>()
    for (const b of bookings) {
        const label = bookingStatusLabelVi(b.status)
        map.set(label, (map.get(label) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
}

const FETCH_KEYS = [
    'Doanh thu ngày',
    'Doanh thu tháng',
    'Doanh thu tuần',
    'Lịch hẹn',
    'Thanh toán gần đây',
    'Thanh toán chờ',
    'Gói đăng ký',
] as const

export const ClinicOwnerDashboardPage = () => {
    const { user } = useAuthStore()
    const { clinics, getMyClinics, isLoading: clinicsLoading } = useClinicStore()

    const [dayRevenue, setDayRevenue] = useState<number | null>(null)
    const [monthRevenue, setMonthRevenue] = useState<number | null>(null)
    const [bookingsToday, setBookingsToday] = useState<number | null>(null)
    const [completedToday, setCompletedToday] = useState<number | null>(null)
    const [recentPayments, setRecentPayments] = useState<ClinicPaymentItem[]>([])
    const [pendingPaymentsCount, setPendingPaymentsCount] = useState<number | null>(null)
    const [revenueWeekLabels, setRevenueWeekLabels] = useState<string[]>([])
    const [revenueWeekValues, setRevenueWeekValues] = useState<number[]>([])
    const [revenueMonthLabels, setRevenueMonthLabels] = useState<string[]>([])
    const [revenueMonthValues, setRevenueMonthValues] = useState<number[]>([])
    const [bookingSegments, setBookingSegments] = useState<{ name: string; value: number }[]>([])
    const [subscriptionSummary, setSubscriptionSummary] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [partialWarnings, setPartialWarnings] = useState<string[]>([])
    const [revenueChartPeriod, setRevenueChartPeriod] = useState<'WEEK' | 'MONTH'>('WEEK')

    const clinic = clinics[0] ?? null
    const clinicId = clinic?.clinicId

    const ratingLabel = useMemo(() => {
        if (!clinic) return '—'
        const avg = clinic.ratingAvg
        const cnt = clinic.ratingCount
        if (!cnt) return 'Chưa có'
        return `${avg.toFixed(1)} / 5`
    }, [clinic])

    const revenueLabels = revenueChartPeriod === 'WEEK' ? revenueWeekLabels : revenueMonthLabels
    const revenueValues = revenueChartPeriod === 'WEEK' ? revenueWeekValues : revenueMonthValues
    const revenueTitle = revenueChartPeriod === 'WEEK' ? 'Doanh thu (tuần)' : 'Doanh thu (tháng)'

    const loadMetrics = useCallback(async () => {
        if (!clinicId) return
        setLoading(true)
        setPartialWarnings([])
        const day = todayIsoDate()

        const settled = await Promise.allSettled([
            getClinicRevenueSummary(clinicId, 'DAY'),
            getClinicRevenueSummary(clinicId, 'MONTH'),
            getClinicRevenueSummary(clinicId, 'WEEK'),
            getBookingsByClinic(clinicId, undefined, undefined, 0, 500),
            getClinicPayments(clinicId, 8, 'PAID'),
            getClinicPayments(clinicId, 100, 'PENDING'),
            subscriptionService.getClinicSubscriptionStatus(clinicId),
        ])

        const w: string[] = []
        settled.forEach((r, i) => {
            if (r.status === 'rejected') w.push(FETCH_KEYS[i])
        })
        setPartialWarnings(w)

        const dayRes = settled[0].status === 'fulfilled' ? settled[0].value : null
        const monthRes = settled[1].status === 'fulfilled' ? settled[1].value : null
        const weekRes = settled[2].status === 'fulfilled' ? settled[2].value : null
        const bookingsPage = settled[3].status === 'fulfilled' ? settled[3].value : null
        const payRes = settled[4].status === 'fulfilled' ? settled[4].value : null
        const payPending = settled[5].status === 'fulfilled' ? settled[5].value : null
        const subStatus = settled[6].status === 'fulfilled' ? settled[6].value : null

        const sumItems = (items: { total?: number | string }[]) =>
            items.reduce((s, i) => s + (Number(i.total) || 0), 0)
        if (dayRes?.items) setDayRevenue(sumItems(dayRes.items))
        else setDayRevenue(null)
        if (monthRes?.items) setMonthRevenue(sumItems(monthRes.items))
        else setMonthRevenue(null)

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
            const todayList = list.filter((b) => isBookingToday(b.bookingDate, day))
            setBookingsToday(todayList.length)
            setCompletedToday(todayList.filter((b) => b.status === 'COMPLETED').length)
            setBookingSegments(aggregateBookingSegments(list))
        } else {
            setBookingsToday(null)
            setCompletedToday(null)
            setBookingSegments([])
        }

        if (payRes) setRecentPayments(payRes.payments?.slice(0, 5) || [])
        else setRecentPayments([])

        if (payPending?.payments) setPendingPaymentsCount(payPending.payments.length)
        else setPendingPaymentsCount(null)

        if (subStatus) {
            if (subStatus.pending)
                setSubscriptionSummary(
                    `Chờ thanh toán${subStatus.pending.plan?.name ? ` — ${subStatus.pending.plan.name}` : ''}`
                )
            else if (subStatus.active)
                setSubscriptionSummary(`Đang hiệu lực — ${subStatus.active.plan?.name ?? 'gói'}`)
            else setSubscriptionSummary('Chưa có gói đang dùng')
        } else {
            setSubscriptionSummary(null)
        }

        setLoading(false)
    }, [clinicId])

    useEffect(() => {
        getMyClinics()
    }, [getMyClinics])

    useEffect(() => {
        if (clinicId) loadMetrics()
    }, [clinicId, loadMetrics])

    const activeServices = clinic?.services?.length ?? null

    return (
        <div className="p-6 bg-stone-50 min-h-screen">
            <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900">Tổng quan phòng khám</h1>
                    <p className="text-stone-600 mt-1">Xin chào, {user?.fullName || 'Chủ phòng khám'}</p>
                    {clinic && (
                        <p className="text-sm font-bold text-stone-800 mt-2 border-2 border-stone-900 inline-block px-3 py-1 bg-amber-100">
                            {clinic.name}
                        </p>
                    )}
                </div>
                <Link
                    to={clinicId ? `${ROUTES.clinicOwner.clinics}/${clinicId}` : ROUTES.clinicOwner.clinics}
                    className={`text-sm font-bold uppercase border-2 border-stone-900 px-4 py-2 shadow-[3px_3px_0_#1c1917] bg-white ${!clinicId ? 'pointer-events-none opacity-50' : 'hover:translate-x-[-2px] hover:translate-y-[-2px]'}`}
                >
                    Chi tiết phòng khám
                </Link>
            </header>

            {clinicsLoading && <p className="text-stone-600 mb-4">Đang tải phòng khám…</p>}
            {!clinicsLoading && !clinic && (
                <div className="border-4 border-stone-900 bg-white p-6 shadow-brutal">
                    <p className="font-bold text-stone-800">Chưa có phòng khám.</p>
                    <Link to={ROUTES.clinicOwner.clinics} className="inline-block mt-4 btn-brutal text-sm uppercase font-bold">
                        Đăng ký phòng khám
                    </Link>
                </div>
            )}

            {partialWarnings.length > 0 && (
                <div
                    className="mb-4 border-2 border-amber-800 bg-amber-50 px-4 py-3 text-sm font-bold text-stone-800 shadow-[3px_3px_0_#1c1917]"
                    role="status"
                >
                    Dữ liệu không đầy đủ: không tải được {partialWarnings.join(', ')}.
                </div>
            )}

            {clinicId && (
                <>
                    <DashboardSection title="Hôm nay">
                        <DashboardStatsGrid>
                            <DashboardCard
                                title="Doanh thu hôm nay"
                                value={loading ? '…' : formatVnd(dayRevenue ?? 0)}
                                subtitle="Theo ngày"
                            />
                            <DashboardCard
                                title="Lịch hẹn hôm nay"
                                value={loading ? '…' : bookingsToday ?? '—'}
                                subtitle="Tổng trong ngày"
                            />
                            <DashboardCard
                                title="Hoàn thành hôm nay"
                                value={loading ? '…' : completedToday ?? '—'}
                                subtitle="Lịch hẹn"
                            />
                            <DashboardCard
                                title="Thanh toán chờ"
                                value={loading ? '…' : pendingPaymentsCount ?? '—'}
                                subtitle="Bản ghi chờ thanh toán"
                            />
                        </DashboardStatsGrid>
                    </DashboardSection>

                    <DashboardSection title="Biểu đồ">
                        <div className="flex flex-wrap gap-2 mb-4">
                            <button
                                type="button"
                                onClick={() => setRevenueChartPeriod('WEEK')}
                                className={`text-xs font-bold uppercase px-3 py-1 border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] ${
                                    revenueChartPeriod === 'WEEK' ? 'bg-amber-200' : 'bg-white'
                                }`}
                            >
                                Tuần
                            </button>
                            <button
                                type="button"
                                onClick={() => setRevenueChartPeriod('MONTH')}
                                className={`text-xs font-bold uppercase px-3 py-1 border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] ${
                                    revenueChartPeriod === 'MONTH' ? 'bg-amber-200' : 'bg-white'
                                }`}
                            >
                                Tháng
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

                    <DashboardSection title="Thông tin phòng khám">
                        <DashboardStatsGrid>
                            <DashboardCard
                                title="Dịch vụ"
                                value={activeServices === null ? '—' : activeServices}
                                subtitle="Đang hoạt động (dữ liệu đã tải)"
                            />
                            <DashboardCard
                                title="Điểm đánh giá TB"
                                value={ratingLabel}
                                subtitle={`${clinic?.ratingCount ?? 0} đánh giá`}
                            />
                            <DashboardCard
                                title="Doanh thu tháng"
                                value={loading ? '…' : formatVnd(monthRevenue ?? 0)}
                                subtitle="Theo tháng"
                            />
                            <DashboardCard
                                title="Gói đăng ký"
                                value={loading ? '…' : subscriptionSummary ?? '—'}
                                subtitle="Gói phòng khám"
                            />
                        </DashboardStatsGrid>
                    </DashboardSection>

                    <DashboardSection
                        title="Doanh thu tháng (tóm tắt)"
                        action={
                            <Link
                                to="/clinic-owner/revenue"
                                className="text-sm font-bold uppercase text-amber-800 border-2 border-stone-900 px-3 py-1 bg-white shadow-[2px_2px_0_#1c1917]"
                            >
                                Chi tiết doanh thu
                            </Link>
                        }
                    >
                        <div className="bg-white border-4 border-stone-900 shadow-brutal p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">Tổng doanh thu (tháng)</p>
                                    <p className="text-2xl font-bold text-stone-900">{loading ? '…' : formatVnd(monthRevenue ?? 0)}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">Lịch hẹn hôm nay</p>
                                    <p className="text-2xl font-bold text-stone-900">{loading ? '…' : bookingsToday ?? '—'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">Hoàn thành hôm nay</p>
                                    <p className="text-2xl font-bold text-stone-900">{loading ? '…' : completedToday ?? '—'}</p>
                                </div>
                            </div>
                        </div>
                    </DashboardSection>

                    <DashboardSection title="Thanh toán gần đây">
                        <div className="bg-white border-4 border-stone-900 shadow-brutal overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="border-b-4 border-stone-900 bg-stone-100">
                                    <tr>
                                        <th className="p-3 text-xs font-bold uppercase">Mã</th>
                                        <th className="p-3 text-xs font-bold uppercase">Số tiền</th>
                                        <th className="p-3 text-xs font-bold uppercase">Thời gian</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentPayments.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={3} className="p-6 text-center text-stone-600">
                                                Chưa có giao dịch
                                            </td>
                                        </tr>
                                    )}
                                    {recentPayments.map((p) => (
                                        <tr key={p.paymentId} className="border-b-2 border-stone-200">
                                            <td className="p-3 font-mono text-sm">{p.bookingCode}</td>
                                            <td className="p-3 font-bold">{formatVnd(p.amount)}</td>
                                            <td className="p-3 text-sm text-stone-600">
                                                {p.paidAt
                                                    ? new Date(p.paidAt).toLocaleString('vi-VN')
                                                    : new Date(p.createdAt).toLocaleString('vi-VN')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </DashboardSection>

                    <DashboardSection title="Liên kết nhanh">
                        <div className="flex flex-wrap gap-3">
                            <Link
                                to="/clinic-owner/services"
                                className="inline-block px-4 py-3 font-bold uppercase text-sm border-4 border-stone-900 bg-white shadow-[4px_4px_0_#1c1917]"
                            >
                                Dịch vụ
                            </Link>
                            <Link
                                to="/clinic-owner/staff"
                                className="inline-block px-4 py-3 font-bold uppercase text-sm border-4 border-stone-900 bg-amber-50 shadow-[4px_4px_0_#1c1917]"
                            >
                                Nhân viên
                            </Link>
                            <Link
                                to="/clinic-owner/notifications"
                                className="inline-block px-4 py-3 font-bold uppercase text-sm border-4 border-stone-900 bg-white shadow-[4px_4px_0_#1c1917]"
                            >
                                Thông báo
                            </Link>
                        </div>
                    </DashboardSection>
                </>
            )}
        </div>
    )
}

export default ClinicOwnerDashboardPage
