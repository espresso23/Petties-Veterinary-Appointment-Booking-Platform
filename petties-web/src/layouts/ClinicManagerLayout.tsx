import { Outlet } from 'react-router-dom'

/**
 * Layout for CLINIC_MANAGER role dashboard
 */
export const ClinicManagerLayout = () => {
    return (
        <div className="clinic-manager-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>👨‍💼 Quản lý phòng khám</h2>
                </div>
                <nav className="sidebar-nav">
                    <a href="/clinic-manager" className="nav-item active">Dashboard</a>
                    <a href="/clinic-manager/vets" className="nav-item">Danh sách bác sĩ thú y</a>
                    <a href="/clinic-manager/bookings" className="nav-item">Booking mới</a>
                    <a href="/clinic-manager/schedule" className="nav-item">Lịch bác sĩ</a>
                    <a href="/clinic-manager/chat" className="nav-item">Chat tư vấn</a>
                    <a href="/clinic-manager/refunds" className="nav-item">Hủy & Hoàn tiền</a>
                </nav>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    )
}

export default ClinicManagerLayout
