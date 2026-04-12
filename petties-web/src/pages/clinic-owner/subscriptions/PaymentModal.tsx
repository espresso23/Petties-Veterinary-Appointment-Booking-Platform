import React, { useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { subscriptionService, type SubscriptionPlan, type PaymentMethod } from '../../../services/api/subscriptionService'
import { useToast } from '../../../components/Toast'
import {
    QrCodeIcon,
    CreditCardIcon,
    XMarkIcon,
    ShieldCheckIcon,
    CurrencyDollarIcon
} from '@heroicons/react/24/outline'

interface PaymentModalProps {
    isOpen: boolean
    onClose: () => void
    plan: SubscriptionPlan
    clinicId: string
    onSuccess: () => void
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, plan, clinicId, onSuccess }) => {
    const { showToast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('QR')

    const handleConfirm = async () => {
        if (!clinicId) return

        setIsSubmitting(true)
        try {
            await subscriptionService.subscribe({
                planId: plan.planId,
                clinicId: clinicId,
                paymentMethod: selectedMethod
            })

            showToast(
                'success',
                `Đăng ký gói ${plan.name} thành công! Hệ thống đang chờ xác nhận thanh toán.`
            )
            onSuccess()
            onClose()
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Có lỗi xảy ra khi đăng ký'
            showToast('error', message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95 translateY(30px)"
                            enterTo="opacity-100 scale-100 translateY(0)"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100 translateY(0)"
                            leaveTo="opacity-0 scale-95 translateY(30px)"
                        >
                            <Dialog.Panel className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl border border-gray-100">
                                <div className="p-8 space-y-8">
                                    <div className="flex justify-between items-center">
                                        <div className="space-y-1">
                                            <Dialog.Title className="text-xl font-black text-gray-900 tracking-tight">
                                                Xác nhận thanh toán
                                            </Dialog.Title>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Bước cuối để nâng cấp phòng khám</p>
                                        </div>
                                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-2xl transition-all group active:scale-90">
                                            <XMarkIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-900" />
                                        </button>
                                    </div>

                                    <div className="p-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-blue-100/50 flex justify-between items-center group">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Gói dịch vụ</p>
                                            <p className="text-xl font-black text-gray-900 uppercase tracking-tight">{plan.name}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Tổng tiền</p>
                                            <p className="text-xl font-black text-indigo-600 tabular-nums">
                                                {plan.price.toLocaleString('vi-VN')} <span className="text-xs uppercase ml-0.5">VNĐ</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Chọn phương thức thanh toán</p>
                                        <div className="grid grid-cols-1 gap-3">
                                            <button
                                                onClick={() => setSelectedMethod('QR')}
                                                className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 border-2 ${selectedMethod === 'QR'
                                                    ? 'border-indigo-500 bg-white shadow-xl shadow-indigo-100 scale-[1.02]'
                                                    : 'border-gray-50 bg-gray-50/50 hover:border-gray-200 hover:bg-white'
                                                    }`}
                                            >
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedMethod === 'QR' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-400 shadow-sm'}`}>
                                                    <QrCodeIcon className="w-6 h-6" />
                                                </div>
                                                <div className="text-left flex-1">
                                                    <p className={`font-black uppercase tracking-tight text-sm ${selectedMethod === 'QR' ? 'text-gray-900' : 'text-gray-500'}`}>Chuyển khoản QR</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Xác nhận tự động • 1-3 PHÚT</p>
                                                </div>
                                                {selectedMethod === 'QR' && (
                                                    <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white">
                                                        <ShieldCheckIcon className="w-4 h-4" />
                                                    </div>
                                                )}
                                            </button>

                                            <button
                                                onClick={() => setSelectedMethod('CARD')}
                                                className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 border-2 ${selectedMethod === 'CARD'
                                                    ? 'border-blue-500 bg-white shadow-xl shadow-blue-100 scale-[1.02]'
                                                    : 'border-gray-50 bg-gray-50/50 hover:border-gray-200 hover:bg-white'
                                                    }`}
                                            >
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedMethod === 'CARD' ? 'bg-blue-500 text-white' : 'bg-white text-gray-400 shadow-sm'}`}>
                                                    <CreditCardIcon className="w-6 h-6" />
                                                </div>
                                                <div className="text-left flex-1">
                                                    <p className={`font-black uppercase tracking-tight text-sm ${selectedMethod === 'CARD' ? 'text-gray-900' : 'text-gray-500'}`}>Thẻ tín dụng / Stripe</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Bảo mật Quốc tế • TỨC THÌ</p>
                                                </div>
                                                {selectedMethod === 'CARD' && (
                                                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white">
                                                        <ShieldCheckIcon className="w-4 h-4" />
                                                    </div>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-2 space-y-4">
                                        <button
                                            onClick={handleConfirm}
                                            disabled={isSubmitting}
                                            className={`w-full h-14 font-black rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 ${isSubmitting ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white hover:bg-black shadow-gray-200'}`}
                                        >
                                            {isSubmitting ? (
                                                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <CurrencyDollarIcon className="w-5 h-5" />
                                                    XÁC NHẬN ĐĂNG KÝ
                                                </>
                                            )}
                                        </button>
                                        <p className="text-center text-[9px] text-gray-400 font-bold uppercase tracking-[0.1em] px-4">
                                            Bằng cách tiếp tục, bạn đồng ý với các Điều khoản Dịch vụ và Chính sách Bảo mật của Petties.
                                        </p>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
