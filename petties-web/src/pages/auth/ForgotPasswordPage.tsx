import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { forgotPassword } from '../../services/endpoints/auth'
import { useToast } from '../../components/Toast'
import { EnvelopeIcon, ArrowLeftIcon, KeyIcon } from '@heroicons/react/24/outline'
import '../../styles/brutalist.css'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await forgotPassword({ email })

      showToast('success', response.message)

      // Navigate to reset password page with email in state
      navigate('/auth/reset-password', {
        state: {
          email,
          expiryMinutes: response.expiryMinutes,
          resendCooldownSeconds: response.resendCooldownSeconds
        }
      })
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Không thể gửi mã OTP. Vui lòng thử lại.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-stone-50 flex">
      {/* Left Side - Forgot Password Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-sm w-full">
          {/* Back to Login Link */}
          <Link
            to="/login"
            className="group inline-flex items-center gap-2 text-stone-900 font-bold hover:text-amber-700 mb-8 transition-colors cursor-pointer"
          >
            <ArrowLeftIcon className="w-5 h-5 text-stone-900 group-hover:text-amber-700 transition-colors" />
            <span className="text-sm font-bold text-stone-900">Quay lại đăng nhập</span>
          </Link>

          {/* Forgot Password Card */}
          <div className="border-brutal bg-white shadow-brutal p-6 sm:p-8">
            {/* Logo & Title */}
            <div className="text-center mb-6">
              <div className="mb-4">
                <span className="text-3xl sm:text-4xl font-bold text-amber-600 tracking-tight">
                  PETTIES
                </span>
              </div>
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 border-brutal bg-amber-100 flex items-center justify-center shadow-brutal-sm">
                  <KeyIcon className="w-8 h-8 text-stone-900" />
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-3 uppercase tracking-tight">
                QUÊN MẬT KHẨU
              </h1>
              <p className="text-sm sm:text-base text-stone-600">
                Nhập email để nhận mã OTP khôi phục mật khẩu
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

            {/* Forgot Password Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-bold text-stone-900 mb-2 uppercase tracking-wide"
                >
                  Email *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <EnvelopeIcon className="w-5 h-5 text-stone-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Nhập địa chỉ email"
                    required
                    disabled={isLoading}
                    className="input-brutal text-sm !pl-10"
                  />
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  Mã OTP sẽ được gửi đến email này và có hiệu lực trong 5 phút
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-brutal text-sm sm:text-base py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  'ĐANG GỬI MÃ OTP...'
                ) : (
                  <>
                    <EnvelopeIcon className="w-5 h-5" />
                    GỬI MÃ OTP
                  </>
                )}
              </button>
            </form>

            {/* Additional Info */}
            <div className="mt-6 pt-5 border-t-4 border-stone-200">
              <p className="text-xs text-stone-600 text-center">
                Nhớ mật khẩu?{' '}
                <Link
                  to="/login"
                  className="font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer transition-colors"
                >
                  Đăng nhập ngay
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
              KHÔI PHỤC
              <br />
              TÀI KHOẢN
            </h2>
            <p className="text-lg text-stone-700 leading-relaxed">
              Chúng tôi sẽ gửi mã xác thực đến email của bạn để đặt lại mật khẩu
            </p>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-3 justify-center">
            <div className="border-brutal bg-white px-4 py-2 shadow-brutal-sm flex items-center gap-2">
              <KeyIcon className="w-5 h-5 text-stone-900" />
              <span className="text-sm font-bold text-stone-900">Bảo mật cao</span>
            </div>
            <div className="border-brutal bg-white px-4 py-2 shadow-brutal-sm flex items-center gap-2">
              <EnvelopeIcon className="w-5 h-5 text-stone-900" />
              <span className="text-sm font-bold text-stone-900">Xác thực qua email</span>
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
