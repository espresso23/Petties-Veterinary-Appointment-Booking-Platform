import { useAuthStore } from '../../store/authStore'

/**
 * VET Dashboard Page
 */
export const VetDashboardPage = () => {
    const { user } = useAuthStore()

    return (
        <div className="dashboard-page">
            <header className="dashboard-header">
                <h1>🩺 Dashboard Bác sĩ</h1>
                <p>Chào mừng, {user?.username || 'Bác sĩ'}</p>
            </header>

            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <h3>📅 Lịch hôm nay</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Bookings được gán</p>
                </div>

                <div className="dashboard-card">
                    <h3>⏳ Chờ phê duyệt</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Bookings mới</p>
                </div>

                <div className="dashboard-card">
                    <h3>✅ Đã hoàn thành</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Hôm nay</p>
                </div>

                <div className="dashboard-card">
                    <h3>⭐ Đánh giá</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Trung bình sao</p>
                </div>
            </div>

            <section className="dashboard-section">
                <h2>Bookings sắp tới</h2>
                <p className="placeholder-text">Chức năng đang được phát triển...</p>
            </section>
        </div>
    )
}

export default VetDashboardPage
