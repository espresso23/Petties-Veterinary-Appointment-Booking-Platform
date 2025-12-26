import { useEffect } from 'react'
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastProps {
  type: ToastType
  message: string
  onClose: () => void
  duration?: number
}

/**
 * Toast Notification Component - Neobrutalism Style
 *
 * Auto-closes after duration (default 5s)
 * Features:
 * - 4 types: success, error, warning, info
 * - Thick borders, offset shadows (no blur)
 * - No rounded corners
 */
export const Toast = ({ type, message, onClose, duration = 5000 }: ToastProps) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const config = {
    success: {
      icon: CheckCircleIcon,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-600',
      textColor: 'text-green-900',
      iconColor: 'text-green-600'
    },
    error: {
      icon: XCircleIcon,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-600',
      textColor: 'text-red-900',
      iconColor: 'text-red-600'
    },
    warning: {
      icon: ExclamationTriangleIcon,
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-600',
      textColor: 'text-amber-900',
      iconColor: 'text-amber-600'
    },
    info: {
      icon: InformationCircleIcon,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-600',
      textColor: 'text-blue-900',
      iconColor: 'text-blue-600'
    }
  }

  const { icon: Icon, bgColor, borderColor, textColor, iconColor } = config[type]

  return (
    <div
      className={`
        ${bgColor} ${borderColor} ${textColor}
        border-4 shadow-brutal-lg
        px-4 py-3 flex items-start gap-3 min-w-[320px] max-w-md
        animate-slide-in-right
      `}
      role="alert"
    >
      <Icon className={`w-6 h-6 flex-shrink-0 ${iconColor}`} />
      <p className="flex-1 text-sm font-medium leading-relaxed">{message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 hover:bg-black/5 transition-colors cursor-pointer"
        aria-label="Close notification"
      >
        <XMarkIcon className="w-5 h-5" />
      </button>
    </div>
  )
}

/**
 * Toast Container Component
 * Positions toasts in top-right corner
 */
interface ToastContainerProps {
  children: React.ReactNode
}

export const ToastContainer = ({ children }: ToastContainerProps) => {
  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
    >
      {children}
    </div>
  )
}
