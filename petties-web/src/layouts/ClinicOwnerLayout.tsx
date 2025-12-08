import { Outlet } from 'react-router-dom'

/**
 * Layout for CLINIC_OWNER role dashboard
 */
export const ClinicOwnerLayout = () => {
    return (
        <div className="clinic-owner-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>🏥 Chủ phòng khám</h2>
                </div>
                <nav className="sidebar-nav">
                    <a href="/clinic-owner" className="nav-item active">Dashboard</a>
                    <a href="/clinic-owner/clinic-info" className="nav-item">Thông tin phòng khám</a>
                    <a href="/clinic-owner/services" className="nav-item">Quản lý dịch vụ</a>
                    <a href="/clinic-owner/pricing" className="nav-item">Cấu hình giá</a>
                    <a href="/clinic-owner/revenue" className="nav-item">Doanh thu</a>
                    <a href="/clinic-owner/schedule" className="nav-item">Lịch biểu tổng</a>
                </nav>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    )
}

export default ClinicOwnerLayout
