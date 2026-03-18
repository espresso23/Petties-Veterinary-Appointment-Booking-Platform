import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/Toast';
import { getAllReportsForAdmin, resolveReport } from '../../services/reportService';
import type { ReportResponse, ReportStatus } from '../../types/report';
import { isAxiosError } from 'axios';
import '../../styles/brutalist.css';

export const ReportsPage = () => {
    const [reports, setReports] = useState<ReportResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<ReportStatus | 'ALL'>('ALL');
    const { showToast } = useToast();

    // Resolution Modal state
    const [resolvingReport, setResolvingReport] = useState<ReportResponse | null>(null);
    const [adminNote, setAdminNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const status = filterStatus === 'ALL' ? undefined : filterStatus;
            const data = await getAllReportsForAdmin(status);
            setReports(data.content || []);
        } catch (error) {
            console.error('Failed to fetch reports:', error);
            showToast('error', 'Không thể tải danh sách báo cáo');
        } finally {
            setLoading(false);
        }
    }, [filterStatus, showToast]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const handleResolve = async (status: 'APPROVED' | 'REJECTED') => {
        if (!resolvingReport) return;
        if (adminNote.trim().length < 5) {
            showToast('error', 'Ghi chú của admin phải ít nhất 5 ký tự');
            return;
        }

        setIsSubmitting(true);
        try {
            await resolveReport(resolvingReport.id, {
                status,
                adminNote: adminNote.trim()
            });
            setAdminNote('');
            showToast('success', `Đã ${status === 'APPROVED' ? 'duyệt' : 'từ chối'} báo cáo thành công`);
            fetchReports();
        } catch (error) {
            console.error('Failed to resolve report:', error);
            const errorMessage = isAxiosError(error) && error.response?.data?.message 
                ? error.response.data.message 
                : 'Không thể xử lý báo cáo';
            showToast('error', errorMessage);
        } finally {
            setIsSubmitting(false);
            setResolvingReport(null); // Dù success hay fail cũng đóng popup
        }
    };

    const getStatusBadge = (status: ReportStatus) => {
        const styles = {
            PENDING: 'bg-yellow-400 text-stone-900',
            APPROVED: 'bg-mint-400 text-stone-900',
            REJECTED: 'bg-red-500 text-white'
        };
        const labels = {
            PENDING: 'Chờ xử lý',
            APPROVED: 'Đã duyệt',
            REJECTED: 'Từ chối'
        };
        return (
            <span className={`px-3 py-1 text-xs font-bold uppercase border-2 border-stone-900 ${styles[status]}`}>
                {labels[status]}
            </span>
        );
    };

    return (
        <div className="p-6 bg-stone-50 min-h-screen">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-stone-900 uppercase tracking-wide">
                    QUẢN LÝ BÁO CÁO
                </h1>
                <p className="text-stone-600 mt-1">
                    Xem và xử lý các báo cáo vi phạm từ người dùng và phòng khám
                </p>
            </header>

            {/* Filters */}
            <div className="mb-6 flex gap-2">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 font-bold text-sm uppercase border-2 border-stone-900 transition-all ${filterStatus === status
                            ? 'bg-amber-400 shadow-[4px_4px_0_#1c1917]'
                            : 'bg-white hover:bg-stone-100'
                            }`}
                    >
                        {status === 'ALL' ? 'Tất cả' : status === 'PENDING' ? 'Chờ xử lý' : status === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
                    </button>
                ))}
            </div>

            {/* Reports Table */}
            <div className="bg-white border-4 border-stone-900 shadow-brutal overflow-hidden">
                <table className="w-full">
                    <thead className="border-b-4 border-stone-900 bg-stone-100">
                        <tr className="text-left font-bold uppercase text-xs tracking-wider">
                            <th className="p-4">Mã Booking</th>
                            <th className="p-4">Người báo cáo</th>
                            <th className="p-4">Bị báo cáo</th>
                            <th className="p-4">Lý do</th>
                            <th className="p-4 text-center">Trạng thái</th>
                            <th className="p-4 text-center">Ngày tạo</th>
                            <th className="p-4 text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-stone-600">Đang tải...</td>
                            </tr>
                        ) : reports.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-stone-600">Không có báo cáo nào</td>
                            </tr>
                        ) : (
                            reports.map((report) => (
                                <tr key={report.id} className="border-b-2 border-stone-200 hover:bg-amber-50">
                                    <td className="p-4 font-mono font-bold">{report.bookingCode}</td>
                                    <td className="p-4">
                                        <div className="font-bold">{report.reporterName}</div>
                                        <div className="text-[10px] text-stone-500 uppercase">{report.reporterRole}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold">
                                            {report.reportedClinicName || report.reportedUserName}
                                        </div>
                                        <div className="text-[10px] text-stone-500 uppercase">
                                            {report.reportedClinicName ? 'PHÒNG KHÁM' : 'PET OWNER'}
                                        </div>
                                    </td>
                                    <td className="p-4 max-w-xs">
                                        <div className="text-sm line-clamp-2" title={report.reason}>
                                            {report.reason}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        {getStatusBadge(report.status)}
                                    </td>
                                    <td className="p-4 text-center text-sm text-stone-600">
                                        {new Date(report.createdAt).toLocaleDateString('vi-VN')}
                                    </td>
                                    <td className="p-4 text-center">
                                        {report.status === 'PENDING' ? (
                                            <button
                                                onClick={() => setResolvingReport(report)}
                                                className="px-3 py-1 text-xs font-bold uppercase bg-amber-400 border-2 border-stone-900 hover:shadow-[2px_2px_0_#1c1917]"
                                            >
                                                Xử lý
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setResolvingReport(report)}
                                                className="px-3 py-1 text-xs font-bold uppercase bg-white border-2 border-stone-900 hover:shadow-[2px_2px_0_#1c1917]"
                                            >
                                                Chi tiết
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Resolve Modal */}
            {resolvingReport && (
                <div className="fixed inset-0 bg-stone-900/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                    <div className="bg-white border-4 border-stone-900 shadow-[8px_8px_0_#1c1917] max-w-2xl w-full flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="bg-amber-400 border-b-4 border-stone-900 p-4 flex justify-between items-center">
                            <h2 className="text-xl font-bold uppercase">Chi tiết xử lý báo cáo</h2>
                            <button onClick={() => setResolvingReport(null)} className="w-8 h-8 flex items-center justify-center bg-white border-2 border-stone-900 hover:bg-stone-100">✕</button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="border-2 border-stone-900 p-3 bg-stone-50">
                                    <p className="text-[10px] font-bold text-stone-500 uppercase">Người báo cáo</p>
                                    <p className="font-bold">{resolvingReport.reporterName} ({resolvingReport.reporterRole})</p>
                                </div>
                                <div className="border-2 border-stone-900 p-3 bg-stone-50">
                                    <p className="text-[10px] font-bold text-stone-500 uppercase">Bị báo cáo</p>
                                    <p className="font-bold">{resolvingReport.reportedClinicName || resolvingReport.reportedUserName}</p>
                                </div>
                            </div>

                            <div className="border-2 border-stone-900 p-3 bg-white">
                                <p className="text-[10px] font-bold text-stone-500 uppercase mb-1">Lý do báo cáo</p>
                                <p className="text-sm font-medium">{resolvingReport.reason}</p>
                            </div>

                            {resolvingReport.status !== 'PENDING' && (
                                <div className={`border-2 border-stone-900 p-3 ${resolvingReport.status === 'APPROVED' ? 'bg-mint-50' : 'bg-red-50'}`}>
                                    <p className="text-[10px] font-bold text-stone-500 uppercase mb-1">Quyết định của Admin</p>
                                    <div className="mb-2">{getStatusBadge(resolvingReport.status)}</div>
                                    <p className="text-sm font-medium">Ghi chú: {resolvingReport.adminNote}</p>
                                </div>
                            )}

                            {resolvingReport.status === 'PENDING' && (
                                <div>
                                    <p className="font-bold text-stone-900 mb-2 uppercase text-xs tracking-wider">Ghi chú giải quyết (Bắt buộc):</p>
                                    <textarea
                                        value={adminNote}
                                        onChange={(e) => setAdminNote(e.target.value)}
                                        placeholder="Nhập lý do duyệt hoặc từ chối báo cáo này..."
                                        className="w-full h-32 p-4 border-4 border-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium text-stone-700 resize-none"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t-4 border-stone-900 bg-stone-100 flex justify-end gap-3">
                            <button
                                onClick={() => setResolvingReport(null)}
                                className="px-6 py-2 font-bold uppercase bg-white border-2 border-stone-900 shadow-[4px_4px_0_#1c1917]"
                            >
                                Đóng
                            </button>
                            {resolvingReport.status === 'PENDING' && (
                                <>
                                    <button
                                        onClick={() => handleResolve('REJECTED')}
                                        disabled={isSubmitting || adminNote.trim().length < 5}
                                        className="px-6 py-2 font-bold uppercase bg-red-500 text-white border-2 border-stone-900 shadow-[4px_4px_0_#1c1917] disabled:opacity-50"
                                    >
                                        Từ chối
                                    </button>
                                    <button
                                        onClick={() => handleResolve('APPROVED')}
                                        disabled={isSubmitting || adminNote.trim().length < 5}
                                        className="px-6 py-2 font-bold uppercase bg-mint-400 border-2 border-stone-900 shadow-[4px_4px_0_#1c1917] disabled:opacity-50"
                                    >
                                        Duyệt
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
