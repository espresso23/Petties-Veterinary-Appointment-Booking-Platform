import { useState, useEffect, useRef } from 'react'
import { XMarkIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import { requestEmailChange, verifyEmailChange } from '../../services/api/userService'
import { isAxiosError } from 'axios'

interface EmailChangeModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  isLoading: boolean
}

const Step = {
  ENTER_EMAIL: 1,
  VERIFY_OTP: 2,
} as const

type StepType = typeof Step[keyof typeof Step]

export function EmailChangeModal({
  isOpen,
  onClose,
  onSuccess,
}: EmailChangeModalProps) {
  const [step, setStep] = useState<StepType>(Step.ENTER_EMAIL)
  const [newEmail, setNewEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(60)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [canResend, setCanResend] = useState(false)

  // Refs for OTP inputs
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer for resend OTP
  useEffect(() => {
    if (step === Step.VERIFY_OTP && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [step, countdown])

  // Auto-focus first OTP input when entering Step 2
  useEffect(() => {
    if (step === Step.VERIFY_OTP && otpInputRefs.current[0]) {
      otpInputRefs.current[0].focus()
    }
  }, [step])

  const resetForm = () => {
    setStep(Step.ENTER_EMAIL)
    setNewEmail('')
    setOtp(['', '', '', '', '', ''])
    setCountdown(60)
    setCanResend(false)
    setError('')
    setIsLoading(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!newEmail.trim()) {
      setError('Vui lòng nhập email mới')
      return
    }

    if (!validateEmail(newEmail)) {
      setError('Email không hợp lệ')
      return
    }

    setIsLoading(true)

    try {
      await requestEmailChange(newEmail)
      setStep(Step.VERIFY_OTP)
      setCountdown(60)
      setCanResend(false)
    } catch (error) {
      let message = 'Không thể gửi mã OTP'
      if (isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message
      } else if (error instanceof Error) {
        message = error.message
      }
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setError('')
    setIsLoading(true)

    try {
      await requestEmailChange(newEmail)
      setCountdown(60)
      setCanResend(false)
      setOtp(['', '', '', '', '', ''])
      if (otpInputRefs.current[0]) {
        otpInputRefs.current[0].focus()
      }
    } catch (error) {
      let message = 'Không thể gửi lại mã OTP'
      if (isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message
      } else if (error instanceof Error) {
        message = error.message
      }
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return // Only allow digits

    const newOtp = [...otp]
    newOtp[index] = value.slice(-1) // Only take last digit
    setOtp(newOtp)

    // Auto-focus next input
    if (value && index < 5 && otpInputRefs.current[index + 1]) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6)

    if (!/^\d+$/.test(pastedData)) return // Only allow digits

    const newOtp = [...otp]
    for (let i = 0; i < pastedData.length && i < 6; i++) {
      newOtp[i] = pastedData[i]
    }
    setOtp(newOtp)

    // Focus on last filled input or next empty one
    const nextIndex = Math.min(pastedData.length, 5)
    otpInputRefs.current[nextIndex]?.focus()
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const otpCode = otp.join('')

    if (otpCode.length !== 6) {
      setError('Vui lòng nhập đầy đủ 6 số OTP')
      return
    }

    setIsLoading(true)

    try {
      await verifyEmailChange(newEmail, otpCode)
      onSuccess()
    } catch (error) {
      let message = 'Mã OTP không chính xác'
      if (isAxiosError(error) && error.response?.data?.message) {
        message = error.response.data.message
      } else if (error instanceof Error) {
        message = error.message
      }
      setError(message)
      setOtp(['', '', '', '', '', ''])
      if (otpInputRefs.current[0]) {
        otpInputRefs.current[0].focus()
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-stone-900/70"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white border-4 border-stone-900 shadow-[8px_8px_0_#000]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-4 border-stone-900 bg-amber-500">
          <h2 className="text-xl font-bold text-stone-900 uppercase">
            ĐỔI EMAIL
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="p-1 hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="w-6 h-6 text-stone-900" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Step 1: Enter New Email */}
          {step === Step.ENTER_EMAIL && (
            <form onSubmit={handleRequestEmailChange} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-stone-900 uppercase mb-2">
                  Email mới
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-4 py-3 pl-11 border-4 border-stone-900 bg-white text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="Nhập email mới"
                    disabled={isLoading}
                  />
                  <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-600" />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-100 border-2 border-red-500">
                  <p className="text-red-700 text-sm font-semibold">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-stone-200 border-4 border-stone-900 font-bold text-stone-900 uppercase hover:bg-stone-300 transition-colors shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-amber-500 border-4 border-stone-900 font-bold text-stone-900 uppercase hover:bg-amber-400 transition-colors shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'ĐANG GỬI...' : 'GỬI MÃ OTP'}
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Verify OTP */}
          {step === Step.VERIFY_OTP && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div>
                <p className="text-sm text-stone-600 mb-4">
                  Mã OTP đã được gửi đến:{' '}
                  <span className="font-bold text-stone-900">{newEmail}</span>
                </p>

                <label className="block text-sm font-bold text-stone-900 uppercase mb-3">
                  Nhập mã OTP
                </label>

                {/* OTP Input Boxes */}
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpInputRefs.current[index] = el
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={index === 0 ? handleOtpPaste : undefined}
                      disabled={isLoading}
                      className="w-12 h-14 border-4 border-stone-900 bg-white text-center text-xl font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                    />
                  ))}
                </div>
              </div>

              {/* Resend OTP */}
              <div className="text-center">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={isLoading}
                    className="text-sm font-bold text-amber-600 hover:text-amber-700 uppercase disabled:opacity-50"
                  >
                    GỬI LẠI OTP
                  </button>
                ) : (
                  <p className="text-sm font-bold text-stone-500 uppercase">
                    Gửi lại OTP ({countdown}s)
                  </p>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-100 border-2 border-red-500">
                  <p className="text-red-700 text-sm font-semibold">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-stone-200 border-4 border-stone-900 font-bold text-stone-900 uppercase hover:bg-stone-300 transition-colors shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-amber-500 border-4 border-stone-900 font-bold text-stone-900 uppercase hover:bg-amber-400 transition-colors shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'ĐANG XÁC NHẬN...' : 'XÁC NHẬN'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmailChangeModal
