import { useAuthStore } from '../../store/authStore'
import { DashboardCard, DashboardStatsGrid, DashboardSection } from '../../components/dashboard/DashboardCard'
import '../../styles/brutalist.css'

/**
 * QUẢN LÝ PHÒNG KHÁM Dashboard Page - Neobrutalism Design
 * No icons/emoji as per design guidelines
 */
export const ClinicManagerDashboardPage = () => {
    const { user } = useAuthStore()

    return (
        <div className="p-6 bg-stone-50 min-h-screen">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-stone-900 uppercase tracking-wide">
                    DASHBOARD QUẢN LÝ PHÒNG KHÁM
                </h1>
                <p className="text-stone-600 mt-1">
                    Chào mừng, {user?.username || 'Quản lý'}
                </p>
            </header>

            {/* Today Overview */}
            <DashboardSection title="TỔNG QUAN HÔM NAY">
                <DashboardStatsGrid>
                    <DashboardCard
                        title="BOOKING MOI"
                        value="--"
                        subtitle="Cho gán bác sĩ"
                    />
                    <DashboardCard
                        title="BÁC SĨ ONLINE"
                        value="--"
                        subtitle="Đang làm việc"
                    />
                    <DashboardCard
                        title="CUỘC HẸN"
                        value="--"
                        subtitle="Hôm nay"
                    />
                    <DashboardCard
                        title="HOÀN THÀNH"
                        value="--"
                        subtitle="Hôm nay"
                    />
                </DashboardStatsGrid>
            </DashboardSection>

            {/* Pending Actions */}
            <DashboardSection title="CẦN XỬ LÝ">
                <DashboardStatsGrid>
                    <DashboardCard
                        title="BOOKING PENDING"
                        value="--"
                        subtitle="Chưa gán bác sĩ"
                    />
                    <DashboardCard
                        title="TIN NHẮN"
                        value="--"
                        subtitle="Chưa đọc"
                    />
                    <DashboardCard
                        title="HOÀN TIỀN"
                        value="--"
                        subtitle="Yêu cầu cho"
                    />
                    <DashboardCard
                        title="BÁC SĨ TỪ CHỐI"
                        value="--"
                        subtitle="Cần gán lại"
                    />
                </DashboardStatsGrid>
            </DashboardSection>

            {/* Recent Bookings */}
            <DashboardSection title="BOOKING GẦN ĐÂY">
                <div className="bg-white border-4 border-stone-900 shadow-brutal">
                    <table className="w-full">
                        <thead className="border-b-4 border-stone-900">
                            <tr className="text-left">
                                <th className="p-4 text-xs font-bold uppercase tracking-wide">ID</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wide">KHACH HANG</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wide">DICH VU</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wide">THOI GIAN</th>
                                <th className="p-4 text-xs font-bold uppercase tracking-wide">TRANG THAI</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colSpan={5} className="p-6 text-center text-stone-600">
                                    Không có booking
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </DashboardSection>

            {/* Quick Actions */}
            <DashboardSection title="QUICK ACTIONS">
                <div className="flex flex-wrap gap-4">
                    <button className="btn-brutal py-3 px-6 text-sm">
                        THÊM BÁC SĨ
                    </button>
                    <button className="btn-brutal-outline py-3 px-6 text-sm">
                        IMPORT LỊCH
                    </button>
                    <button className="btn-brutal-outline py-3 px-6 text-sm">
                        XEM TẤT CẢ BOOKING
                    </button>
                </div>
            </DashboardSection>
        </div>
    )
}

export default ClinicManagerDashboardPage
