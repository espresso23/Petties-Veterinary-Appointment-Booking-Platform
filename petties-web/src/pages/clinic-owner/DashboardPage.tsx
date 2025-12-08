import { useAuthStore } from '../../store/authStore'

/**
 * CLINIC_OWNER Dashboard Page
 */
export const ClinicOwnerDashboardPage = () => {
    const { user } = useAuthStore()

    return (
        <div className="dashboard-page">
            <header className="dashboard-header">
                <h1>🏥 Dashboard Chủ phòng khám</h1>
                <p>Chào mừng, {user?.username || 'Chủ phòng khám'}</p>
            </header>

            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <h3>💰 Doanh thu hôm nay</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">VND</p>
                </div>

                <div className="dashboard-card">
                    <h3>📊 Tổng booking</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Tháng này</p>
                </div>

                <div className="dashboard-card">
                    <h3>🩺 Dịch vụ</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Đang hoạt động</p>
                </div>

                <div className="dashboard-card">
                    <h3>👨‍⚕️ Bác sĩ</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Trong phòng khám</p>
                </div>
            </div>

            <section className="dashboard-section">
                <h2>Thống kê doanh thu</h2>
                <p className="placeholder-text">Chức năng đang được phát triển...</p>
            </section>
        </div>
    )
}

export default ClinicOwnerDashboardPage
