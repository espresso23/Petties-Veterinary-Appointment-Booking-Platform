import { useState, useEffect, useCallback } from 'react';
import type { RefundApplicationItem, AdminFilterParams } from '../../../services/refundApplicationService';
import { getPendingForAdmin, getAllForAdmin, updateRefundApplicationStatus } from '../../../services/refundApplicationService';
import { useToast } from '../../../hooks/useToast';
import { format } from 'date-fns';
import {
    BanknotesIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    FunnelIcon,
    XMarkIcon,
    ExclamationTriangleIcon,
    ArchiveBoxIcon,
    MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { findBankByName, getVietQRImageUrl } from '../../../utils/vietqr';

function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

type Tab = 'pending' | 'history';

// --- Custom Confirm Modal ---
interface ConfirmModalProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    confirmClass: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
    icon?: React.ReactNode;
}
function ConfirmModal({ open, title, description, confirmLabel, confirmClass, onConfirm, onCancel, isLoading, icon }: ConfirmModalProps) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[6px_6px_0_#1c1917] w-full max-w-md">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        {icon && (
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg border-2 border-stone-900 bg-amber-50 flex items-center justify-center shadow-[2px_2px_0_#1c1917]">
                                {icon}
                            </div>
                        )}
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-stone-900">{title}</h3>
                            <p className="mt-1 text-sm font-medium text-stone-600">{description}</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pb-6">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="flex-1 py-2.5 px-4 rounded-lg border-2 border-stone-900 bg-white text-stone-800 font-bold text-sm shadow-[3px_3px_0_#1c1917] hover:bg-stone-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1c1917] transition-all disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 py-2.5 px-4 rounded-lg border-2 border-stone-900 text-white font-bold text-sm shadow-[3px_3px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1c1917] transition-all disabled:opacity-50 ${confirmClass}`}
                    >
                        {isLoading ? 'Đang xử lý...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Status Badge ---
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-400',
        APPROVED: 'bg-teal-100 text-teal-800 border-teal-500',
        REJECTED: 'bg-red-100 text-red-800 border-red-400',
    };
    const labels: Record<string, string> = {
        PENDING: 'Chờ duyệt',
        APPROVED: 'Đã duyệt',
        REJECTED: 'Từ chối',
    };
    return (
        <span className={`inline-block px-2.5 py-0.5 rounded-full border font-bold text-xs ${map[status] || 'bg-stone-100 text-stone-700 border-stone-300'}`}>
            {labels[status] || status}
        </span>
    );
}

