import React from 'react'
import { XMarkIcon, CheckCircleIcon, SparklesIcon, CalendarDaysIcon, BanknotesIcon } from '@heroicons/react/24/outline'
import { type SubscriptionPlan } from '../../../services/api/subscriptionService'

interface PlanDetailsModalProps {
    isOpen: boolean
    onClose: () => void
    plan: SubscriptionPlan | null
}

export const PlanDetailsModal: React.FC<PlanDetailsModalProps> = ({
    isOpen,
    onClose,
    plan,
}) => {
    if (!isOpen || !plan) return null

    const features = plan.features?.split(',').map(f => f.trim()).filter(Boolean) || []

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-10 pt-10 pb-6 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-xl text-orange-600">
                            <SparklesIcon className="w-6 h-6 stroke-[2]" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Chi tiết gói</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Thông tin cấu hình hệ thống</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-10 py-6 space-y-8">
                    <div className="text-center space-y-3">
                        <div className="inline-block px-4 py-1.5 bg-orange-50 text-orange-600 rounded-full text-[11px] font-black uppercase tracking-widest shadow-sm">
                            {plan.isActive ? 'Đang hoạt động' : 'Đã ẩn hệ thống'}
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tighter">
                            {plan.name}
                        </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 flex flex-col items-center justify-center gap-2 group hover:bg-white hover:shadow-md transition-all">
                            <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 group-hover:text-orange-600 transition-colors">
                                <BanknotesIcon className="w-6 h-6" />
                            </div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Giá niêm yết</p>
                            <p className="text-xl font-black text-slate-800">{plan.price.toLocaleString('vi-VN')} VNĐ</p>
                        </div>
                        <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 flex flex-col items-center justify-center gap-2 group hover:bg-white hover:shadow-md transition-all">
                            <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-400 group-hover:text-blue-600 transition-colors">
                                <CalendarDaysIcon className="w-6 h-6" />
                            </div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Thời hạn gói</p>
                            <p className="text-xl font-black text-slate-800">
                                {plan.durationDays >= 365 ? `${Math.floor(plan.durationDays / 365)} Năm` : plan.durationDays >= 30 ? `${Math.floor(plan.durationDays / 30)} Tháng` : `${plan.durationDays} Ngày`}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-slate-100" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tính năng mở khóa</span>
                            <div className="h-px flex-1 bg-slate-100" />
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {features.length > 0 ? (
                                features.map((feature, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-slate-50/50 p-4 rounded-2xl border border-transparent hover:border-slate-100 transition-all">
                                        <div className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                                            <CheckCircleIcon className="w-4 h-4 stroke-[3]" />
                                        </div>
                                        <span className="font-bold text-slate-700 text-sm">{feature.trim().replace(/_/g, ' ')}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-400 italic text-center py-4">Không có tính năng đặc biệt được cấu hình</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-10 py-8 bg-slate-50/50 border-t border-slate-100 mt-2">
                    <button
                        onClick={onClose}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-slate-200 transition-all active:scale-[0.98]"
                    >
                        Đóng thông tin
                    </button>
                </div>
            </div>
        </div>
    )
}
