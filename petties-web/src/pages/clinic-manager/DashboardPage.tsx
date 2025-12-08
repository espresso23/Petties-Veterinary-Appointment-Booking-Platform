import { useAuthStore } from '../../store/authStore'

/**
 * CLINIC_MANAGER Dashboard Page
 */
export const ClinicManagerDashboardPage = () => {
    const { user } = useAuthStore()

    return (
        <div className="dashboard-page">
            <header className="dashboard-header">
                <h1>👨‍💼 Dashboard Quản lý phòng khám</h1>
                <p>Chào mừng, {user?.username || 'Quản lý'}</p>
            </header>

            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <h3>📋 Booking mới</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Chờ gán bác sĩ</p>
                </div>

                <div className="dashboard-card">
                    <h3>👨‍⚕️ Bác sĩ</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Đang làm việc hôm nay</p>
                </div>

                <div className="dashboard-card">
                    <h3>💬 Tin nhắn</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Chưa đọc</p>
                </div>

                <div className="dashboard-card">
                    <h3>🔄 Hoàn tiền</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Yêu cầu pending</p>
                </div>
            </div>

            <section className="dashboard-section">
                <h2>Bookings cần xử lý</h2>
                <p className="placeholder-text">Chức năng đang được phát triển...</p>
            </section>
        </div>
    )
}

export default ClinicManagerDashboardPage