// --- Application Card ---
interface AppCardProps {
    app: RefundApplicationItem;
    onApprove?: (id: string) => void;
    onReject?: (app: RefundApplicationItem) => void;
    isPending?: boolean;
}
function AppCard({ app, onApprove, onReject, isPending }: AppCardProps) {
    const requestedAmount = Number(app.requestedAmount || app.amountAfterDeduction || 0);
    const bank = app.bankName ? findBankByName(app.bankName) : undefined;
    const qrImageUrl = bank && app.accountNumber
        ? getVietQRImageUrl(bank.code, app.accountNumber, 'compact2', {
            amount: requestedAmount,
            addInfo: `Rut tien ${app.periodYearMonth}`,
            accountName: app.clinicName,
        })
        : '';

    return (
        <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] flex flex-col hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#1c1917] transition-all">
            <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0 mr-2">
                        <div className="relative group/clinic inline-block max-w-full">
                            <h3
                                className="font-bold text-stone-900 leading-tight truncate cursor-help underline decoration-dotted underline-offset-2"
                                title={app.clinicName}
                            >
                                {app.clinicName}
                            </h3>

                            <div className="hidden group-hover/clinic:block absolute left-0 top-full mt-2 z-20 w-[320px] bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-3">
                                <h4 className="text-xs font-bold uppercase text-stone-500 mb-2">Thông tin chuyển khoản</h4>

                                <div className="space-y-1.5 mb-3">
                                    <div className="flex justify-between gap-3 text-xs">
                                        <span className="font-bold text-stone-500 uppercase">Phòng khám</span>
                                        <span className="font-semibold text-stone-900 text-right break-words">{app.clinicName}</span>
                                    </div>
                                    <div className="flex justify-between gap-3 text-xs">
                                        <span className="font-bold text-stone-500 uppercase">Số tiền gửi</span>
                                        <span className="font-black text-teal-700">{formatVND(requestedAmount)}</span>
                                    </div>
                                    <div className="flex justify-between gap-3 text-xs">
                                        <span className="font-bold text-stone-500 uppercase">Tên ngân hàng</span>
                                        <span className="font-semibold text-stone-900 text-right break-words">{app.bankName || 'Chưa có thông tin'}</span>
                                    </div>
                                    <div className="flex justify-between gap-3 text-xs">
                                        <span className="font-bold text-stone-500 uppercase">Mã ngân hàng</span>
                                        <span className="font-bold text-stone-900">{bank?.code || 'Không xác định'}</span>
                                    </div>
                                    <div className="flex justify-between gap-3 text-xs">
                                        <span className="font-bold text-stone-500 uppercase">Số tài khoản</span>
                                        <span className="font-semibold text-stone-900 text-right break-all">{app.accountNumber || 'Chưa có thông tin'}</span>
                                    </div>
                                </div>

                                {qrImageUrl ? (
                                    <div className="bg-stone-50 border-2 border-stone-900 rounded-lg p-2 shadow-[2px_2px_0_#1c1917]">
                                        <img
                                            src={qrImageUrl}
                                            alt="Mã QR chuyển khoản"
                                            className="w-full h-auto rounded-lg border border-stone-200"
                                            loading="lazy"
                                        />
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-2.5 text-xs font-medium text-amber-800">
                                        Không thể tạo mã QR do thiếu thông tin ngân hàng hợp lệ.
                                    </div>
                                )}
                            </div>
                        </div>
                        <p className="text-xs font-medium text-stone-500 mt-0.5">Kỳ: {app.periodYearMonth}</p>
                    </div>
                    <StatusBadge status={app.status} />
                </div>

                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-200">
                            <p className="text-[10px] font-bold text-stone-500 uppercase mb-0.5">QR</p>
                            <p className="font-bold text-stone-800 text-sm">{formatVND(app.qrRevenue || 0)}</p>
                        </div>
                        <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-200">
                            <p className="text-[10px] font-bold text-stone-500 uppercase mb-0.5">Tiền mặt</p>
                            <p className="font-bold text-stone-800 text-sm">{formatVND(app.cashRevenue || 0)}</p>
                        </div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2.5 border border-red-200">
                        <p className="text-[10px] font-bold text-red-500 uppercase mb-0.5">Khấu trừ ({app.webDeductionPercent}%)</p>
                        <p className="font-bold text-red-700 text-sm">-{formatVND(app.webDeductionAmount)}</p>
                    </div>
                    <div className="bg-teal-50 rounded-lg p-2.5 border-2 border-teal-500">
                        <p className="text-[10px] font-bold text-teal-800 uppercase mb-0.5">Yêu cầu rút</p>
                        <p className="text-lg font-black text-teal-700">{formatVND(requestedAmount)}</p>
                    </div>
                    {app.status === 'REJECTED' && app.rejectionReason && (
                        <div className="bg-red-50 rounded-lg p-2.5 border border-red-200">
                            <p className="text-[10px] font-bold text-red-600 uppercase mb-0.5">Lý do từ chối</p>
                            <p className="text-xs text-red-700 whitespace-pre-wrap">{app.rejectionReason}</p>
                        </div>
                    )}
                    <p className="text-xs text-stone-400 font-medium pt-1">
                        Ngày nộp: {format(new Date(app.createdAt), 'dd/MM/yyyy HH:mm')}
                    </p>
                    {app.reviewedAt && (
                        <p className="text-xs text-stone-400 font-medium">
                            Duyệt lúc: {format(new Date(app.reviewedAt), 'dd/MM/yyyy HH:mm')}
                        </p>
                    )}
                </div>
            </div>

            {isPending && onApprove && onReject && (
                <div className="px-5 pb-5 flex gap-2">
                    <button
                        onClick={() => onApprove(app.refundApplicationId)}
                        className="flex-1 flex justify-center items-center gap-1.5 py-2 px-3 bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs uppercase rounded-lg border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#1c1917] transition-all"
                    >
                        <CheckCircleIcon className="w-4 h-4" />
                        Duyệt
                    </button>
                    <button
                        onClick={() => onReject(app)}
                        className="flex-1 flex justify-center items-center gap-1.5 py-2 px-3 bg-white hover:bg-red-50 text-red-600 font-bold text-xs uppercase rounded-lg border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#1c1917] transition-all"
                    >
                        <XCircleIcon className="w-4 h-4" />
                        Từ chối
                    </button>
                </div>
            )}
        </div>
    );
}

