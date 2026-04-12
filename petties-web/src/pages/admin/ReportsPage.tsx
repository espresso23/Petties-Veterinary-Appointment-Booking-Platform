import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/Toast';
import { getAllReportsForAdmin, resolveReport } from '../../services/reportService';
import { getStrikeConfig, updateStrikeConfig } from '../../services/strikeConfigService';
import { clinicService } from '../../services/api/clinicService';
import { getStruckPetOwners, type UserProfile } from '../../services/api/userService';
import type { ReportResponse, ReportStatus } from '../../types/report';
import type { ClinicResponse } from '../../types/clinic';
import { isAxiosError } from 'axios';
import { Cog6ToothIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import '../../styles/brutalist.css';

const REPORT_ROLE_LABELS: Record<string, string> = {
    PET_OWNER: 'Chủ thú cưng',
    CLINIC_OWNER: 'Chủ phòng khám',
    CLINIC_MANAGER: 'Quản lý phòng khám',
    STAFF: 'Nhân viên',
    ADMIN: 'Quản trị viên',
};

function formatReportRole(role: string | undefined): string {
    if (!role) return '—';
    return REPORT_ROLE_LABELS[role] ?? role;
}

type TabType = 'reports' | 'struck';
type StruckSubTab = 'clinics' | 'petOwners';

export const ReportsPage = () => {
    const [activeTab, setActiveTab] = useState<TabType>('reports');
    const [struckSubTab, setStruckSubTab] = useState<StruckSubTab>('clinics');
    const [reports, setReports] = useState<ReportResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<ReportStatus | 'ALL'>('ALL');
    const { showToast } = useToast();

    const [struckClinics, setStruckClinics] = useState<ClinicResponse[]>([]);
    const [struckPetOwners, setStruckPetOwners] = useState<UserProfile[]>([]);
    const [loadingStruck, setLoadingStruck] = useState(false);

    // Resolution Modal state
    const [resolvingReport, setResolvingReport] = useState<ReportResponse | null>(null);
    const [adminNote, setAdminNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Strike Config Modal
    const [showStrikeConfig, setShowStrikeConfig] = useState(false);
    const [strikeConfig, setStrikeConfig] = useState<Record<string, string> | null>(null);
    const [strikeConfigEdits, setStrikeConfigEdits] = useState<Record<string, string>>({});

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

    const fetchStruckClinics = useCallback(async () => {
        setLoadingStruck(true);
        try {
            const data = await clinicService.getStruckClinics(0, 50);
            setStruckClinics(data.content || []);
        } catch (error) {
            console.error('Failed to fetch struck clinics:', error);
            showToast('error', 'Không thể tải danh sách phòng khám bị hạn chế');
        } finally {
            setLoadingStruck(false);
        }
    }, [showToast]);

    const fetchStruckPetOwners = useCallback(async () => {
        setLoadingStruck(true);
        try {
            const data = await getStruckPetOwners(0, 50);
            setStruckPetOwners(data.content || []);
        } catch (error) {
            console.error('Failed to fetch struck pet owners:', error);
            showToast('error', 'Không thể tải danh sách chủ thú cưng bị hạn chế');
        } finally {
            setLoadingStruck(false);
        }
    }, [showToast]);

    useEffect(() => {
        if (activeTab === 'struck') {
            if (struckSubTab === 'clinics') fetchStruckClinics();
            else fetchStruckPetOwners();
        }
    }, [activeTab, struckSubTab, fetchStruckClinics, fetchStruckPetOwners]);

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

    const openStrikeConfig = useCallback(async () => {
        try {
            const data = await getStrikeConfig();
            setStrikeConfig(data.configs);
            setStrikeConfigEdits(data.configs || {});
            setShowStrikeConfig(true);
        } catch {
            showToast('error', 'Không thể tải cấu hình strike');
        }
    }, [showToast]);

    const handleSaveStrikeConfig = async (key: string, value: string) => {
        try {
            await updateStrikeConfig({ configKey: key, configValue: value });
            showToast('success', 'Đã cập nhật cấu hình');
            setStrikeConfig((prev) => (prev ? { ...prev, [key]: value } : null));
        } catch {
            showToast('error', 'Không thể cập nhật');
        }
    };

    const isPermanentStrike = (d: string | null | undefined) => d && d.startsWith('9999');
    const formatStrikeUntil = (d: string | null | undefined) => {
        if (!d) return '-';
        if (isPermanentStrike(d)) return 'Vĩnh viễn';
        return new Date(d).toLocaleDateString('vi-VN');
    };
    const trimmedAdminNote = adminNote.trim();
    const adminNoteMinLength = 5;
    const adminNoteLength = trimmedAdminNote.length;
    const adminNoteRemaining = Math.max(0, adminNoteMinLength - adminNoteLength);
    const isAdminNoteValid = adminNoteLength >= adminNoteMinLength;

    const STRIKE_DESCRIPTIONS: Record<string, string> = {
        strike_threshold: 'Số report được approve để kích hoạt strike (mặc định: 3)',
        strike_permanent_threshold: 'Số report để block vĩnh viễn (>= ngưỡng này = hạn chế không thời hạn). Đặt 0 để tắt (mặc định: 7)',
        strike_duration_days: 'Số ngày clinic bị hạn chế (mặc định: 7)',
        strike_window_days: 'Chỉ tính report trong X ngày gần nhất (mặc định: 90)',
    };

    const attachmentList = (r: ReportResponse) =>
        (r.attachmentUrls ?? []).filter((u) => typeof u === 'string' && u.trim().length > 0);

    const getStatusBadge = (status: ReportStatus) => {
        const styles = {
            PENDING: 'bg-yellow-400 text-stone-900',
            APPROVED: 'bg-mint-400 text-stone-900',
            REJECTED: 'bg-red-500 text-white',
            WITHDRAWN: 'bg-stone-300 text-stone-900',
        };
        const labels = {
            PENDING: 'Chờ xử lý',
            APPROVED: 'Đã duyệt',
            REJECTED: 'Từ chối',
            WITHDRAWN: 'Đã rút',
        };
        return (
            <span className={`px-3 py-1 text-xs font-bold uppercase border-2 border-stone-900 ${styles[status]}`}>
                {labels[status]}
            </span>
        );
    };

    return (
        <div className="p-6 bg-stone-50 min-h-screen">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 uppercase tracking-wide">
                        QUẢN LÝ BÁO CÁO
                    </h1>
                    <p className="text-stone-600 mt-1">
                        Xem và xử lý các báo cáo vi phạm từ người dùng và phòng khám
                    </p>
                </div>
                <button
                    onClick={openStrikeConfig}
                    className="px-4 py-2 font-bold text-sm uppercase border-2 border-stone-900 bg-white hover:bg-amber-50 shadow-[4px_4px_0_#1c1917] flex items-center gap-2"
                >
                    <Cog6ToothIcon className="w-5 h-5" />
                    Cấu hình Strike
                </button>
            </header>

            {/* Tabs */}
            <div className="mb-6 flex gap-2 border-b-4 border-stone-900 pb-3">
                <button
                    onClick={() => setActiveTab('reports')}
                    className={`px-6 py-3 font-bold text-sm uppercase border-2 border-stone-900 transition-all ${
                        activeTab === 'reports' ? 'bg-amber-400 shadow-[4px_4px_0_#1c1917]' : 'bg-white hover:bg-stone-100'
                    }`}
                >
                    Báo cáo
                </button>
                <button
                    onClick={() => setActiveTab('struck')}
                    className={`px-6 py-3 font-bold text-sm uppercase border-2 border-stone-900 transition-all ${
                        activeTab === 'struck' ? 'bg-amber-400 shadow-[4px_4px_0_#1c1917]' : 'bg-white hover:bg-stone-100'
                    }`}
                >
                    Hạn chế
                </button>
            </div>

            {/* Filters - only for reports tab */}
            {activeTab === 'reports' && (
            <div className="mb-6 flex gap-2">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 font-bold text-sm uppercase border-2 border-stone-900 transition-all ${filterStatus === status
                            ? 'bg-amber-400 shadow-[4px_4px_0_#1c1917]'
                            : 'bg-white hover:bg-stone-100'
                            }`}
                    >
                        {status === 'ALL'
                            ? 'Tất cả'
                            : status === 'PENDING'
                              ? 'Chờ xử lý'
                              : status === 'APPROVED'
                                ? 'Đã duyệt'
                                : status === 'REJECTED'
                                  ? 'Từ chối'
                                  : 'Đã rút'}
                    </button>
                ))}
            </div>
            )}

            {/* Reports Table */}
            {activeTab === 'reports' && (
            <div className="bg-white border-4 border-stone-900 shadow-brutal overflow-hidden">
                <table className="w-full">
                    <thead className="border-b-4 border-stone-900 bg-stone-100">
                        <tr className="text-left font-bold uppercase text-xs tracking-wider">
                            <th className="p-4">Mã Booking</th>
                            <th className="p-4">Người báo cáo</th>
                            <th className="p-4">Bị báo cáo</th>
                            <th className="p-4 w-36">Ảnh minh chứng</th>
                            <th className="p-4">Lý do</th>
                            <th className="p-4 text-center">Trạng thái</th>
                            <th className="p-4 text-center">Ngày tạo</th>
                            <th className="p-4 text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-stone-600">Đang tải...</td>
                            </tr>
                        ) : reports.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-stone-600">Không có báo cáo nào</td>
                            </tr>
                        ) : (
                            reports.map((report) => (
                                <tr key={report.id} className="border-b-2 border-stone-200 hover:bg-amber-50">
                                    <td className="p-4 font-mono font-bold">{report.bookingCode}</td>
                                    <td className="p-4">
                                        <div className="font-bold">{report.reporterName || '—'}</div>
                                        <div className="text-[10px] text-stone-600 font-bold uppercase">
                                            {formatReportRole(report.reporterRole)}
                                        </div>
                                        {report.reporterPhone && (
                                            <div className="text-xs text-stone-500 mt-0.5">{report.reporterPhone}</div>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        {report.reportedClinicName ? (
                                            <>
                                                <div className="font-bold">{report.reportedClinicName}</div>
                                                <div className="text-[10px] text-stone-600 font-bold uppercase">Phòng khám</div>
                                                {report.reportedClinicPhone && (
                                                    <div className="text-xs text-stone-500 mt-0.5">{report.reportedClinicPhone}</div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <div className="font-bold">{report.reportedUserName || '—'}</div>
                                                <div className="text-[10px] text-stone-600 font-bold uppercase">
                                                    {formatReportRole(report.reportedUserRole)}
                                                </div>
                                                {report.reportedUserPhone && (
                                                    <div className="text-xs text-stone-500 mt-0.5">{report.reportedUserPhone}</div>
                                                )}
                                            </>
                                        )}
                                    </td>
                                    <td className="p-4 align-top">
                                        {attachmentList(report).length === 0 ? (
                                            <span className="text-xs text-stone-400 font-bold uppercase">Không có</span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {attachmentList(report)
                                                    .slice(0, 3)
                                                    .map((url) => (
                                                        <a
                                                            key={url}
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="block w-12 h-12 border-2 border-stone-900 bg-stone-100 overflow-hidden shrink-0 hover:opacity-90"
                                                            title="Xem ảnh"
                                                        >
                                                            <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                        </a>
                                                    ))}
                                                {attachmentList(report).length > 3 && (
                                                    <span className="text-[10px] font-bold self-center px-1">
                                                        +{attachmentList(report).length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}
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
            )}

            {/* Struck Tab - Sub-tabs: Phòng khám | Chủ thú cưng */}
            {activeTab === 'struck' && (
            <div className="space-y-4">
                <div className="flex gap-2">
                    <button
                        onClick={() => setStruckSubTab('clinics')}
                        className={`px-4 py-2 font-bold text-sm uppercase border-2 border-stone-900 transition-all ${
                            struckSubTab === 'clinics' ? 'bg-amber-400 shadow-[4px_4px_0_#1c1917]' : 'bg-white hover:bg-stone-100'
                        }`}
                    >
                        Phòng khám
                    </button>
                    <button
                        onClick={() => setStruckSubTab('petOwners')}
                        className={`px-4 py-2 font-bold text-sm uppercase border-2 border-stone-900 transition-all ${
                            struckSubTab === 'petOwners' ? 'bg-amber-400 shadow-[4px_4px_0_#1c1917]' : 'bg-white hover:bg-stone-100'
                        }`}
                    >
                        Chủ thú cưng
                    </button>
                </div>

                {struckSubTab === 'clinics' && (
                <div className="bg-white border-4 border-stone-900 shadow-brutal overflow-hidden">
                    <table className="w-full">
                        <thead className="border-b-4 border-stone-900 bg-stone-100">
                            <tr className="text-left font-bold uppercase text-xs tracking-wider">
                                <th className="p-4">Phòng khám</th>
                                <th className="p-4">Địa chỉ</th>
                                <th className="p-4">Chủ sở hữu</th>
                                <th className="p-4">Hạn chế đến</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingStruck ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-stone-600">Đang tải...</td>
                                </tr>
                            ) : struckClinics.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-stone-600">
                                        Không có phòng khám nào đang bị hạn chế
                                    </td>
                                </tr>
                            ) : (
                                struckClinics.map((clinic) => (
                                    <tr key={clinic.clinicId} className="border-b-2 border-stone-200 hover:bg-amber-50">
                                        <td className="p-4">
                                            <div className="font-bold">{clinic.name}</div>
                                            <div className="text-[10px] text-stone-500 font-mono">{clinic.clinicId.slice(0, 8)}...</div>
                                        </td>
                                        <td className="p-4 text-sm">
                                            {[clinic.address, clinic.ward, clinic.district, clinic.province].filter(Boolean).join(', ')}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold">{clinic.owner?.fullName || clinic.owner?.email || '—'}</div>
                                            <div className="text-[10px] text-stone-500">{clinic.owner?.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-3 py-1 text-xs font-bold uppercase border-2 border-stone-900 ${isPermanentStrike(clinic.strikeUntil) ? 'bg-stone-900 text-white' : 'bg-red-500 text-white'}`}>
                                                {formatStrikeUntil(clinic.strikeUntil)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                )}

                {struckSubTab === 'petOwners' && (
                <div className="bg-white border-4 border-stone-900 shadow-brutal overflow-hidden">
                    <table className="w-full">
                        <thead className="border-b-4 border-stone-900 bg-stone-100">
                            <tr className="text-left font-bold uppercase text-xs tracking-wider">
                                <th className="p-4">Chủ thú cưng</th>
                                <th className="p-4">Email / SĐT</th>
                                <th className="p-4">Hạn chế đến</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingStruck ? (
                                <tr>
                                    <td colSpan={3} className="p-8 text-center text-stone-600">Đang tải...</td>
                                </tr>
                            ) : struckPetOwners.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-8 text-center text-stone-600">
                                        Không có chủ thú cưng nào đang bị hạn chế
                                    </td>
                                </tr>
                            ) : (
                                struckPetOwners.map((user) => (
                                    <tr key={user.userId} className="border-b-2 border-stone-200 hover:bg-amber-50">
                                        <td className="p-4">
                                            <div className="font-bold">{user.fullName || user.username}</div>
                                            <div className="text-[10px] text-stone-500 font-mono">{user.userId.slice(0, 8)}...</div>
                                        </td>
                                        <td className="p-4 text-sm">
                                            <div>{user.email || '—'}</div>
                                            <div className="text-[10px] text-stone-500">{user.phone || ''}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-3 py-1 text-xs font-bold uppercase border-2 border-stone-900 ${isPermanentStrike(user.strikeUntil) ? 'bg-stone-900 text-white' : 'bg-red-500 text-white'}`}>
                                                {formatStrikeUntil(user.strikeUntil)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                )}
            </div>
            )}

            {/* Resolve Modal */}
            {resolvingReport && (
                <div className="fixed inset-0 bg-stone-900/80 flex items-center justify-center z-100 p-4 backdrop-blur-sm">
                    <div className="bg-white border-4 border-stone-900 shadow-[8px_8px_0_#1c1917] max-w-2xl w-full flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="bg-amber-400 border-b-4 border-stone-900 p-4 flex justify-between items-center">
                            <h2 className="text-xl font-bold uppercase">Chi tiết xử lý báo cáo</h2>
                            <button
                                type="button"
                                onClick={() => setResolvingReport(null)}
                                className="w-8 h-8 flex items-center justify-center bg-white border-2 border-stone-900 hover:bg-stone-100"
                                aria-label="Đóng"
                            >
                                <XMarkIcon className="w-5 h-5 text-stone-900" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                            <div className="text-xs font-bold uppercase text-stone-500">
                                Mã lịch hẹn:{' '}
                                <span className="font-mono text-stone-900">{resolvingReport.bookingCode}</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="border-2 border-stone-900 p-3 bg-stone-50 rounded-xl">
                                    <p className="text-[10px] font-bold text-stone-500 uppercase mb-1">Người báo cáo</p>
                                    <p className="font-bold text-stone-900">{resolvingReport.reporterName || '—'}</p>
                                    <p className="text-xs text-stone-600 mt-0.5">{formatReportRole(resolvingReport.reporterRole)}</p>
                                    {resolvingReport.reporterPhone && (
                                        <p className="text-xs text-stone-500 mt-1">Số điện thoại: {resolvingReport.reporterPhone}</p>
                                    )}
                                </div>
                                <div className="border-2 border-stone-900 p-3 bg-stone-50 rounded-xl">
                                    <p className="text-[10px] font-bold text-stone-500 uppercase mb-1">Bị báo cáo</p>
                                    {resolvingReport.reportedClinicName ? (
                                        <>
                                            <p className="font-bold text-stone-900">{resolvingReport.reportedClinicName}</p>
                                            <p className="text-xs text-stone-600 mt-0.5">Phòng khám</p>
                                            {resolvingReport.reportedClinicPhone && (
                                                <p className="text-xs text-stone-500 mt-1">Số điện thoại: {resolvingReport.reportedClinicPhone}</p>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <p className="font-bold text-stone-900">{resolvingReport.reportedUserName || '—'}</p>
                                            <p className="text-xs text-stone-600 mt-0.5">{formatReportRole(resolvingReport.reportedUserRole)}</p>
                                            {resolvingReport.reportedUserPhone && (
                                                <p className="text-xs text-stone-500 mt-1">Số điện thoại: {resolvingReport.reportedUserPhone}</p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="border-2 border-stone-900 p-3 bg-white rounded-xl">
                                <p className="text-[10px] font-bold text-stone-500 uppercase mb-1">Lý do báo cáo</p>
                                <p className="text-sm font-medium text-stone-800 whitespace-pre-wrap">{resolvingReport.reason}</p>
                            </div>

                            <div className="border-2 border-stone-900 p-3 bg-stone-50 rounded-xl">
                                <p className="text-[10px] font-bold text-stone-500 uppercase mb-2 flex items-center gap-2">
                                    <PhotoIcon className="w-4 h-4" />
                                    Ảnh minh chứng
                                </p>
                                {attachmentList(resolvingReport).length === 0 ? (
                                    <p className="text-sm text-stone-500">Không có ảnh đính kèm.</p>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {attachmentList(resolvingReport).map((url) => (
                                            <a
                                                key={url}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block aspect-square border-2 border-stone-900 bg-white overflow-hidden shadow-[2px_2px_0_#1c1917] hover:opacity-95"
                                            >
                                                <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                            </a>
                                        ))}
                                    </div>
                                )}
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
                                    <p
                                        className={`mt-2 text-xs font-bold ${
                                            adminNoteLength === 0
                                                ? 'text-stone-500'
                                                : isAdminNoteValid
                                                    ? 'text-emerald-700'
                                                    : 'text-red-600'
                                            }`}
                                    >
                                        {adminNoteLength === 0
                                            ? 'Vui lòng nhập tối thiểu 5 ký tự.'
                                            : isAdminNoteValid
                                                ? 'Ghi chú đã hợp lệ, bạn có thể xử lý báo cáo.'
                                                : `Ghi chú chưa đủ 5 ký tự (còn thiếu ${adminNoteRemaining} ký tự).`}
                                    </p>
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
                                        disabled={isSubmitting || !isAdminNoteValid}
                                        className="px-6 py-2 font-bold uppercase bg-red-500 text-white border-2 border-stone-900 shadow-[4px_4px_0_#1c1917] disabled:opacity-50"
                                    >
                                        Từ chối
                                    </button>
                                    <button
                                        onClick={() => handleResolve('APPROVED')}
                                        disabled={isSubmitting || !isAdminNoteValid}
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

            {/* Strike Config Modal */}
            {showStrikeConfig && strikeConfig && (
                <div className="fixed inset-0 bg-stone-900/80 flex items-center justify-center z-100 p-4 backdrop-blur-sm">
                    <div className="bg-white border-4 border-stone-900 shadow-[8px_8px_0_#1c1917] max-w-md w-full">
                        <div className="bg-amber-400 border-b-4 border-stone-900 p-4 flex justify-between items-center">
                            <h2 className="text-xl font-bold uppercase">Cấu hình ngưỡng Strike</h2>
                            <button
                                type="button"
                                onClick={() => setShowStrikeConfig(false)}
                                className="w-8 h-8 flex items-center justify-center bg-white border-2 border-stone-900 hover:bg-stone-100"
                                aria-label="Đóng"
                            >
                                <XMarkIcon className="w-5 h-5 text-stone-900" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-stone-600">
                                Khi clinic nhận đủ số report được approve trong cửa sổ thời gian, clinic sẽ bị hạn chế.
                            </p>
                            {Object.entries(strikeConfig).map(([key, value]) => (
                                <div key={key}>
                                    <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                                        {STRIKE_DESCRIPTIONS[key] || key}
                                    </label>
                                    <input
                                        type="text"
                                        value={strikeConfigEdits[key] ?? value}
                                        onChange={(e) => setStrikeConfigEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                                        onBlur={(e) => {
                                            const v = e.target.value.trim();
                                            if (v && v !== value) handleSaveStrikeConfig(key, v);
                                        }}
                                        className="w-full p-3 border-2 border-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t-4 border-stone-900 bg-stone-100">
                            <button
                                onClick={() => setShowStrikeConfig(false)}
                                className="w-full px-6 py-2 font-bold uppercase bg-white border-2 border-stone-900 shadow-[4px_4px_0_#1c1917]"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
