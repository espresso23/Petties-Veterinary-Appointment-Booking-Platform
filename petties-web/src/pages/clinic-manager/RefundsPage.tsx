import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import {
    getMyClinicPayments,
    getClinicRevenueSummary,
    type ClinicPaymentItem,
    type RevenueSummaryItem,
} from '../../services/paymentService';
import { PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../../types/booking';
import {
    CurrencyDollarIcon,
    FunnelIcon,
    TableCellsIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import '../../styles/brutalist.css';

const BOOKING_STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: 'Tất cả trạng thái booking' },
    { value: 'PENDING', label: 'Chờ xác nhận' },
    { value: 'CONFIRMED', label: 'Đã xác nhận' },
    { value: 'IN_PROGRESS', label: 'Đang khám' },
    { value: 'COMPLETED', label: 'Hoàn thành' },
    { value: 'CANCELLED', label: 'Đã hủy' },
    { value: 'NO_SHOW', label: 'Khách không đến' },
];

const PAYMENT_STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: 'Tất cả trạng thái thanh toán' },
    { value: 'PENDING', label: 'Chờ thanh toán' },
    { value: 'PAID', label: 'Đã thanh toán' },
    { value: 'REFUNDED', label: 'Đã hoàn tiền' },
    { value: 'FAILED', label: 'Thất bại' },
];

const PERIOD_OPTIONS: { value: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'; label: string }[] = [
    { value: 'DAY', label: 'Theo ngày' },
    { value: 'WEEK', label: 'Theo tuần' },
    { value: 'MONTH', label: 'Theo tháng' },
    { value: 'YEAR', label: 'Theo năm' },
];

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
    }).format(amount);
}

function formatDateTime(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
}

/**
 * Refunds / Transactions page - Clinic Manager
 * Xem tất cả giao dịch của phòng khám, filter theo trạng thái booking/thanh toán, bảng tổng doanh thu theo kỳ.
 */
