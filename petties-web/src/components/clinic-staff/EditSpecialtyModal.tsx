import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { StaffSpecialty } from '../../types/clinicStaff'
import { SPECIALTY_LABELS } from '../../types/clinicStaff'

interface EditSpecialtyModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (specialty: StaffSpecialty) => Promise<void>
    currentSpecialty?: StaffSpecialty
    staffName: string
}

/**
 * Edit Specialty Modal - Neobrutalism Design
 * Allow editing staff specialty (VET only)
 */
export function EditSpecialtyModal({
    isOpen,
    onClose,
    onSubmit,
    currentSpecialty = 'VET_GENERAL',
    staffName,
}: EditSpecialtyModalProps) {
    const [specialty, setSpecialty] = useState<StaffSpecialty>(currentSpecialty)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsSubmitting(true)

        try {
            await onSubmit(specialty)
            onClose()
        } catch (err: any) {
            setError(err?.userMessage || err?.message || 'Có lỗi xảy ra')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        if (!isSubmitting) {
            setSpecialty(currentSpecialty)
            setError(null)
            onClose()
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-stone-900/50"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md card-brutal p-0 bg-white">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b-4 border-stone-900">
                    <h2 className="text-lg font-bold uppercase text-stone-900">
                        CHỈNH SỬA CHUYÊN MÔN
                    </h2>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="p-1 hover:bg-stone-100 transition-colors"
                    >
                        <XMarkIcon className="w-6 h-6 text-stone-900" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-100 border-4 border-red-600 text-red-800 font-bold text-sm">
                            {error}
                        </div>
                    )}

                    {/* Staff Name */}
                    <div className="p-3 bg-stone-100 border-2 border-stone-900">
                        <p className="text-xs font-bold text-stone-500 uppercase">NHÂN VIÊN</p>
                        <p className="text-lg font-bold text-stone-900">{staffName}</p>
                    </div>

                    {/* Specialty Selector - Card Style */}
                    <div>
                        <label className="block text-sm font-bold uppercase text-stone-700 mb-3">
                            CHỌN CHUYÊN MÔN
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            {(Object.keys(SPECIALTY_LABELS) as StaffSpecialty[]).map((key) => {
                                const isSelected = specialty === key
                                const colorClasses: Record<StaffSpecialty, string> = {
                                    VET_GENERAL: 'border-blue-500 bg-blue-50',
                                    VET_SURGERY: 'border-purple-500 bg-purple-50',
                                    VET_DENTAL: 'border-cyan-500 bg-cyan-50',
                                    VET_DERMATOLOGY: 'border-pink-500 bg-pink-50',
                                    GROOMER: 'border-orange-500 bg-orange-50',
                                }
                                return (
                                    <label
                                        key={key}
                                        className={`
                                            flex items-center gap-3 p-3 cursor-pointer
                                            border-4 font-bold uppercase text-sm
                                            transition-all
                                            ${isSelected
                                                ? `border-stone-900 ${colorClasses[key]} shadow-[4px_4px_0_#1c1917]`
                                                : 'border-stone-300 bg-white hover:border-stone-400'}
                                        `}
                                    >
                                        <input
                                            type="radio"
                                            name="specialty"
                                            value={key}
                                            checked={isSelected}
                                            onChange={() => setSpecialty(key)}
                                            disabled={isSubmitting}
                                            className="sr-only"
                                        />
                                        <div className={`
                                            w-5 h-5 border-4 border-stone-900 flex items-center justify-center
                                            ${isSelected ? 'bg-amber-500' : 'bg-white'}
                                        `}>
                                            {isSelected && <div className="w-2 h-2 bg-stone-900" />}
                                        </div>
                                        <span className={isSelected ? 'text-stone-900' : 'text-stone-600'}>
                                            {SPECIALTY_LABELS[key]}
                                        </span>
                                    </label>
                                )
                            })}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1 py-2 bg-white text-stone-900 border-4 border-stone-900 font-bold uppercase text-sm shadow-[4px_4px_0_#000] hover:bg-stone-50 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                        >
                            HỦY
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-2 bg-amber-600 text-white border-4 border-stone-900 font-bold uppercase text-sm shadow-[4px_4px_0_#000] hover:bg-amber-700 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
