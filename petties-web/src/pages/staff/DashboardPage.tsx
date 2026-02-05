import { useAuthStore } from '../../store/authStore'
import { DashboardCard } from '../../components/dashboard/DashboardCard'
import {
    CalendarDaysIcon,
    ClockIcon,
    CheckCircleIcon,
    StarIcon,
    BuildingOfficeIcon
} from '@heroicons/react/24/outline'

/**
 * Staff Dashboard Page
 */
export const StaffDashboardPage = () => {
    const { user } = useAuthStore()

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="heading-brutal text-stone-900 mb-2">
                    DASHBOARD NHÂN VIÊN
                </h1>
                <p className="text-stone-600 text-lg">
                    Chào mừng trở lại, <span className="font-bold text-amber-600">Nhân viên {user?.fullName || ''}</span>
                </p>
                {user?.workingClinicName && (
                    <div className="flex items-center gap-2 mt-2 text-stone-500">
                        <BuildingOfficeIcon className="w-5 h-5" />
                        <span>
                            Phòng khám: <span className="font-bold text-stone-700">{user.workingClinicName}</span>
                        </span>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <DashboardCard
                    title="LỊCH HÔM NAY"
                    value="--"
                    icon={<CalendarDaysIcon className="w-6 h-6 text-stone-900" />}
                    trend="+2 bookings"
                    trendUp={true}
                />
                <DashboardCard
                    title="CHỜ PHÊ DUYỆT"
                    value="--"
                    icon={<ClockIcon className="w-6 h-6 text-stone-900" />}
                    trend="Đang chờ xử lý"
                    trendUp={false}
                />
                <DashboardCard
                    title="ĐÃ HOÀN THÀNH"
                    value="--"
                    icon={<CheckCircleIcon className="w-6 h-6 text-stone-900" />}
                    trend="Trong tháng này"
                    trendUp={true}
                />
                <DashboardCard
                    title="ĐÁNH GIÁ"
                    value="--"
                    icon={<StarIcon className="w-6 h-6 text-stone-900" />}
                    trend="Trung bình sao"
                    trendUp={true}
                />
            </div>

            {/* Recent Activity / Schedule Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Today's Schedule */}
                <div className="border-brutal bg-white p-6 shadow-brutal transition-all duration-200 hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_#1c1917]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-stone-900 uppercase">
                            LỊCH HẸN HÔM NAY
                        </h2>
                        <button className="btn-brutal-sm text-xs px-3 py-1 cursor-pointer">
                            XEM TẤT CẢ
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-stone-50 border-2 border-stone-200">
                            <p className="text-stone-500 text-center italic">
                                Chưa có lịch hẹn nào hôm nay
                            </p>
                        </div>
                    </div>
                </div>

                {/* Notifications / Updates */}
                <div className="border-brutal bg-white p-6 shadow-brutal transition-all duration-200 hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_#1c1917]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-stone-900 uppercase">
                            THÔNG BÁO MỚI
                        </h2>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-amber-50 border-l-4 border-amber-500 transition-all duration-200 hover:bg-amber-100 hover:border-amber-600 cursor-default">
                            <p className="text-sm font-bold text-stone-900">Hệ thống</p>
                            <p className="text-sm text-stone-600">Chào mừng bạn đến với giao diện mới!</p>
                            <p className="text-xs text-stone-400 mt-1">Vừa xong</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default StaffDashboardPage
