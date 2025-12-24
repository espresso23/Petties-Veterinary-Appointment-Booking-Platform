import { ExclamationCircleIcon, XMarkIcon } from '@heroicons/react/24/solid'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  variant = 'danger',
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const variantColors = {
    danger: { bg: '#ffcdd2', icon: '#d32f2f', button: '#f44336' },
    warning: { bg: '#fff9c4', icon: '#f57c00', button: '#ff9800' },
    info: { bg: '#bbdefb', icon: '#1976d2', button: '#2196f3' },
  }

  const colors = variantColors[variant]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] animate-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{ backgroundColor: colors.bg }}
          className="border-b-4 border-black p-6 flex justify-between items-start"
        >
          <div className="flex items-start gap-3 flex-1">
            <div
              className="p-2 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              style={{ color: colors.icon }}
            >
              <ExclamationCircleIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase text-black leading-tight">
                {title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-white border-2 border-black hover:bg-gray-100 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            style={{ color: '#000000' }}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-base font-bold text-gray-700 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="border-t-4 border-black p-6 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-6 bg-white text-black font-black uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            style={{ backgroundColor: colors.button }}
            className="flex-1 py-3 px-6 text-white font-black uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
