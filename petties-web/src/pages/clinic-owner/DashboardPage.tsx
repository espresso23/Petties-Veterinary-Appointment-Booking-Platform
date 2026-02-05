import { useAuthStore } from '../../store/authStore'
import { DashboardCard, DashboardStatsGrid, DashboardSection } from '../../components/dashboard/DashboardCard'
import '../../styles/brutalist.css'

/**
 * CLINIC_OWNER Dashboard Page - Neobrutalism Design
 * No icons/emoji as per design guidelines
 */
export const ClinicOwnerDashboardPage = () => {
    const { user } = useAuthStore()

    return (
        <div className="p-6 bg-stone-50 min-h-screen">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-stone-900 uppercase tracking-wide">
                    BẢNG ĐIỀU KHIỂN CHỦ PHÒNG KHÁM
                </h1>
                <p className="text-stone-600 mt-1">
                    Chào mừng, {user?.fullName || 'Chủ phòng khám'}
                </p>
            </header>

            {/* Today Stats */}
            <DashboardSection title="THỐNG KÊ HÔM NAY">
                <DashboardStatsGrid>
                    <DashboardCard
                        title="DOANH THU HÔM NAY"
                        value="--"
                        subtitle="VND"
                    />
                    <DashboardCard
                        title="BOOKINGS HÔM NAY"
                        value="--"
                        subtitle="Hôm nay"
                    />
                    <DashboardCard
                        title="HOÀN THÀNH HÔM NAY"
                        value="--"
                        subtitle="Cuộc hẹn"
                    />
                </DashboardStatsGrid>
            </DashboardSection>

            {/* Clinic Info */}
            <DashboardSection title="THÔNG TIN PHÒNG KHÁM">
                <DashboardStatsGrid>
                    <DashboardCard
                        title="DỊCH VỤ"
                        value="--"
                        subtitle="Đang hoạt động"
                    />
                    <DashboardCard
                        title="BÁC SĨ"
                        value="--"
                        subtitle="Trong phòng khám"
                    />
                    <DashboardCard
                        title="ĐIỂM ĐÁNH GIÁ"
                        value="--"
                        subtitle="Trung bình"
                    />
                    <DashboardCard
                        title="ĐÁNH GIÁ"
                        value="--"
                        subtitle="Tổng số"
                    />
                </DashboardStatsGrid>
            </DashboardSection>

            {/* Monthly Revenue */}
            <DashboardSection title="DOANH THU THÁNG NAY">
                <div className="bg-white border-4 border-stone-900 shadow-brutal p-6 transition-all duration-200 hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_#1c1917] cursor-default">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">TỔNG DOANH THU</p>
                            <p className="text-2xl font-bold text-stone-900">-- VND</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">SỐ LƯỢNG ĐẶT LỊCH</p>
                            <p className="text-2xl font-bold text-stone-900">--</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">TRUNG BÌNH/ĐẶT LỊCH</p>
                            <p className="text-2xl font-bold text-stone-900">-- VND</p>
                        </div>
                    </div>
                </div>
            </DashboardSection>
        </div>
    )
}

export default ClinicOwnerDashboardPage
