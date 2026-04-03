import { useEffect, useState } from 'react'
import { useClinicStore } from '../../../store/clinicStore'
import { subscriptionService, type SubscriptionPlan, type UserSubscription } from '../../../services/api/subscriptionService'
import { useToast } from '../../../components/Toast'
import { useMembershipStore } from '../../../store/membershipStore'
import {
    SparklesIcon,
    CheckIcon
} from '@heroicons/react/24/solid'
import { PaymentModal } from './PaymentModal'
import { CancelSubscriptionModal } from './CancelSubscriptionModal'

export const MySubscriptionPage = () => {
    const formatDuration = (days: number, short = false) => {
        if (days === 365) return 'năm'
        if (days % 365 === 0) return `${days / 365} năm`
        if (days % 30 === 0) {
            const months = days / 30
            if (months === 1) return short ? 'tháng' : '1 tháng'
            return `${months} tháng`
        }
        return `${days} ngày`
    }

    const { clinics, getMyClinics, isLoading: clinicsLoading } = useClinicStore()
    const setMembership = useMembershipStore(state => state.setMembership)
    const { showToast } = useToast()

    const [selectedClinicId, setSelectedClinicId] = useState<string>('')
    const [isLoading, setIsLoading] = useState(true)
    const [activePlans, setActivePlans] = useState<SubscriptionPlan[]>([])
    const [activeSubscription, setActiveSubscription] = useState<UserSubscription | null>(null)
    const [pendingSubscription, setPendingSubscription] = useState<UserSubscription | null>(null)
    const [subscriptionHistory, setSubscriptionHistory] = useState<UserSubscription[]>([])
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)
    const [showAllPlans, setShowAllPlans] = useState(false)
    const [showPayQr, setShowPayQr] = useState(false)

    useEffect(() => {
        getMyClinics()
    }, [getMyClinics])

    useEffect(() => {
        if (clinics.length > 0 && !selectedClinicId) {
            setSelectedClinicId(clinics[0].clinicId)
        } else if (clinics.length === 0 && !clinicsLoading) {
            setIsLoading(false)
        }
    }, [clinics, selectedClinicId, clinicsLoading])

    useEffect(() => {
        if (selectedClinicId) {
            fetchData()
        }
    }, [selectedClinicId, fetchData]) // eslint-disable-line react-hooks/exhaustive-deps

    const fetchData = async () => {
        if (!selectedClinicId) return

        setIsLoading(true)
        try {
            const [plans, status, history] = await Promise.all([
                subscriptionService.getActivePlans(),
                subscriptionService.getClinicSubscriptionStatus(selectedClinicId),
                subscriptionService.getClinicSubscriptionHistory(selectedClinicId).catch(() => [])
            ])
            setActivePlans(plans)
            setActiveSubscription(status.active)
            setMembership(status.active)
            setPendingSubscription(status.pending)
            setSubscriptionHistory(history)
        } catch (error) {
            console.error('Failed to fetch subscription data:', error)
            showToast('error', 'Không thể tải thông tin gói dịch vụ')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubscribe = (plan: SubscriptionPlan) => {
        setSelectedPlan(plan)
        setShowPaymentModal(true)
    }

    const handleCancel = async (subId?: string) => {
        if (!selectedClinicId) return
        try {
            setIsLoading(true)
            if (subId) {
                await subscriptionService.cancelSubscription(subId)
            } else {
                await subscriptionService.cancelClinicSubscription(selectedClinicId)
            }
            showToast('success', 'Đã cập nhật trạng thái gói dịch vụ thành công.')
            setShowCancelConfirm(false)
            await fetchData()
        } catch (error: unknown) {
            console.error('Failed to cancel subscription:', error)
            const msg = error instanceof Error ? error.message : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Có lỗi xảy ra khi xử lý'
            showToast('error', msg)
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
            </div>
        )
    }

    return (
        <div className="max-w-[1100px] mx-auto px-6 py-10 space-y-12 bg-[#F9FAFB] min-h-screen">
            {/* Header Pro Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-8">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Gói dịch vụ</h1>
                    <p className="text-gray-500 font-medium">Quản lý nâng cấp và tính năng AI của phòng khám bạn.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            const element = document.getElementById('pricing-grid');
                            element?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all shadow-sm"
                    >
                        Xem so sánh gói
                    </button>
                    <button
                        onClick={() => {
                            setShowAllPlans(true);
                            const element = document.getElementById('pricing-grid');
                            element?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-5 py-2.5 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-all shadow-md shadow-orange-200"
                    >
                        Nâng cấp ngay
                    </button>
                </div>
            </div>

            {/* NO ACTIVE PACKAGES WARNING */}
            {!activeSubscription && !pendingSubscription && (
                <div className="bg-white rounded-[32px] p-16 text-center border-2 border-dashed border-gray-100 shadow-sm transition-all hover:border-blue-200">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                        <SparklesIcon className="w-8 h-8" />
                    </div>
                    <div className="space-y-2 mt-4">
                        <p className="text-xl font-black text-gray-900 uppercase">Bạn chưa có gói hội viên</p>
                        <p className="text-gray-500 font-medium pb-2">Hãy chọn một gói bên dưới để mở khóa toàn bộ sức mạnh AI.</p>
                        <button
                            onClick={() => {
                                const element = document.getElementById('pricing-grid');
                                element?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-8 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 mt-4"
                        >
                            Khám phá gói dịch vụ
                        </button>
                    </div>
                </div>
            )}

            {/* Current Active Plan Section - HERO CARD */}
            <section className="space-y-6">
                <div className="flex flex-col gap-8">
                    {/* ACTIVE SUBSCRIPTION CARD */}
                    {activeSubscription && (
                        <div className="relative group/card">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[36px] blur opacity-[0.08] group-hover:opacity-[0.12] transition-opacity duration-500"></div>

                            <div className="relative bg-white rounded-[32px] border-2 border-blue-50 shadow-[0_20px_50px_rgba(8,_112,_184,_0.08)] overflow-hidden transition-all duration-500 hover:shadow-[0_25px_60px_rgba(8,_112,_184,_0.12)] hover:border-blue-100/50">
                                <div className="absolute top-0 right-0">
                                    <div className="bg-indigo-600 text-white text-[10px] font-black px-6 py-1.5 uppercase tracking-[0.2em] rounded-bl-2xl shadow-sm">
                                        Gói hiện tại
                                    </div>
                                </div>

                                <div className="p-8 md:p-12 flex flex-col lg:flex-row gap-12 items-stretch">
                                    <div className="flex-1 space-y-10 w-full">
                                        <div className="space-y-4">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <div className="px-4 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[11px] font-black rounded-full uppercase tracking-wider shadow-lg shadow-blue-200/50">
                                                    ĐANG HOẠT ĐỘNG
                                                </div>
                                                <p className="text-[11px] font-bold text-blue-500 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">CẬP NHẬT GẦN NHẤT</p>
                                            </div>
                                            <h3 className="text-5xl font-black text-gray-900 uppercase leading-none tracking-tight">
                                                {activeSubscription.plan?.name || 'Gói không tên'}
                                            </h3>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-12 items-start pt-2">
                                            <div className="space-y-2 flex-1 group/days min-w-[200px]">
                                                <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                    Thời hạn còn lại
                                                </p>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-6xl font-black text-gray-900 tracking-tighter tabular-nums transition-transform duration-500">
                                                        {activeSubscription.endDate ? Math.max(0, Math.ceil((new Date(activeSubscription.endDate).getTime() - new Date().getTime()) / 86400000)) : '--'}
                                                    </span>
                                                    <span className="text-xl font-bold text-gray-400 uppercase">Ngày</span>
                                                </div>
                                            </div>

                                            <div className="space-y-3 pb-2 border-l border-gray-100 pl-12 hidden md:block">
                                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Chi tiết</p>
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                                                        <span className="text-sm font-black text-gray-700 uppercase tracking-tight">Đã kích hoạt</span>
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-500 flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        Hết hạn: {activeSubscription.endDate ? new Date(activeSubscription.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full lg:w-[340px] bg-gray-50/80 rounded-2xl p-8 border border-gray-100 flex flex-col gap-6">
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Giá trị gói</p>
                                            <div className="flex flex-col">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-4xl font-black text-gray-900">{(activeSubscription.plan?.price || 0).toLocaleString('vi-VN')}</span>
                                                    <span className="text-lg font-bold text-gray-400 uppercase">VNĐ</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="px-5 py-5 bg-blue-50/50 rounded-[24px] border border-blue-100 flex gap-4 items-start shadow-sm">
                                                <div className="mt-1 shrink-0 p-2 bg-blue-100/50 rounded-lg">
                                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <p className="text-xs text-blue-800 font-semibold leading-relaxed italic">
                                                    Gói sẽ tự động hủy vào ngày hết hạn. Vui lòng gia hạn trước 3 ngày để không bị gián đoạn tính năng.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PENDING SUBSCRIPTION CARD / ALERT */}
                    {pendingSubscription && (
                        <div className={`relative ${activeSubscription ? 'mt-4' : ''} `}>
                            <div className="bg-white rounded-3xl border-2 border-amber-200 shadow-xl shadow-amber-50 overflow-hidden">
                                <div className="bg-amber-400 text-white px-6 py-2.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span className="text-xs font-black uppercase tracking-widest">Đăng ký đang chờ thanh toán</span>
                                    </div>
                                    {!activeSubscription && (
                                        <span className="text-[10px] font-bold bg-amber-500/50 px-3 py-1 rounded-full uppercase">Cần xử lý ngay</span>
                                    )}
                                </div>

                                <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center">
                                    <div className="flex-1 space-y-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Gói đã chọn</p>
                                            <h4 className="text-2xl font-black text-gray-900 uppercase">{pendingSubscription.plan?.name}</h4>
                                        </div>
                                        <div className="flex gap-8">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Giá tiền</p>
                                                <p className="text-lg font-black text-gray-900">{(pendingSubscription.plan?.price || 0).toLocaleString('vi-VN')} VNĐ</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Thời hạn</p>
                                                <p className="text-lg font-black text-gray-900">{pendingSubscription.plan?.durationDays} Ngày</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full md:w-auto min-w-[300px] flex flex-col gap-4">
                                        {pendingSubscription.qrUrl && (
                                            <div className="space-y-4">
                                                {showPayQr ? (
                                                    <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex flex-col md:flex-row gap-6 items-center shadow-inner">
                                                        <div className="flex-shrink-0 text-center space-y-2">
                                                            <img src={pendingSubscription.qrUrl} alt="QR" className="w-32 h-32 rounded-lg bg-white p-2 shadow-sm border border-amber-200" />
                                                            <p className="text-[9px] font-black text-amber-700 uppercase">Mã QR Thanh toán</p>
                                                        </div>
                                                        <div className="flex-1 space-y-4">
                                                            <div className="space-y-1">
                                                                <p className="text-[9px] font-bold text-amber-500 uppercase">Nội dung chuyển khoản</p>
                                                                <p className="text-xl font-black text-amber-700 tracking-wider select-all cursor-pointer bg-white px-3 py-2 rounded-lg border border-amber-200 text-center">{pendingSubscription.paymentDescription}</p>
                                                            </div>
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        setIsLoading(true);
                                                                        const res = await subscriptionService.checkPaymentStatus(pendingSubscription.subscriptionId);
                                                                        if (res.status === 'PAID') {
                                                                            showToast('success', 'Thanh toán thành công!');
                                                                            fetchData();
                                                                        } else {
                                                                            showToast('info', 'Chưa nhận được thanh toán.');
                                                                        }
                                                                    } catch (e: unknown) { 
                                                                        const msg = e instanceof Error ? e.message : (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Lỗi kiểm tra'
                                                                        showToast('error', msg)
                                                                    } finally { setIsLoading(false); }
                                                                }}
                                                                className="w-full h-10 bg-amber-500 text-white text-xs font-black uppercase rounded-lg hover:bg-amber-600 transition-all shadow-lg shadow-amber-200"
                                                            >
                                                                Tôi đã chuyển khoản
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setShowPayQr(true)}
                                                        className="w-full h-12 bg-amber-500 text-white font-black rounded-xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 flex items-center justify-center gap-2"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                                                        HIỆN MÃ QUÉT THANH TOÁN
                                                    </button>
                                                )}
                                                <div className="flex gap-3">
                                                    {showPayQr && (
                                                        <button onClick={() => setShowPayQr(false)} className="flex-1 h-10 text-[10px] font-black uppercase text-gray-400 hover:text-gray-600 bg-gray-50 rounded-lg">Thu gọn</button>
                                                    )}
                                                    <button
                                                        onClick={() => { if (window.confirm('Bạn có muốn hủy đăng ký chờ này để chọn gói khác?')) handleCancel(pendingSubscription.subscriptionId); }}
                                                        className="flex-1 h-10 text-[10px] font-black uppercase text-red-500 hover:text-red-600 bg-red-50 rounded-lg"
                                                    >
                                                        Hủy đăng ký này
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* HISTORY SECTION */}
                    {subscriptionHistory.filter(sub => sub.status !== 'CANCELLED').length > 0 && (
                        <div className="mt-12 space-y-6">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                                <h4 className="text-xl font-black text-gray-900 uppercase tracking-tight">Lịch sử thanh toán & đăng ký</h4>
                                <span className="text-xs font-bold text-gray-400 uppercase bg-gray-50 px-3 py-1 rounded-full">{subscriptionHistory.filter(sub => sub.status !== 'CANCELLED').length} Giao dịch</span>
                            </div>
                            <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/50">
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Gói dịch vụ</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Trạng thái</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Thời gian</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Số tiền</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {subscriptionHistory.filter(sub => sub.status !== 'CANCELLED').map((sub) => (
                                                <tr key={sub.subscriptionId} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <p className="text-sm font-black text-gray-900 uppercase">{sub.plan?.name}</p>
                                                        <p className="text-[10px] font-bold text-gray-400">{sub.plan?.durationDays} Ngày</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${sub.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' :
                                                            sub.status === 'PENDING_PAYMENT' ? 'bg-amber-50 text-amber-600' :
                                                                sub.status === 'CANCELLED' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'
                                                            }`}>
                                                            {sub.status === 'ACTIVE' ? 'Hoạt động' :
                                                                sub.status === 'PENDING_PAYMENT' ? 'Chờ thanh toán' :
                                                                    sub.status === 'CANCELLED' ? 'Đã hủy' : sub.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <p className="text-xs font-bold text-gray-700">
                                                            {sub.startDate ? new Date(sub.startDate).toLocaleDateString('vi-VN') : '---'}
                                                        </p>
                                                        <p className="text-[10px] font-medium text-gray-400 italic">đến {sub.endDate ? new Date(sub.endDate).toLocaleDateString('vi-VN') : '---'}</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <p className="text-sm font-black text-gray-900">{(sub.plan?.price || 0).toLocaleString('vi-VN')} đ</p>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Pricing Section - GRID */}
            <section id="pricing-grid" className="space-y-10 pt-8 mt-4 scroll-mt-20">
                <div id="pricing-table" className="sr-only" />
                <div className="text-center space-y-4">
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">Bảng giá dịch vụ</h2>
                    <p className="text-gray-500 max-w-lg mx-auto font-medium">Lựa chọn gói phù hợp với quy mô phòng khám của bạn. Tiết kiệm hơn với gói dài hạn.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch pt-4">
                    {(() => {
                        const plansWithDailyPrice = activePlans.map(p => ({
                            ...p,
                            dailyPrice: p.price / p.durationDays
                        }));
                        const minDailyPrice = activePlans.length > 0 ? Math.min(...plansWithDailyPrice.map(p => p.dailyPrice)) : 0;

                        return (showAllPlans ? activePlans : activePlans.slice(0, 3)).map((plan) => {
                            const isCurrent = activeSubscription?.plan?.planId === plan.planId;
                            const isPending = pendingSubscription?.plan?.planId === plan.planId;

                            const daysRemaining = activeSubscription?.endDate ? Math.max(0, Math.ceil((new Date(activeSubscription.endDate).getTime() - new Date().getTime()) / 86400000)) : 0;
                            const isDisabled = (activeSubscription && daysRemaining > 3) || !!pendingSubscription;

                            const dailyPrice = plan.price / plan.durationDays;
                            const isBestValue = activePlans.length > 1 && dailyPrice <= minDailyPrice + 0.01;
                            const isPro = plan.name.toLowerCase().includes('chuyên nghiệp');

                            return (
                                <div
                                    key={plan.planId}
                                    className={`relative bg-white rounded-[32px] p-8 flex flex-col justify-between transition-all duration-300 border ${isPro ? 'border-orange-500 shadow-2xl shadow-orange-100 lg:scale-[1.05] z-10' : 'border-gray-100 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:border-gray-200 hover:scale-[1.02]'}`}
                                >
                                    {isBestValue && (
                                        <div className="absolute -top-4 inset-x-0 flex justify-center">
                                            <span className="bg-red-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg animate-bounce">
                                                Gói hời nhất
                                            </span>
                                        </div>
                                    )}

                                    {isPro && !isBestValue && (
                                        <div className="absolute -top-4 inset-x-0 flex justify-center">
                                            <span className="bg-orange-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">
                                                🔥 Best Seller
                                            </span>
                                        </div>
                                    )}

                                    <div className="space-y-8 h-full flex flex-col">
                                        <div className="space-y-6">
                                            <div className="space-y-1">
                                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.15em]">{plan.name}</h3>
                                                <div className="flex flex-col">
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className="text-4xl font-black text-gray-900 tracking-tight">
                                                            {plan.price.toLocaleString('vi-VN')}
                                                        </span>
                                                        <span className="text-sm font-bold text-gray-400 uppercase">VNĐ</span>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-1">
                                                        <div className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-black rounded-md border border-orange-100 uppercase tracking-tighter">
                                                            {formatDuration(plan.durationDays)}
                                                        </div>
                                                        <p className="text-[12px] font-bold text-gray-500">
                                                            ~ {Math.round(plan.price / (plan.durationDays / 30)).toLocaleString('vi-VN')}đ / tháng
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleSubscribe(plan)}
                                                disabled={isDisabled}
                                                className={`mt-10 w-full h-14 rounded-2xl font-black text-xs uppercase transition-all shadow-xl active:scale-[0.98] ${isDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : isPro ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-200' : 'bg-gray-900 text-white hover:bg-black shadow-gray-200'}`}
                                            >
                                                {isCurrent ? 'Gói của bạn' : isPending ? 'Chờ thanh toán' : 'Chọn ngay'}
                                            </button>

                                            <div className="h-px bg-gray-100 my-4" />

                                            <div className="flex-1">
                                                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Các tính năng</p>
                                                <ul className="space-y-3.5">
                                                    {(plan.features || '').split(',').map((feature, i) => (
                                                        <li key={i} className="flex items-start gap-3">
                                                            <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isPro ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                                                                <CheckIcon className="w-3.5 h-3.5" />
                                                            </div>
                                                            <span className="text-[13px] font-semibold text-gray-600 leading-snug">
                                                                {feature.trim()}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            </section>

            {
                selectedPlan && (
                    <PaymentModal
                        isOpen={showPaymentModal}
                        onClose={() => setShowPaymentModal(false)}
                        plan={selectedPlan}
                        clinicId={selectedClinicId}
                        onSuccess={() => {
                            setShowPaymentModal(false)
                            fetchData()
                        }}
                    />
                )
            }

            <CancelSubscriptionModal
                isOpen={showCancelConfirm}
                onClose={() => setShowCancelConfirm(false)}
                onConfirm={() => handleCancel(activeSubscription?.subscriptionId)}
                isLoading={isLoading}
            />
        </div >
    )
}
