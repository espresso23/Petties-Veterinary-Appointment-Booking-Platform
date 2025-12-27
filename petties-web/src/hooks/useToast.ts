import { useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

/**
 * useToast Hook
 *
 * Manages toast notifications state
 *
 * Usage:
 * ```tsx
 * const { toasts, showToast, removeToast } = useToast()
 *
 * // Show success
 * showToast('success', 'Document uploaded!')
 *
 * // Show error
 * showToast('error', 'Upload failed: Invalid file type')
 * ```
 */
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, type, message }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showSuccess = useCallback((message: string) => {
    showToast('success', message)
  }, [showToast])

  const showError = useCallback((message: string) => {
    showToast('error', message)
  }, [showToast])

  const showWarning = useCallback((message: string) => {
    showToast('warning', message)
  }, [showToast])

  const showInfo = useCallback((message: string) => {
    showToast('info', message)
  }, [showToast])

  return {
    toasts,
    showToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  }
}
