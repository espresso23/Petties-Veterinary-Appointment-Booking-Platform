import React, { useEffect, useState } from 'react'
import { subscriptionService, type UserSubscription } from '../../../services/api/subscriptionService'
import {
    InboxIcon,
    CheckCircleIcon,
    BanknotesIcon,
    ClockIcon,
    MagnifyingGlassIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline'
import { useToast } from '../../../components/Toast'
import { useNavigate } from 'react-router-dom'

export const UserSubscriptionHistoryPage: React.FC = () => {
    const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const { showToast } = useToast()
    const navigate = useNavigate()

    const fetchData = async () => {
        try {
            setIsLoading(true)
            const data = await subscriptionService.getAllUserSubscriptions()
            setSubscriptions(data)
        } catch (error) {
            console.error('Failed to fetch subscriptions', error)
            showToast('error', 'Không thể tải danh sách đăng ký. Vui lòng kiểm tra kết nối.')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const filteredSubscriptions = subscriptions.filter(sub =>
        sub.status !== 'CANCELLED' && (
            (sub.clinicName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (sub.plan?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
    )

    const totalRevenue = subscriptions
        .filter(s => s.status === 'ACTIVE')
        .reduce((sum, s) => sum + (s.plan?.price || 0), 0)

    const activeCount = subscriptions.filter(s => s.status === 'ACTIVE').length
    const pendingCount = subscriptions.filter(s => s.status === 'PENDING_PAYMENT').length

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-12">
            <main className="p-8 max-w-7xl mx-auto space-y-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <button
                            onClick={() => navigate('/admin/subscriptions')}
                            className="group flex items-center gap-2 text-slate-400 hover:text-orange-500 transition-colors mb-2"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Quay lại danh sách gói</span>
                        </button>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Lợi nhuận & Giao dịch</h1>
                        <p className="text-slate-500 font-medium text-xs mt-1">Theo dõi lịch sử thanh toán và tình trạng gói từ tất cả phòng khám</p>
                    </div>
                    <button
                        onClick={fetchData}
                        className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Làm mới</span>
                    </button>
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                            <BanknotesIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng doanh thu</p>
                            <p className="text-xl font-black text-slate-800">{totalRevenue.toLocaleString('vi-VN')} đ</p>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                            <CheckCircleIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Gói Active</p>
                            <p className="text-xl font-black text-slate-800">{activeCount}</p>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                            <ClockIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Chờ thanh toán</p>
                            <p className="text-xl font-black text-slate-800">{pendingCount}</p>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                            <ClockIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tổng giao dịch</p>
                            <p className="text-xl font-black text-slate-800">{subscriptions.filter(s => s.status !== 'CANCELLED').length}</p>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                    {/* Search & Filters */}
                    <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
                        <div className="relative w-full max-w-md">
                            <MagnifyingGlassIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo tên phòng khám hoặc gói..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                            />
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
                                            <th className="px-10 py-4 font-black text-left">Phòng khám</th>
                                            <th className="px-4 py-4 font-black text-left">Gói hội viên</th>
                                            <th className="px-4 py-4 font-black text-left">Số tiền</th>
                                            <th className="px-4 py-4 font-black text-left font-black">Trạng thái</th>
                                            <th className="px-4 py-4 font-black text-left font-black">Thời hạn</th>
                                            <th className="px-10 py-4 font-black text-right">Ngày mua</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredSubscriptions.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-10 py-24 text-center">
                                                    <div className="flex flex-col items-center gap-4 text-slate-400">
                                                        <InboxIcon className="w-12 h-12 stroke-[1]" />
                                                        <div>
                                                            <p className="font-bold text-slate-500">Không tìm thấy giao dịch nào</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredSubscriptions.map((sub) => (
                                                <tr key={sub.subscriptionId} className="group hover:bg-slate-50 transition-colors">
                                                    <td className="px-10 py-4">
                                                        <p className="font-bold text-slate-800 text-sm">{sub.clinicName}</p>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <p className="font-bold text-slate-700 text-sm uppercase">{sub.plan?.name}</p>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <p className="font-bold text-slate-700 text-sm">{(sub.plan?.price || 0).toLocaleString('vi-VN')} VNĐ</p>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm
                                                            ${sub.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                                                sub.status === 'PENDING_PAYMENT' ? 'bg-amber-100 text-amber-700' :
                                                                    sub.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                                                                        'bg-slate-100 text-slate-700'}`}>
                                                            {sub.status === 'ACTIVE' ? 'Đang hoạt động' :
                                                                sub.status === 'PENDING_PAYMENT' ? 'Chờ thanh toán' :
                                                                    sub.status === 'CANCELLED' ? 'Đã hủy' :
                                                                        sub.status === 'EXPIRED' ? 'Hết hạn' : sub.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-col gap-0.5 whitespace-nowrap">
                                                            <p className="text-xs font-bold text-slate-700">
                                                                {sub.endDate ? new Date(sub.endDate).toLocaleDateString('vi-VN') : 'N/A'}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Hết hạn</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-4 text-right">
                                                        <p className="text-xs font-bold text-slate-500">
                                                            {sub.startDate ? new Date(sub.startDate).toLocaleDateString('vi-VN') : 'N/A'}
                                                        </p>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Footer Info / Pagination */}
                    <div className="px-10 py-6 border-t border-slate-50 flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Hiển thị {filteredSubscriptions.length} giao dịch
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
        </div>
    )
}
