import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { resetPassword, resendPasswordResetOtp } from '../../services/endpoints/auth'
import { useToast } from '../../components/Toast'
import { parseApiError } from '../../utils/errorHandler'
import { OtpInput } from '../../components/common/OtpInput'
import { KeyIcon, ArrowLeftIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import '../../styles/brutalist.css'

export function ResetPasswordPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { showToast } = useToast()

  // Get email from navigation state
  const stateEmail = location.state?.email as string | undefined
  const initialResendCooldown = location.state?.resendCooldownSeconds as number | undefined

  // Form fields
  const [email] = useState(stateEmail || '')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // UI state
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(initialResendCooldown || 60)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Countdown timer ref
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Redirect if no email provided
  useEffect(() => {
    if (!stateEmail) {
      showToast('error', 'Vui lòng nhập email trước')
      navigate('/auth/forgot-password', { replace: true })
    }
  }, [stateEmail, navigate, showToast])

  // Cleanup countdown timer
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
      }
    }
  }, [])

  // Start resend countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
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

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [resendCountdown])

  const handleSubmit = async () => {
    // Validation
    if (otpCode.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số mã OTP.')
      return
    }

    if (newPassword.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      const response = await resetPassword({
        email,
        otpCode,
        newPassword,
        confirmPassword
      })

      showToast('success', response.message)
      setIsSuccess(true)

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 2000)
    } catch (err: unknown) {
      setError(parseApiError(err))
      // Reset OTP input on error
      setOtpCode('')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return

    setError(null)
    setIsLoading(true)

    try {
      const response = await resendPasswordResetOtp(email)
      showToast('success', response.message)
      setResendCountdown(response.resendCooldownSeconds)
      setOtpCode('')
    } catch (err: unknown) {
      setError(parseApiError(err))
    } finally {
      setIsLoading(false)
    }
  }

  // Success view
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-100 to-stone-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="border-brutal bg-white shadow-brutal p-8 text-center">
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 border-brutal bg-green-100 flex items-center justify-center shadow-brutal">
                <CheckCircleIcon className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-stone-900 mb-3 uppercase tracking-tight">
              ĐỔI MẬT KHẨU THÀNH CÔNG
            </h2>
            <p className="text-stone-600 mb-4">
              Mật khẩu của bạn đã được cập nhật. Đang chuyển đến trang đăng nhập...
            </p>
            <Link
              to="/login"
              className="inline-block btn-brutal text-sm px-6 py-2"
            >
              ĐĂNG NHẬP NGAY
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-stone-50 flex">
      {/* Left Side - Reset Password Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-sm w-full">
          {/* Back to Forgot Password Link */}
          <Link
            to="/auth/forgot-password"
            className="group inline-flex items-center gap-2 text-stone-900 font-bold hover:text-amber-700 mb-8 transition-colors cursor-pointer"
          >
            <ArrowLeftIcon className="w-5 h-5 text-stone-900 group-hover:text-amber-700 transition-colors" />
            <span className="text-sm font-bold text-stone-900">Quay lại</span>
          </Link>

          {/* Reset Password Card */}
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
                ĐẶT LẠI MẬT KHẨU
              </h1>
              <p className="text-sm sm:text-base text-stone-600 mb-2">
                Nhập mã OTP đã được gửi đến
              </p>
              <p className="text-sm font-bold text-amber-600">
                {email}
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

            {/* Reset Password Form */}
            <div className="space-y-5">
              {/* OTP Input */}
              <div>
                <label className="block text-xs font-bold text-stone-900 mb-3 uppercase tracking-wide text-center">
                  Mã OTP (6 chữ số)
                </label>
                <OtpInput
                  length={6}
                  value={otpCode}
                  onChange={setOtpCode}
                  disabled={isLoading}
                  autoFocus
                />
                <p className="text-xs text-stone-500 text-center mt-2">
                  Mã có hiệu lực trong <span className="font-bold text-amber-600">5 phút</span>
                </p>
              </div>

              {/* New Password Field */}
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-xs font-bold text-stone-900 mb-2 uppercase tracking-wide"
                >
                  Mật khẩu mới *
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới (ít nhất 8 ký tự)"
                    required
                    minLength={8}
                    disabled={isLoading}
                    className="input-brutal text-sm !pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="w-5 h-5 text-stone-400 hover:text-stone-600" />
                    ) : (
                      <EyeIcon className="w-5 h-5 text-stone-400 hover:text-stone-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-bold text-stone-900 mb-2 uppercase tracking-wide"
                >
                  Xác nhận mật khẩu *
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    required
                    disabled={isLoading}
                    className="input-brutal text-sm !pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="w-5 h-5 text-stone-400 hover:text-stone-600" />
                    ) : (
                      <EyeIcon className="w-5 h-5 text-stone-400 hover:text-stone-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || otpCode.length !== 6 || !newPassword || !confirmPassword}
                className="w-full btn-brutal text-sm sm:text-base py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  'ĐANG XỬ LÝ...'
                ) : (
                  <>
                    <KeyIcon className="w-5 h-5" />
                    ĐẶT LẠI MẬT KHẨU
                  </>
                )}
              </button>

              {/* Resend OTP Button */}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isLoading || resendCountdown > 0}
                className="w-full btn-brutal-outline text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendCountdown > 0
                  ? `GỬI LẠI MÃ (${resendCountdown}s)`
                  : 'GỬI LẠI MÃ OTP'
                }
              </button>
            </div>

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
              BẢO MẬT
              <br />
              TÀI KHOẢN
            </h2>
            <p className="text-lg text-stone-700 leading-relaxed">
              Đặt mật khẩu mạnh để bảo vệ tài khoản của bạn
            </p>
          </div>

          {/* Security Tips */}
          <div className="border-brutal bg-white p-6 shadow-brutal-sm max-w-md">
            <h3 className="text-sm font-bold text-stone-900 mb-3 uppercase">Mẹo tạo mật khẩu mạnh</h3>
            <ul className="text-xs text-stone-600 space-y-2 text-left">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>Sử dụng ít nhất 8 ký tự</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>Không sử dụng thông tin cá nhân dễ đoán</span>
              </li>
            </ul>
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
