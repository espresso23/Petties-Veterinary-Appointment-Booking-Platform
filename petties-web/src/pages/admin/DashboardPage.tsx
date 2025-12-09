import { useAuthStore } from '../../store/authStore'
import { useState, useEffect } from 'react'

interface ServiceHealth {
    status: 'checking' | 'healthy' | 'error'
    message: string
    version?: string
}

/**
 * ADMIN Dashboard Page
 */
export const AdminDashboardPage = () => {
    const { user } = useAuthStore()
    const [aiHealth, setAiHealth] = useState<ServiceHealth>({ status: 'checking', message: 'Checking...' })
    const [springHealth, setSpringHealth] = useState<ServiceHealth>({ status: 'checking', message: 'Checking...' })

    useEffect(() => {
        checkServices()
    }, [])

    const checkServices = async () => {
        // Check AI Service (port 8001 - direct call, not through gateway/backend)
        try {
            const res = await fetch('http://localhost:8001/health', { method: 'GET' })
            if (res.ok) {
                const data = await res.json()
                setAiHealth({ status: 'healthy', message: data.service || 'AI Service', version: data.version })
            } else {
                setAiHealth({ status: 'error', message: `HTTP ${res.status}` })
            }
        } catch (err) {
            setAiHealth({ status: 'error', message: 'Not running (port 8001)' })
        }

        // Check Spring Boot (actuator health endpoint)
        try {
            const res = await fetch('http://localhost:8080/api/actuator/health', { method: 'GET' })
            if (res.ok) {
                const data = await res.json()
                setSpringHealth({ status: 'healthy', message: data.status || 'Spring Boot API' })
            } else {
                setSpringHealth({ status: 'error', message: `HTTP ${res.status}` })
            }
        } catch (err) {
            setSpringHealth({ status: 'error', message: 'Connection failed' })
        }
    }

    const getStatusIcon = (status: ServiceHealth['status']) => {
        switch (status) {
            case 'healthy': return '🟢'
            case 'error': return '🔴'
            default: return '🟡'
        }
    }

    return (
        <div className="dashboard-page">
            <header className="dashboard-header">
                <h1>👨‍💻 Dashboard Admin nền tảng</h1>
                <p>Chào mừng, {user?.username || 'Admin'}</p>
            </header>

            {/* Service Health Status */}
            <section className="health-section" style={{ marginBottom: '24px' }}>
                <h2>🏥 Service Health</h2>
                <div className="health-grid" style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                    <div className="health-card" style={{
                        padding: '16px', borderRadius: '8px', minWidth: '200px',
                        background: aiHealth.status === 'healthy' ? '#dcfce7' : aiHealth.status === 'error' ? '#fee2e2' : '#fef3c7'
                    }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                            {getStatusIcon(aiHealth.status)} AI Service
                        </div>
                        <div style={{ fontSize: '14px', marginTop: '4px' }}>{aiHealth.message}</div>
                        {aiHealth.version && <div style={{ fontSize: '12px', opacity: 0.7 }}>v{aiHealth.version}</div>}
                    </div>
                    <div className="health-card" style={{
                        padding: '16px', borderRadius: '8px', minWidth: '200px',
                        background: springHealth.status === 'healthy' ? '#dcfce7' : springHealth.status === 'error' ? '#fee2e2' : '#fef3c7'
                    }}>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                            {getStatusIcon(springHealth.status)} Backend API
                        </div>
                        <div style={{ fontSize: '14px', marginTop: '4px' }}>{springHealth.message}</div>
                    </div>
                    <button onClick={checkServices} style={{
                        padding: '16px 24px', borderRadius: '8px', border: 'none',
                        background: '#3b82f6', color: 'white', cursor: 'pointer', fontSize: '14px'
                    }}>
                        🔄 Refresh
                    </button>
                </div>
            </section>

            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <h3>👨‍⚕️ Bác sĩ pending</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Chờ phê duyệt</p>
                </div>

                <div className="dashboard-card">
                    <h3>👥 Tổng người dùng</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Hệ thống</p>
                </div>

                <div className="dashboard-card">
                    <h3>📊 Appointments</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Hôm nay</p>
                </div>

                <div className="dashboard-card">
                    <h3>💰 Doanh thu</h3>
                    <p className="stat-number">--</p>
                    <p className="stat-label">Tháng này (VND)</p>
                </div>
            </div>

            <section className="dashboard-section">
                <h2>Bác sĩ chờ phê duyệt</h2>
                <p className="placeholder-text">Chức năng đang được phát triển...</p>
            </section>
        </div>
    )
}

export default AdminDashboardPage

