import { useState, useEffect } from 'react';
import { useToast } from '../Toast';
import apiClient from '../../services/api/client';
import { checkoutBooking } from '../../services/bookingService';

const formatCurrency = (amount: number) => amount.toLocaleString('vi-VN') + 'đ';

interface Voucher {
  clinicVoucherId: string;
  voucherId: string;
  code: string;
  name: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxDiscountAmount: number;
  minOrderAmount: number;
  isEnabled: boolean;
  isVoucherValid: boolean;
  limitOnePerUser: boolean;
  requireOnlinePayment: boolean;
}

interface CheckoutModalProps {
  bookingId: string;
  bookingCode: string;
  totalPrice: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CheckoutModal({ bookingId, bookingCode, totalPrice, isOpen, onClose, onSuccess }: CheckoutModalProps) {
    const { showToast } = useToast();
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [selectedVoucherId, setSelectedVoucherId] = useState<string>('');
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadVouchers();
            setSelectedVoucherId('');
        }
    }, [isOpen]);

    const loadVouchers = async () => {
        setIsLoading(true);
        try {
            const res = await apiClient.get('/vouchers/clinic-manager/my-vouchers');
            // Filter active + no online_payment_require requirement since this is for manual checkout
            const valid = (res.data.clinicVouchers || []).filter((v: Voucher) => 
                v.isEnabled && v.isVoucherValid && v.minOrderAmount <= totalPrice && !v.requireOnlinePayment
            );
            setVouchers(valid);
        } catch (e) {
            console.error('Error loading vouchers', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCheckout = async () => {
        try {
            setIsCheckingOut(true);
            const payload: any = {};
            if (selectedVoucherId) {
                if (selectedVoucherId === 'remove') {
                    payload.removeVoucher = true;
                } else {
                    payload.voucherId = selectedVoucherId;
                }
            }
            await checkoutBooking(bookingId, payload);
            showToast('success', 'Thanh toán tiền mặt thành công!');
            onSuccess();
            onClose();
        } catch (e: any) {
            showToast('error', e.response?.data?.message || 'Lỗi thanh toán');
        } finally {
            setIsCheckingOut(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md border-4 border-stone-900 shadow-[8px_8px_0_#1c1917] p-6 relative">
                 <h2 className="text-xl font-bold uppercase mb-4 text-stone-900 border-b-4 border-stone-900 pb-2">Thu Tiền Mặt: {bookingCode}</h2>
                 
                 <div className="mb-4">
                     <p className="text-sm font-bold text-stone-500 uppercase mb-2">Tổng hóa đơn</p>
                     <p className="text-3xl font-black text-amber-600">{formatCurrency(totalPrice)}</p>
                 </div>

                 <div className="mb-6">
                     <p className="text-sm font-bold text-stone-500 uppercase mb-2">Áp dụng Voucher</p>
                     {isLoading ? (
                         <div className="text-sm font-bold text-stone-400">Đang tải danh sách ưu đãi...</div>
                     ) : (
                         <select 
                            value={selectedVoucherId} 
                            onChange={e => setSelectedVoucherId(e.target.value)}
                            className="w-full border-2 border-stone-900 p-3 font-bold text-sm bg-white focus:outline-none focus:ring-0 shadow-[4px_4px_0_#1c1917]"
                         >
                             <option value="">-- Giữ nguyên hóa đơn --</option>
                             <option value="remove">❌ Gỡ bỏ voucher cũ (Nếu có)</option>
                             {vouchers.map(v => (
                                 <option key={v.voucherId} value={v.voucherId}>
                                    Mã: {v.code} - Giảm {v.discountType === 'PERCENTAGE' ? `${v.discountValue}%` : formatCurrency(v.discountValue)}
                                 </option>
                             ))}
                         </select>
                     )}
                     <p className="text-[10px] text-stone-500 mt-2 font-bold uppercase">* List này chỉ tải các Voucher hợp lệ với [Tổng hóa đơn]</p>
                 </div>

                 <div className="flex justify-end gap-3 mt-6">
                    <button type="button" onClick={onClose} disabled={isCheckingOut} className="px-6 py-2.5 bg-stone-200 border-2 border-stone-900 font-bold uppercase hover:bg-stone-300">Hủy</button>
                    <button type="button" onClick={handleCheckout} disabled={isCheckingOut} className="px-6 py-2.5 bg-mint-400 border-2 border-stone-900 font-bold uppercase shadow-[4px_4px_0_#1c1917] hover:shadow-[6px_6px_0_#1c1917] hover:-translate-y-1 transition-all disabled:opacity-50">
                        {isCheckingOut ? 'Đang...' : 'Hoàn tất & Lưu'}
                    </button>
                </div>
            </div>
        </div>
    );
}