export const RefundsPage = () => {
    const { user } = useAuthStore();
    const [payments, setPayments] = useState<ClinicPaymentItem[]>([]);
    const [revenueItems, setRevenueItems] = useState<RevenueSummaryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [revenueLoading, setRevenueLoading] = useState(true);
    const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
    const [bookingStatusFilter, setBookingStatusFilter] = useState('');
    const [period, setPeriod] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR'>('MONTH');
    const [clinicName, setClinicName] = useState('');

    const clinicId = user?.workingClinicId;

    const fetchPayments = useCallback(async () => {
        if (!clinicId) return;
        setLoading(true);
        try {
            const res = await getMyClinicPayments(
                200,
                paymentStatusFilter || undefined,
                bookingStatusFilter ? [bookingStatusFilter] : undefined
            );
            setPayments(res.payments || []);
            setClinicName(res.clinicName || '');
        } catch (e) {
            console.error('Failed to fetch payments:', e);
            setPayments([]);
        } finally {
            setLoading(false);
        }
    }, [clinicId, paymentStatusFilter, bookingStatusFilter]);

    const fetchRevenue = useCallback(async () => {
        if (!clinicId) return;
        setRevenueLoading(true);
        try {
            const res = await getClinicRevenueSummary(clinicId, period);
            setRevenueItems(res.items || []);
        } catch (e) {
            console.error('Failed to fetch revenue:', e);
            setRevenueItems([]);
        } finally {
            setRevenueLoading(false);
        }
    }, [clinicId, period]);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    useEffect(() => {
        fetchRevenue();
    }, [fetchRevenue]);

    const revenueChartCategories = useMemo(
        () => revenueItems.slice().reverse().map((item) => item.label),
        [revenueItems]
    );

    const revenueChartData = useMemo(
        () => revenueItems.slice().reverse().map((item) => item.total),
        [revenueItems]
    );

    const revenueChartOptions: ApexOptions = useMemo(
        () => ({
            chart: {
                type: 'bar',
                toolbar: { show: false },
                foreColor: '#1c1917',
                fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            },
            colors: ['#d97706'],
            plotOptions: {
                bar: {
                    borderRadius: 4,
                    horizontal: false,
                },
            },
            dataLabels: {
                enabled: false,
            },
            grid: {
                borderColor: '#e5e7eb',
            },
            xaxis: {
                categories: revenueChartCategories,
                labels: {
                    style: { colors: '#57534e' },
                },
            },
            yaxis: {
                labels: {
                    formatter: (val) => formatCurrency(Number(val)),
                    style: { colors: '#57534e' },
                },
            },
            tooltip: {
                y: {
                    formatter: (val) => formatCurrency(Number(val)),
                },
            },
            legend: {
                show: false,
            },
        }),
        [revenueChartCategories]
    );

    if (!clinicId) {
        return (
            <div className="p-6">
                <div className="bg-amber-50 border-2 border-amber-500 rounded-xl shadow-[3px_3px_0_#1c1917] p-4">
                    <p className="font-medium text-stone-800">
                        Bạn chưa được gán phòng khám. Vui lòng liên hệ quản trị viên.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Page title */}
            <div className="flex items-center gap-2">
                <CurrencyDollarIcon className="w-8 h-8 text-stone-900" />
                <h1 className="text-2xl font-bold text-stone-900">Hoàn tiền & Giao dịch</h1>
            </div>
            {clinicName && (
                <p className="text-stone-600 text-sm font-medium uppercase">Phòng khám: {clinicName}</p>
            )}

            {/* Revenue summary card */}
            <section
                className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] overflow-hidden transition-all hover:shadow-[6px_6px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5"
                aria-labelledby="revenue-heading"
            >
                <div className="p-4 border-b-2 border-stone-900 flex flex-wrap items-center justify-between gap-4">
                    <h2 id="revenue-heading" className="text-lg font-bold text-stone-900 flex items-center gap-2">
                        <TableCellsIcon className="w-5 h-5" />
                        Tổng doanh thu theo kỳ
                    </h2>
                    <div className="flex items-center gap-2">
                        {PERIOD_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setPeriod(opt.value)}
                                className={
                                    period === opt.value
                                        ? 'px-4 py-2 rounded-lg font-bold uppercase text-sm border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] bg-amber-600 text-white'
                                        : 'px-4 py-2 rounded-lg font-bold uppercase text-sm border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] bg-white text-stone-800 hover:bg-stone-100'
                                }
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-4 overflow-x-auto space-y-4">
                    {revenueLoading ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-stone-500">
                            <ArrowPathIcon className="w-5 h-5 animate-spin" />
                            <span>Đang tải...</span>
                        </div>
                    ) : revenueItems.length === 0 ? (
                        <p className="text-stone-500 py-4">Chưa có dữ liệu doanh thu trong kỳ đã chọn.</p>
                    ) : (
                        <>
                            <div className="bg-stone-50 border-2 border-stone-900 rounded-xl shadow-[3px_3px_0_#1c1917] p-3">
                                <ReactApexChart
                                    options={revenueChartOptions}
                                    series={[{ name: 'Doanh thu', data: revenueChartData }]}
                                    type="bar"
                                    height={280}
                                />
                            </div>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-stone-900">
                                        <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">
                                            Kỳ
                                        </th>
                                        <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2 text-right">
                                            Doanh thu
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {revenueItems.map((item) => (
                                        <tr
                                            key={item.label}
                                            className="border-b border-stone-200 hover:bg-stone-50"
                                        >
                                            <td className="py-3 px-2 font-medium text-stone-900">
                                                {item.label}
                                            </td>
                                            <td className="py-3 px-2 text-right font-bold text-stone-900">
                                                {formatCurrency(item.total)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>
            </section>

            {/* All transactions */}
            <section
                className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] overflow-hidden transition-all hover:shadow-[6px_6px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5"
                aria-labelledby="transactions-heading"
            >
                <div className="p-4 border-b-2 border-stone-900 flex flex-wrap items-center justify-between gap-4">
                    <h2 id="transactions-heading" className="text-lg font-bold text-stone-900 flex items-center gap-2">
                        <FunnelIcon className="w-5 h-5" />
                        Tất cả giao dịch
                    </h2>
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase text-stone-600">Trạng thái thanh toán</span>
                            <select
                                value={paymentStatusFilter}
                                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                                className="border-2 border-stone-900 rounded-lg px-3 py-2 bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium min-w-[180px]"
                            >
                                {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase text-stone-600">Trạng thái booking</span>
                            <select
                                value={bookingStatusFilter}
                                onChange={(e) => setBookingStatusFilter(e.target.value)}
                                className="border-2 border-stone-900 rounded-lg px-3 py-2 bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium min-w-[180px]"
                            >
                                {BOOKING_STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            type="button"
                            onClick={() => {
                                setPaymentStatusFilter('');
                                setBookingStatusFilter('');
                            }}
                            className="px-4 py-2 rounded-lg font-bold uppercase text-sm border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] bg-white text-stone-800 hover:bg-stone-100 hover:shadow-[5px_5px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
                        >
                            Xóa bộ lọc
                        </button>
                    </div>
                </div>
                <div className="p-4 overflow-x-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-stone-500">
                            <ArrowPathIcon className="w-5 h-5 animate-spin" />
                            <span>Đang tải...</span>
                        </div>
                    ) : payments.length === 0 ? (
                        <p className="text-stone-500 py-4">Không có giao dịch nào phù hợp bộ lọc.</p>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-stone-900">
                                    <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Mã đơn</th>
                                    <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Khách hàng</th>
                                    <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Số tiền</th>
                                    <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">PT thanh toán</th>
                                    <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Trạng thái TT</th>
                                    <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Trạng thái booking</th>
                                    <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Ngày tạo</th>
                                    <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Thanh toán lúc</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((p) => (
                                    <tr
                                        key={p.paymentId}
                                        className="border-b border-stone-200 hover:bg-stone-50"
                                    >
                                        <td className="py-3 px-2 font-mono text-sm font-medium text-stone-900">
                                            {p.bookingCode}
                                        </td>
                                        <td className="py-3 px-2 text-stone-700">{p.petOwnerName ?? '—'}</td>
                                        <td className="py-3 px-2 font-bold text-stone-900">
                                            {formatCurrency(p.amount)}
                                        </td>
                                        <td className="py-3 px-2 text-stone-700">
                                            {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                                        </td>
                                        <td className="py-3 px-2">
                                            <span
                                                className="inline-block px-2 py-1 rounded-full text-xs font-bold border-2 border-stone-900"
                                                style={{
                                                    backgroundColor: PAYMENT_STATUS_LABELS[p.status]?.color
                                                        ? `${PAYMENT_STATUS_LABELS[p.status].color}40`
                                                        : '#f5f5f4',
                                                    borderColor: PAYMENT_STATUS_LABELS[p.status]?.color ?? '#1c1917',
                                                }}
                                            >
                                                {PAYMENT_STATUS_LABELS[p.status]?.label ?? p.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-stone-700">{p.bookingStatus ?? '—'}</td>
                                        <td className="py-3 px-2 text-stone-600 text-sm">
                                            {formatDateTime(p.createdAt)}
                                        </td>
                                        <td className="py-3 px-2 text-stone-600 text-sm">
                                            {formatDateTime(p.paidAt)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </section>
        </div>
    );
};

export default RefundsPage;
