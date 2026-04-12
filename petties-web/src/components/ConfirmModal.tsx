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
    cancelLabel = 'QUAY LẠI',
    onConfirm,
    onCancel,
    isDanger = false,
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/20 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="w-full max-w-lg bg-white border-[3px] border-stone-900 shadow-[12px_12px_0_0_#1c1917] flex flex-col animate-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="px-8 py-6 flex items-start justify-between border-b-[3px] border-stone-900 bg-stone-50">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 border-2 border-stone-900 shadow-[3px_3px_0_0_#1c1917] ${isDanger ? 'bg-red-500 text-white' : 'bg-orange-400 text-white'}`}>
                            <ExclamationTriangleIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-black text-stone-900 text-xl tracking-tight leading-none uppercase">{title}</h3>
                            <p className="text-stone-500 text-[10px] uppercase tracking-[0.2em] font-black mt-1">Yêu cầu xác nhận</p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-1.5 border-2 border-stone-900 hover:bg-red-500 hover:text-white transition-colors text-stone-900 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none shadow-[2px_2px_0_0_#1c1917]"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-10">
                    <p className="text-stone-900 font-bold text-lg leading-relaxed text-center mb-10 italic">
                        {message}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center justify-center gap-6">
                        <button
                            onClick={onCancel}
                            className="py-3 px-8 border-[3px] border-stone-900 bg-white text-stone-900 font-black text-sm uppercase tracking-widest hover:bg-stone-100 transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none shadow-[4px_4px_0_0_#1c1917]"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`py-3 px-10 border-[3px] border-stone-900 text-white font-black text-sm uppercase tracking-widest transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none shadow-[4px_4px_0_0_#1c1917] ${isDanger
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-orange-500 hover:bg-orange-600'
                                }`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
