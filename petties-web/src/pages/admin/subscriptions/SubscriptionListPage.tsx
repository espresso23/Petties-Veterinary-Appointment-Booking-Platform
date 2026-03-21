import React, { useEffect, useState } from 'react'
import { subscriptionService, type SubscriptionPlan } from '../../../services/api/subscriptionService'
import {
    PlusIcon,
    EyeIcon,
    PencilSquareIcon,
    ArchiveBoxIcon,
    InboxIcon,
    CheckCircleIcon,
    ArrowTrendingUpIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    UsersIcon,
    BanknotesIcon
} from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../../components/Toast'
import { SubscriptionFormModal } from './SubscriptionFormModal'
import { PlanDetailsModal } from './PlanDetailsModal'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog'

export const SubscriptionListPage: React.FC = () => {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'all' | 'active' | 'hidden'>('all')
    const { showToast } = useToast()
    const navigate = useNavigate()

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [isConfirmDeactivateOpen, setIsConfirmDeactivateOpen] = useState(false)
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
    const [planToDeactivate, setPlanToDeactivate] = useState<string | null>(null)

    const fetchPlans = async () => {
        try {
            setIsLoading(true)
            const data = await subscriptionService.getAllPlans()
            setPlans(data)
        } catch (error) {
            console.error('Failed to fetch plans', error)
            showToast('error', 'Không thể tải danh sách gói hội viên. Vui lòng kiểm tra kết nối.')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchPlans()
    }, [])

    const handleDeactivate = async () => {
        if (!planToDeactivate) return

        try {
            await subscriptionService.deactivatePlan(planToDeactivate)
            showToast('success', 'Đã ẩn gói thành công')
            fetchPlans()
        } catch (error) {
            showToast('error', 'Có lỗi xảy ra khi ẩn gói')
        } finally {
            setIsConfirmDeactivateOpen(false)
            setPlanToDeactivate(null)
        }
    }

    const filteredPlans = plans.filter(plan => {
        if (activeTab === 'active') return plan.isActive
        if (activeTab === 'hidden') return !plan.isActive
        return true
    })

    const activeCount = plans.filter(p => p.isActive).length
    const bestSellingPlan = plans.length > 0
        ? plans.reduce((prev, current) => (prev.totalPurchases > current.totalPurchases) ? prev : current)
        : null

    const bestSellingName = bestSellingPlan && bestSellingPlan.totalPurchases > 0
        ? bestSellingPlan.name
        : 'Chưa có'

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-12">
            <main className="p-8 max-w-7xl mx-auto space-y-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Quản lý Gói hội viên</h1>
                        <p className="text-slate-500 font-medium text-xs mt-1">Thiết lập và tùy chỉnh các gói hội viên cho hệ thống</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/admin/subscriptions/history')}
                            className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                        >
                            <BanknotesIcon className="w-5 h-5 text-slate-400" />
                            <span>Lịch sử giao dịch</span>
                        </button>
                        <button
                            onClick={() => {
                                setSelectedPlan(null)
                                setIsFormOpen(true)
                            }}
                            className="bg-[#F97316] hover:bg-[#EA580C] text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95"
                        >
                            <PlusIcon className="w-5 h-5 stroke-[3]" />
                            <span>Tạo gói mới</span>
                        </button>
                    </div>
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-orange-50 rounded-xl text-orange-600">
                            <InboxIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng số gói</p>
                            <p className="text-xl font-black text-slate-800">{plans.length}</p>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                            <CheckCircleIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Đang hoạt động</p>
                            <p className="text-xl font-black text-slate-800">{activeCount}</p>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                            <ArrowTrendingUpIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Gói được mua nhiều nhất</p>
                            <p className="text-xl font-black text-slate-800">{bestSellingName}</p>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                    {/* Tabs */}
                    <div className="px-10 pt-8 border-b border-slate-50">
                        <div className="flex items-center gap-8">
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'all' ? 'text-orange-600 border-orange-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                            >
                                Tất cả gói
                            </button>
                            <button
                                onClick={() => setActiveTab('active')}
                                className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'active' ? 'text-orange-600 border-orange-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                            >
                                Đang hoạt động
                            </button>
                            <button
                                onClick={() => setActiveTab('hidden')}
                                className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'hidden' ? 'text-orange-600 border-orange-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                            >
                                Đã ẩn
                            </button>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div className="flex-1">
                        {isLoading ? (
                            <div className="flex items-center justify-center p-20">
                                <div className="w-12 h-12 border-4 border-orange-100 border-t-orange-500 rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-50 text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest leading-tight whitespace-nowrap">
                                            <th className="px-10 py-4 font-black text-left w-[25%]">Tên gói</th>
                                            <th className="px-4 py-4 font-black text-left w-[15%]">Giá niêm yết</th>
                                            <th className="px-4 py-4 font-black text-left w-[15%]">Thời hạn</th>
                                            <th className="px-4 py-4 font-black text-left w-[15%]">Lượt đăng ký</th>
                                            <th className="px-4 py-4 font-black text-left w-[20%]">Tính năng nổi bật</th>
                                            <th className="px-10 py-4 font-black text-right w-[10%]">Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {plans.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-10 py-24 text-center">
                                                    <div className="flex flex-col items-center gap-4 text-slate-400">
                                                        <InboxIcon className="w-12 h-12 stroke-[1]" />
                                                        <div>
                                                            <p className="font-bold text-slate-500">Chưa có gói hội viên nào</p>
                                                            <p className="text-xs">Hãy tạo gói dịch vụ đầu tiên để bắt đầu hệ thống</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredPlans.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-10 py-20 text-center text-slate-400 font-medium italic">
                                                    Không tìm thấy gói hội viên nào phù hợp với bộ lọc
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredPlans.map((plan) => {
                                                const isMostPopular = bestSellingPlan && bestSellingPlan.totalPurchases > 0 && plan.planId === bestSellingPlan.planId
                                                const isBestValue = plan.durationDays >= 365

                                                return (
                                                    <tr key={plan.planId} className="group hover:bg-slate-50 transition-colors">
                                                        <td className="px-10 py-4">
                                                            <div className="flex flex-col items-start gap-1">
                                                                <p className="font-bold text-slate-800 text-sm">{plan.name}</p>
                                                                {isMostPopular && <span className="text-[9px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full uppercase tracking-tighter shrink-0 mb-auto">Phổ biến</span>}
                                                                {isBestValue && !isMostPopular && <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-tighter shrink-0 mb-auto">Tiết kiệm nhất</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <p className="font-bold text-slate-700 text-sm">{plan.price.toLocaleString('vi-VN')} VNĐ</p>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <p className="text-slate-600 font-medium text-sm">
                                                                {plan.durationDays >= 365 ? `${Math.floor(plan.durationDays / 365)} năm` : plan.durationDays >= 30 ? `${Math.floor(plan.durationDays / 30)} tháng` : `${plan.durationDays} ngày`}
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <UsersIcon className="w-4 h-4 text-slate-400 shrink-0" />
                                                                <p className="font-bold text-slate-700 text-sm">{plan.totalPurchases}</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                                                {(plan.features || '').split(',').slice(0, 2).map((f, i) => (
                                                                    <span key={i} className="text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md uppercase whitespace-nowrap max-w-[120px] truncate shrink-0">
                                                                        {f.trim().replace(/_/g, ' ')}
                                                                    </span>
                                                                ))}
                                                                {(plan.features || '').split(',').length > 2 && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedPlan(plan)
                                                                            setIsDetailsOpen(true)
                                                                        }}
                                                                        className="text-[9px] sm:text-[10px] font-bold bg-orange-50 hover:bg-orange-100 text-orange-600 px-2.5 py-1 rounded-md uppercase whitespace-nowrap transition-colors shrink-0"
                                                                    >
                                                                        +{(plan.features || '').split(',').length - 2} khác
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-10 py-4">
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedPlan(plan)
                                                                        setIsDetailsOpen(true)
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                                                                >
                                                                    <EyeIcon className="w-5 h-5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedPlan(plan)
                                                                        setIsFormOpen(true)
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                >
                                                                    <PencilSquareIcon className="w-5 h-5" />
                                                                </button>
                                                                {plan.isActive && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setPlanToDeactivate(plan.planId)
                                                                            setIsConfirmDeactivateOpen(true)
                                                                        }}
                                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                                        title="Ẩn gói"
                                                                    >
                                                                        <ArchiveBoxIcon className="w-5 h-5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Footer Info / Pagination */}
                    <div className="px-10 py-6 border-t border-slate-50 flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Hiển thị 1-{filteredPlans.length} của {filteredPlans.length} gói dịch vụ
                        </p>
                        <div className="flex gap-2">
                            <button className="p-2 border border-slate-100 rounded-lg text-slate-300 cursor-not-allowed">
                                <ChevronLeftIcon className="w-5 h-5" />
                            </button>
                            <button className="p-2 border border-slate-100 rounded-lg text-slate-300 cursor-not-allowed">
                                <ChevronRightIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

            </main>

            <SubscriptionFormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={fetchPlans}
                plan={selectedPlan}
            />

            <PlanDetailsModal
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                plan={selectedPlan}
            />

            <ConfirmDialog
                isOpen={isConfirmDeactivateOpen}
                onClose={() => {
                    setIsConfirmDeactivateOpen(false)
                    setPlanToDeactivate(null)
                }}
                onConfirm={handleDeactivate}
                title="Xác nhận ẩn gói"
                message="Bạn có chắc chắn muốn ẩn gói này? Người dùng mới sẽ không thấy gói này nữa."
                confirmText="Ẩn gói"
                variant="warning"
            />
        </div>
    )
}