// --- History Filters ---
interface HistoryFiltersProps {
    filters: AdminFilterParams;
    onChange: (f: AdminFilterParams) => void;
    onApply: () => void;
    onReset: () => void;
}
function HistoryFilters({ filters, onChange, onApply, onReset }: HistoryFiltersProps) {
    return (
        <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
                <FunnelIcon className="w-5 h-5 text-stone-600" />
                <h2 className="font-bold text-stone-800">Bộ lọc</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Trạng thái</label>
                    <select
                        value={filters.status || ''}
                        onChange={e => onChange({ ...filters, status: e.target.value || undefined })}
                        className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm"
                    >
                        <option value="">Tất cả</option>
                        <option value="PENDING">Chờ duyệt</option>
                        <option value="APPROVED">Đã duyệt</option>
                        <option value="REJECTED">Từ chối</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Clinic ID</label>
                    <input
                        type="text"
                        placeholder="UUID phòng khám..."
                        value={filters.clinicId || ''}
                        onChange={e => onChange({ ...filters, clinicId: e.target.value || undefined })}
                        className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm placeholder:text-stone-400"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Từ ngày</label>
                    <input
                        type="date"
                        value={filters.from || ''}
                        onChange={e => onChange({ ...filters, from: e.target.value || undefined })}
                        className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Đến ngày</label>
                    <input
                        type="date"
                        value={filters.to || ''}
                        onChange={e => onChange({ ...filters, to: e.target.value || undefined })}
                        className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm"
                    />
                </div>
            </div>
            <div className="flex gap-3 mt-4">
                <button
                    onClick={onApply}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm uppercase rounded-lg border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1c1917] transition-all"
                >
                    <MagnifyingGlassIcon className="w-4 h-4" />
                    Tìm kiếm
                </button>
                <button
                    onClick={onReset}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-stone-100 text-stone-700 font-bold text-sm uppercase rounded-lg border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1c1917] transition-all"
                >
                    <XMarkIcon className="w-4 h-4" />
                    Xóa bộ lọc
                </button>
            </div>
        </div>
    );
}

