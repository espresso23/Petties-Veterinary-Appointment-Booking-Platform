import { useEffect, type ReactNode } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl'
    showCloseButton?: boolean
}

const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-5xl',
}

export const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'lg',
    showCloseButton = true,
}: ModalProps) => {
    useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="absolute inset-0" onClick={onClose} />
            <div
                role="dialog"
                aria-modal="true"
                className={`animate-scaleIn relative mx-auto flex max-h-[90vh] w-full ${sizeClasses[size]} flex-col overflow-hidden rounded-[28px] border-[3px] border-stone-900 bg-white shadow-[10px_10px_0_0_#1c1917]`}
            >
                <div className="flex items-center justify-between border-b-[3px] border-stone-900 bg-stone-50 px-6 py-4">
                    <div>
                        {title ? <h3 className="text-lg font-black uppercase tracking-tight text-stone-900">{title}</h3> : null}
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Hỗ trợ bác sĩ trong cùng một cửa sổ</p>
                    </div>
                    {showCloseButton ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border-2 border-stone-900 bg-white p-2 text-stone-900 shadow-[2px_2px_0_0_#1c1917] transition-colors hover:bg-red-500 hover:text-white active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    ) : null}
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {children}
                </div>
            </div>
        </div>
    )
}

export default Modal
