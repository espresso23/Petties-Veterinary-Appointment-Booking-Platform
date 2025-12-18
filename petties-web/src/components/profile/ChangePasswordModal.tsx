import { useState } from 'react'
import { XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import type { ChangePasswordRequest } from '../../services/api/userService'

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ChangePasswordRequest) => Promise<{ success: boolean; message: string }>
  isLoading: boolean
}

export function ChangePasswordModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const resetForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    setSuccess(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const validateForm = (): string | null => {
    if (!currentPassword) {
      return 'Vui lòng nhập mật khẩu hiện tại'
    }
    if (!newPassword) {
      return 'Vui lòng nhập mật khẩu mới'
    }
    if (newPassword.length < 8) {
      return 'Mật khẩu mới phải có ít nhất 8 ký tự'
    }
    if (newPassword !== confirmPassword) {
      return 'Xác nhận mật khẩu không khớp'
    }
    if (currentPassword === newPassword) {
      return 'Mật khẩu mới phải khác mật khẩu hiện tại'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    const result = await onSubmit({
      currentPassword,
      newPassword,
      confirmPassword,
    })

    if (result.success) {
      setSuccess(result.message)
      setTimeout(() => {
        handleClose()
      }, 2000)
    } else {
      setError(result.message)
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
      <div className="relative w-full max-w-md mx-4 bg-white border-4 border-stone-900 shadow-brutal">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-4 border-stone-900 bg-amber-500">
          <h2 className="text-xl font-bold text-stone-900 uppercase">
            ĐỔI MẬT KHẨU
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 hover:bg-amber-400 transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-stone-900" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-bold text-stone-900 uppercase mb-2">
              Mật khẩu hiện tại
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 border-4 border-stone-900 bg-white text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Nhập mật khẩu hiện tại"
                disabled={isLoading}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-900 focus:outline-none"
              >
                {showCurrentPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-bold text-stone-900 uppercase mb-2">
              Mật khẩu mới
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border-4 border-stone-900 bg-white text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
                disabled={isLoading}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-900 focus:outline-none"
              >
                {showNewPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-bold text-stone-900 uppercase mb-2">
              Xác nhận mật khẩu mới
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border-4 border-stone-900 bg-white text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Nhập lại mật khẩu mới"
                disabled={isLoading}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-900 focus:outline-none"
              >
                {showConfirmPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-100 border-2 border-red-500">
              <p className="text-red-700 text-sm font-semibold">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 bg-green-100 border-2 border-green-500">
              <p className="text-green-700 text-sm font-semibold">{success}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-stone-200 border-4 border-stone-900 font-bold text-stone-900 uppercase hover:bg-stone-300 transition-colors shadow-brutal disabled:opacity-50"
            >
              HỦY
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-amber-500 border-4 border-stone-900 font-bold text-stone-900 uppercase hover:bg-amber-400 transition-colors shadow-brutal disabled:opacity-50"
            >
              {isLoading ? 'ĐANG XỬ LÝ...' : 'ĐỔI MẬT KHẨU'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ChangePasswordModal
