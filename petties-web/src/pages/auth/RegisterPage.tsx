import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { sendRegistrationOtp, verifyOtpAndRegister, resendOtp } from '../../services/endpoints/auth'
import type { SendOtpRequest } from '../../services/endpoints/auth'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/Toast'
import { parseApiError } from '../../utils/errorHandler'
import { OtpInput } from '../../components/common/OtpInput'
import { SparklesIcon, ShieldCheckIcon, RocketLaunchIcon, EnvelopeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
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
type RegisterStep = 'form' | 'otp'

export function RegisterPage() {
    // Form fields
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [fullName, setFullName] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [phone, setPhone] = useState('')
    const [role, setRole] = useState<RegisterRole>('PET_OWNER')

    // OTP state
    const [step, setStep] = useState<RegisterStep>('form')
    const [otpCode, setOtpCode] = useState('')
    const [resendCountdown, setResendCountdown] = useState(0)

    // UI state
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const navigate = useNavigate()
    const { showToast } = useToast()
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
    const user = useAuthStore((state) => state.user)

    // Countdown timer ref
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Redirect nếu đã đăng nhập
    useEffect(() => {
        if (isAuthenticated && user) {
            const dashboardPath = getRoleDashboard(user.role)
            navigate(dashboardPath, { replace: true })
        }
    }, [isAuthenticated, user, navigate])

    // Cleanup countdown timer
    useEffect(() => {
        return () => {
            if (countdownRef.current) {
                clearInterval(countdownRef.current)
            }
        }
    }, [])

    // Start resend cooldown timer
    const startResendCountdown = (seconds: number) => {
        setResendCountdown(seconds)
        if (countdownRef.current) clearInterval(countdownRef.current)

        countdownRef.current = setInterval(() => {
            setResendCountdown((prev) => {
                if (prev <= 1) {
                    if (countdownRef.current) clearInterval(countdownRef.current)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }

    // Step 1: Submit form → Send OTP
    const handleSubmitForm = async (event: FormEvent<HTMLFormElement>) => {
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
            const payload: SendOtpRequest = {
                username,
                email,
                password,
                phone: phone || undefined,
                fullName,
                role,
            }

            const response = await sendRegistrationOtp(payload)

            showToast('success', response.message)
            startResendCountdown(response.resendCooldownSeconds)
            setStep('otp')
        } catch (err: unknown) {
            setError(parseApiError(err))
        } finally {
            setIsLoading(false)
        }
    }

    // Step 2: Verify OTP → Complete registration
    const handleVerifyOtp = async () => {
        if (otpCode.length !== 6) {
            setError('Vui lòng nhập đủ 6 chữ số mã OTP.')
            return
        }

        setError(null)
        setIsLoading(true)

        try {
            const response = await verifyOtpAndRegister({ email, otpCode })

            // PET_OWNER chỉ có thể sử dụng mobile app
            if (response.role === 'PET_OWNER') {
                const msg = 'Đăng ký thành công! Vui lòng tải ứng dụng Petties trên điện thoại để sử dụng.'
                setSuccessMessage(msg)
                showToast('success', msg)
                useAuthStore.getState().clearAuth()
                return
            }

            // CLINIC_OWNER - redirect to clinic-owner dashboard
            if (response.role === 'CLINIC_OWNER') {
                showToast('success', 'Đăng ký thành công! Chào mừng bạn đến với Petties.')
                navigate('/clinic-owner', { replace: true })
                return
            }

            // Redirect to role-based dashboard
            const dashboardPath = getRoleDashboard(response.role)
            navigate(dashboardPath, { replace: true })
        } catch (err: unknown) {
            setError(parseApiError(err))
            // Reset OTP input on error
            setOtpCode('')
        } finally {
            setIsLoading(false)
        }
    }

    // Resend OTP
    const handleResendOtp = async () => {
        if (resendCountdown > 0) return

        setError(null)
        setIsLoading(true)

        try {
            const response = await resendOtp(email)
            showToast('success', response.message)
            startResendCountdown(response.resendCooldownSeconds)
            setOtpCode('')
        } catch (err: unknown) {
            setError(parseApiError(err))
        } finally {
            setIsLoading(false)
        }
    }

    // Go back to form step
    const handleBackToForm = () => {
        setStep('form')
        setOtpCode('')
        setError(null)
        if (countdownRef.current) clearInterval(countdownRef.current)
        setResendCountdown(0)
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-amber-100 to-stone-50 flex">
            {/* Left Side - Register Form */}
            <div className="w-full lg:w-2/5 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <div className="max-w-sm w-full">
                    {/* Back to Home Link */}
                    <Link
                        to="/"
                        className="group inline-flex items-center gap-2 text-stone-900 font-bold hover:text-amber-700 mb-8 transition-colors cursor-pointer"
                    >
                        <svg
                            className="w-5 h-5 text-stone-900 group-hover:text-amber-700 transition-colors"
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
                        <span className="text-sm font-bold text-stone-900">Về trang chủ</span>
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
                                {step === 'form' ? 'ĐĂNG KÝ TÀI KHOẢN' : 'XÁC THỰC EMAIL'}
                            </h1>
                            <p className="text-sm sm:text-base text-stone-600">
                                {step === 'form'
                                    ? 'Tạo tài khoản để bắt đầu sử dụng Petties'
                                    : `Nhập mã OTP đã được gửi đến ${email}`
                                }
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

                        {/* Step 1: Registration Form */}
                        {step === 'form' && (
                            <form onSubmit={handleSubmitForm} className="space-y-4">
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
                                        className="input-brutal text-xs cursor-pointer"
                                    >
                                        <option value="PET_OWNER">Chủ thú cưng (Pet Owner)</option>
                                        <option value="CLINIC_OWNER">Chủ phòng khám (Clinic Owner)</option>
                                    </select>
                                    <p className="text-sm text-stone-500 mt-1">
                                        {role === 'PET_OWNER'
                                            ? 'Sử dụng ứng dụng mobile để đặt lịch khám'
                                            : 'Quản lý phòng khám thú y trên web'
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

                                {/* Full Name Field */}
                                <div>
                                    <label
                                        htmlFor="fullName"
                                        className="block text-xs font-bold text-stone-900 mb-2 uppercase tracking-wide"
                                    >
                                        Họ và tên *
                                    </label>
                                    <input
                                        id="fullName"
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Nhập họ và tên đầy đủ"
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
                                    className="w-full btn-brutal text-sm sm:text-base py-3 disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        'ĐANG GỬI MÃ OTP...'
                                    ) : (
                                        <>
                                            <EnvelopeIcon className="w-5 h-5" />
                                            GỬI MÃ XÁC THỰC
                                        </>
                                    )}
                                </button>
                            </form>
                        )}

                        {/* Step 2: OTP Verification */}
                        {step === 'otp' && (
                            <div className="space-y-6">
                                {/* OTP Input */}
                                <div>
                                    <OtpInput
                                        length={6}
                                        value={otpCode}
                                        onChange={setOtpCode}
                                        disabled={isLoading}
                                        autoFocus
                                    />
                                </div>

                                {/* OTP Info */}
                                <div className="text-center">
                                    <p className="text-sm text-stone-500">
                                        Mã có hiệu lực trong <span className="font-bold text-amber-600">5 phút</span>
                                    </p>
                                </div>

                                {/* Verify Button */}
                                <button
                                    type="button"
                                    onClick={handleVerifyOtp}
                                    disabled={isLoading || otpCode.length !== 6}
                                    className="w-full btn-brutal text-sm sm:text-base py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'ĐANG XÁC THỰC...' : 'XÁC THỰC VÀ ĐĂNG KÝ'}
                                </button>

                                {/* Resend & Back buttons */}
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        type="button"
                                        onClick={handleBackToForm}
                                        disabled={isLoading}
                                        className="flex-1 btn-brutal-outline text-sm py-2 flex items-center justify-center gap-2"
                                    >
                                        <ArrowLeftIcon className="w-4 h-4" />
                                        QUAY LẠI
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleResendOtp}
                                        disabled={isLoading || resendCountdown > 0}
                                        className="flex-1 btn-brutal-outline text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {resendCountdown > 0
                                            ? `GỬI LẠI (${resendCountdown}s)`
                                            : 'GỬI LẠI MÃ'
                                        }
                                    </button>
                                </div>
                            </div>
                        )}

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
                            Đăng ký ngay để kết nối với các phòng khám thú y chuyên nghiệp
                        </p>
                    </div>

                    {/* Feature Pills */}
                    <div className="flex flex-wrap gap-3 justify-center">
                        <div className="border-brutal bg-white px-4 py-2 shadow-brutal-sm flex items-center gap-2">
                            <SparklesIcon className="w-5 h-5 text-stone-900" />
                            <span className="text-sm font-bold text-stone-900">Miễn phí đăng ký</span>
                        </div>
                        <div className="border-brutal bg-white px-4 py-2 shadow-brutal-sm flex items-center gap-2">
                            <ShieldCheckIcon className="w-5 h-5 text-stone-900" />
                            <span className="text-sm font-bold text-stone-900">Bảo mật thông tin</span>
                        </div>
                        <div className="border-brutal bg-white px-4 py-2 shadow-brutal-sm flex items-center gap-2">
                            <RocketLaunchIcon className="w-5 h-5 text-stone-900" />
                            <span className="text-sm font-bold text-stone-900">Sử dụng ngay</span>
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
