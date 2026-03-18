import { useState, useEffect } from 'react';
import { useToast } from '../Toast';
import { createReport } from '../../services/reportService';
import { isAxiosError } from 'axios';

type ReporterContext = 'CLINIC_MANAGER' | 'PET_OWNER';

interface ReportBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookingId: string;
    bookingCode: string;
    onSuccess?: () => void;
    /** Ngữ cảnh: Clinic Manager báo cáo khách hàng vs Pet Owner báo cáo phòng khám */
    reporterContext?: ReporterContext;
}

export const ReportBookingModal = ({ isOpen, onClose, bookingId, bookingCode, onSuccess, reporterContext = 'PET_OWNER' }: ReportBookingModalProps) => {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setReason('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (reason.trim().length < 10) {
            showToast('error', 'Lý do báo cáo phải ít nhất 10 ký tự');
            return;
        }

        setIsSubmitting(true);
        try {
            await createReport({
                bookingId,
                reason: reason.trim()
            });
            showToast('success', 'Đã gửi báo cáo thành công. Admin sẽ sớm xem xét yêu cầu của bạn.');
            onSuccess?.();
        } catch (error) {
            console.error('Failed to create report:', error);
            const errorMessage = isAxiosError(error) && error.response?.data?.message 
                ? error.response.data.message 
                : 'Không thể gửi báo cáo. Vui lòng thử lại sau.';
            showToast('error', errorMessage);
        } finally {
            setIsSubmitting(false);
            onClose(); 
        }
    };

    return (
        <div className="fixed inset-0 bg-stone-900/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
            <div className="bg-white border-4 border-stone-900 shadow-[8px_8px_0_#1c1917] max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-red-500 border-b-4 border-stone-900 p-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white uppercase tracking-tight">Báo cáo vi phạm</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center bg-white border-2 border-stone-900 hover:bg-stone-100 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div className="mb-4">
                        <span className="text-xs font-bold text-stone-500 uppercase">
                            {reporterContext === 'CLINIC_MANAGER'
                                ? 'Đang báo cáo khách hàng trong lịch hẹn:'
                                : 'Đang báo cáo lịch hẹn:'}
                        </span>
                        <div className="font-mono font-bold text-stone-900">#{bookingCode}</div>
                    </div>
                    
                    <p className="font-bold text-stone-900 mb-2 uppercase text-xs tracking-wider">Lý do báo cáo:</p>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={reporterContext === 'CLINIC_MANAGER'
                            ? 'Vui lòng mô tả chi tiết hành vi vi phạm của khách hàng trong lịch hẹn này (spam, quấy rối, không hợp tác, vi phạm quy định phòng khám...)'
                            : 'Vui lòng mô tả chi tiết vấn đề bạn gặp phải (phát sinh lỗi, thái độ phục vụ, vi phạm chính sách...)'}
                        className="w-full h-40 p-4 border-4 border-stone-900 focus:outline-none focus:ring-2 focus:ring-red-400 font-medium text-stone-700 resize-none"
                    />
                    <p className="mt-2 text-[10px] text-stone-500 italic uppercase font-bold">
                        * Báo cáo này sẽ được gửi trực tiếp đến quản trị viên hệ thống để xử lý.
                    </p>
                </div>

                {/* Footer */}
                <div className="bg-stone-50 border-t-4 border-stone-900 p-4 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-6 py-2 font-bold uppercase bg-white border-2 border-stone-900 hover:shadow-[4px_4px_0_#1c1917] transition-all disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || reason.trim().length < 10}
                        className="px-6 py-2 font-bold uppercase bg-red-500 text-white border-2 border-stone-900 hover:shadow-[4px_4px_0_#1c1917] transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSubmitting ? 'Đang gửi...' : 'Gửi báo cáo'}
                    </button>
                </div>
            </div>
        </div>
    );
};
