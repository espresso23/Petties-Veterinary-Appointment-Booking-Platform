import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { DashboardCard, DashboardStatsGrid, DashboardSection } from '../../components/dashboard/DashboardCard'
import { StaffWorkloadDonut } from '../../components/clinic/StaffWorkloadDonut'
import { getStaffHomeSummary, getBookingsByStaff } from '../../services/bookingService'
import { notificationService } from '../../services/api/notificationService'
import { chatService } from '../../services/api/chatService'
import { bookingStatusLabelEn } from '../../utils/bookingStatusDisplayEn'
import type { UpcomingBookingDTO, Booking } from '../../types/booking'
import {
    CalendarDaysIcon,
    ClockIcon,
    PlayCircleIcon,
    QueueListIcon,
    BuildingOfficeIcon,
    BellAlertIcon,
    ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'
import '../../styles/brutalist.css'

const FETCH_KEYS = ['Home summary', 'Notifications', 'Chat unread', 'Staff bookings'] as const

export const StaffDashboardPage = () => {
    const { user } = useAuthStore()
    const staffId = user?.userId

    const [loading, setLoading] = useState(true)
    const [partialWarnings, setPartialWarnings] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)
    const [todayCount, setTodayCount] = useState(0)
    const [pendingCount, setPendingCount] = useState(0)
    const [inProgressCount, setInProgressCount] = useState(0)
    const [upcoming, setUpcoming] = useState<UpcomingBookingDTO[]>([])
    const [unreadNotifications, setUnreadNotifications] = useState<number | null>(null)
    const [chatUnread, setChatUnread] = useState<number | null>(null)
    const [staffBookings, setStaffBookings] = useState<Booking[]>([])

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        setPartialWarnings([])

        const settled = await Promise.allSettled([
            getStaffHomeSummary(),
            notificationService.getUnreadCount(),
            chatService.getUnreadCount(),
            staffId
                ? getBookingsByStaff(staffId, undefined, 0, 10)
                : Promise.resolve({
                      content: [] as Booking[],
                      totalElements: 0,
                      totalPages: 0,
                      size: 10,
                      number: 0,
                  }),
        ])

        const w: string[] = []
        settled.forEach((r, i) => {
            if (r.status === 'rejected') w.push(FETCH_KEYS[i])
        })
        setPartialWarnings(w)

        const home = settled[0].status === 'fulfilled' ? settled[0].value : null
        const notif = settled[1].status === 'fulfilled' ? settled[1].value : null
        const chat = settled[2].status === 'fulfilled' ? settled[2].value : null
        const bookingsPage = settled[3].status === 'fulfilled' ? settled[3].value : null

        if (home) {
            setTodayCount(home.todayBookingsCount ?? 0)
            setPendingCount(home.pendingCount ?? 0)
            setInProgressCount(home.inProgressCount ?? 0)
            setUpcoming(home.upcomingBookings ?? [])
            setError(null)
        } else {
            setTodayCount(0)
            setPendingCount(0)
            setInProgressCount(0)
            setUpcoming([])
            setError('Could not load overview. Please try again.')
        }

        if (typeof notif === 'number') setUnreadNotifications(notif)
        else setUnreadNotifications(null)

        if (chat) setChatUnread(chat.totalUnreadMessages ?? chat.totalUnreadConversations ?? 0)
        else setChatUnread(null)

        if (bookingsPage?.content) setStaffBookings(bookingsPage.content)
        else setStaffBookings([])

        setLoading(false)
    }, [staffId])

    useEffect(() => {
        void load()
    }, [load])

    const upcomingCount = upcoming.length

    return (
        <div className="p-6 md:p-8 bg-stone-50 min-h-screen">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-stone-900">Staff dashboard</h1>
                <p className="text-stone-600 mt-1">
                    Welcome, <span className="font-bold text-amber-700">{user?.fullName || 'Staff'}</span>
                </p>
                {user?.workingClinicName && (
                    <div className="flex items-center gap-2 mt-2 text-stone-600">
                        <BuildingOfficeIcon className="w-5 h-5 text-stone-900" aria-hidden />
                        <span>
                            Clinic: <span className="font-bold text-stone-900">{user.workingClinicName}</span>
                        </span>
                    </div>
                )}
            </header>

            {error && (
                <p className="mb-4 text-red-700 font-bold border-2 border-red-800 bg-red-50 px-4 py-2 shadow-[3px_3px_0_#1c1917]">
                    {error}
                </p>
            )}

            {partialWarnings.length > 0 && (
                <div
                    className="mb-4 border-2 border-amber-800 bg-amber-50 px-4 py-3 text-sm font-bold text-stone-800 shadow-[3px_3px_0_#1c1917]"
                    role="status"
                >
                    Partial data: could not load {partialWarnings.join(', ')}.
                </div>
            )}

            <DashboardSection title="Work overview">
                <DashboardStatsGrid>
                    <DashboardCard
                        title="Today"
                        value={loading ? '…' : todayCount}
                        subtitle="Assigned bookings today"
                        icon={<CalendarDaysIcon className="w-6 h-6 text-stone-900" />}
                    />
                    <DashboardCard
                        title="Awaiting intake"
                        value={loading ? '…' : pendingCount}
                        subtitle="Confirmed, awaiting check-in"
                        icon={<ClockIcon className="w-6 h-6 text-stone-900" />}
                    />
                    <DashboardCard
                        title="In progress"
                        value={loading ? '…' : inProgressCount}
                        subtitle="In session"
                        icon={<PlayCircleIcon className="w-6 h-6 text-stone-900" />}
                    />
                    <DashboardCard
                        title="Upcoming"
                        value={loading ? '…' : upcomingCount}
                        subtitle="Slots in list"
                        icon={<QueueListIcon className="w-6 h-6 text-stone-900" />}
                    />
                </DashboardStatsGrid>
            </DashboardSection>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <StaffWorkloadDonut
                    todayCount={todayCount}
                    pendingCount={pendingCount}
                    inProgressCount={inProgressCount}
                    upcomingCount={upcomingCount}
                    loading={loading}
                />

                <div className="border-4 border-stone-900 bg-white p-6 shadow-brutal">
                    <h2 className="text-lg font-bold text-stone-900 mb-4">Alerts</h2>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 p-4 border-2 border-stone-900 bg-stone-50 shadow-[2px_2px_0_#1c1917]">
                            <BellAlertIcon className="w-8 h-8 text-stone-900 shrink-0" aria-hidden />
                            <div>
                                <p className="text-xs font-bold uppercase text-stone-500">Unread notifications</p>
                                <p className="text-2xl font-bold text-stone-900">{loading ? '…' : unreadNotifications ?? '—'}</p>
                                <Link
                                    to="/staff/notifications"
                                    className="text-sm font-bold text-amber-800 underline underline-offset-2 mt-1 inline-block"
                                >
                                    Open notifications
                                </Link>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-4 border-2 border-stone-900 bg-amber-50 shadow-[2px_2px_0_#1c1917]">
                            <ChatBubbleLeftRightIcon className="w-8 h-8 text-stone-900 shrink-0" aria-hidden />
                            <div>
                                <p className="text-xs font-bold uppercase text-stone-500">Chat unread</p>
                                <p className="text-2xl font-bold text-stone-900">{loading ? '…' : chatUnread ?? '—'}</p>
                                <Link
                                    to="/staff/bookings"
                                    className="text-sm font-bold text-amber-800 underline underline-offset-2 mt-1 inline-block"
                                >
                                    Open bookings
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="border-4 border-stone-900 bg-white p-6 shadow-brutal transition-all duration-200 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_#1c1917]">
                    <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
                        <h2 className="text-lg font-bold text-stone-900">Upcoming</h2>
                        <Link to="/staff/bookings" className="btn-brutal-sm text-xs px-3 py-2 font-bold uppercase inline-block">
                            View all
                        </Link>
                    </div>

                    {loading && <p className="text-stone-500">Loading…</p>}

                    {!loading && upcoming.length === 0 && (
                        <p className="text-stone-600 text-center py-8 border-2 border-dashed border-stone-300">No upcoming appointments</p>
                    )}

                    {!loading && upcoming.length > 0 && (
                        <ul className="space-y-3">
                            {upcoming.map((b) => (
                                <li
                                    key={b.bookingId}
                                    className="p-4 bg-stone-50 border-2 border-stone-900 shadow-[2px_2px_0_#1c1917]"
                                >
                                    <div className="flex justify-between gap-2 flex-wrap">
                                        <span className="font-mono text-sm font-bold">{b.bookingCode}</span>
                                        <span className="text-xs font-bold uppercase bg-amber-100 border border-stone-900 px-2 py-0.5">
                                            {bookingStatusLabelEn(b.status)}
                                        </span>
                                    </div>
                                    <p className="font-bold text-stone-900 mt-1">
                                        {b.petName || 'Pet'} — {b.ownerName || 'Owner'}
                                    </p>
                                    <p className="text-sm text-stone-600 mt-1">
                                        {new Date(b.bookingDate).toLocaleDateString('en-US')} {b.bookingTime?.slice(0, 5) || ''}
                                        {b.primaryServiceName ? ` · ${b.primaryServiceName}` : ''}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="border-4 border-stone-900 bg-white p-6 shadow-brutal">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                        <h2 className="text-lg font-bold text-stone-900">Your bookings (paged)</h2>
                        <Link to="/staff/bookings" className="btn-brutal-sm text-xs px-3 py-2 font-bold uppercase inline-block">
                            View all
                        </Link>
                    </div>
                    {!staffId && <p className="text-stone-600 text-sm">Sign in again to load assigned bookings list.</p>}
                    {staffId && loading && <p className="text-stone-500">Loading…</p>}
                    {staffId && !loading && staffBookings.length === 0 && (
                        <p className="text-stone-600 text-center py-6 border-2 border-dashed border-stone-300">No bookings in this list</p>
                    )}
                    {staffId && !loading && staffBookings.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b-2 border-stone-900 bg-stone-100">
                                    <tr>
                                        <th className="p-2 text-xs font-bold uppercase">Code</th>
                                        <th className="p-2 text-xs font-bold uppercase">Date</th>
                                        <th className="p-2 text-xs font-bold uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffBookings.map((b) => (
                                        <tr key={b.bookingId} className="border-b border-stone-200">
                                            <td className="p-2 font-mono font-bold">{b.bookingCode}</td>
                                            <td className="p-2">
                                                {new Date(b.bookingDate).toLocaleDateString('en-US')} {b.bookingTime?.slice(0, 5)}
                                            </td>
                                            <td className="p-2 font-bold">{bookingStatusLabelEn(b.status)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <DashboardSection title="Quick links">
                <div className="flex flex-wrap gap-3">
                    <Link
                        to="/staff/schedule"
                        className="inline-block px-4 py-3 font-bold uppercase text-sm border-4 border-stone-900 bg-white shadow-[4px_4px_0_#1c1917]"
                    >
                        Schedule
                    </Link>
                    <Link
                        to="/staff/patients"
                        className="inline-block px-4 py-3 font-bold uppercase text-sm border-4 border-stone-900 bg-amber-50 shadow-[4px_4px_0_#1c1917]"
                    >
                        Patients
                    </Link>
                    <Link
                        to="/staff/ai-chat"
                        className="inline-block px-4 py-3 font-bold uppercase text-sm border-4 border-stone-900 bg-white shadow-[4px_4px_0_#1c1917]"
                    >
                        AI assistant
                    </Link>
                </div>
            </DashboardSection>
        </div>
    )
}

export default StaffDashboardPage