// --- Main Component ---
export const AdminRefundApplicationsPage = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<Tab>('pending');

    // Pending tab state
    const [pendingApps, setPendingApps] = useState<RefundApplicationItem[]>([]);
    const [isPendingLoading, setIsPendingLoading] = useState(true);

    // History tab state
    const [historyApps, setHistoryApps] = useState<RefundApplicationItem[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [filters, setFilters] = useState<AdminFilterParams>({});
    const [appliedFilters, setAppliedFilters] = useState<AdminFilterParams>({});

    // Confirm approve modal
    const [approveModal, setApproveModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

    // Reject modal state
    const [rejectModal, setRejectModal] = useState<{ open: boolean; app: RefundApplicationItem | null }>({ open: false, app: null });
    const [rejectReason, setRejectReason] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load pending
    const loadPending = useCallback(async () => {
        try {
            setIsPendingLoading(true);
            const res = await getPendingForAdmin();
            if (res.success) setPendingApps(res.items);
        } catch {
            showToast('error', 'Không thể tải danh sách đơn chờ duyệt.');
        } finally {
            setIsPendingLoading(false);
        }
    }, [showToast]);

    // Load history
    const loadHistory = useCallback(async (f: AdminFilterParams = {}) => {
        try {
            setIsHistoryLoading(true);
            const res = await getAllForAdmin(f);
            if (res.success) setHistoryApps(res.items);
        } catch {
            showToast('error', 'Không thể tải lịch sử đơn rút tiền.');
        } finally {
            setIsHistoryLoading(false);
        }
    }, [showToast]);

    useEffect(() => { loadPending(); }, [loadPending]);

    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory(appliedFilters);
        }
    }, [activeTab, appliedFilters, loadHistory]);

    // Approve flow
    const openApproveModal = (id: string) => setApproveModal({ open: true, id });
    const handleApproveConfirm = async () => {
        if (!approveModal.id) return;
        try {
            setIsSubmitting(true);
            const res = await updateRefundApplicationStatus(approveModal.id, 'APPROVED');
            if (res.success) {
                showToast('success', 'Đã duyệt đơn rút tiền thành công!');
                setApproveModal({ open: false, id: null });
                loadPending();
                if (activeTab === 'history') loadHistory(appliedFilters);
            }
        } catch {
            showToast('error', 'Đã có lỗi xảy ra khi duyệt đơn.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reject flow
    const openRejectModal = (app: RefundApplicationItem) => {
        setRejectModal({ open: true, app });
        setRejectReason('');
    };
    const handleRejectConfirm = async () => {
        if (!rejectModal.app) return;
        if (!rejectReason.trim()) {
            showToast('error', 'Vui lòng nhập lý do từ chối.');
            return;
        }
        try {
            setIsSubmitting(true);
            const res = await updateRefundApplicationStatus(rejectModal.app.refundApplicationId, 'REJECTED', rejectReason);
            if (res.success) {
                showToast('success', 'Đã từ chối đơn rút tiền.');
                setRejectModal({ open: false, app: null });
                loadPending();
                if (activeTab === 'history') loadHistory(appliedFilters);
            }
        } catch {
            showToast('error', 'Đã có lỗi xảy ra khi từ chối đơn.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const applyFilters = () => {
        setAppliedFilters({ ...filters });
    };

    const resetFilters = () => {
        setFilters({});
        setAppliedFilters({});
    };

    const tabClass = (tab: Tab) =>
        `flex items-center gap-2 px-5 py-2.5 font-bold text-sm uppercase rounded-lg border-2 border-stone-900 transition-all ${activeTab === tab
            ? 'bg-stone-900 text-white shadow-[3px_3px_0_#78716c]'
            : 'bg-white text-stone-700 shadow-[3px_3px_0_#1c1917] hover:bg-stone-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1c1917]'
        }`;

    const isEmpty = (list: RefundApplicationItem[], loading: boolean) => !loading && list.length === 0;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-black text-stone-900 flex items-center gap-3">
                    <BanknotesIcon className="w-8 h-8 text-teal-600" />
                    Quản lý Đơn Rút Tiền
                </h1>
                <p className="text-stone-500 font-medium mt-1">Duyệt hoặc từ chối đơn rút tiền từ phòng khám, xem lịch sử toàn bộ đơn.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-3 mb-8 flex-wrap">
                <button onClick={() => setActiveTab('pending')} className={tabClass('pending')}>
                    <ClockIcon className="w-4 h-4" />
                    Chờ duyệt
                    {pendingApps.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-amber-400 text-stone-900 text-[10px] font-black rounded-full border border-stone-900">
                            {pendingApps.length}
                        </span>
                    )}
                </button>
                <button onClick={() => setActiveTab('history')} className={tabClass('history')}>
                    <ArchiveBoxIcon className="w-4 h-4" />
                    Lịch sử
                </button>
            </div>

            {/* Pending Tab */}
            {activeTab === 'pending' && (
                <>
                    {isPendingLoading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-[4px] border-stone-200 border-t-teal-500" />
                        </div>
                    ) : isEmpty(pendingApps, isPendingLoading) ? (
                        <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-12 text-center">
                            <BanknotesIcon className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-stone-800">Không có đơn chờ</h3>
                            <p className="text-stone-500 font-medium mt-2">Tuyệt vời! Hiện không có đơn rút tiền nào cần xử lý.</p>
                        </div>
                    ) : (
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {pendingApps.map(app => (
                                <AppCard
                                    key={app.refundApplicationId}
                                    app={app}
                                    isPending
                                    onApprove={openApproveModal}
                                    onReject={openRejectModal}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <>
                    <HistoryFilters
                        filters={filters}
                        onChange={setFilters}
                        onApply={applyFilters}
                        onReset={resetFilters}
                    />
                    {isHistoryLoading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-[4px] border-stone-200 border-t-amber-500" />
                        </div>
                    ) : isEmpty(historyApps, isHistoryLoading) ? (
                        <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-12 text-center">
                            <ArchiveBoxIcon className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-stone-800">Không có dữ liệu</h3>
                            <p className="text-stone-500 font-medium mt-2">Thử thay đổi bộ lọc hoặc xóa bộ lọc để xem tất cả đơn.</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm font-medium text-stone-500 mb-4">
                                Tìm thấy <span className="font-bold text-stone-800">{historyApps.length}</span> đơn
                            </p>
                            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                {historyApps.map(app => (
                                    <AppCard key={app.refundApplicationId} app={app} />
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Custom Approve Confirm Modal */}
            <ConfirmModal
                open={approveModal.open}
                title="Xác nhận duyệt đơn"
                description="Bạn có chắc chắn muốn duyệt đơn rút tiền này? Hệ thống sẽ ghi nhận và gửi thông báo tới phòng khám."
                confirmLabel="Duyệt đơn"
                confirmClass="bg-teal-500 hover:bg-teal-600"
                onConfirm={handleApproveConfirm}
                onCancel={() => setApproveModal({ open: false, id: null })}
                isLoading={isSubmitting}
                icon={<CheckCircleIcon className="w-6 h-6 text-teal-600" />}
            />

            {/* Reject Modal */}
            {rejectModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
                    <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[6px_6px_0_#1c1917] w-full max-w-md">
                        <div className="p-6">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg border-2 border-stone-900 bg-red-50 flex items-center justify-center shadow-[2px_2px_0_#1c1917]">
                                    <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-stone-900">Từ chối đơn rút tiền</h3>
                                    <p className="mt-1 text-sm font-medium text-stone-600">
                                        Từ chối yêu cầu rút <span className="font-bold text-stone-800">{formatVND(rejectModal.app?.requestedAmount || rejectModal.app?.amountAfterDeduction || 0)}</span> của <span className="font-bold">{rejectModal.app?.clinicName}</span>
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Lý do từ chối (bắt buộc)</label>
                                <textarea
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    rows={4}
                                    autoFocus
                                    className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm resize-none placeholder:text-stone-400"
                                    placeholder="Nhập lý do chi tiết để phòng khám có thể đối chiếu..."
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 px-6 pb-6">
                            <button
                                onClick={() => setRejectModal({ open: false, app: null })}
                                disabled={isSubmitting}
                                className="flex-1 py-2.5 px-4 rounded-lg border-2 border-stone-900 bg-white text-stone-800 font-bold text-sm shadow-[3px_3px_0_#1c1917] hover:bg-stone-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1c1917] transition-all disabled:opacity-50"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleRejectConfirm}
                                disabled={isSubmitting || !rejectReason.trim()}
                                className="flex-1 py-2.5 px-4 rounded-lg border-2 border-stone-900 bg-red-500 hover:bg-red-600 text-white font-bold text-sm shadow-[3px_3px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1c1917] transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
