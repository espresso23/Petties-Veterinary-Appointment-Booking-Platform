import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { PricingModal, type PricingData } from '../components/clinic-owner'
import '../styles/brutalist.css'

interface NavItem {
    path: string
    label: string
    end?: boolean
}

/**
 * CLINIC_OWNER Layout - Neobrutalism Design
 * Text-only navigation, no icons as per design guidelines
 */
export const ClinicOwnerLayout = () => {
    const navigate = useNavigate()
    const clearAuth = useAuthStore((state) => state.clearAuth)
    const user = useAuthStore((state) => state.user)
    
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)
    const [pricingData, setPricingData] = useState<PricingData>({
        range0to5: 0,
        range5to10: 0,
        range10to20: 0,
        range20plus: 0,
    })

    const handleSavePricing = (data: PricingData) => {
        setPricingData(data)
        setIsPricingModalOpen(false)
        console.log('Pricing saved:', data)
        // TODO: Send to backend API
    }

    const navItems: NavItem[] = [
        { path: '/clinic-owner', label: 'DASHBOARD', end: true },
        { path: '/clinic-owner/clinic-info', label: 'THÔNG TIN PHÒNG KHÁM' },
        { path: '/clinic-owner/services', label: 'DỊCH VỤ' },
        { path: '/clinic-owner/pricing', label: 'GIÁ DỊCH VỤ' },
        { path: '/clinic-owner/revenue', label: 'DOANH THU' },
        { path: '/clinic-owner/profile', label: 'HỒ SƠ CÁ NHÂN' },
    ]

    const handleLogout = () => {
        clearAuth()
        navigate('/login', { replace: true })
    }

    return (
        <div className="min-h-screen bg-stone-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r-4 border-stone-900 flex flex-col">
                {/* Logo/Header */}
                <div className="px-6 py-6 border-b-4 border-stone-900">
                    <h2 className="text-xl font-bold text-amber-600 uppercase tracking-wider">PETTIES</h2>
                    <p className="text-xs font-bold text-stone-600 uppercase tracking-wide mt-1">CHỦ PHÒNG KHÁM</p>
                </div>

                {/* Navigation */}
                <nav className="py-4 overflow-y-auto">
                    {navItems.map((link) => (
                        <NavLink
                            key={link.path}
                            to={link.path}
                            end={link.end}
                            className={({ isActive }) =>
                                `block px-6 py-3 text-sm font-bold uppercase tracking-wide border-l-4 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${isActive
                                    ? 'bg-amber-500 !text-white border-stone-900'
                                    : '!text-stone-900 border-transparent hover:bg-amber-200 hover:border-stone-900 hover:translate-x-[-2px]'
                                }`
                            }
                        >
                            {String(link.label)}
                        </NavLink>
                    ))}
                </nav>

                {/* Pricing Button */}
                <div style={{ padding: '16px 24px' }}>
                    <button
                        onClick={() => setIsPricingModalOpen(true)}
                        style={{
                            width: '100%',
                            padding: '16px',
                            backgroundColor: '#FFFFFF',
                            color: '#000000',
                            border: '4px solid #000000',
                            boxShadow: '6px 6px 0 #000000',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            gap: '12px',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f5f5f4'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#FFFFFF'
                        }}
                    >
                        <span style={{ fontSize: '24px', fontWeight: '900', lineHeight: '1' }}>$</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.2' }}>
                            <span style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}>CHỈNH SỬA GIÁ</span>
                            <span style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}>KM</span>
                        </div>
                    </button>
                </div>
                
                <div style={{ flex: 1 }}></div>

                {/* User & Logout */}
                <div className="px-6 py-4 border-t-4 border-stone-900">
                    <p className="text-xs font-bold text-stone-700 uppercase mb-3 truncate">
                        {user?.username || 'User'}
                    </p>
                    <button
                        onClick={handleLogout}
                        className="w-full py-2 px-4 bg-white text-stone-950 text-sm font-black uppercase tracking-widest border-4 border-stone-950 shadow-[4px_4px_0_#000] hover:bg-amber-400 hover:shadow-[6px_6px_0_#000] hover:-translate-x-1 hover:-translate-y-1 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_#000] transition-all duration-200 cursor-pointer focus:outline-none focus:ring-4 focus:ring-amber-500"
                    >
                        ĐĂNG XUẤT
                    </button>
                    <p className="text-xs text-stone-500 text-center mt-3">V0.0.1</p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
            
            {/* Pricing Modal */}
            {isPricingModalOpen && (
                <PricingModal
                    isOpen={isPricingModalOpen}
                    onClose={() => setIsPricingModalOpen(false)}
                    onSave={handleSavePricing}
                    initialData={pricingData}
                />
            )}
        </div>
    )
}

export default ClinicOwnerLayout
