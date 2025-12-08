import { Outlet } from 'react-router-dom'

/**
 * Layout for VET role dashboard
 */
export const VetLayout = () => {
    return (
        <div className="vet-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>🩺 Bác sĩ thú y</h2>
                </div>
                <nav className="sidebar-nav">
                    <a href="/vet" className="nav-item active">Dashboard</a>
                    <a href="/vet/schedule" className="nav-item">Lịch làm việc</a>
                    <a href="/vet/bookings" className="nav-item">Bookings được gán</a>
                    <a href="/vet/patients" className="nav-item">Bệnh nhân</a>
                    <a href="/vet/profile" className="nav-item">Hồ sơ của tôi</a>
                </nav>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    )
}

export default VetLayout
