import { useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { useToast } from '../Toast';
import { checkQrPaymentStatus } from '../../services/paymentService';

interface QrPaymentPanelProps {
    bookingId: string;
    bookingStatus?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    qrImageUrl?: string;
    paymentDescription?: string;
    canShowQrPaymentButton?: boolean;
    onBookingRefresh?: () => Promise<void> | void;
}

const formatUpper = (value?: string): string => (value || '').trim().toUpperCase();

export const QrPaymentPanel = ({
    bookingId,
    bookingStatus,
    paymentMethod,
    paymentStatus,
    qrImageUrl,
    paymentDescription,
    canShowQrPaymentButton,
    onBookingRefresh,
}: QrPaymentPanelProps) => {
    const { showToast } = useToast();
    const [isChecking, setIsChecking] = useState(false);

    const normalizedBookingStatus = formatUpper(bookingStatus);
    const normalizedMethod = formatUpper(paymentMethod);
    const normalizedPaymentStatus = formatUpper(paymentStatus);

    const shouldRender = useMemo(() => {
        const hasPayload = Boolean((qrImageUrl || '').trim() || (paymentDescription || '').trim());
        if (!hasPayload) {
            return false;
        }

        const completedQrUnpaidRule =
            normalizedBookingStatus === 'COMPLETED'
            && normalizedMethod === 'QR'
            && normalizedPaymentStatus !== 'PAID';

        if (canShowQrPaymentButton === true) {
            return completedQrUnpaidRule;
        }

        return completedQrUnpaidRule;
    }, [
        canShowQrPaymentButton,
        normalizedBookingStatus,
        normalizedMethod,
        normalizedPaymentStatus,
        paymentDescription,
        qrImageUrl,
    ]);

    if (!shouldRender) {
        return null;
    }

    const handleCheckPaymentStatus = async () => {
        setIsChecking(true);
        try {
            const result = await checkQrPaymentStatus(bookingId);
            const latestStatus = formatUpper(result.status);

            if (latestStatus === 'PAID') {
                showToast('success', 'Đã xác nhận thanh toán QR thành công');
            } else {
                showToast('info', result.message || 'Chưa tìm thấy giao dịch phù hợp. Vui lòng kiểm tra lại sau.');
            }

            if (onBookingRefresh) {
                await onBookingRefresh();
            }
        } catch (error) {
            const message =
                isAxiosError(error)
                    && error.response?.data
                    && typeof error.response.data === 'object'
                    && 'message' in error.response.data
                    ? String((error.response.data as { message?: unknown }).message)
                    : 'Không thể kiểm tra trạng thái thanh toán QR';

            showToast('error', message);
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div className="border-2 border-stone-900 bg-blue-50 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="text-xs font-bold uppercase text-stone-600">Thanh toán QR</div>
                    <div className="text-sm font-semibold text-stone-800">
                        Hiển thị mã QR để Pet Owner quét thanh toán ngay
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleCheckPaymentStatus}
                    disabled={isChecking}
                    className="px-4 py-2 bg-blue-500 text-white border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-[5px_5px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 font-bold text-xs uppercase transition-all disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_#1c1917]"
                >
                    {isChecking ? 'Đang kiểm tra...' : 'Kiểm tra thanh toán'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
                <div className="bg-white border-2 border-stone-900 p-3 flex items-center justify-center min-h-[220px]">
                    {qrImageUrl ? (
                        <img
                            src={qrImageUrl}
                            alt="Mã QR thanh toán"
                            className="w-full max-w-[190px] h-auto object-contain"
                        />
                    ) : (
                        <div className="text-center text-xs text-stone-500 font-medium">
                            Chưa có ảnh mã QR
                        </div>
                    )}
                </div>

                <div className="bg-white border-2 border-stone-900 p-3 space-y-2">
                    <div className="text-xs font-bold uppercase text-stone-600">Nội dung chuyển khoản</div>
                    <div className="border-2 border-stone-300 bg-stone-50 p-3 font-mono text-sm break-all text-stone-800">
                        {(paymentDescription || '').trim() || 'Chưa có nội dung chuyển khoản'}
                    </div>
                    <p className="text-xs text-stone-500">
                        Sau khi Pet Owner chuyển khoản, bấm <span className="font-bold">Kiểm tra thanh toán</span> để cập nhật trạng thái mới nhất.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default QrPaymentPanel;
