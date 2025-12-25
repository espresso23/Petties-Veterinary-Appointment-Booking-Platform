import { useAuthStore } from '../../store/authStore'
import { useState, useEffect } from 'react'
import { env } from '../../config/env'
import { DashboardCard, DashboardStatsGrid, DashboardSection } from '../../components/dashboard/DashboardCard'
import '../../styles/brutalist.css'

interface ServiceHealth {
    status: 'checking' | 'healthy' | 'error'
    message: string
    version?: string
}

/**
 * ADMIN Dashboard Page - Neobrutalism Design
 * No icons/emoji as per design guidelines
 */
export const AdminDashboardPage = () => {
    const { user } = useAuthStore()
    const [aiHealth, setAiHealth] = useState<ServiceHealth>({ status: 'checking', message: 'Checking...' })
    const [springHealth, setSpringHealth] = useState<ServiceHealth>({ status: 'checking', message: 'Checking...' })

    useEffect(() => {
        checkServices()
    }, [])

    const checkServices = async () => {
        // Check AI Service - FIX: Use env.AGENT_SERVICE_URL instead of hardcoded port 8001
        try {
            const res = await fetch(`${env.AGENT_SERVICE_URL}/health`, { method: 'GET' })
            if (res.ok) {
                const data = await res.json()
                setAiHealth({ status: 'healthy', message: data.service || 'AI Service', version: data.version })
            } else {
                setAiHealth({ status: 'error', message: `HTTP ${res.status}` })
            }
        } catch {
            setAiHealth({ status: 'error', message: 'Not running' })
        }

        // Check Spring Boot
        try {
            const res = await fetch(`${env.API_BASE_URL}/actuator/health`, { method: 'GET' })
            if (res.ok) {
                const data = await res.json()
                setSpringHealth({ status: 'healthy', message: data.status || 'UP' })
            } else {
                setSpringHealth({ status: 'error', message: `HTTP ${res.status}` })
            }
        } catch {
            setSpringHealth({ status: 'error', message: 'Connection failed' })
        }
    }

    const getStatusStyle = (status: ServiceHealth['status']) => {
        switch (status) {
            case 'healthy': return 'bg-amber-100 text-stone-900'
            case 'error': return 'bg-red-100 text-stone-900'
            default: return 'bg-stone-100 text-stone-700'
        }
    }

    const getStatusText = (status: ServiceHealth['status']) => {
        switch (status) {
            case 'healthy': return 'HEALTHY'
            case 'error': return 'ERROR'
            default: return 'CHECKING'
        }
    }

    return (
        <div className="p-6 bg-stone-50 min-h-screen">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-stone-900 uppercase tracking-wide">
                    ADMIN DASHBOARD
                </h1>
                <p className="text-stone-600 mt-1">
                    Chao mung, {user?.username || 'Admin'}
                </p>
            </header>

            {/* Service Health */}
            <DashboardSection title="SERVICE HEALTH">
                <div className="flex flex-wrap gap-4">
                    <div className={`border-4 border-stone-900 p-4 shadow-brutal transition-all duration-200 hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_#1c1917] cursor-default ${getStatusStyle(aiHealth.status)}`}>
                        <p className="text-xs font-bold uppercase tracking-wide mb-1">AI SERVICE</p>
                        <p className="text-lg font-bold">{getStatusText(aiHealth.status)}</p>
                        <p className="text-sm">{aiHealth.message}</p>
                        {aiHealth.version && <p className="text-xs opacity-70">v{aiHealth.version}</p>}
                    </div>
                    <div className={`border-4 border-stone-900 p-4 shadow-brutal transition-all duration-200 hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_#1c1917] cursor-default ${getStatusStyle(springHealth.status)}`}>
                        <p className="text-xs font-bold uppercase tracking-wide mb-1">BACKEND API</p>
                        <p className="text-lg font-bold">{getStatusText(springHealth.status)}</p>
                        <p className="text-sm">{springHealth.message}</p>
                    </div>
                    <button
                        onClick={checkServices}
                        className="btn-brutal py-2 px-4 text-sm"
                    >
                        REFRESH
                    </button>
                </div>
            </DashboardSection>

            {/* Platform Stats */}
            <DashboardSection title="PLATFORM STATS">
                <DashboardStatsGrid>
                    <DashboardCard
                        title="CLINICS PENDING"
                        value="--"
                        subtitle="Cho phe duyet"
                    />
                    <DashboardCard
                        title="TOTAL USERS"
                        value="--"
                        subtitle="He thong"
                    />
                    <DashboardCard
                        title="APPOINTMENTS"
                        value="--"
                        subtitle="Hom nay"
                    />
                    <DashboardCard
                        title="REVENUE"
                        value="--"
                        subtitle="Thang nay (VND)"
                    />
                </DashboardStatsGrid>
            </DashboardSection>

            {/* AI Agent Stats */}
            <DashboardSection title="AI AGENT STATS">
                <DashboardStatsGrid>
                    <DashboardCard
                        title="ACTIVE AGENTS"
                        value="--"
                        subtitle="Dang hoat dong"
                    />
                    <DashboardCard
                        title="TOOLS"
                        value="--"
                        subtitle="Da dang ky"
                    />
                    <DashboardCard
                        title="KNOWLEDGE DOCS"
                        value="--"
                        subtitle="Da index"
                    />
                    <DashboardCard
                        title="CHAT SESSIONS"
                        value="--"
                        subtitle="24h qua"
                    />
                </DashboardStatsGrid>
            </DashboardSection>

            {/* Pending Actions */}
            <DashboardSection title="PENDING ACTIONS">
                <div className="bg-white border-4 border-stone-900 shadow-brutal p-6 transition-all duration-200 hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_#1c1917] cursor-default">
                    <p className="text-stone-600 text-center">Khong co hanh dong cho xu ly</p>
                </div>
            </DashboardSection>
        </div>
    )
}

export default AdminDashboardPage
