import React, { useEffect, useState } from 'react'
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/solid'
import {
    DocumentTextIcon,
    CircleStackIcon,
    ChatBubbleLeftRightIcon,
    ChartBarIcon,
    GlobeAltIcon,
    UsersIcon,
    SparklesIcon
} from '@heroicons/react/24/outline'
import { useToast } from '../../../components/Toast'
import { subscriptionService, type SubscriptionPlan, type CreateSubscriptionPlanDto } from '../../../services/api/subscriptionService'

interface SubscriptionFormModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    plan?: SubscriptionPlan | null
}

type DurationUnit = 'day' | 'month' | 'year'

const COMMON_SUGGESTIONS = [
    { title: 'Không giới hạn dự án', icon: CircleStackIcon },
    { title: 'Hỗ trợ ưu tiên 24/7', icon: ChatBubbleLeftRightIcon },
    { title: 'Phân tích nâng cao', icon: ChartBarIcon },
    { title: 'Tên miền tùy chỉnh', icon: GlobeAltIcon },
    { title: 'Cộng tác nhóm', icon: UsersIcon }
]

export const SubscriptionFormModal: React.FC<SubscriptionFormModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    plan,
}) => {
    const { showToast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [durationValue, setDurationValue] = useState(1)
    const [durationUnit, setDurationUnit] = useState<DurationUnit>('month')
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
    const [priceInput, setPriceInput] = useState<string>('0')
    const [durationInput, setDurationInput] = useState<string>('1')

    const [formData, setFormData] = useState<CreateSubscriptionPlanDto>({
        name: '',
        description: '',
        price: 0,
        durationDays: 30,
        features: '',
    })

    useEffect(() => {
        if (plan) {
            setFormData({
                name: plan.name,
                description: plan.description || '',
                price: plan.price,
                durationDays: plan.durationDays,
                features: plan.features || '',
            })
            // Estimate duration value/unit
            if (plan.durationDays % 365 === 0) {
                setDurationValue(plan.durationDays / 365)
                setDurationUnit('year')
            } else if (plan.durationDays % 30 === 0) {
                setDurationValue(plan.durationDays / 30)
                setDurationUnit('month')
            } else {
                setDurationValue(plan.durationDays)
                setDurationUnit('day')
            }
            setSelectedFeatures(plan.features ? plan.features.split(',').map(f => f.trim()) : [])
            setPriceInput(plan.price.toString())
            const initialDuration = plan.durationDays % 365 === 0 ? plan.durationDays / 365 : plan.durationDays % 30 === 0 ? plan.durationDays / 30 : plan.durationDays
            setDurationInput(initialDuration.toString())
        } else {
            setFormData({
                name: '',
                description: '',
                price: 0,
                durationDays: 30,
                features: '',
            })
            setDurationValue(1)
            setDurationUnit('month')
            setSelectedFeatures(['Không giới hạn dự án', 'Hỗ trợ ưu tiên 24/7'])
            setPriceInput('0')
            setDurationInput('1')
        }
    }, [plan, isOpen])

    useEffect(() => {
        let days = durationValue
        if (durationUnit === 'month') days = durationValue * 30
        if (durationUnit === 'year') days = durationValue * 365
        setFormData(prev => ({ ...prev, durationDays: days, features: selectedFeatures.filter(f => f.trim() !== '').join(', ') }))
    }, [durationValue, durationUnit, selectedFeatures])

    if (!isOpen) return null

    const addEmptyFeature = () => {
        setSelectedFeatures(prev => [...prev, ''])
    }

    const removeFeature = (index: number) => {
        setSelectedFeatures(prev => prev.filter((_, i) => i !== index))
    }

    const updateFeature = (index: number, value: string) => {
        setSelectedFeatures(prev => prev.map((f, i) => i === index ? value : f))
    }

    const quickAddFeature = (title: string) => {
        if (!selectedFeatures.includes(title)) {
            setSelectedFeatures(prev => [...prev, title])
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name || formData.price < 0 || formData.durationDays <= 0) {
            showToast('error', 'Vui lòng điền đầy đủ thông tin hợp lệ')
            return
        }

        try {
            setIsSubmitting(true)
            const featureString = selectedFeatures.filter(f => f.trim() !== '').join(', ')
            const payload = { ...formData, features: featureString }
            if (plan) {
                await subscriptionService.updatePlan(plan.planId, payload)
                showToast('success', 'Cập nhật gói thành công')
            } else {
                await subscriptionService.createPlan(payload)
                showToast('success', 'Tạo gói mới thành công')
            }
            onSuccess()
            onClose()
        } catch (error) {
            console.error('Failed to save plan', error)
            showToast('error', 'Có lỗi xảy ra khi lưu gói')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-3xl bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-10 pt-10 pb-6 flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                            {plan ? 'Cập nhật Gói hội viên' : 'Tạo gói Hội viên mới'}
                        </h2>
                        <p className="text-slate-500 font-medium text-xs mt-1">Cấu hình các quyền lợi và mức giá cho khách hàng trung thành của Petties.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                    >
                        <XMarkIcon className="w-7 h-7" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-10 py-4 overflow-y-auto scrollbar-hide">
                    <form id="subscription-form" onSubmit={handleSubmit} className="space-y-8 pb-10">
                        {/* Section 1: General Info */}
                        <div className="bg-white border border-slate-100 rounded-3xl p-8 space-y-6 shadow-sm">
                            <div className="flex items-center gap-3 text-orange-600">
                                <DocumentTextIcon className="w-6 h-6 stroke-[2.5]" />
                                <h3 className="text-sm font-black uppercase tracking-widest">Thông tin chung</h3>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        Tên gói hội viên <span className="text-orange-500 text-lg">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ví dụ: Gói Chuyên Nghiệp (Professional)"
                                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 font-bold text-slate-700 focus:bg-white focus:border-orange-500 transition-all outline-none placeholder:text-slate-300"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        Mô tả chi tiết
                                    </label>
                                    <textarea
                                        placeholder="Nhập mô tả về lợi ích của gói hội viên này..."
                                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 font-bold text-slate-700 focus:bg-white focus:border-orange-500 transition-all outline-none placeholder:text-slate-300 min-h-[100px] resize-none"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            Giá gói (VNĐ) <span className="text-orange-500 text-lg">*</span>
                                        </label>
                                        <div className="relative group">
                                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold group-focus-within:text-orange-600 transition-colors">₫</span>
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                placeholder="0"
                                                className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl pl-12 pr-6 py-4 font-bold text-slate-700 focus:bg-white focus:border-orange-500 transition-all outline-none"
                                                value={priceInput}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setPriceInput(val);
                                                    setFormData(prev => ({ ...prev, price: val === '' ? 0 : Number(val) }));
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            Thời gian sử dụng <span className="text-orange-500 text-lg">*</span>
                                        </label>
                                        <div className="flex gap-3">
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                placeholder="1"
                                                className="w-24 bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 font-bold text-slate-700 focus:bg-white focus:border-orange-500 transition-all outline-none"
                                                value={durationInput}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setDurationInput(val);
                                                    setDurationValue(val === '' ? 0 : Number(val));
                                                }}
                                            />
                                            <select
                                                className="flex-1 bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-4 font-bold text-slate-700 focus:bg-white focus:border-orange-500 transition-all outline-none appearance-none cursor-pointer"
                                                value={durationUnit}
                                                onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                                            >
                                                <option value="day">Ngày</option>
                                                <option value="month">Tháng</option>
                                                <option value="year">Năm</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Features Group */}
                        <div className="bg-white border border-slate-100 rounded-3xl p-8 space-y-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-orange-600">
                                    <SparklesIcon className="w-6 h-6 stroke-[2.5]" />
                                    <h3 className="text-sm font-black uppercase tracking-widest">Tính năng bao gồm</h3>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {selectedFeatures.map((feature, idx) => (
                                    <div key={idx} className="flex gap-2 group animate-in slide-in-from-left-2 duration-150">
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                placeholder="VD: Không giới hạn thú cưng..."
                                                className="w-full bg-slate-50 border-2 border-slate-50 rounded-xl px-4 py-3 font-bold text-slate-700 focus:bg-white focus:border-orange-500 transition-all outline-none text-sm placeholder:text-slate-300"
                                                value={feature}
                                                onChange={(e) => updateFeature(idx, e.target.value)}
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-white w-2 h-2 rounded-full border-2 border-orange-500" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeFeature(idx)}
                                            className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                        >
                                            <XMarkIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={addEmptyFeature}
                                    className="w-full p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-orange-300 hover:bg-orange-50/20 transition-all flex items-center justify-center gap-2 group"
                                >
                                    <PlusIcon className="w-5 h-5 text-slate-300 group-hover:text-orange-500" />
                                    <span className="text-xs font-black uppercase text-slate-400 group-hover:text-orange-500 tracking-widest">Thêm tính năng thủ công</span>
                                </button>
                            </div>

                            <div className="pt-4 border-t border-slate-50">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Gợi ý nhanh:</p>
                                <div className="flex flex-wrap gap-2">
                                    {COMMON_SUGGESTIONS.map((sug, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => quickAddFeature(sug.title)}
                                            className="px-4 py-2 bg-slate-50 hover:bg-orange-50 hover:text-orange-600 rounded-full text-xs font-bold text-slate-500 transition-all border border-transparent hover:border-orange-200"
                                        >
                                            + {sug.title}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-10 py-8 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 font-bold uppercase tracking-widest text-xs hover:text-slate-600 transition-colors"
                        disabled={isSubmitting}
                    >
                        Hủy bỏ
                    </button>
                    <button
                        type="submit"
                        form="subscription-form"
                        className="bg-orange-600 hover:bg-orange-700 text-white min-w-[200px] py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-orange-100 transition-all active:scale-95 disabled:opacity-50"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Đang xử lý...</span>
                            </div>
                        ) : (
                            plan ? 'Lưu gói hội viên' : 'Xác nhận tạo gói'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
