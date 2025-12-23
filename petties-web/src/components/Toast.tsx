import { useState, useEffect, createContext, useContext, useCallback, useRef, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
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
    // Use a counter ref for unique IDs to prevent duplicate keys
    const idCounter = useRef(0)

    const showToast = useCallback((type: ToastType, message: string, duration = 5000) => {
        // Generate unique ID using counter + timestamp
        const id = `toast-${++idCounter.current}-${Date.now()}`
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
                    bg: 'bg-[#22c55e]',
                    icon: CheckCircle2,
                    iconBg: 'bg-[#15803d]',
                }
            case 'error':
                return {
                    bg: 'bg-[#ef4444]',
                    icon: AlertCircle,
                    iconBg: 'bg-[#b91c1c]',
                }
            case 'warning':
                return {
                    bg: 'bg-[#f59e0b]',
                    icon: AlertTriangle,
                    iconBg: 'bg-[#b45309]',
                }
            case 'info':
                return {
                    bg: 'bg-[#3b82f6]',
                    icon: Info,
                    iconBg: 'bg-[#1d4ed8]',
                }
        }
    }

    const styles = getStyles()

    return (
        <div
            className={`
        ${styles.bg} 
        border-[4px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]
        p-4 flex items-center gap-4 min-w-[320px]
        transform transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
      `}
        >
            <div className={`p-1.5 border-2 border-black ${styles.iconBg} shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
                <styles.icon size={20} className="text-white" strokeWidth={3} />
            </div>

            <p className="text-black font-black uppercase text-sm flex-1 tracking-tight">{toast.message}</p>

            <button
                onClick={() => {
                    setIsVisible(false)
                    setTimeout(() => onClose(toast.id), 300)
                }}
                className="w-8 h-8 flex items-center justify-center bg-black text-white border-2 border-black hover:bg-gray-800 transition-all active:translate-x-[2px] active:translate-y-[2px]"
            >
                <X size={18} strokeWidth={3} />
            </button>
        </div>
    )
}

export default ToastProvider
