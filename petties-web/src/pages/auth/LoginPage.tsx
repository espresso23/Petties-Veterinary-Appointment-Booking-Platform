import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { GoogleOAuthProvider, GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { login, googleSignIn } from '../../services/endpoints/auth'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../components/Toast'
import { parseApiError } from '../../utils/errorHandler'
import { HomeIcon, CpuChipIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline'
import '../../styles/brutalist.css'

// Google Client ID (Web)
const GOOGLE_CLIENT_ID = '770052765216-lhn9icposo0odos1petjhdfrpcnso7fe.apps.googleusercontent.com'

// Helper to get role-based dashboard path
function getRoleDashboard(role: string): string {
  const dashboards: Record<string, string> = {
    'ADMIN': '/admin',
    'VET': '/vet',
    'CLINIC_MANAGER': '/clinic-manager',
    'CLINIC_OWNER': '/clinic-owner',
    // PET_OWNER blocked from web - mobile only
  }
  return dashboards[role] || '/home'
}

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  // Track if URL error has been handled to prevent infinite loop
  const hasHandledUrlError = useRef(false)

  // Check for URL error parameters on mount (run only once)
  useEffect(() => {
    if (hasHandledUrlError.current) return

    const urlError = searchParams.get('error')
    if (urlError === 'pet_owner_mobile_only') {
      hasHandledUrlError.current = true
      setError('Tài khoản PET_OWNER chỉ có thể sử dụng ứng dụng mobile. Vui lòng tải ứng dụng Petties trên điện thoại.')
    }
  }, []) // Empty dependency - run only on mount

  // Redirect nếu đã đăng nhập (trừ PET_OWNER - xử lý trong handleSubmit)
  useEffect(() => {
    if (isAuthenticated && user) {
      // Không redirect PET_OWNER - handleSubmit sẽ clear auth và show error
      if (user.role === 'PET_OWNER') {
        return
      }
      const dashboardPath = getRoleDashboard(user.role)
      navigate(dashboardPath, { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await login({ username, password })

      // Block PET_OWNER from web (mobile only)
      if (response.role === 'PET_OWNER') {
        useAuthStore.getState().clearAuth()
        setError('Tài khoản PET_OWNER chỉ có thể sử dụng ứng dụng mobile. Vui lòng tải ứng dụng Petties trên điện thoại.')
        return
      }

      showToast('success', `Đăng nhập thành công! Chào mừng ${response.fullName}`)
      const dashboardPath = getRoleDashboard(response.role)
      navigate(dashboardPath, { replace: true })
    } catch (err: unknown) {
      setError(parseApiError(err))
    } finally {
      setIsLoading(false)
    }
  }

  // Google Sign-In Success Handler
  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError('Không nhận được token từ Google')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await googleSignIn(credentialResponse.credential)

      // Block PET_OWNER from web (mobile only)
      // Note: Backend cũng validate, nhưng giữ check ở FE để đảm bảo
      if (response.role === 'PET_OWNER') {
        useAuthStore.getState().clearAuth()
        setError('Tài khoản PET_OWNER chỉ có thể sử dụng ứng dụng mobile. Vui lòng tải ứng dụng Petties trên điện thoại.')
        return
      }

      showToast('success', `Đăng nhập Google thành công! Chào mừng ${response.fullName}`)
      const dashboardPath = getRoleDashboard(response.role)
      navigate(dashboardPath, { replace: true })
    } catch (err: unknown) {
      setError(parseApiError(err))
    } finally {
      setIsLoading(false)
    }
  }

  // Google Sign-In Error Handler
  const handleGoogleError = () => {
    setError('Đăng nhập Google thất bại. Vui lòng thử lại.')
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen bg-gradient-to-b from-amber-100 to-stone-50 flex">
        {/* Left Side - Login Form */}
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

            {/* Login Card */}
            <div className="border-brutal bg-white shadow-brutal p-6 sm:p-8">
              {/* Logo & Welcome */}
              <div className="text-center mb-6">
                <div className="mb-4">
                  <span className="text-3xl sm:text-4xl font-bold text-amber-600 tracking-tight">
                    PETTIES
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-3 uppercase tracking-tight">
                  CHÀO MỪNG TRỞ LẠI
                </h1>
                <p className="text-sm sm:text-base text-stone-600">
                  Đăng nhập để truy cập vào nền tảng Petties
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div
                  className="border-brutal bg-red-50 border-red-300 p-3 mb-5 shadow-brutal-sm"
                  role="alert"
                >
                  <p className="text-xs sm:text-sm font-medium text-red-800">{error}</p>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Username Field */}
                <div>
                  <label
                    htmlFor="username"
                    className="block text-xs font-bold text-stone-900 mb-2 uppercase tracking-wide"
                  >
                    Tên đăng nhập
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

                {/* Password Field */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-bold text-stone-900 mb-2 uppercase tracking-wide"
                  >
                    Mật khẩu
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    required
                    disabled={isLoading}
                    className="input-brutal text-sm"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full btn-brutal text-sm sm:text-base py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center my-6">
                <div className="flex-1 h-1 bg-stone-300"></div>
                <span className="px-4 text-xs font-bold text-stone-500 uppercase tracking-wide">Hoặc</span>
                <div className="flex-1 h-1 bg-stone-300"></div>
              </div>

              {/* Google Sign-In Button */}
              <div className="flex justify-center">
                <div className="border-brutal bg-white shadow-brutal-sm hover:shadow-brutal transition-all duration-200 hover:translate-x-[-2px] hover:translate-y-[-2px]">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    useOneTap={false}
                    text="signin_with"
                    shape="rectangular"
                    theme="outline"
                    size="large"
                    width="280"
                  />
                </div>
              </div>

              {/* Additional Info */}
              <div className="mt-6 pt-5 border-t-4 border-stone-200">
                <p className="text-xs text-stone-600 text-center">
                  Quên mật khẩu?{' '}
                  <Link to="/auth/forgot-password" className="font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer transition-colors">
                    Khôi phục ngay
                  </Link>
                </p>
                <p className="text-xs text-stone-600 text-center mt-3">
                  Chưa có tài khoản?{' '}
                  <Link
                    to="/register"
                    className="font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer transition-colors"
                  >
                    Đăng ký tại đây
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
                CHĂM SÓC THÚ CƯNG
                <br />
                DỄ DÀNG HƠN
              </h2>
              <p className="text-lg text-stone-700 leading-relaxed">
                Nền tảng kết nối chủ nuôi thú cưng với bác sĩ thú y chuyên nghiệp
              </p>
            </div>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-3 justify-center">
              <div className="border-brutal bg-white px-4 py-2 shadow-brutal-sm flex items-center gap-2 transition-all duration-200 hover:translate-x-[-3px] hover:translate-y-[-3px] hover:shadow-[7px_7px_0_#1c1917] cursor-default">
                <HomeIcon className="w-5 h-5 text-stone-900" />
                <span className="text-sm font-bold text-stone-900">Đặt lịch tại nhà</span>
              </div>
              <div className="border-brutal bg-white px-4 py-2 shadow-brutal-sm flex items-center gap-2 transition-all duration-200 hover:translate-x-[-3px] hover:translate-y-[-3px] hover:shadow-[7px_7px_0_#1c1917] cursor-default">
                <CpuChipIcon className="w-5 h-5 text-stone-900" />
                <span className="text-sm font-bold text-stone-900">AI Tư vấn 24/7</span>
              </div>
              <div className="border-brutal bg-white px-4 py-2 shadow-brutal-sm flex items-center gap-2 transition-all duration-200 hover:translate-x-[-3px] hover:translate-y-[-3px] hover:shadow-[7px_7px_0_#1c1917] cursor-default">
                <ClipboardDocumentListIcon className="w-5 h-5 text-stone-900" />
                <span className="text-sm font-bold text-stone-900">Hồ sơ điện tử</span>
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
    </GoogleOAuthProvider>
  )
}
