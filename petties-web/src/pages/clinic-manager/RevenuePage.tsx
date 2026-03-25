import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import {
    getClinicRevenueBreakdown,
    getBalanceFluctuation,
    getMyClinicPayments,
    getClinicRevenueSummary,
    type RevenueBreakdownResponse,
    type BalanceFluctuationItem,
    type ClinicPaymentItem,
    type RevenueSummaryItem,
} from '../../services/paymentService';
import { PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../../types/booking';
import {
    BanknotesIcon,
    QrCodeIcon,
    ArrowPathIcon,
    ChevronLeftIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    FunnelIcon,
    TableCellsIcon,
    CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import '../../styles/brutalist.css';

type ViewMode = 'before_deduction' | 'after_deduction';

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
    return d.toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export const RevenuePage = () => {
    const { user } = useAuthStore();
    const clinicId = user?.workingClinicId;

    // --- REVENUE BREAKDOWN STATE ---
    const [breakdownLoading, setBreakdownLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [breakdown, setBreakdown] = useState<RevenueBreakdownResponse | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('before_deduction');

    // --- CALCULATED REVENUE FIELDS ---
    const rawTotalRevenue = breakdown?.totalRevenue || 0;
    const qrRevenue = breakdown?.qrRevenue || 0;
    const cashRevenue = breakdown?.cashRevenue || 0;
    const qrPlatformFee = qrRevenue * 0.05;
    const cashPlatformFee = cashRevenue * 0.05;
    const qrWithdrawable = qrRevenue * 0.95;
    const cashNetRevenue = cashRevenue * 0.95;
    const netTotal = rawTotalRevenue * 0.95;


    // --- BALANCE FLUCTUATION STATE ---
    const [showFluctuation, setShowFluctuation] = useState(false);
    const [fluctuationMethod, setFluctuationMethod] = useState<'QR' | 'CASH'>('QR');
    const [fluctuationItems, setFluctuationItems] = useState<BalanceFluctuationItem[]>([]);
    const [fluctuationLoading, setFluctuationLoading] = useState(false);

    // --- OLD REFUNDS functionality state ---
    const [payments, setPayments] = useState<ClinicPaymentItem[]>([]);
    const [revenueItems, setRevenueItems] = useState<RevenueSummaryItem[]>([]);
    const [paymentsLoading, setPaymentsLoading] = useState(true);
    const [revenueSummaryLoading, setRevenueSummaryLoading] = useState(true);
    const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
    const [bookingStatusFilter, setBookingStatusFilter] = useState('');
    const [period, setPeriod] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR'>('MONTH');

    // --- FETCHES ---
    const fetchBreakdown = useCallback(async () => {
        if (!clinicId) return;
        setBreakdownLoading(true);
        setError(null);
        try {
            const data = await getClinicRevenueBreakdown(clinicId);
            setBreakdown(data);
        } catch (err) {
            console.error('Failed to fetch revenue breakdown:', err);
            setError('Không thể tải dữ liệu doanh thu. Vui lòng thử lại.');
        } finally {
            setBreakdownLoading(false);
        }
    }, [clinicId]);

    const handleShowFluctuation = async (method: 'QR' | 'CASH') => {
        if (!clinicId) return;
        setFluctuationMethod(method);
        setShowFluctuation(true);
        setFluctuationLoading(true);
        try {
            const data = await getBalanceFluctuation(clinicId, method, 100);
            setFluctuationItems(data.items || []);
        } catch (err) {
            console.error('Failed to fetch balance fluctuation:', err);
            setFluctuationItems([]);
        } finally {
            setFluctuationLoading(false);
        }
    };

    const fetchPayments = useCallback(async () => {
        if (!clinicId) return;
        setPaymentsLoading(true);
        try {
            const res = await getMyClinicPayments(
                200,
                paymentStatusFilter || undefined,
                bookingStatusFilter ? [bookingStatusFilter] : undefined
            );
            setPayments(res.payments || []);
        } catch (e) {
            console.error('Failed to fetch payments:', e);
            setPayments([]);
        } finally {
            setPaymentsLoading(false);
        }
    }, [clinicId, paymentStatusFilter, bookingStatusFilter]);

    const fetchRevenueSummary = useCallback(async () => {
        if (!clinicId) return;
        setRevenueSummaryLoading(true);
        try {
            const res = await getClinicRevenueSummary(clinicId, period);
            setRevenueItems(res.items || []);
        } catch (e) {
            console.error('Failed to fetch revenue chart:', e);
            setRevenueItems([]);
        } finally {
            setRevenueSummaryLoading(false);
        }
    }, [clinicId, period]);

    useEffect(() => {
        fetchBreakdown();
        fetchPayments();
    }, [fetchBreakdown, fetchPayments]);

    useEffect(() => {
        fetchRevenueSummary();
    }, [fetchRevenueSummary]);

    // --- CHART DATA ---
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
            plotOptions: { bar: { borderRadius: 4, horizontal: false } },
            dataLabels: { enabled: false },
            grid: { borderColor: '#e5e7eb' },
            xaxis: {
                categories: revenueChartCategories,
                labels: { style: { colors: '#57534e' } },
            },
            yaxis: {
                labels: {
                    formatter: (val) => formatCurrency(Number(val)),
                    style: { colors: '#57534e' },
                },
            },
            tooltip: {
                y: { formatter: (val) => formatCurrency(Number(val)) },
            },
            legend: { show: false },
        }),
        [revenueChartCategories]
    );

    if (!clinicId) {
        return (
            <div className="p-6 bg-stone-50 min-h-screen flex items-center justify-center">
                <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-8 text-center">
                    <p className="text-stone-600 font-medium">Bạn chưa được gán phòng khám nào.</p>
                </div>
            </div>
        );
    }

    // --- RENDER FLUCTUATION VIEW ---
    if (showFluctuation) {
        return (
            <div className="p-6 bg-stone-50 min-h-screen">
                <header className="mb-6">
                    <button
                        onClick={() => setShowFluctuation(false)}
                        className="inline-flex items-center gap-2 px-4 py-2 mb-4 bg-white border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-[5px_5px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 font-bold text-sm uppercase transition-all"
                    >
                        <ChevronLeftIcon className="w-4 h-4" />
                        Quay lại
                    </button>
                    <h1 className="text-2xl font-bold text-stone-900">
                        Biến động số dư {fluctuationMethod === 'QR' ? '(QR)' : '(Tiền mặt)'}
                    </h1>
                    <p className="text-stone-600 mt-1">
                        Chi tiết doanh thu từng booking theo phương thức {fluctuationMethod === 'QR' ? 'QR' : 'tiền mặt'}
                    </p>
                </header>

                <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917]">
                    {fluctuationLoading ? (
                        <div className="p-8 text-center text-stone-500 font-medium">Đang tải dữ liệu...</div>
                    ) : fluctuationItems.length === 0 ? (
                        <div className="p-8 text-center text-stone-500 font-medium">Chưa có giao dịch nào</div>
                    ) : (
                        <div className="divide-y-2 divide-stone-200">
                            {fluctuationItems.map((item) => (
                                <div key={item.paymentId} className="p-5 hover:bg-amber-50/50 transition-colors">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <span className="font-mono font-bold text-sm text-stone-900">{item.bookingCode}</span>
                                            {item.petOwnerName && <span className="ml-3 text-sm text-stone-500">{item.petOwnerName}</span>}
                                        </div>
                                        <span className="text-xs text-stone-400 font-medium">{formatDateTime(item.paidAt)}</span>
                                    </div>
                                    <div className="space-y-1.5 pl-2 border-l-2 border-stone-200">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />
                                                <span className="text-sm font-medium text-stone-600">Thu nhập</span>
                                            </div>
                                            <span className="font-bold text-green-600">+{formatCurrency(item.amount)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
                                                <span className="text-sm font-medium text-stone-600">Phí nền tảng (5%)</span>
                                            </div>
                                            <span className="font-bold text-red-500">-{formatCurrency(item.platformFee)}</span>
                                        </div>
                                        <div className="flex items-center justify-between pt-1.5 border-t border-stone-200">
                                            <span className="text-sm font-bold text-stone-700">Doanh thu sau khấu trừ</span>
                                            <span className="font-bold text-stone-900 text-base">{formatCurrency(item.netAmount)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- RENDER MAIN REVENUE VIEW ---
    return (
        <div className="p-6 bg-stone-50 min-h-screen space-y-8">
            <header className="flex items-center gap-2">
                <CurrencyDollarIcon className="w-8 h-8 text-stone-900" />
                <h1 className="text-2xl font-bold text-stone-900">
                    Doanh thu & Giao dịch
                </h1>
            </header>

            {/* ERROR ALERT */}
            {error && (
                <div className="bg-red-50 border-2 border-red-400 rounded-xl shadow-[3px_3px_0_#ef4444] p-4">
                    <p className="text-red-700 font-medium">{error}</p>
                </div>
            )}

            {/* ===== REVENUE BREAKDOWN SECTION (NEW FEATURE) ===== */}
            <section>
                {/* View Mode Toggle */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <button
                        onClick={() => setViewMode('before_deduction')}
                        className={`px-5 py-2.5 font-bold text-sm uppercase border-2 border-stone-900 rounded-lg transition-all ${viewMode === 'before_deduction'
                            ? 'bg-amber-500 text-stone-900 shadow-[3px_3px_0_#1c1917]'
                            : 'bg-white text-stone-700 hover:bg-stone-50'
                            }`}
                    >
                        Trước khấu trừ
                    </button>
                    <button
                        onClick={() => setViewMode('after_deduction')}
                        className={`px-5 py-2.5 font-bold text-sm uppercase border-2 border-stone-900 rounded-lg transition-all ${viewMode === 'after_deduction'
                            ? 'bg-amber-500 text-stone-900 shadow-[3px_3px_0_#1c1917]'
                            : 'bg-white text-stone-700 hover:bg-stone-50'
                            }`}
                    >
                        Sau khấu trừ tiền duy trì web
                    </button>
                    <button
                        onClick={fetchBreakdown}
                        disabled={breakdownLoading}
                        className="ml-auto px-4 py-2.5 bg-white border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-[5px_5px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                        title="Làm mới dữ liệu"
                    >
                        <ArrowPathIcon className={`w-5 h-5 ${breakdownLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {breakdownLoading ? (
                    <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-12 text-center">
                        <p className="text-stone-500 font-medium">Đang tải biểu đồ doanh thu chi tiết...</p>
                    </div>
                ) : breakdown && (
                    <div className="space-y-6">
                        {/* Total Revenue Card */}
                        <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-6">
                            <h2 className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-2">
                                Tổng doanh thu
                            </h2>
                            <div className="text-3xl font-bold text-stone-900">
                                {formatCurrency(viewMode === 'before_deduction' ? rawTotalRevenue : netTotal)}
                            </div>
                            {viewMode === 'after_deduction' && (
                                <p className="text-sm text-stone-500 mt-1">Đã khấu trừ 5% phí duy trì nền tảng</p>
                            )}
                        </div>

                        {/* QR + CASH Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* ===== QR SECTION ===== */}
                            <div className="bg-blue-50 border-2 border-blue-400 rounded-xl shadow-[4px_4px_0_#4299E1] p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-blue-500 border-2 border-stone-900 rounded-lg flex items-center justify-center shadow-[2px_2px_0_#1c1917]"><QrCodeIcon className="w-5 h-5 text-white" /></div>
                                    <h2 className="font-bold text-lg text-blue-900">Thanh toán QR</h2>
                                </div>
                                <div className="space-y-3">
                                    <div className="bg-white border-2 border-blue-300 rounded-lg p-4">
                                        <span className="text-xs font-bold uppercase tracking-wide text-stone-400">
                                            {viewMode === 'before_deduction' ? 'Doanh thu QR' : 'Doanh thu QR (sau khấu trừ)'}
                                        </span>
                                        <div className="text-2xl font-bold text-stone-900 mt-1">
                                            {formatCurrency(viewMode === 'before_deduction' ? qrRevenue : qrWithdrawable)}
                                        </div>
                                    </div>
                                    <div className="bg-teal-50 border-2 border-teal-500 rounded-lg p-4">
                                        <span className="text-xs font-bold uppercase tracking-wide text-teal-600">Số tiền có thể rút</span>
                                        <div className="text-2xl font-bold text-teal-700 mt-1">{formatCurrency(qrWithdrawable)}</div>
                                        <p className="text-xs text-teal-600 mt-1">= Tổng QR - 5% phí nền tảng ({formatCurrency(qrPlatformFee)})</p>
                                    </div>
                                    <button onClick={() => handleShowFluctuation('QR')} className="w-full px-4 py-3 bg-blue-500 text-white border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-[5px_5px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 font-bold text-sm uppercase transition-all">
                                        Xem biến động số dư
                                    </button>
                                </div>
                            </div>
                            {/* ===== CASH SECTION ===== */}
                            <div className="bg-amber-50 border-2 border-amber-500 rounded-xl shadow-[4px_4px_0_#d97706] p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-amber-600 border-2 border-stone-900 rounded-lg flex items-center justify-center shadow-[2px_2px_0_#1c1917]"><BanknotesIcon className="w-5 h-5 text-white" /></div>
                                    <h2 className="font-bold text-lg text-amber-900">Thanh toán tiền mặt</h2>
                                </div>
                                <div className="space-y-3">
                                    <div className="bg-white border-2 border-amber-300 rounded-lg p-4">
                                        <span className="text-xs font-bold uppercase tracking-wide text-stone-400">
                                            {viewMode === 'before_deduction' ? 'Doanh thu tiền mặt' : 'Doanh thu tiền mặt (sau khấu trừ)'}
                                        </span>
                                        <div className="text-2xl font-bold text-stone-900 mt-1">
                                            {formatCurrency(viewMode === 'before_deduction' ? cashRevenue : cashNetRevenue)}
                                        </div>
                                    </div>
                                    <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
                                        <span className="text-xs font-bold uppercase tracking-wide text-red-600">Số tiền cần nộp lại nền tảng</span>
                                        <div className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(cashPlatformFee)}</div>
                                        <p className="text-xs text-red-500 mt-1">= 5% doanh thu tiền mặt</p>
                                    </div>
                                    <button onClick={() => handleShowFluctuation('CASH')} className="w-full px-4 py-3 bg-amber-600 text-white border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-[5px_5px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 font-bold text-sm uppercase transition-all">
                                        Xem biến động số dư
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Platform Fee Summary */}
                        <div className="bg-stone-100 border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-5">
                            <h3 className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-3">Tóm tắt phí nền tảng (5%)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div><span className="text-xs text-stone-500 font-medium">Phí từ QR</span><div className="text-lg font-bold text-stone-900">{formatCurrency(qrPlatformFee)}</div></div>
                                <div><span className="text-xs text-stone-500 font-medium">Phí từ tiền mặt</span><div className="text-lg font-bold text-stone-900">{formatCurrency(cashPlatformFee)}</div></div>
                                <div><span className="text-xs text-stone-500 font-medium">Tổng phí khấu trừ</span><div className="text-lg font-bold text-stone-900">{formatCurrency(qrPlatformFee + cashPlatformFee)}</div></div>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* ===== CHART SUMMARY SECTION ===== */}
            <section className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] overflow-hidden">
                <div className="p-4 border-b-2 border-stone-900 flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                        <TableCellsIcon className="w-5 h-5" /> Tổng doanh thu theo kỳ
                    </h2>
                    <div className="flex items-center gap-3">
                        {PERIOD_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setPeriod(opt.value)}
                                className={period === opt.value
                                    ? 'px-4 py-2 rounded-lg font-bold uppercase text-sm border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] bg-stone-900 text-white'
                                    : 'px-4 py-2 rounded-lg font-bold uppercase text-sm border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] bg-white text-stone-800 hover:bg-stone-100'}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-4">
                    {revenueSummaryLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 text-stone-500">
                            <ArrowPathIcon className="w-6 h-6 animate-spin mb-2" />
                            Đang tải biểu đồ...
                        </div>
                    ) : revenueItems.length === 0 ? (
                        <p className="text-stone-500 py-4 text-center">Chưa có dữ liệu doanh thu.</p>
                    ) : (
                        <>
                            <div className="bg-stone-50 border-2 border-stone-900 rounded-xl shadow-[3px_3px_0_#1c1917] p-3 mb-4">
                                <ReactApexChart options={revenueChartOptions} series={[{ name: 'Doanh thu', data: revenueChartData }]} type="bar" height={280} />
                            </div>
                        </>
                    )}
                </div>
            </section>

            {/* ===== TRANSACTIONS SECTION ===== */}
            <section className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] overflow-hidden">
                <div className="p-4 border-b-2 border-stone-900 flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                        <FunnelIcon className="w-5 h-5" /> Lịch sử giao dịch chi tiết
                    </h2>
                    <div className="flex flex-wrap gap-3">
                        <select
                            value={paymentStatusFilter}
                            onChange={(e) => setPaymentStatusFilter(e.target.value)}
                            className="border-2 border-stone-900 rounded-lg px-3 py-2 bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium"
                        >
                            {PAYMENT_STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <select
                            value={bookingStatusFilter}
                            onChange={(e) => setBookingStatusFilter(e.target.value)}
                            className="border-2 border-stone-900 rounded-lg px-3 py-2 bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium"
                        >
                            {BOOKING_STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <button
                            type="button"
                            onClick={() => { setPaymentStatusFilter(''); setBookingStatusFilter(''); }}
                            className="px-4 py-2 rounded-lg font-bold uppercase text-sm border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] bg-white text-stone-800 hover:bg-stone-100"
                        >
                            Xóa lọc
                        </button>
                    </div>
                </div>
                <div className="p-4 overflow-x-auto">
                    {paymentsLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 text-stone-500">
                            <ArrowPathIcon className="w-6 h-6 animate-spin mb-2" />
                            Đang tải giao dịch...
                        </div>
                    ) : payments.length === 0 ? (
                        <p className="text-stone-500 py-4 text-center">Không có giao dịch nào phù hợp.</p>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-stone-900">
                                    <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Mã đơn</th>
                                    <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Khách hàng</th>
                                    <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Số tiền</th>
                                    <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">PT thanh toán</th>
                                    <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Lúc</th>
                                    <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((p) => (
                                    <tr key={p.paymentId} className="border-b border-stone-200 hover:bg-stone-50">
                                        <td className="py-3 px-2 font-mono text-sm font-medium">{p.bookingCode}</td>
                                        <td className="py-3 px-2 text-stone-700">{p.petOwnerName ?? '—'}</td>
                                        <td className="py-3 px-2 font-bold">{formatCurrency(p.amount)}</td>
                                        <td className="py-3 px-2 text-stone-700">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</td>
                                        <td className="py-3 px-2 text-stone-600 text-sm">{formatDateTime(p.paidAt)}</td>
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

export default RevenuePage;
