import React from 'react'
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/solid'

interface ConfirmModalProps {
    isOpen: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    onConfirm: () => void
    onCancel: () => void
    isDanger?: boolean
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'XÁC NHẬN',
    cancelLabel = 'HỦY BỎ',
    onConfirm,
    onCancel,
    isDanger = false,
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
            <div
                className="w-full max-w-md bg-white border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] rounded-2xl transform transition-all overflow-hidden"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className={`p-5 border-b-2 border-stone-900 flex items-center justify-between ${isDanger ? 'bg-red-100' : 'bg-amber-100'}`}>
                    <div className="flex items-center gap-3 text-stone-900">
                        <div className={`p-2 rounded-full border-2 border-stone-900 bg-white ${isDanger ? 'text-red-500' : 'text-amber-500'}`}>
                            <ExclamationTriangleIcon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg">{title}</h3>
                    </div>
                    <button onClick={onCancel} className="text-stone-900 hover:rotate-90 transition-transform bg-white rounded-full p-1 border-2 border-stone-900">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-stone-700 font-medium mb-8 text-base leading-relaxed">
                        {message}
                    </p>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-3 px-4 bg-white text-stone-900 border-2 border-stone-900 rounded-xl font-bold text-sm shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 py-3 px-4 text-white border-2 border-stone-900 rounded-xl font-bold text-sm shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all ${isDanger ? 'bg-red-500' : 'bg-stone-900'}`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
