import { useState, useEffect, createContext, useContext, useCallback, type ReactNode } from 'react'
import '../styles/brutalist.css'

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
    id: string
    type: ToastType
    message: string
    duration?: number
}

interface ToastContextType {
    showToast: (type: ToastType, message: string, duration?: number) => void
    hideToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

// Toast Provider
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const showToast = useCallback((type: ToastType, message: string, duration = 5000) => {
        const id = Date.now().toString()
        setToasts((prev) => [...prev, { id, type, message, duration }])
    }, [])

    const hideToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ showToast, hideToast }}>
            {children}
            <ToastContainer toasts={toasts} onClose={hideToast} />
        </ToastContext.Provider>
    )
}

// Hook to use toast
export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}

// Toast Container
function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onClose={onClose} />
            ))}
        </div>
    )
}

// Single Toast Item
function ToastItem({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // Animate in
        requestAnimationFrame(() => setIsVisible(true))

        // Auto dismiss
        const timer = setTimeout(() => {
            setIsVisible(false)
            setTimeout(() => onClose(toast.id), 300)
        }, toast.duration || 5000)

        return () => clearTimeout(timer)
    }, [toast.id, toast.duration, onClose])

    const getStyles = () => {
        switch (toast.type) {
            case 'success':
                return {
                    bg: 'bg-green-500',
                    icon: '✅',
                    border: 'border-green-700'
                }
            case 'error':
                return {
                    bg: 'bg-red-500',
                    icon: '❌',
                    border: 'border-red-700'
                }
            case 'warning':
                return {
                    bg: 'bg-amber-500',
                    icon: '⚠️',
                    border: 'border-amber-700'
                }
            case 'info':
                return {
                    bg: 'bg-blue-500',
                    icon: 'ℹ️',
                    border: 'border-blue-700'
                }
        }
    }

    const styles = getStyles()

    return (
        <div
            className={`
        ${styles.bg} ${styles.border}
        border-4 border-stone-900 shadow-brutal
        p-4 flex items-start gap-3
        transform transition-all duration-300
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
        >
            <span className="text-xl flex-shrink-0">{styles.icon}</span>
            <p className="text-white font-semibold text-sm flex-1">{toast.message}</p>
            <button
                onClick={() => {
                    setIsVisible(false)
                    setTimeout(() => onClose(toast.id), 300)
                }}
                className="text-white hover:text-stone-200 font-bold text-lg leading-none"
            >
                ×
            </button>
        </div>
    )
}

export default ToastProvider
