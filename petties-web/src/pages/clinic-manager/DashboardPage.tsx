import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useClinicStore } from '../../store/clinicStore'
import { DashboardCard, DashboardStatsGrid, DashboardSection } from '../../components/dashboard/DashboardCard'
import '../../styles/brutalist.css'

/**
 * QUẢN LÝ PHÒNG KHÁM Dashboard Page - Neobrutalism Design
 * No icons/emoji as per design guidelines
 */
export const ClinicManagerDashboardPage = () => {
    const { user } = useAuthStore()
    const { clinics, getMyClinics, isLoading: isClinicsLoading } = useClinicStore()

    // Fetch clinics on component mount
    useEffect(() => {
        getMyClinics()
    }, [getMyClinics])

    // Get the first clinic the manager works with
    const currentClinic = clinics.length > 0 ? clinics[0] : null

    return (
        <div className="p-6 bg-stone-50 min-h-screen">
            {/* Header with Clinic Name */}
            <header className="mb-8">
                {/* Clinic Badge */}
                {currentClinic && (
                    <Link
                        to="/clinic-manager/clinic"
                        className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-amber-100 border-2 border-stone-900 shadow-[3px_3px_0px_#1c1917] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#1c1917] transition-all"
                    >
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-sm font-bold uppercase text-stone-900 tracking-wide">
                            {currentClinic.name}
                        </span>
                    </Link>
                )}
                {isClinicsLoading && (
                    <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-stone-100 border-2 border-stone-400">
                        <span className="text-sm text-stone-500">Đang tải...</span>
                    </div>
                )}
                <h1 className="text-2xl font-bold text-stone-900 uppercase tracking-wide">
                    DASHBOARD QUẢN LÝ PHÒNG KHÁM
                </h1>
                <p className="text-stone-600 mt-1">
                    Chào mừng, {user?.fullName || 'Quản lý'}
                </p>
            </header>

            {/* Today Overview */}
            <DashboardSection title="TỔNG QUAN HÔM NAY">
                <DashboardStatsGrid>
                    <DashboardCard
                        title="BOOKING MỚI"
                        value="--"
                        subtitle="Chưa gán bác sĩ"
                    />
                    <DashboardCard
                        title="BÁC SĨ ONLINE"
                        value="--"
                        subtitle="Đang làm việc"
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
                        title="BOOKING CHƯA GÁN BÁC SĨ"
                        value="--"
                        subtitle="Chưa gán bác sĩ"
                    />
                    <DashboardCard
                        title="TIN NHẮN"
                        value="--"
                        subtitle="Chưa đọc"
                    />
                    <DashboardCard
                        title="YÊU CẦU HOÀN TIỀN"
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
                <div className="bg-white border-4 border-stone-900 shadow-brutal transition-all duration-200 hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_#1c1917]">
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
                            <tr className="transition-colors duration-200 hover:bg-amber-50 cursor-default">
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
