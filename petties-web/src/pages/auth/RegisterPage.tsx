import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../../services/endpoints/auth'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/Toast'
import '../../styles/brutalist.css'

// Helper to get role-based dashboard path
function getRoleDashboard(role: string): string {
    const dashboards: Record<string, string> = {
        'ADMIN': '/admin',
        'VET': '/vet',
        'CLINIC_MANAGER': '/clinic-manager',
        'CLINIC_OWNER': '/clinic-owner',
    }
    return dashboards[role] || '/home'
}

type RegisterRole = 'PET_OWNER' | 'CLINIC_OWNER'

export function RegisterPage() {
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [phone, setPhone] = useState('')
    const [role, setRole] = useState<RegisterRole>('PET_OWNER')
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const navigate = useNavigate()
    const { showToast } = useToast()
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
    const user = useAuthStore((state) => state.user)

    // Redirect nếu đã đăng nhập
    useEffect(() => {
        if (isAuthenticated && user) {
            const dashboardPath = getRoleDashboard(user.role)
            navigate(dashboardPath, { replace: true })
        }
    }, [isAuthenticated, user, navigate])

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError(null)

        // Validate password match
        if (password !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp.')
            return
        }

        // Validate password length
        if (password.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự.')
            return
        }

        setIsLoading(true)

        try {
            await register({
                username,
                email,
                password,
                phone: phone || undefined,
                role,
            })

            // Get user from store after register
            const registeredUser = useAuthStore.getState().user
            if (registeredUser) {
                // PET_OWNER chỉ có thể sử dụng mobile app
                if (registeredUser.role === 'PET_OWNER') {
                    const msg = '🎉 Đăng ký thành công! Vui lòng tải ứng dụng Petties trên điện thoại để sử dụng.'
                    setSuccessMessage(msg)
                    showToast('success', msg)
                    useAuthStore.getState().clearAuth()
                    return
                }

                // CLINIC_OWNER - redirect to clinic-owner dashboard
                if (registeredUser.role === 'CLINIC_OWNER') {
                    showToast('success', '🎉 Đăng ký thành công! Chào mừng bạn đến với Petties.')
                    navigate('/clinic-owner', { replace: true })
                    return
                }

                // Redirect to role-based dashboard
                const dashboardPath = getRoleDashboard(registeredUser.role)
                navigate(dashboardPath, { replace: true })
            } else {
                // Fallback if user not set
                navigate('/home', { replace: true })
            }
        } catch (err: any) {
            setError(
                err.response?.data?.message ||
                err.message ||
                'Đăng ký thất bại. Vui lòng thử lại.',
            )
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-amber-100 to-stone-50 flex">
            {/* Left Side - Register Form */}
            <div className="w-full lg:w-2/5 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <div className="max-w-sm w-full">
                    {/* Back to Home Link */}
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-stone-900 font-bold hover:text-amber-700 mb-8 transition-colors cursor-pointer"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                            />
                        </svg>
                        <span className="text-sm font-medium">Về trang chủ</span>
                    </Link>

                    {/* Register Card */}
                    <div className="border-brutal bg-white shadow-brutal p-6 sm:p-8">
                        {/* Logo & Welcome */}
                        <div className="text-center mb-6">
                            <div className="mb-4">
                                <span className="text-3xl sm:text-4xl font-bold text-amber-600 tracking-tight">
                                    PETTIES
                                </span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-3 uppercase tracking-tight">
                                ĐĂNG KÝ TÀI KHOẢN
                            </h1>
                            <p className="text-sm sm:text-base text-stone-600">
                                Tạo tài khoản để bắt đầu sử dụng Petties
                            </p>
                        </div>

                        {/* Success Message */}
                        {successMessage && (
                            <div
                                className="border-brutal bg-green-50 border-green-300 p-3 mb-5 shadow-brutal-sm"
                                role="alert"
                            >
                                <p className="text-xs sm:text-sm font-medium text-green-800">{successMessage}</p>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div
                                className="border-brutal bg-red-50 border-red-300 p-3 mb-5 shadow-brutal-sm"
                                role="alert"
                            >
                                <p className="text-xs sm:text-sm font-medium text-red-800">{error}</p>
                            </div>
                        )}

                        {/* Register Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Role Selection */}
                            <div>
                                <label
                                    htmlFor="role"
                                    className="block text-xs font-bold text-stone-900 mb-2 uppercase tracking-wide"
                                >
                                    Loại tài khoản *
                                </label>
                                <select
                                    id="role"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as RegisterRole)}
                                    disabled={isLoading}
                                    className="input-brutal text-sm cursor-pointer"
                                >
                                    <option value="PET_OWNER">🐾 Chủ thú cưng (Pet Owner)</option>
                                    <option value="CLINIC_OWNER">🏥 Chủ phòng khám (Clinic Owner)</option>
                                </select>
                                <p className="text-xs text-stone-500 mt-1">
                                    {role === 'PET_OWNER'
                                        ? '📱 Sử dụng ứng dụng mobile để đặt lịch khám'
                                        : '💻 Quản lý phòng khám thú y trên web'
                                    }
                                </p>
                            </div>

                            {/* Username Field */}
                            <div>
                                <label
                                    htmlFor="username"
                                    className="block text-xs font-bold text-stone-900 mb-2 uppercase tracking-wide"
                                >
                                    Tên đăng nhập *
                                </label>
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Nhập tên đăng nhập"
                                    required
                                    disabled={isLoading}
                                    className="input-brutal text-sm"
                                />
                            </div>

                            {/* Email Field */}
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-xs font-bold text-stone-900 mb-2 uppercase tracking-wide"
                                >
                                    Email *
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Nhập địa chỉ email"
                                    required
                                    disabled={isLoading}
                                    className="input-brutal text-sm"
                                />
                            </div>

                            {/* Phone Field */}
                            <div>
                                <label
                                    htmlFor="phone"
                                    className="block text-xs font-bold text-stone-900 mb-2 uppercase tracking-wide"
                                >
                                    Số điện thoại
                                </label>
                                <input
                                    id="phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Nhập số điện thoại (tùy chọn)"
                                    disabled={isLoading}
                                    className="input-brutal text-sm"
                                />
                            </div>

                            {/* Password Field */}
                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-xs font-bold text-stone-900 mb-2 uppercase tracking-wide"
                                >
                                    Mật khẩu *
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Nhập mật khẩu (ít nhất 6 ký tự)"
                                    required
                                    minLength={6}
                                    disabled={isLoading}
                                    className="input-brutal text-sm"
                                />
                            </div>

                            {/* Confirm Password Field */}
                            <div>
                                <label
                                    htmlFor="confirmPassword"
                                    className="block text-xs font-bold text-stone-900 mb-2 uppercase tracking-wide"
                                >
                                    Xác nhận mật khẩu *
                                </label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Nhập lại mật khẩu"
                                    required
                                    disabled={isLoading}
                                    className="input-brutal text-sm"
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full btn-brutal text-sm sm:text-base py-3 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                            >
                                {isLoading ? 'ĐANG ĐĂNG KÝ...' : 'ĐĂNG KÝ'}
                            </button>
                        </form>

                        {/* Additional Info */}
                        <div className="mt-6 pt-5 border-t-4 border-stone-200">
                            <p className="text-xs text-stone-600 text-center">
                                Đã có tài khoản?{' '}
                                <Link
                                    to="/login"
                                    className="font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer transition-colors"
                                >
                                    Đăng nhập ngay
                                </Link>
                            </p>
                        </div>
                    </div>

                    {/* Help Text */}
                    <div className="mt-6 text-center">
                        <p className="text-xs text-stone-500">
                            Cần hỗ trợ?{' '}
                            <a href="#" className="font-medium text-stone-700 hover:text-stone-900 underline cursor-pointer transition-colors">
                                Liên hệ chúng tôi
                            </a>
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side - Decorative Content */}
            <div className="hidden lg:flex lg:w-3/5 bg-white relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute inset-0 flex items-center justify-center">
                    {/* Large Geometric Shapes */}
                    <div className="absolute top-20 left-20 w-32 h-32 border-brutal bg-amber-100 rotate-12 shadow-brutal"></div>
                    <div className="absolute bottom-32 right-32 w-40 h-40 border-brutal bg-stone-100 -rotate-12 shadow-brutal"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-brutal bg-amber-50 rotate-45 shadow-brutal-sm"></div>
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center justify-center px-12 text-center max-w-2xl mx-auto">
                    <div className="mb-8">
                        <span className="text-6xl sm:text-7xl font-bold text-amber-600 tracking-tight">
                            PETTIES
                        </span>
                    </div>

                    <div className="border-brutal bg-amber-50 p-8 shadow-brutal mb-8">
                        <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 mb-4 uppercase tracking-tight">
                            THAM GIA CỘNG ĐỒNG
                            <br />
                            THÚ CƯNG
                        </h2>
                        <p className="text-lg text-stone-700 leading-relaxed">
                            Đăng ký ngay để kết nối với bác sĩ thú y chuyên nghiệp
                        </p>
                    </div>

                    {/* Feature Pills */}
                    <div className="flex flex-wrap gap-3 justify-center">
                        <div className="border-brutal bg-white px-4 py-2 shadow-brutal-sm">
                            <span className="text-sm font-bold text-stone-900">✨ Miễn phí đăng ký</span>
                        </div>
                        <div className="border-brutal bg-white px-4 py-2 shadow-brutal-sm">
                            <span className="text-sm font-bold text-stone-900">🔒 Bảo mật thông tin</span>
                        </div>
                        <div className="border-brutal bg-white px-4 py-2 shadow-brutal-sm">
                            <span className="text-sm font-bold text-stone-900">🚀 Sử dụng ngay</span>
                        </div>
                    </div>
                </div>

                {/* Decorative Line Pattern */}
                <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M0,100 Q250,50 500,100 T1000,100"
                        stroke="#d97706"
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                    />
                    <path
                        d="M0,200 Q300,150 600,200 T1200,200"
                        stroke="#d97706"
                        strokeWidth="6"
                        fill="none"
                        strokeLinecap="round"
                    />
                    <path
                        d="M0,300 Q200,250 400,300 T800,300"
                        stroke="#d97706"
                        strokeWidth="4"
                        fill="none"
                        strokeLinecap="round"
                    />
                </svg>
            </div>
        </div>
    )
}
