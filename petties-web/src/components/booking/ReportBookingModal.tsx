import { useState, useEffect, useMemo } from 'react';
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { useToast } from '../Toast';
import { createReport, updateReport } from '../../services/reportService';
import type { ReportResponse } from '../../types/report';
import { isAxiosError } from 'axios';

type ReporterContext = 'CLINIC_MANAGER' | 'PET_OWNER';

const MAX_IMAGES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function formatBookingDateVi(dateStr: string): string {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface ReportBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookingId: string;
    bookingCode: string;
    /** Tên phòng khám + ngày/giờ lịch hẹn (hiển thị thay cho mã booking khi có tên phòng khám) */
    clinicName?: string;
    bookingDate?: string;
    bookingTime?: string;
    onSuccess?: () => void;
    /** Ngữ cảnh: Clinic Manager báo cáo khách hàng vs Pet Owner báo cáo phòng khám */
    reporterContext?: ReporterContext;
    mode?: 'create' | 'edit';
    /** Bắt buộc khi mode === 'edit' */
    reportId?: string;
    initialReport?: ReportResponse;
}

export const ReportBookingModal = ({
    isOpen,
    onClose,
    bookingId,
    bookingCode,
    clinicName,
    bookingDate,
    bookingTime,
    onSuccess,
    reporterContext = 'PET_OWNER',
    mode = 'create',
    reportId,
    initialReport,
}: ReportBookingModalProps) => {
    const [reason, setReason] = useState('');
    const [remoteUrls, setRemoteUrls] = useState<string[]>([]);
    const [localFiles, setLocalFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showToast } = useToast();

    const previews = useMemo(
        () => localFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
        [localFiles]
    );

    useEffect(() => {
        return () => {
            previews.forEach((p) => URL.revokeObjectURL(p.url));
        };
    }, [previews]);

    useEffect(() => {
        if (!isOpen) return;
        if (mode === 'edit' && initialReport) {
            setReason(initialReport.reason);
            setRemoteUrls(initialReport.attachmentUrls?.length ? [...initialReport.attachmentUrls] : []);
        } else {
            setReason('');
            setRemoteUrls([]);
        }
        setLocalFiles([]);
    }, [isOpen, mode, initialReport]);

    if (!isOpen) return null;

    const totalCount = remoteUrls.length + localFiles.length;
    const trimmedReason = reason.trim();
    const reasonLength = trimmedReason.length;
    const minReasonLength = 10;
    const remainingChars = Math.max(0, minReasonLength - reasonLength);
    const isReasonValid = reasonLength >= minReasonLength;

    const handlePickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const list = e.target.files;
        if (!list?.length) return;
        const next: File[] = [...localFiles];
        for (let i = 0; i < list.length; i++) {
            if (next.length + remoteUrls.length >= MAX_IMAGES) {
                showToast('error', `Tối đa ${MAX_IMAGES} ảnh đính kèm`);
                break;
            }
            const file = list[i];
            if (!file.type.startsWith('image/')) {
                showToast('error', 'Chỉ chấp nhận file ảnh');
                continue;
            }
            if (file.size > MAX_FILE_BYTES) {
                showToast('error', 'Mỗi ảnh tối đa 10MB');
                continue;
            }
            next.push(file);
        }
        setLocalFiles(next);
        e.target.value = '';
    };

    const removeRemote = (index: number) => {
        setRemoteUrls((prev) => prev.filter((_, i) => i !== index));
    };

    const removeLocal = (index: number) => {
        setLocalFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (reason.trim().length < 10) {
            showToast('error', 'Lý do báo cáo phải ít nhất 10 ký tự');
            return;
        }

        if (mode === 'edit' && !reportId) {
            showToast('error', 'Thiếu thông tin báo cáo');
            return;
        }

        setIsSubmitting(true);
        try {
            if (mode === 'edit' && reportId) {
                await updateReport(reportId, reason.trim(), localFiles, remoteUrls);
                showToast('success', 'Đã cập nhật báo cáo thành công.');
            } else {
                await createReport(bookingId, reason.trim(), localFiles);
                showToast('success', 'Đã gửi báo cáo thành công. Admin sẽ sớm xem xét yêu cầu của bạn.');
            }
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Failed to save report:', error);
            const errorMessage =
                isAxiosError(error) && error.response?.data?.message
                    ? String(error.response.data.message)
                    : mode === 'edit'
                      ? 'Không thể cập nhật báo cáo. Vui lòng thử lại sau.'
                      : 'Không thể gửi báo cáo. Vui lòng thử lại sau.';
            showToast('error', errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const title = mode === 'edit' ? 'Sửa báo cáo' : 'Báo cáo vi phạm';
    const primaryLabel =
        mode === 'edit' ? (isSubmitting ? 'Đang lưu...' : 'Cập nhật báo cáo') : isSubmitting ? 'Đang gửi...' : 'Gửi báo cáo';

    return (
        <div className="fixed inset-0 bg-stone-900/80 flex items-center justify-center z-100 p-4 backdrop-blur-sm">
            <div className="bg-white border-4 border-stone-900 shadow-[8px_8px_0_#1c1917] max-w-lg w-full max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 sm:max-w-xl">
                <div className="bg-red-500 border-b-4 border-stone-900 p-5 flex justify-between items-center shrink-0">
                    <h2 className="text-2xl font-bold text-white uppercase tracking-tight">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-8 h-8 flex items-center justify-center bg-white border-2 border-stone-900 hover:bg-stone-100 transition-colors disabled:opacity-50"
                        aria-label="Đóng"
                    >
                        <XMarkIcon className="w-5 h-5 text-stone-900" />
                    </button>
                </div>

                <div className="p-6 sm:p-8 overflow-y-auto flex-1 min-h-0">
                    <div className="mb-4">
                        <span className="text-xs font-bold text-stone-500 uppercase">
                            {reporterContext === 'CLINIC_MANAGER'
                                ? 'Đang báo cáo khách hàng trong lịch hẹn:'
                                : 'Đang báo cáo lịch hẹn:'}
                        </span>
                        <div className="mt-1 space-y-1">
                            {clinicName ? (
                                <>
                                    <div className="font-bold text-stone-900 text-base">{clinicName}</div>
                                    {(bookingDate || bookingTime) && (
                                        <div className="text-sm font-medium text-stone-700">
                                            {bookingDate ? formatBookingDateVi(bookingDate) : ''}
                                            {bookingDate && bookingTime ? ' · ' : ''}
                                            {bookingTime ?? ''}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="font-mono font-bold text-stone-900">#{bookingCode}</div>
                            )}
                        </div>
                    </div>

                    <p className="font-bold text-stone-900 mb-2 uppercase text-xs tracking-wider">Lý do báo cáo:</p>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={
                            reporterContext === 'CLINIC_MANAGER'
                                ? 'Vui lòng mô tả chi tiết hành vi vi phạm của khách hàng trong lịch hẹn này (spam, quấy rối, không hợp tác, vi phạm quy định phòng khám...)'
                                : 'Vui lòng mô tả chi tiết vấn đề bạn gặp phải (phát sinh lỗi, thái độ phục vụ, vi phạm chính sách...)'
                        }
                        className="w-full h-40 p-4 border-4 border-stone-900 focus:outline-none focus:ring-2 focus:ring-red-400 font-medium text-stone-700 resize-none"
                    />
                    <p
                        className={`mt-2 text-xs font-bold ${
                            reasonLength === 0
                                ? 'text-stone-500'
                                : isReasonValid
                                  ? 'text-emerald-700'
                                  : 'text-red-600'
                        }`}
                    >
                        {reasonLength === 0
                            ? 'Vui lòng nhập tối thiểu 10 ký tự.'
                            : isReasonValid
                              ? 'Lý do đã hợp lệ, bạn có thể gửi báo cáo.'
                              : `Lý do chưa đủ 10 ký tự (còn thiếu ${remainingChars} ký tự).`}
                    </p>

                    <p className="mt-4 font-bold text-stone-900 mb-2 uppercase text-xs tracking-wider">Ảnh minh chứng (tùy chọn)</p>
                    <p className="text-[10px] text-stone-500 font-bold uppercase mb-2">
                        Tối đa {MAX_IMAGES} ảnh, mỗi ảnh tối đa 10MB ({totalCount}/{MAX_IMAGES})
                    </p>

                    {totalCount > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {remoteUrls.map((url, index) => (
                                <div
                                    key={`r-${url}-${index}`}
                                    className="relative w-20 h-20 border-2 border-stone-900 bg-stone-100 overflow-hidden shrink-0"
                                >
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeRemote(index)}
                                        disabled={isSubmitting}
                                        className="absolute top-0 right-0 w-6 h-6 bg-stone-900 text-white text-xs font-bold flex items-center justify-center hover:bg-red-600 disabled:opacity-50"
                                        aria-label="Xóa ảnh"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {previews.map((p, index) => (
                                <div
                                    key={`l-${p.url}`}
                                    className="relative w-20 h-20 border-2 border-stone-900 bg-stone-100 overflow-hidden shrink-0"
                                >
                                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeLocal(index)}
                                        disabled={isSubmitting}
                                        className="absolute top-0 right-0 w-6 h-6 bg-stone-900 text-white text-xs font-bold flex items-center justify-center hover:bg-red-600 disabled:opacity-50"
                                        aria-label="Xóa ảnh"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <label className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-stone-900 bg-stone-50 hover:bg-amber-50 cursor-pointer font-bold uppercase text-xs text-stone-700">
                        <PhotoIcon className="w-5 h-5" />
                        Chọn ảnh
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handlePickFiles}
                            disabled={isSubmitting || totalCount >= MAX_IMAGES}
                        />
                    </label>

                    <p className="mt-3 text-[10px] text-stone-500 italic uppercase font-bold">
                        * Báo cáo này sẽ được gửi trực tiếp đến quản trị viên hệ thống để xử lý.
                    </p>
                </div>

                <div className="bg-stone-50 border-t-4 border-stone-900 p-5 flex gap-3 justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-6 py-2 font-bold uppercase bg-white border-2 border-stone-900 hover:shadow-[4px_4px_0_#1c1917] transition-all disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !isReasonValid}
                        className="px-6 py-2 font-bold uppercase bg-red-500 text-white border-2 border-stone-900 hover:shadow-[4px_4px_0_#1c1917] transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {primaryLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
