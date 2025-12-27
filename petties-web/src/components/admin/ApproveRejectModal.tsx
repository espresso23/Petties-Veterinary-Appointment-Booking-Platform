import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { ClinicResponse } from '../../types/clinic'

interface ApproveRejectModalProps {
  isOpen: boolean
  onClose: () => void
  clinic: ClinicResponse
  type: 'approve' | 'reject'
  onConfirm: (reason?: string) => void | Promise<void>
}

/**
 * Approve/Reject Modal - Neobrutalism Design
 * Form to approve or reject clinic with optional reason
 */
export const ApproveRejectModal = ({
  isOpen,
  onClose,
  clinic,
  type,
  onConfirm,
}: ApproveRejectModalProps) => {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (type === 'reject' && !reason.trim()) {
      return
    }
    setIsSubmitting(true)
    try {
      await onConfirm(type === 'reject' ? reason.trim() : (reason.trim() || undefined))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setReason('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div
        className="relative w-full max-w-2xl bg-white border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b-4 border-black p-6 ${
            type === 'approve' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          <h2 className="text-2xl font-black uppercase text-black">
            {type === 'approve' ? 'Duyệt phòng khám' : 'Từ chối phòng khám'}
          </h2>
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center bg-black text-white border-2 border-black hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.4)] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="border-4 border-black p-4 bg-stone-50">
            <h3 className="text-lg font-black uppercase text-black mb-2">Phòng khám</h3>
            <p className="text-base font-bold text-black">{clinic.name}</p>
            <p className="text-sm text-stone-600 mt-1">{clinic.address}</p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="reason"
              className="block text-sm font-black uppercase text-black"
            >
              {type === 'approve' ? 'Lý do duyệt (Tùy chọn)' : 'Lý do từ chối *'}
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required={type === 'reject'}
              rows={4}
              className="w-full p-3 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow font-bold text-black"
              placeholder={
                type === 'approve'
                  ? 'Nhập lý do duyệt (nếu có)...'
                  : 'Nhập lý do từ chối phòng khám này...'
              }
            />
            {type === 'reject' && (
              <p className="text-xs text-stone-600 font-bold">
                Lý do từ chối là bắt buộc và sẽ được gửi đến chủ sở hữu phòng khám.
              </p>
            )}
            {type === 'approve' && (
              <p className="text-xs text-stone-600 font-bold">
                Lý do duyệt là tùy chọn. Nếu có, sẽ được gửi đến chủ sở hữu phòng khám.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 px-6 bg-white text-black font-black uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (type === 'reject' && !reason.trim())}
              className={`flex-1 py-3 px-6  font-black uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                type === 'approve' ? 'bg-green-600' : 'bg-red-600'
              }`}
            >
              {isSubmitting
                ? 'ĐANG XỬ LÝ...'
                : type === 'approve'
                  ? 'DUYỆT'
                  : 'TỪ CHỐI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

