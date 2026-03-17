import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    getClinicRevenueBreakdown,
    getBalanceFluctuation,
    getClinicPayments,
    getClinicRevenueSummary,
    type RevenueBreakdownResponse,
    type BalanceFluctuationItem,
    type ClinicPaymentItem,
    type RevenueSummaryItem,
} from '../../services/paymentService';
import { clinicService } from '../../services/api/clinicService';
import { createRefundApplication, getClinicRefundApplications, type RefundApplicationItem } from '../../services/refundApplicationService';
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
    DocumentPlusIcon,
    XMarkIcon,
    CurrencyDollarIcon,
    HomeModernIcon
} from '@heroicons/react/24/outline';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useToast } from '../../components/Toast';
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

export const ClinicOwnerRevenuePage = () => {
    const { showToast } = useToast();

    // --- CLINICS SELECTION STATE ---
    const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
    const [selectedClinicId, setSelectedClinicId] = useState<string>('');
    const [clinicsLoading, setClinicsLoading] = useState(true);

    // --- REVENUE BREAKDOWN STATE ---
    const [breakdownLoading, setBreakdownLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [breakdown, setBreakdown] = useState<RevenueBreakdownResponse | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('before_deduction');

    // --- BALANCE FLUCTUATION STATE ---
    const [showFluctuation, setShowFluctuation] = useState(false);
    const [fluctuationMethod, setFluctuationMethod] = useState<'QR' | 'CASH'>('QR');
    const [fluctuationItems, setFluctuationItems] = useState<BalanceFluctuationItem[]>([]);
    const [fluctuationLoading, setFluctuationLoading] = useState(false);

    // --- TRANSACTIONS & SUMMARY STATE ---
    const [payments, setPayments] = useState<ClinicPaymentItem[]>([]);
    const [revenueItems, setRevenueItems] = useState<RevenueSummaryItem[]>([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [revenueSummaryLoading, setRevenueSummaryLoading] = useState(false);
    const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
    const [bookingStatusFilter, setBookingStatusFilter] = useState('');
    const [period, setPeriod] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR'>('MONTH');

    // --- REFUND MODAL STATE ---
    const [refundModalOpen, setRefundModalOpen] = useState(false);
    const [requestedAmountInput, setRequestedAmountInput] = useState<string>('');
    const [refundSubmitting, setRefundSubmitting] = useState(false);

    // --- REFUNDS HISTORY STATE ---
    const [refundHistoryOpen, setRefundHistoryOpen] = useState(false);
    const [refunds, setRefunds] = useState<RefundApplicationItem[]>([]);
    const [refundsLoading, setRefundsLoading] = useState(false);

    // --- CALCULATED REVENUE FIELDS ---
    const rawTotalRevenue = breakdown?.totalRevenue || 0;
    const qrRevenue = breakdown?.qrRevenue || 0;
    const cashRevenue = breakdown?.cashRevenue || 0;
    const qrPlatformFee = qrRevenue * 0.05;
    const cashPlatformFee = cashRevenue * 0.05;
    const qrWithdrawable = qrRevenue * 0.95;
    const cashNetRevenue = cashRevenue * 0.95;
    const netTotal = rawTotalRevenue * 0.95;

    const monthRevenue = rawTotalRevenue;
    const webDeductionAmount = qrPlatformFee + cashPlatformFee;
    const amountAfterDeduction = Math.max(0, breakdown?.withdrawableBalance || 0);
    const totalWithdrawn = Math.max(0, breakdown?.totalWithdrawn || 0);

    const requestedAmountNum = useMemo(() => {
        const n = parseFloat(requestedAmountInput.replace(/\s/g, '').replace(',', '.')) || 0;
        return Number.isFinite(n) && n >= 0 ? n : 0;
    }, [requestedAmountInput]);

    const isRequestedAmountValid = requestedAmountNum > 0 && requestedAmountNum <= amountAfterDeduction;

    // --- FETCHES ---
    const loadClinics = useCallback(async () => {
        setClinicsLoading(true);
        try {
            const res = await clinicService.getMyClinics(0, 100);

            // Handle pagination from Spring or direct array
            const clinicItems = Array.isArray(res) ? res : (res as any).content || (res as any).data || [];

            const loadedClinics = clinicItems.map((c: any) => ({ id: c.clinicId, name: c.name }));
            setClinics(loadedClinics);
            if (loadedClinics.length > 0 && !selectedClinicId) {
                setSelectedClinicId(loadedClinics[0].id);
            }
        } catch (err) {
            console.error('Failed to load clinics:', err);
            showToast('error', 'Không thể tải danh sách phòng khám');
        } finally {
            setClinicsLoading(false);
        }
    }, [selectedClinicId, showToast]);

    useEffect(() => {
        loadClinics();
    }, [loadClinics]);

    const fetchBreakdown = useCallback(async () => {
        if (!selectedClinicId) return;
        setBreakdownLoading(true);
        setError(null);
        try {
            const data = await getClinicRevenueBreakdown(selectedClinicId);
            setBreakdown(data);
        } catch (err) {
            console.error('Failed to fetch revenue breakdown:', err);
            setError('Không thể tải dữ liệu doanh thu. Vui lòng thử lại.');
        } finally {
            setBreakdownLoading(false);
        }
    }, [selectedClinicId]);

    const fetchPayments = useCallback(async () => {
        if (!selectedClinicId) return;
        setPaymentsLoading(true);
        try {
            const res = await getClinicPayments(
                selectedClinicId,
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
    }, [selectedClinicId, paymentStatusFilter, bookingStatusFilter]);

    const fetchRevenueSummary = useCallback(async () => {
        if (!selectedClinicId) return;
        setRevenueSummaryLoading(true);
        try {
            const res = await getClinicRevenueSummary(selectedClinicId, period);
            setRevenueItems(res.items || []);
        } catch (e) {
            console.error('Failed to fetch revenue chart:', e);
            setRevenueItems([]);
        } finally {
            setRevenueSummaryLoading(false);
        }
    }, [selectedClinicId, period]);

    const fetchRefunds = useCallback(async () => {
        if (!selectedClinicId) return;
        setRefundsLoading(true);
        try {
            const res = await getClinicRefundApplications(selectedClinicId);
            setRefunds(res.items || []);
        } catch (err) {
            console.error('Failed to fetch refunds:', err);
            setRefunds([]);
        } finally {
            setRefundsLoading(false);
        }
    }, [selectedClinicId]);

    useEffect(() => {
        if (selectedClinicId) {
            fetchBreakdown();
            fetchPayments();
            fetchRevenueSummary();
            fetchRefunds();
        }
    }, [selectedClinicId, fetchBreakdown, fetchPayments, fetchRevenueSummary, fetchRefunds]);

    const handleShowFluctuation = async (method: 'QR' | 'CASH') => {
        if (!selectedClinicId) return;
        setFluctuationMethod(method);
        setShowFluctuation(true);
        setFluctuationLoading(true);
        try {
            const data = await getBalanceFluctuation(selectedClinicId, method, 100);
            setFluctuationItems(data.items || []);
        } catch (err) {
            console.error('Failed to fetch balance fluctuation:', err);
            setFluctuationItems([]);
        } finally {
            setFluctuationLoading(false);
        }
    };

    // --- REFUND SUBMISSION ---
    const openRefundModal = () => {
        setRequestedAmountInput(amountAfterDeduction > 0 ? amountAfterDeduction.toString() : '');
        setRefundModalOpen(true);
    };
    const closeRefundModal = () => {
        setRefundModalOpen(false);
        setRefundSubmitting(false);
    };
    const submitRefundApplication = async () => {
        if (monthRevenue <= 0) {
            showToast('warning', 'Vui lòng nhập doanh thu tháng lớn hơn 0.');
            return;
        }
        setRefundSubmitting(true);
        try {
            await createRefundApplication({
                monthRevenue: rawTotalRevenue,
                qrRevenue: qrRevenue,
                cashRevenue: cashRevenue,
                requestedAmount: requestedAmountNum,
                periodYearMonth: new Date().toISOString().slice(0, 7),
                clinicId: selectedClinicId
            });
            showToast('success', 'Đã nộp đơn rút tiền thành công. Đơn đang chờ admin duyệt.');
            closeRefundModal();
            fetchRefunds(); // Refresh history
        } catch (e: any) {
            const msg = e?.response?.data?.message || 'Không thể nộp đơn. Vui lòng thử lại.';
            showToast('error', msg);
        } finally {
            setRefundSubmitting(false);
        }
    };

    // --- CHART DATA ---
    const revenueChartCategories = useMemo(
        () => revenueItems.slice().reverse().map((item) => item.label),
        [revenueItems]
    );

    const revenueChartData = useMemo(
        () => revenueItems.slice().reverse().map((item) => item.total),
        [revenueItems]
    );

    const isSingleBar = revenueChartData.length <= 1;

    const revenueChartOptions: ApexOptions = useMemo(
        () => ({
            chart: {
                type: 'bar',
                toolbar: { show: false },
                foreColor: '#1c1917',
                fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            },
            colors: ['#0d9488'], // Toned teal for Owner
            plotOptions: {
                bar: {
                    borderRadius: 4,
                    horizontal: false,
                    columnWidth: isSingleBar ? '26%' : '55%',
                },
            },
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
        [revenueChartCategories, isSingleBar]
    );

    if (clinicsLoading && !selectedClinicId) {
        return (
            <div className="p-6 bg-stone-50 min-h-screen flex items-center justify-center">
                <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-8 text-center flex flex-col items-center gap-3">
                    <ArrowPathIcon className="w-8 h-8 text-stone-500 animate-spin" />
                    <p className="text-stone-600 font-medium">Đang tải danh sách phòng khám...</p>
                </div>
            </div>
        );
    }

    if (!selectedClinicId) {
        return (
            <div className="p-6 bg-stone-50 min-h-screen flex items-center justify-center">
                <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-8 text-center">
                    <p className="text-stone-600 font-medium">Bạn chưa có phòng khám nào.</p>
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

                <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] overflow-hidden">
                    {fluctuationLoading ? (
                        <div className="p-8 text-center text-stone-500 font-medium">Đang tải dữ liệu...</div>
                    ) : fluctuationItems.length === 0 ? (
                        <div className="p-8 text-center text-stone-500 font-medium">Chưa có giao dịch nào</div>
                    ) : (
                        <div className="divide-y-2 divide-stone-200">
                            {fluctuationItems.map((item) => (
                                <div key={item.paymentId} className="p-5 hover:bg-teal-50/50 transition-colors">
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
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <CurrencyDollarIcon className="w-8 h-8 text-stone-900" />
                    <h1 className="text-2xl font-bold text-stone-900">
                        Doanh thu Phòng Khám
                    </h1>
                </div>

                {/* CLINIC SELECTOR */}
                <div className="flex items-center gap-2 bg-white px-4 py-2 border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917]">
                    <HomeModernIcon className="w-5 h-5 text-stone-500" />
                    <select
                        value={selectedClinicId}
                        onChange={(e) => setSelectedClinicId(e.target.value)}
                        className="bg-transparent border-none focus:outline-none focus:ring-0 font-medium text-stone-800"
                        title="Chọn phòng khám"
                    >
                        {clinics.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </header>

            {/* ERROR ALERT */}
            {error && (
                <div className="bg-red-50 border-2 border-red-400 rounded-xl shadow-[3px_3px_0_#ef4444] p-4">
                    <p className="text-red-700 font-medium">{error}</p>
                </div>
            )}

            {/* ===== REVENUE BREAKDOWN SECTION ===== */}
            <section>
                {/* View Mode Toggle */}
                <div className="flex flex-wrap gap-2 mb-4">
                    <button
                        onClick={() => setViewMode('before_deduction')}
                        className={`px-5 py-2.5 font-bold text-sm uppercase border-2 border-stone-900 rounded-lg transition-all ${viewMode === 'before_deduction'
                            ? 'bg-teal-500 text-white shadow-[3px_3px_0_#1c1917]'
                            : 'bg-white text-stone-700 hover:bg-stone-50'
                            }`}
                    >
                        Trước khấu trừ
                    </button>
                    <button
                        onClick={() => setViewMode('after_deduction')}
                        className={`px-5 py-2.5 font-bold text-sm uppercase border-2 border-stone-900 rounded-lg transition-all ${viewMode === 'after_deduction'
                            ? 'bg-teal-500 text-white shadow-[3px_3px_0_#1c1917]'
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
                        <p className="text-stone-500 font-medium">Đang tải báo cáo doanh thu...</p>
                    </div>
                ) : breakdown && (
                    <div className="space-y-6">
                        {/* Total Revenue Card */}
                        <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <CurrencyDollarIcon className="w-24 h-24" />
                            </div>
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
                                        <span className="text-xs font-bold uppercase tracking-wide text-teal-600">Số tiền có thể rút (Đã cấn trừ nợ & Đã rút)</span>
                                        <div className="text-2xl font-bold text-teal-700 mt-1">{formatCurrency(amountAfterDeduction)}</div>
                                        <div className="mt-1 text-sm text-teal-800">
                                            Đã rút: <span className="font-bold">{formatCurrency(totalWithdrawn)}</span>
                                        </div>
                                        <div className="mt-3 bg-teal-100/50 p-3 rounded border justify-center border-teal-200 text-xs text-teal-800 space-y-1.5">
                                            <p className="font-bold border-b border-teal-200 pb-1 mb-1">Chi tiết tính toán:</p>
                                            <div className="flex justify-between">
                                                <span>Doanh thu QR sau thuế (5%)</span>
                                                <span className="font-bold">{formatCurrency(qrWithdrawable)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>(-) Phí nền tảng từ Tiền mặt đang nợ</span>
                                                <span className="font-bold text-red-600">-{formatCurrency(cashPlatformFee)}</span>
                                            </div>
                                            {/* Removed alreadyWithdrawn as backend handles withdrawableBalance directly */}
                                        </div>
                                    </div>
                                    <button onClick={() => handleShowFluctuation('QR')} className="w-full px-4 py-3 bg-white text-blue-600 border-2 border-blue-500 rounded-lg shadow-[3px_3px_0_#3b82f6] hover:shadow-[5px_5px_0_#3b82f6] hover:-translate-x-0.5 hover:-translate-y-0.5 font-bold text-sm uppercase transition-all">
                                        Xem biến động số dư QR
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
                                        <span className="text-xs font-bold uppercase tracking-wide text-red-600">Phí nợ nền tảng (5%)</span>
                                        <div className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(cashPlatformFee)}</div>
                                        <p className="text-xs text-red-500 mt-1">Sẽ được trừ thẳng vào Số tiền có thể rút từ QR.</p>
                                    </div>
                                    <button onClick={() => handleShowFluctuation('CASH')} className="w-full px-4 py-3 bg-white text-amber-600 border-2 border-amber-500 rounded-lg shadow-[3px_3px_0_#d97706] hover:shadow-[5px_5px_0_#d97706] hover:-translate-x-0.5 hover:-translate-y-0.5 font-bold text-sm uppercase transition-all">
                                        Xem biến động số dư Tiền mặt
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
                        <button
                            type="button"
                            onClick={() => setRefundHistoryOpen(true)}
                            className="px-4 py-2 rounded-lg font-bold uppercase text-sm border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] bg-white text-stone-900 hover:bg-stone-100 transition-all flex items-center gap-2 hover:-translate-y-0.5"
                        >
                            Quản lý đơn rút tiền
                        </button>
                        <button
                            type="button"
                            onClick={openRefundModal}
                            className="px-4 py-2 rounded-lg font-bold uppercase text-sm border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] bg-teal-400 text-stone-900 hover:bg-teal-500 transition-all flex items-center gap-2 hover:-translate-y-0.5"
                        >
                            <DocumentPlusIcon className="w-5 h-5" /> Nộp đơn rút tiền
                        </button>
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
                            className="border-2 border-stone-900 rounded-lg px-3 py-2 bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-teal-600 font-medium"
                        >
                            {PAYMENT_STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <select
                            value={bookingStatusFilter}
                            onChange={(e) => setBookingStatusFilter(e.target.value)}
                            className="border-2 border-stone-900 rounded-lg px-3 py-2 bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-teal-600 font-medium"
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

            {/* ===== REFUND MODAL ===== */}
            {refundModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 transition-opacity">
                    <div className="relative w-full max-w-md bg-white border-4 border-stone-900 rounded-xl shadow-[8px_8px_0_#1c1917]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b-2 border-stone-900 flex items-center justify-between bg-teal-100 rounded-t-lg">
                            <h3 className="text-lg font-bold text-stone-900">Nộp đơn rút tiền</h3>
                            <button onClick={closeRefundModal} className="p-2 rounded-lg border-2 border-stone-900 hover:bg-teal-200 bg-white shadow-[2px_2px_0_#1c1917] hover:-translate-y-0.5 transition-transform">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <form className="p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); submitRefundApplication(); }}>
                            <div className="bg-stone-50 border-2 border-stone-900 rounded-lg p-4">
                                <p className="text-sm font-bold uppercase text-stone-600 mb-2">Thông tin khối lượng doanh thu</p>
                                <div className="space-y-2 mt-2 text-sm font-medium">
                                    <div className="flex justify-between">
                                        <span>Doanh thu báo cáo:</span>
                                        <span>{formatCurrency(monthRevenue)}</span>
                                    </div>
                                    <div className="flex justify-between text-red-600">
                                        <span>Tổng phí nền tảng (5%):</span>
                                        <span>-{formatCurrency(webDeductionAmount)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-teal-700 pt-2 border-t border-stone-300">
                                        <span>Số tiền tối đa có thể rút:</span>
                                        <span>{formatCurrency(amountAfterDeduction)}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-stone-600 mb-2">Số tiền muốn rút (VND)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min={0}
                                        max={amountAfterDeduction}
                                        step={1000}
                                        value={requestedAmountInput}
                                        onChange={(e) => setRequestedAmountInput(e.target.value)}
                                        className={`w-full px-4 py-3 border-2 rounded-lg shadow-[3px_3px_0_#1c1917] focus:outline-none font-medium text-lg leading-none ${!isRequestedAmountValid && requestedAmountInput !== '' ? 'border-red-500 focus:border-red-600 bg-red-50 text-red-700' : 'border-stone-900 focus:border-teal-600 bg-white text-stone-900'
                                            }`}
                                        placeholder="0"
                                    />
                                    {!isRequestedAmountValid && requestedAmountInput !== '' && requestedAmountNum > amountAfterDeduction && (
                                        <p className="text-xs font-bold text-red-600 mt-2">Số tiền rút không được vượt quá số tiền tối đa ({formatCurrency(amountAfterDeduction)})</p>
                                    )}
                                </div>
                                <p className="text-xs font-medium text-stone-500 mt-2">Sẽ được chuyển vào tài khoản ngân hàng của phòng khám</p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={closeRefundModal} className="flex-1 px-4 py-3 rounded-lg font-bold uppercase text-sm border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] bg-white text-stone-800 hover:bg-stone-100">
                                    Hủy
                                </button>
                                <button type="submit" disabled={refundSubmitting || !isRequestedAmountValid} className="flex-1 px-4 py-3 rounded-lg font-bold uppercase text-sm border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] bg-teal-500 text-stone-900 hover:bg-teal-600 disabled:opacity-60 disabled:cursor-not-allowed">
                                    {refundSubmitting ? 'Đang nộp...' : 'Nộp đơn rút'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== REFUND HISTORY MODAL ===== */}
            {refundHistoryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 transition-opacity">
                    <div className="relative w-full max-w-4xl bg-white border-4 border-stone-900 rounded-xl shadow-[8px_8px_0_#1c1917] flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b-2 border-stone-900 flex items-center justify-between bg-stone-100 rounded-t-lg">
                            <h3 className="text-lg font-bold text-stone-900">Lịch sử đơn rút tiền</h3>
                            <button onClick={() => setRefundHistoryOpen(false)} className="p-2 rounded-lg border-2 border-stone-900 hover:bg-stone-200 bg-white shadow-[2px_2px_0_#1c1917] hover:-translate-y-0.5 transition-transform">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {refundsLoading ? (
                                <div className="text-center py-8 text-stone-500 font-medium">Đang tải lịch sử...</div>
                            ) : refunds.length === 0 ? (
                                <div className="text-center py-8 text-stone-500 font-medium">Chưa có đơn yêu cầu rút tiền nào.</div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-stone-900">
                                            <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Kỳ (Năm-Tháng)</th>
                                            <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Doanh thu báo cáo</th>
                                            <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Khấu trừ (5%)</th>
                                            <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Thực nhận</th>
                                            <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Trạng thái</th>
                                            <th className="text-xs font-bold uppercase text-stone-600 py-3 px-2">Tạo lúc</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {refunds.map(r => (
                                            <tr key={r.refundApplicationId} className="border-b border-stone-200 hover:bg-stone-50 text-sm">
                                                <td className="py-3 px-2 font-bold">{r.periodYearMonth}</td>
                                                <td className="py-3 px-2">{formatCurrency(r.monthRevenue)}</td>
                                                <td className="py-3 px-2 text-red-600">-{formatCurrency(r.webDeductionAmount)}</td>
                                                <td className="py-3 px-2 font-bold text-teal-700">{formatCurrency(r.requestedAmount || r.amountAfterDeduction)}</td>
                                                <td className="py-3 px-2">
                                                    <span className={`inline-block px-2 py-1 rounded shadow-[2px_2px_0_#1c1917] border-2 border-stone-900 text-xs font-bold ${r.status === 'APPROVED' ? 'bg-green-300 text-green-900' :
                                                        r.status === 'REJECTED' ? 'bg-red-300 text-red-900' :
                                                            'bg-yellow-300 text-yellow-900'
                                                        }`}>
                                                        {r.status === 'PENDING' ? 'Chờ duyệt' : r.status === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
                                                    </span>
                                                    {r.status === 'REJECTED' && r.rejectionReason && (
                                                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800 text-left whitespace-pre-wrap">
                                                            <span className="font-bold">Lý do:</span> {r.rejectionReason}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-2 text-stone-500">{formatDateTime(r.createdAt)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClinicOwnerRevenuePage;
